import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// Helper: saldo akhir per akun (akumulasi debit - credit)
function accountBalance(accountId, dateTo = null) {
  let sql = `
    SELECT COALESCE(SUM(je.debit),0) - COALESCE(SUM(je.credit),0) as balance
    FROM journal_entries je JOIN journals j ON j.id = je.journal_id
    WHERE je.account_id = ?
  `;
  const params = [accountId];
  if (dateTo) { sql += ' AND j.date <= ?'; params.push(dateTo); }
  return db.prepare(sql).get(...params).balance || 0;
}

// GET profit & loss (laba rugi)
router.get('/profit-loss', (req, res) => {
  const { date_from, date_to } = req.query;
  let where = "WHERE a.type IN ('revenue','expense') AND a.active=1 AND a.is_header=0";
  const params = [];
  if (date_from) { where += ' AND j.date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND j.date <= ?'; params.push(date_to); }

  const sql = `
    SELECT a.id, a.code, a.name, a.type,
      COALESCE(SUM(je.debit),0) as total_debit,
      COALESCE(SUM(je.credit),0) as total_credit
    FROM accounts a
    LEFT JOIN journal_entries je ON je.account_id = a.id
    LEFT JOIN journals j ON j.id = je.journal_id
    ${where}
    GROUP BY a.id
    ORDER BY a.code
  `;
  const rows = db.prepare(sql).all(...params);

  const revenue = rows.filter(r => r.type === 'revenue').map(r => ({
    ...r, amount: r.total_credit - r.total_debit
  }));
  const expenses = rows.filter(r => r.type === 'expense').map(r => ({
    ...r, amount: r.total_debit - r.total_credit
  }));
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
  const netIncome = totalRevenue - totalExpenses;

  res.json({
    date_from: date_from || null,
    date_to: date_to || null,
    revenue, expenses,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_income: netIncome
  });
});

  // GET balance sheet (neraca)
router.get('/balance-sheet', (req, res) => {
  const { date_to } = req.query;
  const types = ['asset', 'liability', 'equity'];
  const result = {};
  for (const type of types) {
    const accounts = db.prepare(`SELECT * FROM accounts WHERE type=? AND active=1 AND is_header=0 ORDER BY code`).all(type);
    const items = accounts.map(a => {
      let bal = accountBalance(a.id, date_to);
      // Liability & equity: credit balance (tampilkan positif)
      if (type !== 'asset') bal = -bal;
      return { ...a, balance: bal };
    });
    result[type] = items;
    result[type + '_total'] = items.reduce((s, i) => s + i.balance, 0);
  }
  // Net income from P&L (revenue - expense)
  const pl = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(je.credit),0) - COALESCE(SUM(je.debit),0) FROM journal_entries je JOIN accounts a ON a.id=je.account_id JOIN journals j ON j.id=je.journal_id WHERE a.type='revenue') as rev,
      (SELECT COALESCE(SUM(je.debit),0) - COALESCE(SUM(je.credit),0) FROM journal_entries je JOIN accounts a ON a.id=je.account_id JOIN journals j ON j.id=je.journal_id WHERE a.type='expense') as exp
  `).get();
  const netIncome = (pl.rev || 0) - (pl.exp || 0);
  result.net_income = netIncome;
  result.liability_equity_total = result.liability_total + result.equity_total + netIncome;
  res.json(result);
});

// GET cash flow summary (arus kas sederhana)
router.get('/cash-flow', (req, res) => {
  const { date_from, date_to } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (date_from) { where += ' AND j.date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND j.date <= ?'; params.push(date_to); }

  const cashAccounts = db.prepare(`SELECT id FROM accounts WHERE code IN ('1001','1002')`).all().map(r => r.id);
  const placeholders = cashAccounts.map(() => '?').join(',');

  // Untuk akun kas/bank (asset): debit = uang masuk, credit = uang keluar
  const inflow = db.prepare(`
    SELECT COALESCE(SUM(je.debit),0) as total
    FROM journal_entries je JOIN journals j ON j.id=je.journal_id
    ${where} AND je.account_id IN (${placeholders}) AND je.debit > 0
  `).get(...params, ...cashAccounts).total || 0;

  const outflow = db.prepare(`
    SELECT COALESCE(SUM(je.credit),0) as total
    FROM journal_entries je JOIN journals j ON j.id=je.journal_id
    ${where} AND je.account_id IN (${placeholders}) AND je.credit > 0
  `).get(...params, ...cashAccounts).total || 0;

  res.json({
    date_from: date_from || null,
    date_to: date_to || null,
    cash_inflow: inflow,
    cash_outflow: outflow,
    net_cash_flow: inflow - outflow
  });
});

// GET general ledger (buku besar) per akun
router.get('/ledger/:accountId', (req, res) => {
  const { accountId } = req.params;
  const { date_from, date_to } = req.query;
  let where = 'WHERE je.account_id = ?';
  const params = [accountId];
  if (date_from) { where += ' AND j.date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND j.date <= ?'; params.push(date_to); }

  const rows = db.prepare(`
    SELECT j.date, j.ref_no, j.description, je.debit, je.credit, je.note
    FROM journal_entries je JOIN journals j ON j.id = je.journal_id
    ${where}
    ORDER BY j.date ASC, j.id ASC
  `).all(...params);

  let running = 0;
  const ledger = rows.map(r => {
    running += (r.debit - r.credit);
    return { ...r, balance: running };
  });
  res.json({ account_id: Number(accountId), entries: ledger, ending_balance: running });
});

export default router;