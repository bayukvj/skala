// Invoice page
route('/invoices', async (el) => {
  document.getElementById('page-title').textContent = 'Invoice';

  const [invoices, customers, accounts, products] = await Promise.all([
    get('/api/invoices'),
    get('/api/customers'),
    get('/api/accounts'),
    get('/api/products')
  ]);

  const revenueAccounts = accounts.filter(a => a.type === 'revenue');
  const cashAccounts = accounts.filter(a => ['1001', '1002'].includes(a.code));
  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
    .reduce((s, i) => s + (i.total - i.paid_amount), 0);

  const statusLabels = { draft: 'Draft', sent: 'Dikirim', paid: 'Lunas', partial: 'Sebagian', overdue: 'Jatuh Tempo', cancelled: 'Batal' };
  const statusBadgeMap = { draft: 'badge-gray', sent: 'badge-info', paid: 'badge-success', partial: 'badge-warning', overdue: 'badge-danger', cancelled: 'badge-gray' };

  el.innerHTML = `
    <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
      <div class="stat-card">
        <div class="stat-icon yellow">🧾</div>
        <div>
          <div class="stat-label">Total Belum Lunas</div>
          <div class="stat-value">${fmtIDR(totalOutstanding)}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">📄</div>
        <div>
          <div class="stat-label">Total Invoice</div>
          <div class="stat-value">${invoices.length}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Invoice</div>
        <button class="btn btn-primary" onclick="newInvoice()">+ Buat Invoice</button>
      </div>
      ${invoices.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Pelanggan</th><th class="amount">Total</th><th class="amount">Dibayar</th><th class="amount">Sisa</th><th>Status</th><th></th></tr></thead>
        <tbody>${invoices.map(i => `
          <tr>
            <td><strong>${esc(i.invoice_no)}</strong></td>
            <td>${fmtDate(i.date)}</td>
            <td>${esc(i.customer_name)}</td>
            <td class="amount">${fmtIDR(i.total)}</td>
            <td class="amount">${fmtIDR(i.paid_amount)}</td>
            <td class="amount">${fmtIDR(i.total - i.paid_amount)}</td>
            <td><span class="badge ${statusBadgeMap[i.status]}">${statusLabels[i.status]}</span></td>
            <td>
              ${i.status === 'draft' ? `<button class="btn btn-info btn-sm" onclick="sendInvoice(${i.id})">Kirim</button>` : ''}
              ${(i.status === 'sent' || i.status === 'partial') ? `<button class="btn btn-success btn-sm" onclick="payInvoice(${i.id}, ${i.total - i.paid_amount})">Bayar</button>` : ''}
              ${i.status === 'sent' ? `<button class="btn btn-ghost btn-sm" onclick="markPaid(${i.id})">Tandai Lunas</button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="viewInvoice(${i.id})">Detail</button>
              <button class="btn btn-ghost btn-sm" onclick="previewInvoice(${i.id})">Preview</button>
              <button class="btn btn-ghost btn-sm" onclick="printInvoice(${i.id})">🖨️ Cetak</button>
              ${i.status !== 'paid' ? `<button class="btn btn-ghost btn-sm" onclick="editInvoice(${i.id})">Edit</button>` : ''}
              ${i.status !== 'paid' ? `<button class="btn-icon" onclick="deleteInvoice(${i.id})" title="Hapus">🗑️</button>` : ''}
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('🧾', 'Belum ada invoice')}
    </div>
  `;

  const custOptions = (sel) => customers.map(c =>
    `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const revOptions = () => revenueAccounts.map(a =>
    `<option value="${a.id}">${esc(a.code)} - ${esc(a.name)}</option>`).join('');
  const cashOptions = () => cashAccounts.map(a =>
    `<option value="${a.id}">${esc(a.code)} - ${esc(a.name)}</option>`).join('');
  const prodOptions = () => '<option value="">- Pilih Produk (opsional) -</option>' + products.map(p =>
    `<option value="${p.id}" data-price="${p.selling_price}" data-name="${esc(p.name)}">${esc(p.sku || '')} - ${esc(p.name)} (Stok: ${p.stock})</option>`).join('');

  const invoiceForm = (inv = null) => {
    const items = inv?.items || [{ description: '', qty: 1, price: 0, revenue_account_id: revenueAccounts[0]?.id }];
    return `
      <form id="form-inv">
        <div class="form-row">
          <div class="form-group"><label class="form-label">No. Invoice *</label><input class="form-control" name="invoice_no" value="${esc(inv?.invoice_no || 'INV-' + Date.now().toString().slice(-6))}" required></div>
          <div class="form-group"><label class="form-label">Tanggal *</label><input type="date" class="form-control" name="date" value="${esc(inv?.date || todayStr())}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Pelanggan *</label><select class="form-control" name="customer_id" required>${custOptions(inv?.customer_id)}</select></div>
          <div class="form-group"><label class="form-label">Jatuh Tempo</label><input type="date" class="form-control" name="due_date" value="${esc(inv?.due_date || '')}"></div>
        </div>
        <label class="form-label">Item *</label>
        <div id="items-container">
          ${items.map(it => `
            <div class="entry-row" style="grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr auto">
              <select class="form-control" name="product_id" onchange="onInvoiceProductChange(this)">${prodOptions(it.product_id)}</select>
              <input class="form-control" name="description" placeholder="Deskripsi item" value="${esc(it.description || '')}" required>
              <input type="number" class="form-control" name="qty" value="${it.qty || 1}" min="0" step="0.01" oninput="recalcInvoice()">
              <input type="number" class="form-control" name="price" placeholder="Harga" value="${it.price || 0}" min="0" step="0.01" oninput="recalcInvoice()">
              <input class="form-control" name="amount" placeholder="Jumlah" value="${it.amount || 0}" readonly>
              <select class="form-control" name="revenue_account_id">${revOptions(it.revenue_account_id)}</select>
              <button type="button" class="btn-icon" onclick="this.parentElement.remove(); recalcInvoice()">✕</button>
            </div>`).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="addInvoiceItem()">+ Tambah Item</button>
        <div class="form-row" style="margin-top:16px">
          <div class="form-group"><label class="form-label">PPN / Pajak</label><input type="number" class="form-control" name="tax" id="inv-tax" value="${inv?.tax || 0}" min="0" step="0.01"></div>
          <div class="form-group"><label class="form-label">Total</label><input class="form-control" id="inv-total" value="0" readonly></div>
        </div>
        <div class="form-group"><label class="form-label">Catatan</label><textarea class="form-control" name="notes" rows="2">${esc(inv?.notes || '')}</textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `;
  };

  const recalcInvoice = () => {
    const form = document.getElementById('form-inv');
    if (!form) return;
    let subtotal = 0;
    form.querySelectorAll('#items-container .entry-row').forEach(row => {
      const qty = Number(row.querySelector('[name=qty]').value) || 0;
      const price = Number(row.querySelector('[name=price]').value) || 0;
      const amount = qty * price;
      row.querySelector('[name=amount]').value = amount;
      subtotal += amount;
    });
    const tax = Number(form.querySelector('#inv-tax').value) || 0;
    form.querySelector('#inv-total').value = subtotal + tax;
  };

  window.addInvoiceItem = () => {
    const container = document.getElementById('items-container');
    const row = document.createElement('div');
    row.className = 'entry-row';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr 1fr 1fr auto';
    row.innerHTML = `
      <select class="form-control" name="product_id" onchange="onInvoiceProductChange(this)">${prodOptions()}</select>
      <input class="form-control" name="description" placeholder="Deskripsi item" required>
      <input type="number" class="form-control" name="qty" value="1" min="0" step="0.01" oninput="recalcInvoice()">
      <input type="number" class="form-control" name="price" placeholder="Harga" min="0" step="0.01" oninput="recalcInvoice()">
      <input class="form-control" name="amount" placeholder="Jumlah" readonly>
      <select class="form-control" name="revenue_account_id">${revOptions()}</select>
      <button type="button" class="btn-icon" onclick="this.parentElement.remove(); recalcInvoice()">✕</button>
    `;
    container.appendChild(row);
    recalcInvoice();
  };

  window.onInvoiceProductChange = (select) => {
    const row = select.parentElement;
    const opt = select.options[select.selectedIndex];
    if (opt.value) {
      row.querySelector('[name=description]').value = opt.dataset.name || '';
      row.querySelector('[name=price]').value = opt.dataset.price || 0;
      recalcInvoice();
    }
  };

  const collectItems = (form) => {
    const items = [];
    form.querySelectorAll('#items-container .entry-row').forEach(row => {
      const desc = row.querySelector('[name=description]').value;
      if (!desc) return;
      const productId = row.querySelector('[name=product_id]').value;
      items.push({
        description: desc,
        qty: Number(row.querySelector('[name=qty]').value) || 1,
        price: Number(row.querySelector('[name=price]').value) || 0,
        product_id: productId ? Number(productId) : null,
        revenue_account_id: Number(row.querySelector('[name=revenue_account_id]').value) || null
      });
    });
    return items;
  };

  window.newInvoice = () => {
    openModal('Buat Invoice', invoiceForm());
    const form = document.getElementById('form-inv');
    form.querySelectorAll('#items-container input').forEach(i => i.addEventListener('input', recalcInvoice));
    form.querySelector('#inv-tax').addEventListener('input', recalcInvoice);
    recalcInvoice();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/invoices', {
          invoice_no: f.invoice_no.value, date: f.date.value,
          customer_id: Number(f.customer_id.value),
          due_date: f.due_date.value || null,
          tax: Number(f.tax.value) || 0,
          notes: f.notes.value || null,
          items: collectItems(f)
        });
        closeModal(); toast('Invoice dibuat', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editInvoice = async (id) => {
    const inv = await get(`/api/invoices/${id}`);
    openModal('Edit Invoice', invoiceForm(inv));
    const form = document.getElementById('form-inv');
    form.querySelectorAll('#items-container input').forEach(i => i.addEventListener('input', recalcInvoice));
    form.querySelector('#inv-tax').addEventListener('input', recalcInvoice);
    recalcInvoice();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await put(`/api/invoices/${id}`, {
          invoice_no: f.invoice_no.value, date: f.date.value,
          customer_id: Number(f.customer_id.value),
          due_date: f.due_date.value || null,
          tax: Number(f.tax.value) || 0,
          notes: f.notes.value || null,
          status: inv.status,
          items: collectItems(f)
        });
        closeModal(); toast('Invoice diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.viewInvoice = async (id) => {
    const inv = await get(`/api/invoices/${id}`);
    openModal(`Invoice ${inv.invoice_no}`, `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Tanggal</label><input class="form-control" value="${fmtDate(inv.date)}" disabled></div>
        <div class="form-group"><label class="form-label">Pelanggan</label><input class="form-control" value="${esc(inv.customer_name)}" disabled></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Jatuh Tempo</label><input class="form-control" value="${fmtDate(inv.due_date)}" disabled></div>
        <div class="form-group"><label class="form-label">Status</label><input class="form-control" value="${statusLabels[inv.status]}" disabled></div>
      </div>
      <label class="form-label">Item</label>
      <div class="table-wrap"><table>
        <thead><tr><th>Produk</th><th>Deskripsi</th><th class="amount">Qty</th><th class="amount">Harga</th><th class="amount">Jumlah</th></tr></thead>
        <tbody>${inv.items.map(it => `
          <tr>
            <td>${it.product_sku ? `<strong>${esc(it.product_sku)}</strong><br><small>${esc(it.product_name || '')}</small>` : '-'}</td>
            <td>${esc(it.description)}</td>
            <td class="amount">${it.qty}</td>
            <td class="amount">${fmtIDR(it.price)}</td>
            <td class="amount">${fmtIDR(it.amount)}</td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div style="text-align:right;margin-top:12px">
        <div>Subtotal: <strong>${fmtIDR(inv.subtotal)}</strong></div>
        <div>Pajak: <strong>${fmtIDR(inv.tax)}</strong></div>
        <div style="font-size:18px;margin-top:6px">Total: <strong>${fmtIDR(inv.total)}</strong></div>
        <div>Dibayar: <strong>${fmtIDR(inv.paid_amount)}</strong></div>
        <div>Sisa: <strong>${fmtIDR(inv.total - inv.paid_amount)}</strong></div>
      </div>
    `);
  };

  window.sendInvoice = async (id) => {
    if (!confirm('Kirim invoice? Ini akan membuat jurnal piutang & pendapatan.')) return;
    try {
      await post(`/api/invoices/${id}/send`);
      toast('Invoice dikirim, jurnal dibuat', 'success'); navigate();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.markPaid = async (id) => {
    if (!confirm('Tandai invoice lunas?')) return;
    try {
      await post(`/api/invoices/${id}/mark-paid`);
      toast('Invoice dilunasi', 'success'); navigate();
    } catch (err) { toast(err.message, 'error'); }
  };

  window.payInvoice = (id, remaining) => {
    openModal('Bayar Invoice', `
      <form id="form-payinv">
        <div class="form-group"><label class="form-label">Sisa Tagihan</label><input class="form-control" value="${fmtIDR(remaining)}" disabled></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Jumlah Bayar *</label><input type="number" class="form-control" name="amount" value="${remaining}" min="0.01" step="0.01" required></div>
          <div class="form-group"><label class="form-label">Tanggal Bayar</label><input type="date" class="form-control" name="payment_date" value="${todayStr()}"></div>
        </div>
        <div class="form-group"><label class="form-label">Rekening Kas/Bank</label><select class="form-control" name="cash_account_id">${cashOptions()}</select></div>
        <div class="form-group"><label class="form-label">Metode</label>
          <select class="form-control" name="method"><option>Tunai</option><option>Transfer Bank</option><option>QRIS</option></select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-success">Catat Pembayaran</button>
        </div>
      </form>
    `);
    document.getElementById('form-payinv').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post(`/api/invoices/${id}/payments`, {
          amount: Number(f.amount.value),
          payment_date: f.payment_date.value,
          method: f.method.value,
          cash_account_id: Number(f.cash_account_id.value)
        });
        closeModal(); toast('Pembayaran tercatat', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deleteInvoice = async (id) => {
    if (!confirm('Hapus invoice ini?')) return;
    try {
      await del(`/api/invoices/${id}`);
      toast('Invoice dihapus', 'success'); navigate();
    } catch (err) { toast(err.message, 'error'); }
  };

  // ===== PREVIEW & PRINT =====
  const buildInvoiceDoc = (inv, company) => {
    const items = inv.items.map(it => `
      <tr>
        <td>${esc(it.description)}</td>
        <td class="amount">${it.qty}</td>
        <td class="amount">${fmtIDR(it.price)}</td>
        <td class="amount">${fmtIDR(it.amount)}</td>
      </tr>`).join('');
    return `
      <div class="print-doc">
        <div class="doc-header">
          <div>
            <div class="doc-title">${esc(company.company_name || 'Skala Bisnis')}</div>
            <div class="doc-subtitle">INVOICE</div>
          </div>
          <div class="doc-meta">
            <div><strong>${esc(inv.invoice_no)}</strong></div>
            <div>Tanggal: ${fmtDate(inv.date)}</div>
            <div>Jatuh Tempo: ${fmtDate(inv.due_date)}</div>
          </div>
        </div>
        <div class="doc-section">
          <div class="doc-section-title">Kepada</div>
          <strong>${esc(inv.customer_name)}</strong>
        </div>
        <div class="doc-section">
          <table>
            <thead><tr><th>Deskripsi</th><th class="amount">Qty</th><th class="amount">Harga</th><th class="amount">Jumlah</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
        </div>
        <div class="doc-totals">
          <div class="row"><span>Subtotal</span><span>${fmtIDR(inv.subtotal)}</span></div>
          <div class="row"><span>Pajak</span><span>${fmtIDR(inv.tax)}</span></div>
          <div class="row grand"><span>Total</span><span>${fmtIDR(inv.total)}</span></div>
          <div class="row"><span>Dibayar</span><span>${fmtIDR(inv.paid_amount)}</span></div>
          <div class="row"><span>Sisa</span><span>${fmtIDR(inv.total - inv.paid_amount)}</span></div>
        </div>
        ${inv.notes ? `<div class="doc-section"><div class="doc-section-title">Catatan</div><div>${esc(inv.notes)}</div></div>` : ''}
        <div class="doc-signature">
          <div>Hormat kami,</div>
          <div class="line">${esc(company.company_name || 'Skala Bisnis')}</div>
        </div>
      </div>
    `;
  };

  window.previewInvoice = async (id) => {
    const [inv, company] = await Promise.all([
      get(`/api/invoices/${id}`),
      get('/api/settings')
    ]);
    openModal(`Preview Invoice ${inv.invoice_no}`, `
      ${buildInvoiceDoc(inv, company)}
      <div class="no-print" style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
        <button class="btn btn-primary" onclick="printInvoice(${inv.id})">🖨️ Cetak</button>
      </div>
    `);
    document.querySelector('.modal').style.maxWidth = '760px';
  };

  window.printInvoice = async (id) => {
    const [inv, company] = await Promise.all([
      get(`/api/invoices/${id}`),
      get('/api/settings')
    ]);
    printDocument(buildInvoiceDoc(inv, company));
  };
});