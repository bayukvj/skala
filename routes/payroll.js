import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// ===== EMPLOYEES =====

router.get('/employees', (req, res) => {
  const rows = db.prepare(`SELECT * FROM employees WHERE active=1 ORDER BY name`).all();
  res.json(rows);
});

router.post('/employees', (req, res) => {
  const { name, employee_no, phone, email, address, base_salary, position } = req.body;
  if (!name) return res.status(400).json({ error: 'name wajib' });
  try {
    const info = db.prepare(`
      INSERT INTO employees (name, employee_no, phone, email, address, base_salary, position)
      VALUES (?,?,?,?,?,?,?)
    `).run(name, employee_no || null, phone || null, email || null, address || null, Number(base_salary) || 0, position || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/employees/:id', (req, res) => {
  const { name, employee_no, phone, email, address, base_salary, position, active } = req.body;
  const info = db.prepare(`
    UPDATE employees SET name=?, employee_no=?, phone=?, email=?, address=?, base_salary=?, position=?, active=?
    WHERE id=?
  `).run(name, employee_no || null, phone || null, email || null, address || null, Number(base_salary) || 0, position || null, active ? 1 : 0, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
  res.json({ ok: true });
});

router.delete('/employees/:id', (req, res) => {
  db.prepare('UPDATE employees SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ===== PAYROLL =====

// GET payroll list
router.get('/', (req, res) => {
  const { period, status } = req.query;
  let sql = `SELECT p.*, e.name as employee_name, e.employee_no, e.position
    FROM payrolls p JOIN employees e ON e.id = p.employee_id WHERE 1=1`;
  const params = [];
  if (period) { sql += ' AND p.period=?'; params.push(period); }
  if (status) { sql += ' AND p.status=?'; params.push(status); }
  sql += ' ORDER BY p.period DESC, p.id DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET single payroll
router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, e.name as employee_name, e.employee_no, e.position
    FROM payrolls p JOIN employees e ON e.id = p.employee_id WHERE p.id=?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
  res.json(p);
});

// POST create payroll (draft)
router.post('/', (req, res) => {
  const { period, employee_id, base_salary, allowances, deductions, notes, payment_date } = req.body;
  if (!period || !employee_id) return res.status(400).json({ error: 'period & employee_id wajib' });

  const base = Number(base_salary) || 0;
  const allow = Number(allowances) || 0;
  const ded = Number(deductions) || 0;
  const netPay = base + allow - ded;

  try {
    const info = db.prepare(`
      INSERT INTO payrolls (period, employee_id, base_salary, allowances, deductions, net_pay, payment_date, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(period, employee_id, base, allow, ded, netPay, payment_date || null, notes || null);
    res.status(201).json({ id: info.lastInsertRowid, net_pay: netPay });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update payroll (draft only)
router.put('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM payrolls WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
  if (p.status === 'paid') return res.status(400).json({ error: 'Payroll sudah dibayar, tidak bisa diubah' });

  const { period, employee_id, base_salary, allowances, deductions, notes, payment_date } = req.body;
  const base = Number(base_salary) || 0;
  const allow = Number(allowances) || 0;
  const ded = Number(deductions) || 0;
  const netPay = base + allow - ded;

  const info = db.prepare(`
    UPDATE payrolls SET period=?, employee_id=?, base_salary=?, allowances=?, deductions=?, net_pay=?, payment_date=?, notes=?
    WHERE id=?
  `).run(period, employee_id, base, allow, ded, netPay, payment_date || null, notes || null, req.params.id);
  res.json({ ok: true, net_pay: netPay });
});

// DELETE payroll (draft only)
router.delete('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM payrolls WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
  if (p.status === 'paid') return res.status(400).json({ error: 'Payroll sudah dibayar, tidak bisa dihapus' });
  db.prepare('DELETE FROM payrolls WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST proses payroll (bayar -> buat jurnal beban gaji + kas)
router.post('/:id/pay', (req, res) => {
  const { payment_date, cash_account_id } = req.body;
  const { id } = req.params;
  const p = db.prepare('SELECT * FROM payrolls WHERE id=?').get(id);
  if (!p) return res.status(404).json({ error: 'Payroll tidak ditemukan' });
  if (p.status === 'paid') return res.status(400).json({ error: 'Payroll sudah dibayar' });

  const salaryAccount = db.prepare(`SELECT id FROM accounts WHERE code='5001'`).get()?.id;
  const cashAcc = cash_account_id ? Number(cash_account_id) : db.prepare(`SELECT id FROM accounts WHERE code='1001'`).get()?.id;
  if (!salaryAccount || !cashAcc) return res.status(400).json({ error: 'Akun Beban Gaji (5001) atau Kas (1001) tidak ditemukan' });

  const insertJournal = db.prepare(`INSERT INTO journals (date, ref_no, description) VALUES (?,?,?)`);
  const insertEntry = db.prepare(`INSERT INTO journal_entries (journal_id, account_id, debit, credit, note) VALUES (?,?,?,?,?)`);

  const result = db.transaction(() => {
    const emp = db.prepare('SELECT name FROM employees WHERE id=?').get(p.employee_id);
    const jid = insertJournal.run(
      payment_date || new Date().toISOString().slice(0,10),
      `PR-${p.period}-${p.employee_id}`,
      `Gaji ${p.period} - ${emp?.name || 'Karyawan'}`
    ).lastInsertRowid;
    insertEntry.run(jid, salaryAccount, p.net_pay, 0, 'Beban Gaji');
    insertEntry.run(jid, cashAcc, 0, p.net_pay, 'Kas/Bank');
    db.prepare(`UPDATE payrolls SET status='paid', payment_date=?, journal_id=? WHERE id=?`)
      .run(payment_date || new Date().toISOString().slice(0,10), jid, id);
    return jid;
  })();

  res.json({ ok: true, journal_id: result });
});

// GET ringkasan payroll per periode
router.get('/summary/period', (req, res) => {
  const rows = db.prepare(`
    SELECT period,
      COUNT(*) as employee_count,
      SUM(base_salary) as total_base,
      SUM(allowances) as total_allowances,
      SUM(deductions) as total_deductions,
      SUM(net_pay) as total_net_pay
    FROM payrolls
    GROUP BY period
    ORDER BY period DESC
  `).all();
  res.json(rows);
});

export default router;