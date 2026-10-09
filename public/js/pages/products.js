// Produk page
route('/products', async (el) => {
  document.getElementById('page-title').textContent = 'Produk';

  const [products, warehouses, categories] = await Promise.all([
    get('/api/products'),
    get('/api/warehouses'),
    get('/api/products/list/categories')
  ]);

  const lowStock = products.filter(p => p.min_stock > 0 && p.stock <= p.min_stock);

  el.innerHTML = `
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
      <div class="stat-card">
        <div class="stat-icon blue">📦</div>
        <div>
          <div class="stat-label">Total Produk</div>
          <div class="stat-value">${products.length}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon ${lowStock.length > 0 ? 'red' : 'green'}">⚠️</div>
        <div>
          <div class="stat-label">Stok Menipis</div>
          <div class="stat-value">${lowStock.length}</div>
          <div class="stat-sub">${lowStock.length > 0 ? 'Perlu restock' : 'Semua aman'}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">🏭</div>
        <div>
          <div class="stat-label">Warehouse</div>
          <div class="stat-value">${warehouses.length}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Produk</div>
        <button class="btn btn-primary" onclick="newProduct()">+ Tambah Produk</button>
      </div>
      <div class="filters">
        <input type="text" id="search" class="form-control" placeholder="Cari nama / SKU..." oninput="filterProducts()">
        <select class="form-control" id="f-category" onchange="filterProducts()">
          <option value="">Semua Kategori</option>
          ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
      </div>
      ${products.length ? `
      <div class="table-wrap"><table id="products-table">
        <thead><tr><th>SKU</th><th>Nama</th><th>Kategori</th><th>Warehouse</th><th class="amount">Harga Beli</th><th class="amount">Harga Jual</th><th class="amount">Stok</th><th>Status</th><th></th></tr></thead>
        <tbody>${products.map(p => {
          const isLow = p.min_stock > 0 && p.stock <= p.min_stock;
          return `<tr data-category="${esc(p.category || '')}">
            <td>${esc(p.sku || '-')}</td>
            <td><strong>${esc(p.name)}</strong>${p.barcode ? `<br><small style="color:var(--gray-400)">${esc(p.barcode)}</small>` : ''}</td>
            <td>${esc(p.category || '-')}</td>
            <td>${esc(p.warehouse_name || '-')}</td>
            <td class="amount">${fmtIDR(p.purchase_price)}</td>
            <td class="amount">${fmtIDR(p.selling_price)}</td>
            <td class="amount ${isLow ? 'negative' : ''}">${p.stock} ${esc(p.unit)}</td>
            <td>${isLow ? '<span class="badge badge-danger">Menipis</span>' : '<span class="badge badge-success">Aman</span>'}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="viewProduct(${p.id})">Detail</button>
              <button class="btn btn-ghost btn-sm" onclick="editProduct(${p.id})">Edit</button>
              <button class="btn btn-ghost btn-sm" onclick="adjustStock(${p.id}, '${esc(p.name)}')">Adjust</button>
              <button class="btn-icon" onclick="deleteProduct(${p.id})" title="Nonaktifkan">🗑️</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : emptyState('📦', 'Belum ada produk. Klik "Tambah Produk" untuk mulai.')}
    </div>
  `;

  window.filterProducts = () => {
    const q = document.getElementById('search').value.toLowerCase();
    const cat = document.getElementById('f-category').value;
    document.querySelectorAll('#products-table tbody tr').forEach(tr => {
      const matchQ = tr.textContent.toLowerCase().includes(q);
      const matchCat = !cat || tr.dataset.category === cat;
      tr.style.display = (matchQ && matchCat) ? '' : 'none';
    });
  };

  const whOptions = (sel) => '<option value="">- Tanpa Warehouse -</option>' + warehouses.map(w =>
    `<option value="${w.id}" ${sel === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('');

  const productForm = (p = {}) => `
    <form id="form-product">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nama Produk *</label><input class="form-control" name="name" value="${esc(p.name || '')}" required></div>
        <div class="form-group"><label class="form-label">SKU</label><input class="form-control" name="sku" value="${esc(p.sku || '')}" placeholder="PRD-001"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Barcode</label><input class="form-control" name="barcode" value="${esc(p.barcode || '')}"></div>
        <div class="form-group"><label class="form-label">Kategori</label><input class="form-control" name="category" value="${esc(p.category || '')}" placeholder="Makanan, Elektronik, dll"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Satuan</label><input class="form-control" name="unit" value="${esc(p.unit || 'pcs')}"></div>
        <div class="form-group"><label class="form-label">Warehouse</label><select class="form-control" name="warehouse_id">${whOptions(p.warehouse_id)}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Harga Beli</label><input type="number" class="form-control" name="purchase_price" value="${p.purchase_price || 0}" min="0" step="0.01"></div>
        <div class="form-group"><label class="form-label">Harga Jual</label><input type="number" class="form-control" name="selling_price" value="${p.selling_price || 0}" min="0" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Stok Minimum</label><input type="number" class="form-control" name="min_stock" value="${p.min_stock || 0}" min="0"></div>
        <div class="form-group"><label class="form-label">Stok Awal</label><input type="number" class="form-control" name="initial_stock" value="0" min="0" ${p.id ? 'disabled' : ''}></div>
      </div>
      <div class="form-group"><label class="form-label">Deskripsi</label><textarea class="form-control" name="description" rows="2">${esc(p.description || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>
  `;

  window.newProduct = () => {
    openModal('Tambah Produk', productForm());
    document.getElementById('form-product').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/products', {
          name: f.name.value, sku: f.sku.value || null, barcode: f.barcode.value || null,
          category: f.category.value || null, unit: f.unit.value || 'pcs',
          purchase_price: Number(f.purchase_price.value) || 0,
          selling_price: Number(f.selling_price.value) || 0,
          min_stock: Number(f.min_stock.value) || 0,
          warehouse_id: f.warehouse_id.value ? Number(f.warehouse_id.value) : null,
          description: f.description.value || null,
          initial_stock: Number(f.initial_stock.value) || 0
        });
        closeModal(); toast('Produk ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editProduct = async (id) => {
    const p = await get(`/api/products/${id}`);
    openModal('Edit Produk', productForm(p));
    document.getElementById('form-product').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await put(`/api/products/${id}`, {
          name: f.name.value, sku: f.sku.value || null, barcode: f.barcode.value || null,
          category: f.category.value || null, unit: f.unit.value || 'pcs',
          purchase_price: Number(f.purchase_price.value) || 0,
          selling_price: Number(f.selling_price.value) || 0,
          min_stock: Number(f.min_stock.value) || 0,
          warehouse_id: f.warehouse_id.value ? Number(f.warehouse_id.value) : null,
          description: f.description.value || null, active: true
        });
        closeModal(); toast('Produk diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.viewProduct = async (id) => {
    const p = await get(`/api/products/${id}`);
    openModal(`Produk — ${p.name}`, `
      <div class="form-row">
        <div class="form-group"><label class="form-label">SKU</label><input class="form-control" value="${esc(p.sku || '-')}" disabled></div>
        <div class="form-group"><label class="form-label">Kategori</label><input class="form-control" value="${esc(p.category || '-')}" disabled></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Stok</label><input class="form-control" value="${p.stock} ${esc(p.unit)}" disabled></div>
        <div class="form-group"><label class="form-label">Warehouse</label><input class="form-control" value="${esc(p.warehouse_name || '-')}" disabled></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Harga Beli</label><input class="form-control" value="${fmtIDR(p.purchase_price)}" disabled></div>
        <div class="form-group"><label class="form-label">Harga Jual</label><input class="form-control" value="${fmtIDR(p.selling_price)}" disabled></div>
      </div>
      <label class="form-label">Riwayat Perpindahan Stok</label>
      ${p.movements.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Tipe</th><th>Qty</th><th>Referensi</th><th>Catatan</th></tr></thead>
        <tbody>${p.movements.map(m => `
          <tr>
            <td>${m.type === 'in' ? '<span class="badge badge-success">Masuk</span>' : m.type === 'out' ? '<span class="badge badge-danger">Keluar</span>' : '<span class="badge badge-warning">Adjust</span>'}</td>
            <td class="amount">${m.qty}</td>
            <td>${esc(m.reference_type || '-')}</td>
            <td>${esc(m.notes || '-')}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<p style="color:var(--gray-400)">Belum ada perpindahan stok</p>'}
    `);
  };

  window.adjustStock = (id, name) => {
    openModal(`Adjust Stok — ${name}`, `
      <form id="form-adjust">
        <p style="color:var(--gray-500);margin-bottom:12px">Gunakan angka positif untuk menambah, negatif untuk mengurangi.</p>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Jumlah *</label><input type="number" class="form-control" name="qty" step="0.01" required></div>
          <div class="form-group"><label class="form-label">Warehouse</label><select class="form-control" name="warehouse_id">${whOptions()}</select></div>
        </div>
        <div class="form-group"><label class="form-label">Catatan</label><input class="form-control" name="notes" placeholder="Alasan penyesuaian"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-adjust').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const res = await post(`/api/products/${id}/adjust`, {
          qty: Number(f.qty.value),
          warehouse_id: f.warehouse_id.value ? Number(f.warehouse_id.value) : null,
          notes: f.notes.value || null
        });
        closeModal(); toast(`Stok disesuaikan. Stok baru: ${res.new_stock}`, 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deleteProduct = async (id) => {
    if (!confirm('Nonaktifkan produk ini?')) return;
    await del(`/api/products/${id}`);
    toast('Produk dinonaktifkan', 'success'); navigate();
  };
});