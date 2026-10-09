// Transaksi (Uang Masuk & Keluar) - quick entry page
route('/transactions', async (el) => {
  document.getElementById('page-title').textContent = 'Uang Masuk & Keluar';

  const [accounts, projects, journals] = await Promise.all([
    get('/api/accounts'),
    get('/api/projects'),
    get('/api/journals?limit=100')
  ]);

  const cashAccounts = accounts.filter(a => ['1001', '1002'].includes(a.code));
  const revenueAccounts = accounts.filter(a => a.type === 'revenue');
  const expenseAccounts = accounts.filter(a => a.type === 'expense');
  const assetAccounts = accounts.filter(a => a.type === 'asset');
  const liabilityAccounts = accounts.filter(a => a.type === 'liability');

  const opt = (list) => list.map(a => `<option value="${a.id}">${esc(a.code)} - ${esc(a.name)}</option>`).join('');
  const projectOpt = '<option value="">- Tanpa Proyek -</option>' + projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  el.innerHTML = `
    <div class="tabs">
      <button class="tab active" onclick="switchTab('in')">💵 Uang Masuk</button>
      <button class="tab" onclick="switchTab('out')">💸 Uang Keluar</button>
      <button class="tab" onclick="switchTab('transfer')">🔄 Transfer</button>
    </div>

    <div class="chart-row">
      <div class="card" id="tab-in">
        <div class="card-header"><div class="card-title">Catat Uang Masuk (Pendapatan)</div></div>
        <form id="form-in">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Tanggal *</label><input type="date" class="form-control" name="date" value="${todayStr()}" required></div>
            <div class="form-group"><label class="form-label">Jumlah *</label><input type="number" class="form-control" name="amount" placeholder="0" min="0.01" step="0.01" required></div>
          </div>
          <div class="form-group"><label class="form-label">Sumber Dana *</label><select class="form-control" name="cash_account">${opt(cashAccounts)}</select></div>
          <div class="form-group"><label class="form-label">Kategori Pendapatan *</label><select class="form-control" name="revenue_account">${opt(revenueAccounts)}</select></div>
          <div class="form-group"><label class="form-label">Proyek</label><select class="form-control" name="project_id">${projectOpt}</select></div>
          <div class="form-group"><label class="form-label">Deskripsi *</label><input class="form-control" name="description" placeholder="Contoh: Penjualan produk X" required></div>
          <button type="submit" class="btn btn-success" style="width:100%">Simpan Uang Masuk</button>
        </form>
      </div>

      <div class="card hidden" id="tab-out">
        <div class="card-header"><div class="card-title">Catat Uang Keluar (Beban)</div></div>
        <form id="form-out">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Tanggal *</label><input type="date" class="form-control" name="date" value="${todayStr()}" required></div>
            <div class="form-group"><label class="form-label">Jumlah *</label><input type="number" class="form-control" name="amount" placeholder="0" min="0.01" step="0.01" required></div>
          </div>
          <div class="form-group"><label class="form-label">Dari Kas/Bank *</label><select class="form-control" name="cash_account">${opt(cashAccounts)}</select></div>
          <div class="form-group"><label class="form-label">Kategori Beban *</label><select class="form-control" name="expense_account">${opt(expenseAccounts)}</select></div>
          <div class="form-group"><label class="form-label">Proyek</label><select class="form-control" name="project_id">${projectOpt}</select></div>
          <div class="form-group"><label class="form-label">Deskripsi *</label><input class="form-control" name="description" placeholder="Contoh: Bayar listrik" required></div>
          <button type="submit" class="btn btn-danger" style="width:100%">Simpan Uang Keluar</button>
        </form>
      </div>

      <div class="card hidden" id="tab-transfer">
        <div class="card-header"><div class="card-title">Transfer antar Rekening</div></div>
        <form id="form-transfer">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Tanggal *</label><input type="date" class="form-control" name="date" value="${todayStr()}" required></div>
            <div class="form-group"><label class="form-label">Jumlah *</label><input type="number" class="form-control" name="amount" placeholder="0" min="0.01" step="0.01" required></div>
          </div>
          <div class="form-group"><label class="form-label">Dari *</label><select class="form-control" name="from_account">${opt(cashAccounts)}</select></div>
          <div class="form-group"><label class="form-label">Ke *</label><select class="form-control" name="to_account">${opt(cashAccounts)}</select></div>
          <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-control" name="description" placeholder="Transfer kas ke bank"></div>
          <button type="submit" class="btn btn-primary" style="width:100%">Simpan Transfer</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Riwayat Transaksi Terbaru</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Deskripsi</th><th>Proyek</th><th class="amount">Debit</th><th class="amount">Kredit</th></tr></thead>
        <tbody>${journals.slice(0, 20).map(j => {
          const debit = j.entries ? '' : '';
          return `<tr>
            <td>${fmtDate(j.date)}</td>
            <td>${esc(j.description || '-')}</td>
            <td>${esc(j.project_name || '-')}</td>
            <td class="amount">-</td>
            <td class="amount">-</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
  `;

  window.switchTab = (tab) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    ['in', 'out', 'transfer'].forEach(t => {
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
    });
  };

  document.getElementById('form-in').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await post('/api/journals', {
        date: f.date.value,
        description: f.description.value,
        project_id: f.project_id.value ? Number(f.project_id.value) : null,
        entries: [
          { account_id: Number(f.cash_account.value), debit: Number(f.amount.value), credit: 0 },
          { account_id: Number(f.revenue_account.value), debit: 0, credit: Number(f.amount.value) }
        ]
      });
      toast('Uang masuk tercatat', 'success');
      navigate();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('form-out').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await post('/api/journals', {
        date: f.date.value,
        description: f.description.value,
        project_id: f.project_id.value ? Number(f.project_id.value) : null,
        entries: [
          { account_id: Number(f.expense_account.value), debit: Number(f.amount.value), credit: 0 },
          { account_id: Number(f.cash_account.value), debit: 0, credit: Number(f.amount.value) }
        ]
      });
      toast('Uang keluar tercatat', 'success');
      navigate();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('form-transfer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.from_account.value === f.to_account.value) return toast('Rekening sumber dan tujuan sama', 'error');
    try {
      await post('/api/journals', {
        date: f.date.value,
        description: f.description.value || 'Transfer antar rekening',
        entries: [
          { account_id: Number(f.to_account.value), debit: Number(f.amount.value), credit: 0 },
          { account_id: Number(f.from_account.value), debit: 0, credit: Number(f.amount.value) }
        ]
      });
      toast('Transfer tercatat', 'success');
      navigate();
    } catch (err) { toast(err.message, 'error'); }
  });
});