import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET payables
router.get('/', (req, res) => {
  const { status, supplier_id } = req.query;
  let sql = `SELECT p.*, s.name as supplier_name,
    (p.total_amount - p.paid_amount) as remaining
    FROM payables p JOIN suppliers s ON s.id = p.supplier_id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (supplier_id) { sql += ' AND p.supplier_id = ?'; params.push(supplier_id); }
  sql += ' ORDER BY p.due_date ASC, p.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET single
router.get('/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, s.name as supplier_name FROM payables p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Tidak ditemukan' });
  const payments = db.prepare('SELECT * FROM payable_payments WHERE payable_id=? ORDER BY payment_date DESC').all(req.params.id);
  p.payments = payments;
  res.json(p);
});

// POST create payable
router.post('/', (req, res) => {
  const { supplier_id, total_amount, due_date, description } = req.body;
  if (!supplier_id || !total_amount) return res.status(400).json({ error: 'supplier_id & total_amount wajib' });
  const info = db.prepare(`
    INSERT INTO payables (supplier_id, total_amount, due_date, description)
    VALUES (?, ?, ?, ?)
  `).run(supplier_id, total_amount, due_date || null, description || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// POST record payment
router.post('/:id/payments', (req, res) => {
  const { amount, payment_date, method, note } = req.body;
  const { id } = req.params;
  const p = db.prepare('SELECT * FROM payables WHERE id=?').get(id);
  if (!p) return res.status(404).json({ error: 'Hutang tidak ditemukan' });
  if (amount > (p.total_amount - p.paid_amount)) return res.status(400).json({ error: 'Jumlah melebihi sisa hutang' });

  const updateStatus = (paid, total) => {
    let status = 'unpaid';
    if (paid >= total) status = 'paid';
    else if (paid > 0) status = 'partial';
    if (status !== 'paid' && p.due_date && new Date(p.due_date) < new Date()) status = 'overdue';
    db.prepare('UPDATE payables SET paid_amount=?, status=? WHERE id=?').run(paid, status, id);
  };

  const insertP = db.prepare('INSERT INTO payable_payments (payable_id, amount, payment_date, method, note) VALUES (?,?,?,?,?)');
  insertP.run(id, amount, payment_date || new Date().toISOString().slice(0,10), method || null, note || null);

  const newPaid = p.paid_amount + amount;
  updateStatus(newPaid, p.total_amount);
  res.json({ ok: true, remaining: p.total_amount - newPaid });
});

// PUT update
router.put('/:id', (req, res) => {
  const { status, total_amount, due_date, description } = req.body;
  db.prepare('UPDATE payables SET status=?, total_amount=?, due_date=?, description=? WHERE id=?')
    .run(status, total_amount, due_date, description, req.params.id);
  res.json({ ok: true });
});

export default router;