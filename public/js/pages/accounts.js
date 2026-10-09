// Akun (Chart of Accounts) page
route('/accounts', async (el) => {
  document.getElementById('page-title').textContent = 'Akun (Chart of Accounts)';

  const accounts = await get('/api/accounts?include_inactive=true');
  const typeLabels = { asset: 'Aset', liability: 'Kewajiban', equity: 'Modal', revenue: 'Pendapatan', expense: 'Beban' };
  const typeBadge = { asset: 'badge-info', liability: 'badge-warning', equity: 'badge-gray', revenue: 'badge-success', expense: 'badge-danger' };

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Akun</div>
        <button class="btn btn-primary" onclick="newAccount()">+ Tambah Akun</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Kode</th><th>Nama Akun</th><th>Tipe</th><th>Status</th><th></th></tr></thead>
        <tbody>${accounts.map(a => `
          <tr>
            <td><strong>${esc(a.code)}</strong></td>
            <td>${esc(a.name)}</td>
            <td><span class="badge ${typeBadge[a.type]}">${typeLabels[a.type]}</span></td>
            <td>${a.active ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>'}</td>
            <td>
              <button class="btn-icon" onclick="toggleAccount(${a.id}, ${a.active})" title="${a.active ? 'Nonaktifkan' : 'Aktifkan'}">${a.active ? '⏸️' : '▶️'}</button>
              <button class="btn-icon" onclick="deleteAccount(${a.id})" title="Hapus">🗑️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `;

  window.newAccount = () => {
    openModal('Tambah Akun', `
      <form id="form-acc">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Kode Akun *</label><input class="form-control" name="code" placeholder="1001" required></div>
          <div class="form-group"><label class="form-label">Nama Akun *</label><input class="form-control" name="name" required></div>
        </div>
        <div class="form-group"><label class="form-label">Tipe *</label>
          <select class="form-control" name="type" required>
            <option value="asset">Aset</option>
            <option value="liability">Kewajiban</option>
            <option value="equity">Modal</option>
            <option value="revenue">Pendapatan</option>
            <option value="expense">Beban</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-acc').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/accounts', { code: f.code.value, name: f.name.value, type: f.type.value });
        closeModal(); toast('Akun ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.toggleAccount = async (id, active) => {
    await put(`/api/accounts/${id}`, { code: '', name: '', type: 'asset', active: !active });
    toast(active ? 'Akun dinonaktifkan' : 'Akun diaktifkan', 'success');
    navigate();
  };

  window.deleteAccount = async (id) => {
    if (!confirm('Nonaktifkan akun ini?')) return;
    await del(`/api/accounts/${id}`);
    toast('Akun dinonaktifkan', 'success'); navigate();
  };
});