// Proyek page
route('/projects', async (el) => {
  document.getElementById('page-title').textContent = 'Manajemen Proyek';

  const [projects, customers, users] = await Promise.all([
    get('/api/projects'),
    get('/api/customers'),
    get('/api/users')
  ]);

  const statusLabels = { active: 'Aktif', on_hold: 'Tertunda', completed: 'Selesai', cancelled: 'Batal' };

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Proyek</div>
        <button class="btn btn-primary" onclick="newProject()">+ Proyek Baru</button>
      </div>
      ${projects.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Pelanggan</th><th>PIC</th><th>Anggaran</th><th class="amount">Biaya</th><th class="amount">Laba</th><th>Status</th><th></th></tr></thead>
        <tbody>${projects.map(p => {
          const profit = (p.total_credit || 0) - (p.total_debit || 0);
          const budgetUsed = p.budget > 0 ? Math.min(100, ((p.total_debit || 0) / p.budget) * 100) : 0;
          return `<tr>
            <td><strong>${esc(p.name)}</strong>${p.code ? `<br><small style="color:var(--gray-400)">${esc(p.code)}</small>` : ''}</td>
            <td>${esc(p.customer_name || '-')}</td>
            <td>${esc(p.pic_name || '-')}</td>
            <td>${fmtIDR(p.budget)}</td>
            <td class="amount">${fmtIDR(p.total_debit || 0)}</td>
            <td class="amount ${profit >= 0 ? 'positive' : 'negative'}">${fmtIDR(profit)}</td>
            <td>${statusBadge(p.status)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="editProject(${p.id})">Edit</button>
              <button class="btn btn-ghost btn-sm" onclick="viewProject(${p.id})">Detail</button>
              <button class="btn-icon" onclick="deleteProject(${p.id})" title="Hapus">🗑️</button>
            </td>
          </tr>
          <tr><td colspan="8" style="padding:0 12px 8px">
            <div class="progress"><div class="progress-bar ${budgetUsed > 90 ? 'red' : budgetUsed > 70 ? 'yellow' : 'green'}" style="width:${budgetUsed}%"></div></div>
            <small style="color:var(--gray-400)">Penggunaan anggaran: ${budgetUsed.toFixed(0)}%</small>
          </td></tr>`;
        }).join('')}</tbody>
      </table></div>` : emptyState('📁', 'Belum ada proyek')}
    </div>
  `;

  const custOptions = (sel) => '<option value="">- Tanpa Pelanggan -</option>' + customers.map(c =>
    `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const userOptions = (sel) => '<option value="">- Tanpa PIC -</option>' + users.filter(u => u.active).map(u =>
    `<option value="${u.id}" ${sel === u.id ? 'selected' : ''}>${esc(u.full_name)} (${esc(u.username)})</option>`).join('');
  const statusOptions = (sel) => Object.entries(statusLabels).map(([v, l]) =>
    `<option value="${v}" ${sel === v ? 'selected' : ''}>${l}</option>`).join('');

  const projectForm = (p = {}) => `
    <form id="form-proj">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nama Proyek *</label><input class="form-control" name="name" value="${esc(p.name || '')}" required></div>
        <div class="form-group"><label class="form-label">Kode</label><input class="form-control" name="code" value="${esc(p.code || '')}" placeholder="PRJ-001"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Pelanggan</label><select class="form-control" name="customer_id">${custOptions(p.customer_id)}</select></div>
        <div class="form-group"><label class="form-label">PIC (Penanggung Jawab)</label><select class="form-control" name="pic_user_id">${userOptions(p.pic_user_id)}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Anggaran</label><input type="number" class="form-control" name="budget" min="0" step="0.01" value="${p.budget || 0}"></div>
        <div class="form-group"><label class="form-label">Status</label><select class="form-control" name="status">${statusOptions(p.status || 'active')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Tanggal Mulai</label><input type="date" class="form-control" name="start_date" value="${p.start_date || ''}"></div>
        <div class="form-group"><label class="form-label">Tanggal Selesai</label><input type="date" class="form-control" name="end_date" value="${p.end_date || ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Deskripsi</label><textarea class="form-control" name="description" rows="2">${esc(p.description || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>
  `;

  const submitForm = (form, url, method, successMsg) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = {
        name: f.name.value,
        code: f.code.value || null,
        customer_id: f.customer_id.value ? Number(f.customer_id.value) : null,
        pic_user_id: f.pic_user_id.value ? Number(f.pic_user_id.value) : null,
        budget: Number(f.budget.value) || 0,
        start_date: f.start_date.value || null,
        end_date: f.end_date.value || null,
        status: f.status.value,
        description: f.description.value || null
      };
      try {
        if (method === 'POST') await post(url, body);
        else await put(url, body);
        closeModal(); toast(successMsg, 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.newProject = () => {
    openModal('Proyek Baru', projectForm());
    submitForm(document.getElementById('form-proj'), '/api/projects', 'POST', 'Proyek ditambahkan');
  };

  window.editProject = async (id) => {
    const p = await get(`/api/projects/${id}`);
    openModal('Edit Proyek', projectForm(p));
    submitForm(document.getElementById('form-proj'), `/api/projects/${id}`, 'PUT', 'Proyek diperbarui');
  };

  window.viewProject = async (id) => {
    const p = await get(`/api/projects/${id}`);
    const profit = (p.total_credit || 0) - (p.total_debit || 0);
    openModal(`Proyek — ${p.name}`, `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Kode</label><input class="form-control" value="${esc(p.code || '-')}" disabled></div>
        <div class="form-group"><label class="form-label">Pelanggan</label><input class="form-control" value="${esc(p.customer_name || '-')}" disabled></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">PIC</label><input class="form-control" value="${esc(p.pic_name || '-')}" disabled></div>
        <div class="form-group"><label class="form-label">Status</label><input class="form-control" value="${statusLabels[p.status] || p.status}" disabled></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Anggaran</label><input class="form-control" value="${fmtIDR(p.budget)}" disabled></div>
        <div class="form-group"><label class="form-label">Total Biaya</label><input class="form-control" value="${fmtIDR(p.total_debit || 0)}" disabled></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Pendapatan</label><input class="form-control" value="${fmtIDR(p.total_credit || 0)}" disabled></div>
        <div class="form-group"><label class="form-label">${profit >= 0 ? 'Laba' : 'Rugi'}</label><input class="form-control" value="${fmtIDR(profit)}" disabled></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Mulai</label><input class="form-control" value="${fmtDate(p.start_date)}" disabled></div>
        <div class="form-group"><label class="form-label">Selesai</label><input class="form-control" value="${fmtDate(p.end_date)}" disabled></div>
      </div>
      <label class="form-label">Jurnal Terkait</label>
      ${p.journals.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Deskripsi</th></tr></thead>
        <tbody>${p.journals.map(j => `<tr><td>${fmtDate(j.date)}</td><td>${esc(j.description || '-')}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p style="color:var(--gray-400)">Belum ada jurnal terkait</p>'}
    `);
  };

  window.deleteProject = async (id) => {
    if (!confirm('Hapus proyek ini? Jurnal terkait akan tetap ada tapi tidak terhubung.')) return;
    await del(`/api/projects/${id}`);
    toast('Proyek dihapus', 'success'); navigate();
  };
});