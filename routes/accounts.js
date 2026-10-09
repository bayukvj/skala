import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET all accounts (filter by type, active only by default)
router.get('/', (req, res) => {
  const { type, all, include_inactive } = req.query;
  let sql = 'SELECT * FROM accounts WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (include_inactive !== 'true') { sql += ' AND active = 1'; }
  sql += ' ORDER BY code ASC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET single account
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  res.json(row);
});

// POST create account
router.post('/', (req, res) => {
  const { code, name, type, parent_id, is_header, currency } = req.body;
  if (!code || !name || !type) return res.status(400).json({ error: 'code, name, type wajib' });
  const validTypes = ['asset','liability','equity','revenue','expense'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'type tidak valid' });
  try {
    const info = db.prepare(`
      INSERT INTO accounts (code, name, type, parent_id, is_header, currency)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, name, type, parent_id || null, is_header ? 1 : 0, currency || 'IDR');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Code akun sudah ada' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update account
router.put('/:id', (req, res) => {
  const { code, name, type, parent_id, is_header, currency, active } = req.body;
  const info = db.prepare(`
    UPDATE accounts SET code=?, name=?, type=?, parent_id=?, is_header=?, currency=?, active=?
    WHERE id=?
  `).run(code, name, type, parent_id || null, is_header ? 1 : 0, currency || 'IDR', active ? 1 : 0, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Akun tidak ditemukan' });
  res.json({ ok: true });
});

// DELETE account (soft delete)
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE accounts SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;