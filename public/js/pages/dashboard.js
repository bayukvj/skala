// Dashboard page
route('/', async (el) => {
  document.getElementById('page-title').textContent = 'Dashboard';
  const [s, trend, breakdown, health] = await Promise.all([
    get('/api/dashboard/summary'),
    get('/api/dashboard/trend'),
    get('/api/dashboard/expense-breakdown'),
    get('/api/dashboard/health')
  ]);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">💰</div>
        <div>
          <div class="stat-label">Saldo Kas & Bank</div>
          <div class="stat-value">${fmtIDR(s.cash_balance)}</div>
          <div class="stat-sub">Total aset ${fmtIDR(s.total_assets)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">📈</div>
        <div>
          <div class="stat-label">Pendapatan Bulan Ini</div>
          <div class="stat-value">${fmtIDR(s.revenue_month)}</div>
          <div class="stat-sub">Beban ${fmtIDR(s.expense_month)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${s.net_income_month >= 0 ? 'green' : 'red'}">💵</div>
        <div>
          <div class="stat-label">Laba Bersih Bulan Ini</div>
          <div class="stat-value">${fmtIDR(s.net_income_month)}</div>
          <div class="stat-sub">${s.net_income_month >= 0 ? '✅ Untung' : '❌ Rugi'}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">🧾</div>
        <div>
          <div class="stat-label">Piutang Belum Dibayar</div>
          <div class="stat-value">${fmtIDR(s.receivables.total)}</div>
          <div class="stat-sub">${s.receivables.count} pelanggan</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">📄</div>
        <div>
          <div class="stat-label">Hutang Belum Dibayar</div>
          <div class="stat-value">${fmtIDR(s.payables.total)}</div>
          <div class="stat-sub">${s.payables.count} supplier</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">📁</div>
        <div>
          <div class="stat-label">Proyek Aktif</div>
          <div class="stat-value">${s.active_projects}</div>
          <div class="stat-sub">Ekuitas ${fmtIDR(s.equity)}</div>
        </div>
      </div>
    </div>

    <div class="chart-row">
      <div class="card">
        <div class="card-header"><div class="card-title">Tren Pendapatan & Beban (6 bulan)</div></div>
        <div class="chart-container"><canvas id="trendChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Rincian Beban</div></div>
        <div class="chart-container"><canvas id="expenseChart"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Kesehatan Bisnis</div>
        <span class="badge badge-${health.color}" style="font-size:14px;padding:6px 16px">${health.grade} — Skor ${health.score}/100</span>
      </div>
      <div class="progress" style="height:12px;margin-bottom:20px">
        <div class="progress-bar ${health.color === 'green' ? 'green' : health.color === 'yellow' ? 'yellow' : 'red'}" style="width:${health.score}%"></div>
      </div>
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom:0">
        <div class="stat-card">
          <div class="stat-icon ${health.indicators.profitability.status === 'good' ? 'green' : health.indicators.profitability.status === 'warn' ? 'yellow' : 'red'}">📈</div>
          <div>
            <div class="stat-label">Margin Laba</div>
            <div class="stat-value">${health.margin}%</div>
            <div class="stat-sub">${health.net_income_month >= 0 ? 'Untung' : 'Rugi'} bulan ini</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${health.indicators.liquidity.status === 'good' ? 'green' : health.indicators.liquidity.status === 'warn' ? 'yellow' : 'red'}">💧</div>
          <div>
            <div class="stat-label">Rasio Likuiditas</div>
            <div class="stat-value">${health.liquidity_ratio}x</div>
            <div class="stat-sub">Kas vs hutang</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${health.indicators.cash.status === 'good' ? 'green' : health.indicators.cash.status === 'warn' ? 'yellow' : 'red'}">💰</div>
          <div>
            <div class="stat-label">Kas Tersedia</div>
            <div class="stat-value">${fmtIDR(health.cash_balance)}</div>
            <div class="stat-sub">Hutang: ${fmtIDR(health.payables)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${health.indicators.receivables.status === 'good' ? 'green' : health.indicators.receivables.status === 'warn' ? 'yellow' : 'red'}">🧾</div>
          <div>
            <div class="stat-label">Piutang / Pendapatan</div>
            <div class="stat-value">${health.ar_ratio}%</div>
            <div class="stat-sub">Piutang: ${fmtIDR(health.receivables)}</div>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:8px;font-size:12px;color:var(--gray-600)">
        <strong>Ringkasan:</strong>
        Aset ${fmtIDR(health.total_assets)} • Kewajiban ${fmtIDR(health.total_liabilities)} • Ekuitas ${fmtIDR(health.equity)} •
        Pendapatan bulan ini ${fmtIDR(health.revenue_month)} • Beban ${fmtIDR(health.expense_month)} •
        Laba bersih ${fmtIDR(health.net_income_month)}
      </div>
    </div>

    <div class="chart-row">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Transaksi Terbaru</div>
          <a href="#/journals" class="btn btn-ghost btn-sm">Lihat Semua</a>
        </div>
        ${s.recent_journals.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Tanggal</th><th>Ref</th><th>Deskripsi</th><th>Proyek</th></tr></thead>
          <tbody>${s.recent_journals.map(j => `
            <tr>
              <td>${fmtDate(j.date)}</td>
              <td>${esc(j.ref_no || '-')}</td>
              <td>${esc(j.description || '-')}</td>
              <td>${esc(j.project_name || '-')}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('📒', 'Belum ada transaksi')}
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Piutang Jatuh Tempo (30 hari)</div>
          <a href="#/receivables" class="btn btn-ghost btn-sm">Lihat Semua</a>
        </div>
        ${s.receivables_due_soon.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Pelanggan</th><th>Jatuh Tempo</th><th class="amount">Sisa</th></tr></thead>
          <tbody>${s.receivables_due_soon.map(r => `
            <tr>
              <td>${esc(r.customer_name)}</td>
              <td>${fmtDate(r.due_date)}</td>
              <td class="amount">${fmtIDR(r.total_amount - r.paid_amount)}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('🧾', 'Tidak ada piutang jatuh tempo')}
      </div>
    </div>
  `;

  // Charts
  const months = trend.map(t => {
    const [y, m] = t.month.split('-');
    return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'short' });
  });
  new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Pendapatan', data: trend.map(t => t.revenue), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
        { label: 'Beban', data: trend.map(t => t.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: v => 'Rp ' + (v/1000000).toFixed(1) + 'jt' } } } }
  });

  if (breakdown.length) {
    new Chart(document.getElementById('expenseChart'), {
      type: 'doughnut',
      data: {
        labels: breakdown.map(b => b.name),
        datasets: [{ data: breakdown.map(b => b.amount), backgroundColor: ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#64748b'] }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
  } else {
    document.getElementById('expenseChart').parentElement.innerHTML = emptyState('📊', 'Belum ada data beban');
  }
});