import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET dashboard summary
router.get('/summary', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  // Saldo kas & bank
  const cash = db.prepare(`
    SELECT COALESCE(SUM(je.debit - je.credit), 0) as balance
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    WHERE a.code IN ('1001','1002')
  `).get().balance;

  // Total piutang belum dibayar
  const receivables = db.prepare(`
    SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total,
           COUNT(*) as count
    FROM receivables WHERE status != 'paid'
  `).get();

  // Total hutang belum dibayar
  const payables = db.prepare(`
    SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total,
           COUNT(*) as count
    FROM payables WHERE status != 'paid'
  `).get();

  // Pendapatan bulan ini
  const revenueMonth = db.prepare(`
    SELECT COALESCE(SUM(je.credit - je.debit), 0) as total
    FROM journal_entries je
    JOIN accounts a ON a.id = je.account_id
    JOIN journals j ON j.id = je.journal_id
    WHERE a.type = 'revenue' AND j.date >= ? AND j.date <= ?
  `).get(monthStart, today).total;

  // Beban bulan ini
  const expenseMonth = db.prepare(`
    SELECT COALESCE(SUM(je.debit - je.credit), 0) as total
    FROM journal_entries je
    JOIN accounts a ON a.id = je.account_id
    JOIN journals j ON j.id = je.journal_id
    WHERE a.type = 'expense' AND j.date >= ? AND j.date <= ?
  `).get(monthStart, today).total;

  // Laba bersih bulan ini
  const netIncomeMonth = revenueMonth - expenseMonth;

  // Total aset
  const totalAssets = db.prepare(`
    SELECT COALESCE(SUM(je.debit - je.credit), 0) as total
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    WHERE a.type = 'asset'
  `).get().total;

  // Total kewajiban
  const totalLiabilities = db.prepare(`
    SELECT COALESCE(SUM(je.credit - je.debit), 0) as total
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    WHERE a.type = 'liability'
  `).get().total;

  // Proyek aktif
  const activeProjects = db.prepare(`SELECT COUNT(*) as c FROM projects WHERE status='active'`).get().c;

  // Transaksi terbaru
  const recentJournals = db.prepare(`
    SELECT j.*, p.name as project_name
    FROM journals j LEFT JOIN projects p ON p.id = j.project_id
    ORDER BY j.date DESC, j.id DESC LIMIT 10
  `).all();

  // Piutang jatuh tempo 30 hari
  const dueSoon = db.prepare(`
    SELECT r.*, c.name as customer_name
    FROM receivables r JOIN customers c ON c.id = r.customer_id
    WHERE r.status != 'paid' AND r.due_date <= date(?, '+30 days')
    ORDER BY r.due_date ASC LIMIT 10
  `).all(today);

  res.json({
    cash_balance: cash,
    receivables: { total: receivables.total, count: receivables.count },
    payables: { total: payables.total, count: payables.count },
    revenue_month: revenueMonth,
    expense_month: expenseMonth,
    net_income_month: netIncomeMonth,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    equity: totalAssets - totalLiabilities,
    active_projects: activeProjects,
    recent_journals: recentJournals,
    receivables_due_soon: dueSoon
  });
});

