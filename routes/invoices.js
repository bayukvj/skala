import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET invoices
router.get('/', (req, res) => {
  const { status, customer_id } = req.query;
  let sql = `SELECT i.*, c.name as customer_name,
    (i.total - i.paid_amount) as remaining
    FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND i.status=?'; params.push(status); }
  if (customer_id) { sql += ' AND i.customer_id=?'; params.push(customer_id); }
  sql += ' ORDER BY i.date DESC, i.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET single invoice with items
router.get('/:id', (req, res) => {
  const i = db.prepare(`
    SELECT i.*, c.name as customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.id=?
  `).get(req.params.id);
  if (!i) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
  i.items = db.prepare(`
    SELECT ii.*, a.name as revenue_account_name, p.name as product_name, p.sku as product_sku
    FROM invoice_items ii
    LEFT JOIN accounts a ON a.id=ii.revenue_account_id
    LEFT JOIN products p ON p.id=ii.product_id
    WHERE ii.invoice_id=? ORDER BY ii.id
  `).all(req.params.id);
  res.json(i);
});

// POST create invoice
router.post('/', (req, res) => {
  const { invoice_no, date, customer_id, due_date, items, tax, notes, status, create_journal } = req.body;
  if (!invoice_no || !date || !customer_id) {
    return res.status(400).json({ error: 'invoice_no, date, customer_id wajib' });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items wajib (min 1)' });
  }

  // Hitung subtotal & total
  let subtotal = 0;
  for (const it of items) {
    it.qty = Number(it.qty) || 1;
    it.price = Number(it.price) || 0;
    it.amount = it.qty * it.price;
    subtotal += it.amount;
  }
  const taxAmt = Number(tax) || 0;
  const total = subtotal + taxAmt;

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (invoice_no, date, customer_id, due_date, subtotal, tax, total, status, notes)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, description, qty, price, amount, product_id, revenue_account_id)
    VALUES (?,?,?,?,?,?,?)
  `);

  try {
    const result = db.transaction(() => {
      const info = insertInvoice.run(invoice_no, date, customer_id, due_date || null, subtotal, taxAmt, total, status || 'draft', notes || null);
      const invId = info.lastInsertRowid;
      for (const it of items) {
        insertItem.run(invId, it.description, it.qty, it.price, it.amount, it.product_id || null, it.revenue_account_id || null);
      }
      return invId;
    })();
    res.status(201).json({ id: result, total });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Nomor invoice sudah ada' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update invoice (hanya jika belum dikirim/lunas)
router.put('/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
  if (inv.status === 'paid') return res.status(400).json({ error: 'Invoice sudah lunas, tidak bisa diubah' });

  const { invoice_no, date, customer_id, due_date, items, tax, notes, status } = req.body;
  let subtotal = 0;
  const cleanItems = (items || []).map(it => {
    it.qty = Number(it.qty) || 1;
    it.price = Number(it.price) || 0;
    it.amount = it.qty * it.price;
    subtotal += it.amount;
    return it;
  });
  const taxAmt = Number(tax) || 0;
  const total = subtotal + taxAmt;

  const updateItems = db.transaction(() => {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(req.params.id);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, description, qty, price, amount, product_id, revenue_account_id)
      VALUES (?,?,?,?,?,?,?)
    `);
    for (const it of cleanItems) {
      insertItem.run(req.params.id, it.description, it.qty, it.price, it.amount, it.product_id || null, it.revenue_account_id || null);
    }
    db.prepare(`
      UPDATE invoices SET invoice_no=?, date=?, customer_id=?, due_date=?, subtotal=?, tax=?, total=?, status=?, notes=?
      WHERE id=?
    `).run(invoice_no, date, customer_id, due_date || null, subtotal, taxAmt, total, status || inv.status, notes || null, req.params.id);
  });

  try {
    updateItems();
    res.json({ ok: true, total });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Nomor invoice sudah ada' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE invoice
router.delete('/:id', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
  if (inv.status === 'paid') return res.status(400).json({ error: 'Invoice sudah lunas, tidak bisa dihapus' });
  db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST kirim invoice (status draft -> sent, buat jurnal piutang)
router.post('/:id/send', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
  if (inv.status !== 'draft') return res.status(400).json({ error: 'Hanya invoice draft yang bisa dikirim' });

  // Cari akun Piutang (1003) dan revenue account default
  const receivableAccount = db.prepare(`SELECT id FROM accounts WHERE code='1003'`).get();
  if (!receivableAccount) return res.status(400).json({ error: 'Akun Piutang (1003) tidak ditemukan' });

  // Ambil revenue account dari item pertama yang punya, atau default 4001
  const firstItem = db.prepare(`SELECT revenue_account_id FROM invoice_items WHERE invoice_id=? AND revenue_account_id IS NOT NULL LIMIT 1`).get(req.params.id);
  const revenueAccountId = firstItem?.revenue_account_id || db.prepare(`SELECT id FROM accounts WHERE code='4001'`).get()?.id;
  if (!revenueAccountId) return res.status(400).json({ error: 'Akun pendapatan tidak ditemukan' });

  const insertJournal = db.prepare(`INSERT INTO journals (date, ref_no, description) VALUES (?,?,?)`);
  const insertEntry = db.prepare(`INSERT INTO journal_entries (journal_id, account_id, debit, credit, note) VALUES (?,?,?,?,?)`);
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (product_id, warehouse_id, type, qty, reference_type, reference_id, notes)
    VALUES (?, ?, 'out', ?, 'invoice', ?, ?)
  `);

  const result = db.transaction(() => {
    const jid = insertJournal.run(inv.date, inv.invoice_no, `Invoice ${inv.invoice_no} - ${inv.customer_name || 'Penjualan'}`).lastInsertRowid;
    insertEntry.run(jid, receivableAccount.id, inv.total, 0, 'Piutang');
    insertEntry.run(jid, revenueAccountId, 0, inv.total, 'Pendapatan');

    // Kurangi stok untuk item yang punya product_id
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(req.params.id);
    for (const it of items) {
      if (it.product_id) {
        const prod = db.prepare('SELECT warehouse_id FROM products WHERE id=?').get(it.product_id);
        insertMovement.run(it.product_id, prod?.warehouse_id || null, it.qty, req.params.id, `Invoice ${inv.invoice_no}`);
      }
    }

    db.prepare(`UPDATE invoices SET status='sent', journal_id=? WHERE id=?`).run(jid, req.params.id);
    return jid;
  })();

  res.json({ ok: true, journal_id: result });
});

// POST tandai lunas (manual, tanpa jurnal pembayaran)
router.post('/:id/mark-paid', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
  db.prepare(`UPDATE invoices SET paid_amount=?, status='paid' WHERE id=?`).run(inv.total, req.params.id);
  res.json({ ok: true });
});

