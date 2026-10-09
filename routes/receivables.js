import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET receivables
router.get('/', (req, res) => {
  const { status, customer_id } = req.query;
  let sql = `SELECT r.*, c.name as customer_name,
    (r.total_amount - r.paid_amount) as remaining
    FROM receivables r JOIN customers c ON c.id = r.customer_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (customer_id) { sql += ' AND r.customer_id = ?'; params.push(customer_id); }
  sql += ' ORDER BY r.due_date ASC, r.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET single
router.get('/:id', (req, res) => {
  const r = db.prepare(`SELECT r.*, c.name as customer_name FROM receivables r JOIN customers c ON c.id=r.customer_id WHERE r.id=?`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Tidak ditemukan' });
  const payments = db.prepare(`SELECT * FROM receivable_payments WHERE receivable_id=? ORDER BY payment_date DESC`).all(req.params.id);
  r.payments = payments;
  res.json(r);
});

// POST create receivable
router.post('/', (req, res) => {
  const { customer_id, total_amount, due_date, description } = req.body;
  if (!customer_id || !total_amount) return res.status(400).json({ error: 'customer_id & total_amount wajib' });
  const info = db.prepare(`
    INSERT INTO receivables (customer_id, total_amount, due_date, description)
    VALUES (?, ?, ?, ?)
  `).run(customer_id, total_amount, due_date || null, description || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// POST record payment
router.post('/:id/payments', (req, res) => {
  const { amount, payment_date, method, note } = req.body;
  const { id } = req.params;
  const r = db.prepare('SELECT * FROM receivables WHERE id=?').get(id);
  if (!r) return res.status(404).json({ error: 'Piutang tidak ditemukan' });
  if (amount > (r.total_amount - r.paid_amount)) return res.status(400).json({ error: 'Jumlah melebihi sisa piutang' });

  const updateStatus = (paid, total) => {
    let status = 'unpaid';
    if (paid >= total) status = 'paid';
    else if (paid > 0) status = 'partial';
    // overdue check
    if (status !== 'paid' && r.due_date && new Date(r.due_date) < new Date() && status !== 'paid') status = 'overdue';
    db.prepare('UPDATE receivables SET paid_amount=?, status=? WHERE id=?').run(paid, status, id);
  };

  const insertP = db.prepare('INSERT INTO receivable_payments (receivable_id, amount, payment_date, method, note) VALUES (?,?,?,?,?)');
  insertP.run(id, amount, payment_date || new Date().toISOString().slice(0,10), method || null, note || null);

  const newPaid = r.paid_amount + amount;
  updateStatus(newPaid, r.total_amount);
  res.json({ ok: true, remaining: r.total_amount - newPaid });
});

// PUT update status
router.put('/:id', (req, res) => {
  const { status, total_amount, due_date, description } = req.body;
  db.prepare('UPDATE receivables SET status=?, total_amount=?, due_date=?, description=? WHERE id=?')
    .run(status, total_amount, due_date, description, req.params.id);
  res.json({ ok: true });
});

export default router;