// GET monthly trend (6 bulan terakhir)
router.get('/trend', (req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', j.date) as month,
      SUM(CASE WHEN a.type='revenue' THEN je.credit - je.debit ELSE 0 END) as revenue,
      SUM(CASE WHEN a.type='expense' THEN je.debit - je.credit ELSE 0 END) as expense
    FROM journal_entries je
    JOIN accounts a ON a.id = je.account_id
    JOIN journals j ON j.id = je.journal_id
    WHERE j.date >= date('now', '-6 months')
    GROUP BY month
    ORDER BY month ASC
  `).all();
  res.json(rows);
});

// GET expense breakdown by category
router.get('/expense-breakdown', (req, res) => {
  const { date_from, date_to } = req.query;
  let where = "WHERE a.type = 'expense' AND a.is_header = 0";
  const params = [];
  if (date_from) { where += ' AND j.date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND j.date <= ?'; params.push(date_to); }
  const rows = db.prepare(`
    SELECT a.name, a.code, SUM(je.debit - je.credit) as amount
    FROM journal_entries je
    JOIN accounts a ON a.id = je.account_id
    JOIN journals j ON j.id = je.journal_id
    ${where}
    GROUP BY a.id
    ORDER BY amount DESC
  `).all(...params);
  res.json(rows);
});

// GET business health (kesehatan bisnis)
router.get('/health', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  // Saldo kas & bank
  const cash = db.prepare(`
    SELECT COALESCE(SUM(je.debit - je.credit), 0) as balance
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    WHERE a.code IN ('1001','1002')
  `).get().balance;

  // Total aset & kewajiban
  const totalAssets = db.prepare(`
    SELECT COALESCE(SUM(je.debit - je.credit), 0) as total
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    WHERE a.type = 'asset'
  `).get().total;

  const totalLiabilities = db.prepare(`
    SELECT COALESCE(SUM(je.credit - je.debit), 0) as total
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    WHERE a.type = 'liability'
  `).get().total;

  // Piutang & hutang berjalan
  const receivables = db.prepare(`
    SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total
    FROM receivables WHERE status != 'paid'
  `).get().total;

  const payables = db.prepare(`
    SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total
    FROM payables WHERE status != 'paid'
  `).get().total;

  // Pendapatan & beban bulan ini
  const revenueMonth = db.prepare(`
    SELECT COALESCE(SUM(je.credit - je.debit), 0) as total
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    JOIN journals j ON j.id = je.journal_id
    WHERE a.type = 'revenue' AND j.date >= ? AND j.date <= ?
  `).get(monthStart, today).total;

  const expenseMonth = db.prepare(`
    SELECT COALESCE(SUM(je.debit - je.credit), 0) as total
    FROM journal_entries je JOIN accounts a ON a.id = je.account_id
    JOIN journals j ON j.id = je.journal_id
    WHERE a.type = 'expense' AND j.date >= ? AND j.date <= ?
  `).get(monthStart, today).total;

  const netIncomeMonth = revenueMonth - expenseMonth;
  const margin = revenueMonth > 0 ? (netIncomeMonth / revenueMonth) * 100 : 0;

  // Rasio likuiditas (kas / hutang jangka pendek)
  const liquidityRatio = payables > 0 ? cash / payables : (cash > 0 ? 99 : 0);

  // Rasio piutang terhadap pendapatan
  const arRatio = revenueMonth > 0 ? (receivables / revenueMonth) * 100 : 0;

  // Skor kesehatan (0-100)
  let score = 0;
  let grade = 'Belum Ada Data';
  let color = 'gray';

  if (revenueMonth > 0 || expenseMonth > 0) {
    // Komponen skor
    const profitScore = netIncomeMonth > 0 ? Math.min(40, (margin / 25) * 40) : 0;
    const cashScore = cash > 0 ? Math.min(25, Math.min(1, cash / (payables + 1) * 0.5 + 0.5) * 25) : 0;
    const liquidityScore = liquidityRatio >= 1.5 ? 20 : liquidityRatio >= 1 ? 12 : liquidityRatio > 0 ? 5 : 0;
    const arScore = arRatio <= 30 ? 15 : arRatio <= 60 ? 8 : 3;

    score = Math.round(profitScore + cashScore + liquidityScore + arScore);

    if (score >= 75) { grade = 'Sehat'; color = 'green'; }
    else if (score >= 50) { grade = 'Cukup'; color = 'yellow'; }
    else if (score >= 25) { grade = 'Perlu Perhatian'; color = 'orange'; }
    else { grade = 'Kritis'; color = 'red'; }
  }

  res.json({
    score, grade, color,
    cash_balance: cash,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    equity: totalAssets - totalLiabilities,
    receivables, payables,
    revenue_month: revenueMonth,
    expense_month: expenseMonth,
    net_income_month: netIncomeMonth,
    margin: Math.round(margin * 10) / 10,
    liquidity_ratio: Math.round(liquidityRatio * 100) / 100,
    ar_ratio: Math.round(arRatio * 10) / 10,
    indicators: {
      profitability: { label: 'Profitabilitas', value: Math.round(margin), max: 100, status: margin >= 20 ? 'good' : margin >= 10 ? 'warn' : 'bad' },
      liquidity: { label: 'Likuiditas', value: liquidityRatio, status: liquidityRatio >= 1.5 ? 'good' : liquidityRatio >= 1 ? 'warn' : 'bad' },
      cash: { label: 'Kas Tersedia', value: cash, status: cash > payables ? 'good' : cash > 0 ? 'warn' : 'bad' },
      receivables: { label: 'Piutang vs Pendapatan', value: Math.round(arRatio), max: 100, status: arRatio <= 30 ? 'good' : arRatio <= 60 ? 'warn' : 'bad' }
    }
  });
});

export default router;