// POST pembayaran invoice (catat ke kas/bank + lunaskan piutang)
router.post('/:id/payments', (req, res) => {
  const { amount, payment_date, method, cash_account_id } = req.body;
  const { id } = req.params;
  const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(id);
  if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
  if (inv.status !== 'sent' && inv.status !== 'partial') return res.status(400).json({ error: 'Invoice belum dikirim' });
  const remaining = inv.total - inv.paid_amount;
  const payAmt = Number(amount) || remaining;
  if (payAmt > remaining) return res.status(400).json({ error: 'Jumlah melebihi sisa invoice' });

  const cashAcc = cash_account_id ? Number(cash_account_id) : db.prepare(`SELECT id FROM accounts WHERE code='1001'`).get()?.id;
  const receivableAccount = db.prepare(`SELECT id FROM accounts WHERE code='1003'`).get()?.id;

  const insertJournal = db.prepare(`INSERT INTO journals (date, ref_no, description) VALUES (?,?,?)`);
  const insertEntry = db.prepare(`INSERT INTO journal_entries (journal_id, account_id, debit, credit, note) VALUES (?,?,?,?,?)`);

  const result = db.transaction(() => {
    const jid = insertJournal.run(payment_date || new Date().toISOString().slice(0,10), `PAY-${inv.invoice_no}`, `Pembayaran invoice ${inv.invoice_no}`).lastInsertRowid;
    insertEntry.run(jid, cashAcc, payAmt, 0, 'Kas/Bank');
    insertEntry.run(jid, receivableAccount, 0, payAmt, 'Piutang');
    const newPaid = inv.paid_amount + payAmt;
    const newStatus = newPaid >= inv.total ? 'paid' : 'partial';
    db.prepare(`UPDATE invoices SET paid_amount=?, status=? WHERE id=?`).run(newPaid, newStatus, id);
    return jid;
  })();

  res.json({ ok: true, journal_id: result, remaining: inv.total - inv.paid_amount - payAmt });
});

export default router;