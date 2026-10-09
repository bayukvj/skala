import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET projects
router.get('/', (req, res) => {
  const { status, customer_id } = req.query;
  let sql = `SELECT p.*, c.name as customer_name, u.full_name as pic_name,
    (SELECT COALESCE(SUM(j.debit),0) FROM journal_entries j JOIN journals jrn ON jrn.id=j.journal_id WHERE jrn.project_id=p.id) as total_debit,
    (SELECT COALESCE(SUM(j.credit),0) FROM journal_entries j JOIN journals jrn ON jrn.id=j.journal_id WHERE jrn.project_id=p.id) as total_credit
    FROM projects p
    LEFT JOIN customers c ON c.id=p.customer_id
    LEFT JOIN users u ON u.id=p.pic_user_id
    WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND p.status=?'; params.push(status); }
  if (customer_id) { sql += ' AND p.customer_id=?'; params.push(customer_id); }
  sql += ' ORDER BY p.id DESC';
  const rows = db.prepare(sql).all(...params);
  const final = rows.map(p => {
    const totals = db.prepare(`
      SELECT COALESCE(SUM(je.debit),0) as debit, COALESCE(SUM(je.credit),0) as credit
      FROM journal_entries je JOIN journals j ON j.id=je.journal_id
      WHERE j.project_id=?
    `).get(p.id);
    p.total_debit = totals.debit;
    p.total_credit = totals.credit;
    p.total_cost = totals.debit;
    p.profit = totals.debit - totals.credit;
    return p;
  });
  res.json(final);
});

router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name as customer_name, u.full_name as pic_name
    FROM projects p
    LEFT JOIN customers c ON c.id=p.customer_id
    LEFT JOIN users u ON u.id=p.pic_user_id
    WHERE p.id=?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  const journals = db.prepare(`SELECT * FROM journals WHERE project_id=? ORDER BY date DESC`).all(req.params.id);
  p.journals = journals;
  res.json(p);
});

router.post('/', (req, res) => {
  const { name, code, customer_id, pic_user_id, budget, start_date, end_date, status, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name wajib' });
  const info = db.prepare(`INSERT INTO projects (name, code, customer_id, pic_user_id, budget, start_date, end_date, status, description)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(name, code||null, customer_id||null, pic_user_id||null, budget||0, start_date||null, end_date||null, status||'active', description||null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { name, code, customer_id, pic_user_id, budget, start_date, end_date, status, description } = req.body;
  const info = db.prepare(`UPDATE projects SET name=?, code=?, customer_id=?, pic_user_id=?, budget=?, start_date=?, end_date=?, status=?, description=? WHERE id=?`)
    .run(name, code||null, customer_id||null, pic_user_id||null, budget||0, start_date||null, end_date||null, status||'active', description||null, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

export default router;