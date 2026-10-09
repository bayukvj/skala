// Laporan page
route('/reports', async (el, query) => {
  document.getElementById('page-title').textContent = 'Laporan Keuangan';

  const { date_from, date_to } = query;
  const params = new URLSearchParams();
  if (date_from) params.set('date_from', date_from);
  if (date_to) params.set('date_to', date_to);
  const qs = params.toString();

  const [pl, bs, cf, tb] = await Promise.all([
    get('/api/reports/profit-loss' + (qs ? '?' + qs : '')),
    get('/api/reports/balance-sheet'),
    get('/api/reports/cash-flow' + (qs ? '?' + qs : '')),
    get('/api/journals/reports/trial-balance' + (qs ? '?' + qs : ''))
  ]);

  const tab = query.tab || 'profit-loss';

  el.innerHTML = `
    <div class="filters">
      <input type="date" id="f-from" class="form-control" value="${date_from || ''}">
      <span style="color:var(--gray-400)">s.d.</span>
      <input type="date" id="f-to" class="form-control" value="${date_to || ''}">
      <button class="btn btn-ghost" onclick="applyFilter()">Terapkan</button>
      <button class="btn btn-ghost" onclick="window.print()">🖨️ Cetak</button>
    </div>

    <div class="tabs">
      <button class="tab ${tab === 'profit-loss' ? 'active' : ''}" onclick="goTab('profit-loss')">Laba Rugi</button>
      <button class="tab ${tab === 'balance-sheet' ? 'active' : ''}" onclick="goTab('balance-sheet')">Neraca</button>
      <button class="tab ${tab === 'cash-flow' ? 'active' : ''}" onclick="goTab('cash-flow')">Arus Kas</button>
      <button class="tab ${tab === 'trial-balance' ? 'active' : ''}" onclick="goTab('trial-balance')">Neraca Saldo</button>
      <button class="tab ${tab === 'ledger' ? 'active' : ''}" onclick="goTab('ledger')">Buku Besar</button>
    </div>

    <div id="report-content"></div>
  `;

  window.goTab = (t) => {
    const p = new URLSearchParams();
    if (date_from) p.set('date_from', date_from);
    if (date_to) p.set('date_to', date_to);
    p.set('tab', t);
    location.hash = '#/reports?' + p.toString();
  };

  window.applyFilter = () => {
    const from = document.getElementById('f-from').value;
    const to = document.getElementById('f-to').value;
    const p = new URLSearchParams();
    if (from) p.set('date_from', from);
    if (to) p.set('date_to', to);
    p.set('tab', tab);
    location.hash = '#/reports?' + p.toString();
  };

  const content = document.getElementById('report-content');

  if (tab === 'profit-loss') {
    content.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Laporan Laba Rugi</div>
          <div>${date_from ? fmtDate(date_from) : '...'} s.d. ${date_to ? fmtDate(date_to) : 'kini'}</div>
        </div>
        <h4 style="margin:12px 0;color:var(--gray-600)">Pendapatan</h4>
        <table>
          <tbody>${pl.revenue.length ? pl.revenue.map(r => `
            <tr><td>${esc(r.code)} - ${esc(r.name)}</td><td class="amount">${fmtIDR(r.amount)}</td></tr>
          `).join('') : '<tr><td colspan="2" style="color:var(--gray-400)">Tidak ada pendapatan</td></tr>'}
          <tr style="font-weight:700;background:var(--gray-50)"><td>TOTAL PENDAPATAN</td><td class="amount">${fmtIDR(pl.total_revenue)}</td></tr>
          </tbody>
        </table>
        <h4 style="margin:20px 0 12px;color:var(--gray-600)">Beban</h4>
        <table>
          <tbody>${pl.expenses.length ? pl.expenses.map(r => `
            <tr><td>${esc(r.code)} - ${esc(r.name)}</td><td class="amount">${fmtIDR(r.amount)}</td></tr>
          `).join('') : '<tr><td colspan="2" style="color:var(--gray-400)">Tidak ada beban</td></tr>'}
          <tr style="font-weight:700;background:var(--gray-50)"><td>TOTAL BEBAN</td><td class="amount">${fmtIDR(pl.total_expenses)}</td></tr>
          </tbody>
        </table>
        <div style="margin-top:20px;padding:16px;background:${pl.net_income >= 0 ? 'var(--success-light)' : 'var(--danger-light)'};border-radius:8px;display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:16px">${pl.net_income >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}</strong>
          <strong style="font-size:22px">${fmtIDR(pl.net_income)}</strong>
        </div>
      </div>
    `;
  }

  if (tab === 'balance-sheet') {
    const section = (title, items, total) => `
      <h4 style="margin:16px 0 8px;color:var(--gray-600)">${title}</h4>
      <table><tbody>
        ${items.length ? items.map(i => `
          <tr><td>${esc(i.code)} - ${esc(i.name)}</td><td class="amount">${fmtIDR(i.balance)}</td></tr>
        `).join('') : '<tr><td colspan="2" style="color:var(--gray-400)">-</td></tr>'}
        <tr style="font-weight:700;background:var(--gray-50)"><td>TOTAL ${title.toUpperCase()}</td><td class="amount">${fmtIDR(total)}</td></tr>
      </tbody></table>
    `;
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Neraca (Balance Sheet)</div><div>Per ${date_to ? fmtDate(date_to) : fmtDate(todayStr())}</div></div>
        ${section('Aset', bs.asset, bs.asset_total)}
        ${section('Kewajiban', bs.liability, bs.liability_total)}
        ${section('Modal', bs.equity, bs.equity_total)}
        <table><tbody>
          <tr><td>Laba Bersih Berjalan</td><td class="amount">${fmtIDR(bs.net_income)}</td></tr>
          <tr style="font-weight:700;background:var(--gray-50)"><td>TOTAL KEWAJIBAN + MODAL</td><td class="amount">${fmtIDR(bs.liability_equity_total)}</td></tr>
        </tbody></table>
        <div style="margin-top:16px;padding:12px;background:var(--gray-50);border-radius:8px">
          <strong>Selisih (Aset - Kewajiban - Modal):</strong> ${fmtIDR(bs.asset_total - bs.liability_equity_total)}
          ${Math.abs(bs.asset_total - bs.liability_equity_total) < 1 ? '<span class="badge badge-success">Seimbang ✅</span>' : '<span class="badge badge-danger">Tidak seimbang ⚠️</span>'}
        </div>
      </div>
    `;
  }

  if (tab === 'cash-flow') {
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Arus Kas (Kas & Bank)</div></div>
        <table><tbody>
          <tr><td>Arus Kas Masuk</td><td class="amount positive">${fmtIDR(cf.cash_inflow)}</td></tr>
          <tr><td>Arus Kas Keluar</td><td class="amount negative">${fmtIDR(cf.cash_outflow)}</td></tr>
          <tr style="font-weight:700;background:var(--gray-50)"><td>Arus Kas Bersih</td><td class="amount ${cf.net_cash_flow >= 0 ? 'positive' : 'negative'}">${fmtIDR(cf.net_cash_flow)}</td></tr>
        </tbody></table>
      </div>
    `;
  }

  if (tab === 'trial-balance') {
    const totalD = tb.reduce((s, r) => s + r.total_debit, 0);
    const totalC = tb.reduce((s, r) => s + r.total_credit, 0);
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Neraca Saldo (Trial Balance)</div></div>
        <table>
          <thead><tr><th>Kode</th><th>Akun</th><th>Tipe</th><th class="amount">Debit</th><th class="amount">Kredit</th></tr></thead>
          <tbody>${tb.length ? tb.map(r => `
            <tr>
              <td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.type)}</td>
              <td class="amount">${r.total_debit ? fmtIDR(r.total_debit) : '-'}</td>
              <td class="amount">${r.total_credit ? fmtIDR(r.total_credit) : '-'}</td>
            </tr>`).join('') : '<tr><td colspan="5" style="color:var(--gray-400)">Tidak ada transaksi</td></tr>'}
            <tr style="font-weight:700;background:var(--gray-50)"><td colspan="3">TOTAL</td><td class="amount">${fmtIDR(totalD)}</td><td class="amount">${fmtIDR(totalC)}</td></tr>
          </tbody>
        </table>
        ${Math.abs(totalD - totalC) < 1 ? '<span class="badge badge-success">Seimbang ✅</span>' : '<span class="badge badge-danger">Tidak seimbang ⚠️</span>'}
      </div>
    `;
  }

  if (tab === 'ledger') {
    const accounts = await get('/api/accounts');
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Buku Besar (General Ledger)</div></div>
        <div class="form-group">
          <label class="form-label">Pilih Akun</label>
          <select class="form-control" id="ledger-account" onchange="loadLedger()">
            ${accounts.map(a => `<option value="${a.id}">${esc(a.code)} - ${esc(a.name)}</option>`).join('')}
          </select>
        </div>
        <div id="ledger-content"></div>
      </div>
    `;
    window.loadLedger = async () => {
      const accId = document.getElementById('ledger-account').value;
      const data = await get(`/api/reports/ledger/${accId}` + (qs ? '?' + qs : ''));
      const lc = document.getElementById('ledger-content');
      if (!data.entries.length) {
        lc.innerHTML = emptyState('📒', 'Belum ada transaksi untuk akun ini');
        return;
      }
      lc.innerHTML = `
        <table>
          <thead><tr><th>Tanggal</th><th>Ref</th><th>Deskripsi</th><th class="amount">Debit</th><th class="amount">Kredit</th><th class="amount">Saldo</th></tr></thead>
          <tbody>${data.entries.map(e => `
            <tr>
              <td>${fmtDate(e.date)}</td>
              <td>${esc(e.ref_no || '-')}</td>
              <td>${esc(e.description || '-')}</td>
              <td class="amount">${e.debit ? fmtIDR(e.debit) : '-'}</td>
              <td class="amount">${e.credit ? fmtIDR(e.credit) : '-'}</td>
              <td class="amount">${fmtIDR(e.balance)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:12px;text-align:right"><strong>Saldo Akhir: ${fmtIDR(data.ending_balance)}</strong></div>
      `;
    };
    loadLedger();
  }
});