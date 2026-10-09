// Warehouse page
route('/warehouses', async (el) => {
  document.getElementById('page-title').textContent = 'Warehouse';

  const warehouses = await get('/api/warehouses');

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Warehouse</div>
        <button class="btn btn-primary" onclick="newWarehouse()">+ Tambah Warehouse</button>
      </div>
      ${warehouses.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Kode</th><th>Lokasi</th><th class="amount">Total Item</th><th class="amount">Nilai Stok</th><th></th></tr></thead>
        <tbody>${warehouses.map(w => `
          <tr>
            <td><strong>${esc(w.name)}</strong></td>
            <td>${esc(w.code || '-')}</td>
            <td>${esc(w.location || '-')}</td>
            <td class="amount">${w.total_items}</td>
            <td class="amount">${fmtIDR(w.total_value)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="viewWarehouse(${w.id})">Stok</button>
              <button class="btn btn-ghost btn-sm" onclick="editWarehouse(${w.id})">Edit</button>
              <button class="btn-icon" onclick="deleteWarehouse(${w.id})" title="Nonaktifkan">🗑️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('🏭', 'Belum ada warehouse. Klik "Tambah Warehouse" untuk mulai.')}
    </div>
  `;

  const warehouseForm = (w = {}) => `
    <form id="form-warehouse">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nama Warehouse *</label><input class="form-control" name="name" value="${esc(w.name || '')}" required></div>
        <div class="form-group"><label class="form-label">Kode</label><input class="form-control" name="code" value="${esc(w.code || '')}" placeholder="WH-01"></div>
      </div>
      <div class="form-group"><label class="form-label">Lokasi</label><input class="form-control" name="location" value="${esc(w.location || '')}" placeholder="Alamat gudang"></div>
      <div class="form-group"><label class="form-label">Deskripsi</label><textarea class="form-control" name="description" rows="2">${esc(w.description || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>
  `;

  window.newWarehouse = () => {
    openModal('Tambah Warehouse', warehouseForm());
    document.getElementById('form-warehouse').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/warehouses', {
          name: f.name.value, code: f.code.value || null,
          location: f.location.value || null, description: f.description.value || null
        });
        closeModal(); toast('Warehouse ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editWarehouse = async (id) => {
    const w = await get(`/api/warehouses/${id}`);
    openModal('Edit Warehouse', warehouseForm(w));
    document.getElementById('form-warehouse').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await put(`/api/warehouses/${id}`, {
          name: f.name.value, code: f.code.value || null,
          location: f.location.value || null,
          description: f.description.value || null, active: true
        });
        closeModal(); toast('Warehouse diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.viewWarehouse = async (id) => {
    const w = await get(`/api/warehouses/${id}`);
    const stock = await get(`/api/warehouses/${id}/stock`);
    const totalValue = stock.reduce((s, p) => s + (p.stock * 0), 0);
    openModal(`Stok — ${w.name}`, `
      ${stock.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>SKU</th><th>Nama Produk</th><th class="amount">Stok</th><th>Min</th><th>Status</th></tr></thead>
        <tbody>${stock.map(p => {
          const isLow = p.min_stock > 0 && p.stock <= p.min_stock;
          return `<tr>
            <td>${esc(p.sku || '-')}</td>
            <td>${esc(p.name)}</td>
            <td class="amount ${isLow ? 'negative' : ''}">${p.stock} ${esc(p.unit)}</td>
            <td>${p.min_stock}</td>
            <td>${isLow ? '<span class="badge badge-danger">Menipis</span>' : '<span class="badge badge-success">Aman</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : emptyState('📦', 'Belum ada produk di warehouse ini')}
    `);
  };

  window.deleteWarehouse = async (id) => {
    if (!confirm('Nonaktifkan warehouse ini?')) return;
    await del(`/api/warehouses/${id}`);
    toast('Warehouse dinonaktifkan', 'success'); navigate();
  };
});