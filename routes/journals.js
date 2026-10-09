import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET journals with entries
router.get('/', (req, res) => {
  const { limit = 100, offset = 0, date_from, date_to, project_id } = req.query;
  let sql = `SELECT j.*, p.name as project_name,
    (SELECT COALESCE(SUM(debit),0) - COALESCE(SUM(credit),0) FROM journal_entries je WHERE je.journal_id = j.id) as balance
    FROM journals j LEFT JOIN projects p ON p.id = j.project_id WHERE 1=1`;
  const params = [];
  if (date_from) { sql += ' AND j.date >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND j.date <= ?'; params.push(date_to); }
  if (project_id) { sql += ' AND j.project_id = ?'; params.push(project_id); }
  sql += ' ORDER BY j.date DESC, j.id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET single journal with entries
router.get('/:id', (req, res) => {
  const j = db.prepare('SELECT * FROM journals WHERE id = ?').get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Jurnal tidak ditemukan' });
  const entries = db.prepare(`
    SELECT je.*, a.name as account_name, a.type as account_type, a.code as account_code
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    WHERE je.journal_id = ? ORDER BY je.id
  `).all(req.params.id);
  j.entries = entries;
  res.json(j);
});

// POST create journal (double-entry validation)
router.post('/', (req, res) => {
  const { date, ref_no, description, project_id, entries } = req.body;
  if (!date || !entries || !Array.isArray(entries) || entries.length < 2) {
    return res.status(400).json({ error: 'Date dan entries (min 2) wajib' });
  }

  // Validate double-entry: total debit must equal total credit
  let totalDebit = 0, totalCredit = 0;
  for (const e of entries) {
    totalDebit += Number(e.debit) || 0;
    totalCredit += Number(e.credit) || 0;
  }
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({
      error: 'Double-entry tidak seimbang',
      detail: `Total debit (${totalDebit}) != total credit (${totalCredit})`
    });
  }

  // Validate each entry has account and either debit or credit
  for (const e of entries) {
    if (!e.account_id) return res.status(400).json({ error: 'account_id wajib untuk semua entry' });
    const d = Number(e.debit) || 0, c = Number(e.credit) || 0;
    if (d < 0 || c < 0) return res.status(400).json({ error: 'Debit/Kredit tidak boleh negatif' });
    if (d > 0 && c > 0) return res.status(400).json({ error: 'Satu entry tidak boleh punya debit dan credit bersamaan' });
    if (d === 0 && c === 0) return res.status(400).json({ error: 'Entry harus punya debit atau credit' });
  }

  const insertJournal = db.prepare(`
    INSERT INTO journals (date, ref_no, description, project_id)
    VALUES (?, ?, ?, ?)
  `);
  const insertEntry = db.prepare(`
    INSERT INTO journal_entries (journal_id, account_id, debit, credit, note)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTx = db.transaction(() => {
    const jinfo = insertJournal.run(date, ref_no || null, description || null, project_id || null);
    const jid = jinfo.lastInsertRowid;
    for (const e of entries) {
      insertEntry.run(jid, e.account_id, Number(e.debit) || 0, Number(e.credit) || 0, e.note || null);
    }
    return jid;
  });

  try {
    const jid = insertTx();
    res.status(201).json({ id: jid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE journal
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM journals WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Jurnal tidak ditemukan' });
  res.json({ ok: true });
});

// GET trial balance
router.get('/reports/trial-balance', (req, res) => {
  const { date_from, date_to } = req.query;
  let sql = `
    SELECT a.id, a.code, a.name, a.type,
      COALESCE(SUM(je.debit), 0) as total_debit,
      COALESCE(SUM(je.credit), 0) as total_credit
    FROM accounts a
    LEFT JOIN journal_entries je ON je.account_id = a.id
    LEFT JOIN journals j ON j.id = je.journal_id
    WHERE a.active = 1 AND a.is_header = 0
  `;
  const params = [];
  if (date_from) { sql += ' AND j.date >= ?'; params.push(date_from); }
  if (date_to) { sql += ' AND j.date <= ?'; params.push(date_to); }
  sql += ' GROUP BY a.id HAVING total_debit != 0 OR total_credit != 0 ORDER BY a.code';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

export default router;