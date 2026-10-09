// Hutang page
route('/payables', async (el) => {
  document.getElementById('page-title').textContent = 'Hutang (Accounts Payable)';

  const [payables, suppliers] = await Promise.all([
    get('/api/payables'),
    get('/api/suppliers')
  ]);

  const totalOutstanding = payables.reduce((s, p) => s + (p.total_amount - p.paid_amount), 0);

  el.innerHTML = `
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
      <div class="stat-card">
        <div class="stat-icon red">📄</div>
        <div>
          <div class="stat-label">Total Hutang Belum Lunas</div>
          <div class="stat-value">${fmtIDR(totalOutstanding)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">🏢</div>
        <div>
          <div class="stat-label">Total Tagihan</div>
          <div class="stat-value">${payables.length}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Hutang</div>
        <button class="btn btn-primary" onclick="newPayable()">+ Tambah Hutang</button>
      </div>
      ${payables.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Supplier</th><th>Deskripsi</th><th>Jatuh Tempo</th><th class="amount">Total</th><th class="amount">Dibayar</th><th class="amount">Sisa</th><th>Status</th><th></th></tr></thead>
        <tbody>${payables.map(p => `
          <tr>
            <td>${esc(p.supplier_name)}</td>
            <td>${esc(p.description || '-')}</td>
            <td>${fmtDate(p.due_date)}</td>
            <td class="amount">${fmtIDR(p.total_amount)}</td>
            <td class="amount">${fmtIDR(p.paid_amount)}</td>
            <td class="amount">${fmtIDR(p.total_amount - p.paid_amount)}</td>
            <td>${statusBadge(p.status)}</td>
            <td>
              <button class="btn btn-success btn-sm" onclick="payPayable(${p.id}, '${esc(p.supplier_name)}', ${p.total_amount - p.paid_amount})">Bayar</button>
              <button class="btn-icon" onclick="viewPayable(${p.id})" title="Detail">👁️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('📄', 'Belum ada hutang')}
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Supplier</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Telepon</th><th>Email</th><th></th></tr></thead>
        <tbody>${suppliers.map(s => `
          <tr>
            <td>${esc(s.name)}</td>
            <td>${esc(s.phone || '-')}</td>
            <td>${esc(s.email || '-')}</td>
            <td><button class="btn-icon" onclick="deleteSupplier(${s.id})" title="Hapus">🗑️</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <button class="btn btn-ghost btn-sm" onclick="newSupplier()">+ Tambah Supplier</button>
    </div>
  `;

  window.newPayable = () => {
    const supOpt = suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    openModal('Tambah Hutang', `
      <form id="form-pay">
        <div class="form-group"><label class="form-label">Supplier *</label><select class="form-control" name="supplier_id" required>${supOpt}</select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Jumlah *</label><input type="number" class="form-control" name="total_amount" min="0.01" step="0.01" required></div>
          <div class="form-group"><label class="form-label">Jatuh Tempo</label><input type="date" class="form-control" name="due_date"></div>
        </div>
        <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-control" name="description" placeholder="Invoice supplier #..."></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-pay').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/payables', {
          supplier_id: Number(f.supplier_id.value),
          total_amount: Number(f.total_amount.value),
          due_date: f.due_date.value || null,
          description: f.description.value || null
        });
        closeModal(); toast('Hutang ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.payPayable = (id, name, remaining) => {
    openModal(`Bayar Hutang — ${name}`, `
      <form id="form-paybtn">
        <div class="form-group"><label class="form-label">Sisa Hutang</label><input class="form-control" value="${fmtIDR(remaining)}" disabled></div>
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
    document.getElementById('form-paybtn').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post(`/api/payables/${id}/payments`, {
          amount: Number(f.amount.value),
          payment_date: f.payment_date.value,
          method: f.method.value,
          note: f.note.value
        });
        closeModal(); toast('Pembayaran tercatat', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.viewPayable = async (id) => {
    const p = await get(`/api/payables/${id}`);
    openModal(`Hutang — ${p.supplier_name}`, `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Total</label><input class="form-control" value="${fmtIDR(p.total_amount)}" disabled></div>
        <div class="form-group"><label class="form-label">Sisa</label><input class="form-control" value="${fmtIDR(p.total_amount - p.paid_amount)}" disabled></div>
      </div>
      <div class="form-group"><label class="form-label">Status</label><input class="form-control" value="${p.status}" disabled></div>
      <label class="form-label">Riwayat Pembayaran</label>
      ${p.payments.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Jumlah</th><th>Metode</th><th>Catatan</th></tr></thead>
        <tbody>${p.payments.map(x => `<tr><td>${fmtDate(x.payment_date)}</td><td class="amount">${fmtIDR(x.amount)}</td><td>${esc(x.method || '-')}</td><td>${esc(x.note || '-')}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p style="color:var(--gray-400)">Belum ada pembayaran</p>'}
    `);
  };

  window.newSupplier = () => {
    openModal('Tambah Supplier', `
      <form id="form-sup">
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
    document.getElementById('form-sup').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      await post('/api/suppliers', { name: f.name.value, phone: f.phone.value, email: f.email.value, address: f.address.value });
      closeModal(); toast('Supplier ditambahkan', 'success'); navigate();
    });
  };

  window.deleteSupplier = async (id) => {
    if (!confirm('Hapus supplier ini?')) return;
    await del(`/api/suppliers/${id}`);
    toast('Supplier dihapus', 'success'); navigate();
  };
});