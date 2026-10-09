// Pelanggan (Customers) page
route('/customers', async (el) => {
  document.getElementById('page-title').textContent = 'Pelanggan';

  const customers = await get('/api/customers');

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Pelanggan</div>
        <button class="btn btn-primary" onclick="newCustomer()">+ Tambah Pelanggan</button>
      </div>
      <div class="filters">
        <input type="text" id="search" class="form-control" placeholder="Cari nama..." oninput="filterCustomers()">
      </div>
      ${customers.length ? `
      <div class="table-wrap"><table id="customers-table">
        <thead><tr><th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th><th></th></tr></thead>
        <tbody>${customers.map(c => `
          <tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td>${esc(c.phone || '-')}</td>
            <td>${esc(c.email || '-')}</td>
            <td>${esc(c.address || '-')}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="editCustomer(${c.id})">Edit</button>
              <button class="btn-icon" onclick="deleteCustomer(${c.id}, '${esc(c.name)}')" title="Hapus">🗑️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('👤', 'Belum ada pelanggan. Klik "Tambah Pelanggan" untuk mulai.')}
    </div>
  `;

  window.filterCustomers = () => {
    const q = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('#customers-table tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };

  const customerForm = (c = {}) => `
    <form id="form-customer">
      <div class="form-group"><label class="form-label">Nama *</label><input class="form-control" name="name" value="${esc(c.name || '')}" required></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" name="phone" value="${esc(c.phone || '')}"></div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${esc(c.email || '')}"></div>
      </div>
      <div class="form-group"><label class="form-label">Alamat</label><textarea class="form-control" name="address" rows="2">${esc(c.address || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>
  `;

  window.newCustomer = () => {
    openModal('Tambah Pelanggan', customerForm());
    document.getElementById('form-customer').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/customers', {
          name: f.name.value, phone: f.phone.value || null,
          email: f.email.value || null, address: f.address.value || null
        });
        closeModal(); toast('Pelanggan ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editCustomer = async (id) => {
    const all = await get('/api/customers');
    const c = all.find(x => x.id === id);
    if (!c) return toast('Pelanggan tidak ditemukan', 'error');
    openModal('Edit Pelanggan', customerForm(c));
    document.getElementById('form-customer').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await put(`/api/customers/${id}`, {
          name: f.name.value, phone: f.phone.value || null,
          email: f.email.value || null, address: f.address.value || null
        });
        closeModal(); toast('Pelanggan diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deleteCustomer = async (id, name) => {
    if (!confirm(`Hapus pelanggan "${name}"?`)) return;
    await del(`/api/customers/${id}`);
    toast('Pelanggan dihapus', 'success'); navigate();
  };
});