// Role page
route('/roles', async (el) => {
  document.getElementById('page-title').textContent = 'Role & Permisi';

  const [roles, permissions] = await Promise.all([
    get('/api/roles'),
    get('/api/roles/list/permissions')
  ]);

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Role</div>
        <button class="btn btn-primary" onclick="newRole()">+ Tambah Role</button>
      </div>
      ${roles.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Nama Role</th><th>Deskripsi</th><th>Permisi</th><th>Pengguna</th><th></th></tr></thead>
        <tbody>${roles.map(r => {
          let perms = [];
          try { perms = JSON.parse(r.permissions || '[]'); } catch (e) {}
          return `<tr>
            <td><strong>${esc(r.name)}</strong></td>
            <td>${esc(r.description || '-')}</td>
            <td>${perms.length ? perms.map(p => `<span class="badge badge-gray" style="margin:1px">${esc(p)}</span>`).join('') : '<span style="color:var(--gray-400)">-</span>'}</td>
            <td>${r.user_count}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="editRole(${r.id})">Edit</button>
              <button class="btn-icon" onclick="deleteRole(${r.id}, '${esc(r.name)}', ${r.user_count})" title="Hapus">🗑️</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : emptyState('🛡️', 'Belum ada role')}
    </div>
  `;

  const permCheckboxes = (selected = []) => permissions.map(p => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer">
      <input type="checkbox" name="permissions" value="${p.key}" ${selected.includes(p.key) ? 'checked' : ''}>
      <span>${esc(p.label)}</span>
    </label>
  `).join('');

  window.newRole = () => {
    openModal('Tambah Role', `
      <form id="form-role">
        <div class="form-group"><label class="form-label">Nama Role *</label><input class="form-control" name="name" required></div>
        <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-control" name="description"></div>
        <label class="form-label">Permisi</label>
        <div style="border:1px solid var(--gray-200);border-radius:8px;padding:12px;max-height:280px;overflow-y:auto">
          ${permCheckboxes()}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-role').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const perms = Array.from(f.querySelectorAll('[name=permissions]:checked')).map(c => c.value);
      try {
        await post('/api/roles', { name: f.name.value, description: f.description.value || null, permissions: perms });
        closeModal(); toast('Role ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editRole = async (id) => {
    const r = await get(`/api/roles/${id}`);
    let selected = [];
    try { selected = JSON.parse(r.permissions || '[]'); } catch (e) {}
    openModal('Edit Role', `
      <form id="form-role">
        <div class="form-group"><label class="form-label">Nama Role *</label><input class="form-control" name="name" value="${esc(r.name)}" required></div>
        <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-control" name="description" value="${esc(r.description || '')}"></div>
        <label class="form-label">Permisi</label>
        <div style="border:1px solid var(--gray-200);border-radius:8px;padding:12px;max-height:280px;overflow-y:auto">
          ${permCheckboxes(selected)}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-role').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const perms = Array.from(f.querySelectorAll('[name=permissions]:checked')).map(c => c.value);
      try {
        await put(`/api/roles/${id}`, { name: f.name.value, description: f.description.value || null, permissions: perms });
        closeModal(); toast('Role diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deleteRole = async (id, name, userCount) => {
    if (userCount > 0) {
      toast(`Role "${name}" masih dipakai ${userCount} pengguna. Ubah role pengguna dulu.`, 'error');
      return;
    }
    if (!confirm(`Hapus role "${name}"?`)) return;
    await del(`/api/roles/${id}`);
    toast('Role dihapus', 'success'); navigate();
  };
});