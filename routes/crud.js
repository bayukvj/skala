import { Router } from 'express';
import db from '../db/connection.js';

function crudRouter({ table, fields, join }) {
  const router = Router();
  router.get('/', (req, res) => {
    let sql = `SELECT * FROM ${table} WHERE 1=1`;
    const params = [];
    if (req.query.search) { sql += ` AND name LIKE ?`; params.push(`%${req.query.search}%`); }
    sql += ' ORDER BY id DESC';
    res.json(db.prepare(sql).all(...params));
  });
  router.get('/:id', (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Tidak ditemukan' });
    res.json(row);
  });
  router.post('/', (req, res) => {
    const cols = fields.map(f => f.name);
    const placeholders = cols.map(() => '?').join(',');
    const values = cols.map(f => req.body[f.name] ?? f.default ?? null);
    const info = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).run(...values);
    res.status(201).json({ id: info.lastInsertRowid });
  });
  router.put('/:id', (req, res) => {
    const cols = fields.map(f => `${f.name}=?`).join(',');
    const values = cols.map((_, i) => req.body[fields[i].name] ?? null);
    values.push(req.params.id);
    db.prepare(`UPDATE ${table} SET ${cols} WHERE id=?`).run(...values);
    res.json({ ok: true });
  });
  router.delete('/:id', (req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ ok: true });
  });
  return router;
}

export const customersRouter = crudRouter({
  table: 'customers',
  fields: [
    { name: 'name' }, { name: 'phone' }, { name: 'email' }, { name: 'address' }
  ]
});

export const suppliersRouter = crudRouter({
  table: 'suppliers',
  fields: [
    { name: 'name' }, { name: 'phone' }, { name: 'email' }, { name: 'address' }
  ]
});

export default { customersRouter, suppliersRouter };