// Supplier (Vendor) page
route('/suppliers', async (el) => {
  document.getElementById('page-title').textContent = 'Supplier';

  const suppliers = await get('/api/suppliers');

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Supplier</div>
        <button class="btn btn-primary" onclick="newSupplier()">+ Tambah Supplier</button>
      </div>
      <div class="filters">
        <input type="text" id="search" class="form-control" placeholder="Cari nama..." oninput="filterSuppliers()">
      </div>
      ${suppliers.length ? `
      <div class="table-wrap"><table id="suppliers-table">
        <thead><tr><th>Nama</th><th>Telepon</th><th>Email</th><th>Alamat</th><th></th></tr></thead>
        <tbody>${suppliers.map(s => `
          <tr>
            <td><strong>${esc(s.name)}</strong></td>
            <td>${esc(s.phone || '-')}</td>
            <td>${esc(s.email || '-')}</td>
            <td>${esc(s.address || '-')}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="editSupplier(${s.id})">Edit</button>
              <button class="btn-icon" onclick="deleteSupplier(${s.id}, '${esc(s.name)}')" title="Hapus">🗑️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('🏢', 'Belum ada supplier. Klik "Tambah Supplier" untuk mulai.')}
    </div>
  `;

  window.filterSuppliers = () => {
    const q = document.getElementById('search').value.toLowerCase();
    document.querySelectorAll('#suppliers-table tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  };

  const supplierForm = (s = {}) => `
    <form id="form-supplier">
      <div class="form-group"><label class="form-label">Nama *</label><input class="form-control" name="name" value="${esc(s.name || '')}" required></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" name="phone" value="${esc(s.phone || '')}"></div>
        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${esc(s.email || '')}"></div>
      </div>
      <div class="form-group"><label class="form-label">Alamat</label><textarea class="form-control" name="address" rows="2">${esc(s.address || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>
  `;

  window.newSupplier = () => {
    openModal('Tambah Supplier', supplierForm());
    document.getElementById('form-supplier').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/suppliers', {
          name: f.name.value, phone: f.phone.value || null,
          email: f.email.value || null, address: f.address.value || null
        });
        closeModal(); toast('Supplier ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editSupplier = async (id) => {
    const all = await get('/api/suppliers');
    const s = all.find(x => x.id === id);
    if (!s) return toast('Supplier tidak ditemukan', 'error');
    openModal('Edit Supplier', supplierForm(s));
    document.getElementById('form-supplier').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await put(`/api/suppliers/${id}`, {
          name: f.name.value, phone: f.phone.value || null,
          email: f.email.value || null, address: f.address.value || null
        });
        closeModal(); toast('Supplier diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deleteSupplier = async (id, name) => {
    if (!confirm(`Hapus supplier "${name}"?`)) return;
    await del(`/api/suppliers/${id}`);
    toast('Supplier dihapus', 'success'); navigate();
  };
});