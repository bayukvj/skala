// Piutang page
route('/receivables', async (el) => {
  document.getElementById('page-title').textContent = 'Piutang (Accounts Receivable)';

  const [receivables, customers] = await Promise.all([
    get('/api/receivables'),
    get('/api/customers')
  ]);

  const totalOutstanding = receivables.reduce((s, r) => s + (r.total_amount - r.paid_amount), 0);

  el.innerHTML = `
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
      <div class="stat-card">
        <div class="stat-icon yellow">🧾</div>
        <div>
          <div class="stat-label">Total Piutang Belum Lunas</div>
          <div class="stat-value">${fmtIDR(totalOutstanding)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">👥</div>
        <div>
          <div class="stat-label">Total Tagihan</div>
          <div class="stat-value">${receivables.length}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Piutang</div>
        <button class="btn btn-primary" onclick="newReceivable()">+ Tambah Piutang</button>
      </div>
      ${receivables.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Pelanggan</th><th>Deskripsi</th><th>Jatuh Tempo</th><th class="amount">Total</th><th class="amount">Dibayar</th><th class="amount">Sisa</th><th>Status</th><th></th></tr></thead>
        <tbody>${receivables.map(r => `
          <tr>
            <td>${esc(r.customer_name)}</td>
            <td>${esc(r.description || '-')}</td>
            <td>${fmtDate(r.due_date)}</td>
            <td class="amount">${fmtIDR(r.total_amount)}</td>
            <td class="amount">${fmtIDR(r.paid_amount)}</td>
            <td class="amount">${fmtIDR(r.total_amount - r.paid_amount)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>
              <button class="btn btn-success btn-sm" onclick="payReceivable(${r.id}, '${esc(r.customer_name)}', ${r.total_amount - r.paid_amount})">Bayar</button>
              <button class="btn-icon" onclick="viewReceivable(${r.id})" title="Detail">👁️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('🧾', 'Belum ada piutang')}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Pelanggan</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Telepon</th><th>Email</th><th></th></tr></thead>
        <tbody>${customers.map(c => `
          <tr>
            <td>${esc(c.name)}</td>
            <td>${esc(c.phone || '-')}</td>
            <td>${esc(c.email || '-')}</td>
            <td><button class="btn-icon" onclick="deleteCustomer(${c.id})" title="Hapus">🗑️</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <button class="btn btn-ghost btn-sm" onclick="newCustomer()">+ Tambah Pelanggan</button>
    </div>
  `;

  window.newReceivable = () => {
    const custOpt = customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    openModal('Tambah Piutang', `
      <form id="form-recv">
        <div class="form-group"><label class="form-label">Pelanggan *</label><select class="form-control" name="customer_id" required>${custOpt}</select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Jumlah *</label><input type="number" class="form-control" name="total_amount" min="0.01" step="0.01" required></div>
          <div class="form-group"><label class="form-label">Jatuh Tempo</label><input type="date" class="form-control" name="due_date"></div>
        </div>
        <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-control" name="description" placeholder="Invoice #..."></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-recv').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/receivables', {
          customer_id: Number(f.customer_id.value),
          total_amount: Number(f.total_amount.value),
          due_date: f.due_date.value || null,
          description: f.description.value || null
        });
        closeModal(); toast('Piutang ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.payReceivable = (id, name, remaining) => {
    openModal(`Bayar Piutang — ${name}`, `
      <form id="form-pay">
        <div class="form-group"><label class="form-label">Sisa Piutang</label><input class="form-control" value="${fmtIDR(remaining)}" disabled></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Jumlah Bayar *</label><input type="number" class="form-control" name="amount" value="${remaining}" min="0.01" step="0.01" required></div>
          <div class="form-group"><label class="form-label">Tanggal Bayar</label><input type="date" class="form-control" name="payment_date" value="${todayStr()}"></div>
        </div>
        <div class="form-group"><label class="form-label">Metode</label>
          <select class="form-control" name="method">
            <option>Tunai</option><option>Transfer Bank</option><option>QRIS</option><option>Cek</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Catatan</label><input class="form-control" name="note"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-success">Catat Pembayaran</button>
        </div>
      </form>
    `);
    document.getElementById('form-pay').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post(`/api/receivables/${id}/payments`, {
          amount: Number(f.amount.value),
          payment_date: f.payment_date.value,
          method: f.method.value,
          note: f.note.value
        });
        closeModal(); toast('Pembayaran tercatat', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.viewReceivable = async (id) => {
    const r = await get(`/api/receivables/${id}`);
    openModal(`Piutang — ${r.customer_name}`, `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Total</label><input class="form-control" value="${fmtIDR(r.total_amount)}" disabled></div>
        <div class="form-group"><label class="form-label">Sisa</label><input class="form-control" value="${fmtIDR(r.total_amount - r.paid_amount)}" disabled></div>
      </div>
      <div class="form-group"><label class="form-label">Status</label><input class="form-control" value="${r.status}" disabled></div>
      <label class="form-label">Riwayat Pembayaran</label>
      ${r.payments.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Jumlah</th><th>Metode</th><th>Catatan</th></tr></thead>
        <tbody>${r.payments.map(p => `<tr><td>${fmtDate(p.payment_date)}</td><td class="amount">${fmtIDR(p.amount)}</td><td>${esc(p.method || '-')}</td><td>${esc(p.note || '-')}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p style="color:var(--gray-400)">Belum ada pembayaran</p>'}
    `);
  };

  window.newCustomer = () => {
    openModal('Tambah Pelanggan', `
      <form id="form-cust">
        <div class="form-group"><label class="form-label">Nama *</label><input class="form-control" name="name" required></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" name="phone"></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-control" name="email"></div>
        </div>
        <div class="form-group"><label class="form-label">Alamat</label><textarea class="form-control" name="address" rows="2"></textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-cust').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      await post('/api/customers', { name: f.name.value, phone: f.phone.value, email: f.email.value, address: f.address.value });
      closeModal(); toast('Pelanggan ditambahkan', 'success'); navigate();
    });
  };

  window.deleteCustomer = async (id) => {
    if (!confirm('Hapus pelanggan ini?')) return;
    await del(`/api/customers/${id}`);
    toast('Pelanggan dihapus', 'success'); navigate();
  };
});