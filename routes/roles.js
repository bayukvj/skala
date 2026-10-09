import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// Daftar permission yang tersedia
export const PERMISSIONS = [
  { key: 'dashboard', label: 'Lihat Dashboard' },
  { key: 'journals', label: 'Jurnal & Buku Besar' },
  { key: 'transactions', label: 'Uang Masuk & Keluar' },
  { key: 'receivables', label: 'Piutang' },
  { key: 'payables', label: 'Hutang' },
  { key: 'projects', label: 'Proyek' },
  { key: 'reports', label: 'Laporan' },
  { key: 'accounts', label: 'Akun (COA)' },
  { key: 'users', label: 'Pengguna' },
  { key: 'roles', label: 'Role' },
  { key: 'settings', label: 'Pengaturan' },
];

// GET roles
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count
    FROM roles r ORDER BY r.id DESC
  `).all();
  res.json(rows);
});

// GET single role
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM roles WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Role tidak ditemukan' });
  res.json(row);
});

// POST create role
router.post('/', (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama role wajib' });
  const perms = Array.isArray(permissions) ? permissions : [];
  try {
    const info = db.prepare('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)')
      .run(name, description || null, JSON.stringify(perms));
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Nama role sudah ada' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update role
router.put('/:id', (req, res) => {
  const { name, description, permissions } = req.body;
  const perms = Array.isArray(permissions) ? permissions : [];
  const info = db.prepare('UPDATE roles SET name=?, description=?, permissions=? WHERE id=?')
    .run(name, description || null, JSON.stringify(perms), req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Role tidak ditemukan' });
  res.json({ ok: true });
});

// DELETE role
router.delete('/:id', (req, res) => {
  const used = db.prepare('SELECT COUNT(*) as c FROM users WHERE role_id=?').get(req.params.id).c;
  if (used > 0) return res.status(400).json({ error: `Role masih dipakai ${used} pengguna` });
  db.prepare('DELETE FROM roles WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// GET available permissions list
router.get('/list/permissions', (req, res) => {
  res.json(PERMISSIONS);
});

export default router;