import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/connection.js';

const router = Router();

const hashPassword = (pw) => crypto.createHash('sha256').update(String(pw)).digest('hex');

// GET users
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, r.name as role_name, r.permissions as role_permissions
    FROM users u LEFT JOIN roles r ON r.id = u.role_id
    ORDER BY u.id DESC
  `).all();
  res.json(rows);
});

// GET single user
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
  res.json(row);
});

// POST create user
router.post('/', (req, res) => {
  const { username, full_name, email, phone, password, role_id } = req.body;
  if (!username || !full_name || !password) {
    return res.status(400).json({ error: 'username, full_name, password wajib' });
  }
  try {
    const info = db.prepare(`
      INSERT INTO users (username, full_name, email, phone, password, role_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, full_name, email || null, phone || null, hashPassword(password), role_id || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username sudah digunakan' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update user
router.put('/:id', (req, res) => {
  const { username, full_name, email, phone, password, role_id, active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

  let info;
  if (password) {
    info = db.prepare(`
      UPDATE users SET username=?, full_name=?, email=?, phone=?, password=?, role_id=?, active=?
      WHERE id=?
    `).run(username, full_name, email || null, phone || null, hashPassword(password), role_id || null, active ? 1 : 0, req.params.id);
  } else {
    info = db.prepare(`
      UPDATE users SET username=?, full_name=?, email=?, phone=?, role_id=?, active=?
      WHERE id=?
    `).run(username, full_name, email || null, phone || null, role_id || null, active ? 1 : 0, req.params.id);
  }
  if (info.changes === 0) return res.status(404).json({ error: 'Gagal update' });
  res.json({ ok: true });
});

// DELETE user
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
  res.json({ ok: true });
});

// POST login (sederhana)
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare(`
    SELECT u.*, r.name as role_name, r.permissions as role_permissions
    FROM users u LEFT JOIN roles r ON r.id = u.role_id
    WHERE u.username = ? AND u.password = ? AND u.active = 1
  `).get(username, hashPassword(password));
  if (!user) return res.status(401).json({ error: 'Username atau password salah' });
  res.json({ ok: true, user: { id: user.id, username: user.username, full_name: user.full_name, role_name: user.role_name, role_permissions: user.role_permissions } });
});

export default router;