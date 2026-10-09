// Pengguna (Users) page
route('/users', async (el) => {
  document.getElementById('page-title').textContent = 'Pengguna';

  const [users, roles] = await Promise.all([
    get('/api/users'),
    get('/api/roles')
  ]);

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Daftar Pengguna</div>
        <button class="btn btn-primary" onclick="newUser()">+ Tambah Pengguna</button>
      </div>
      ${users.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Username</th><th>Nama Lengkap</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td><strong>${esc(u.username)}</strong></td>
            <td>${esc(u.full_name)}</td>
            <td>${esc(u.email || '-')}</td>
            <td><span class="badge badge-info">${esc(u.role_name || 'Tanpa Role')}</span></td>
            <td>${u.active ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-gray">Nonaktif</span>'}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="editUser(${u.id})">Edit</button>
              <button class="btn-icon" onclick="deleteUser(${u.id}, '${esc(u.username)}')" title="Hapus">🗑️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('👥', 'Belum ada pengguna')}
    </div>
  `;

  const roleOptions = (selected) => roles.map(r =>
    `<option value="${r.id}" ${selected === r.id ? 'selected' : ''}>${esc(r.name)}</option>`
  ).join('');

  window.newUser = () => {
    openModal('Tambah Pengguna', `
      <form id="form-user">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Username *</label><input class="form-control" name="username" required></div>
          <div class="form-group"><label class="form-label">Nama Lengkap *</label><input class="form-control" name="full_name" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email"></div>
          <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" name="phone"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Password *</label><input type="password" class="form-control" name="password" required></div>
          <div class="form-group"><label class="form-label">Role</label><select class="form-control" name="role_id"><option value="">- Tanpa Role -</option>${roleOptions()}</select></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-user').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/users', {
          username: f.username.value, full_name: f.full_name.value,
          email: f.email.value || null, phone: f.phone.value || null,
          password: f.password.value,
          role_id: f.role_id.value ? Number(f.role_id.value) : null
        });
        closeModal(); toast('Pengguna ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editUser = async (id) => {
    const u = await get(`/api/users/${id}`);
    openModal('Edit Pengguna', `
      <form id="form-user">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Username *</label><input class="form-control" name="username" value="${esc(u.username)}" required></div>
          <div class="form-group"><label class="form-label">Nama Lengkap *</label><input class="form-control" name="full_name" value="${esc(u.full_name)}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${esc(u.email || '')}"></div>
          <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" name="phone" value="${esc(u.phone || '')}"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Password (kosongkan jika tidak diubah)</label><input type="password" class="form-control" name="password" placeholder="••••••••"></div>
          <div class="form-group"><label class="form-label">Role</label><select class="form-control" name="role_id"><option value="">- Tanpa Role -</option>${roleOptions(u.role_id)}</select></div>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" name="active">
            <option value="1" ${u.active ? 'selected' : ''}>Aktif</option>
            <option value="0" ${!u.active ? 'selected' : ''}>Nonaktif</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan</button>
        </div>
      </form>
    `);
    document.getElementById('form-user').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const body = {
        username: f.username.value, full_name: f.full_name.value,
        email: f.email.value || null, phone: f.phone.value || null,
        role_id: f.role_id.value ? Number(f.role_id.value) : null,
        active: f.active.value === '1'
      };
      if (f.password.value) body.password = f.password.value;
      try {
        await put(`/api/users/${id}`, body);
        closeModal(); toast('Pengguna diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deleteUser = async (id, username) => {
    if (!confirm(`Hapus pengguna "${username}"?`)) return;
    await del(`/api/users/${id}`);
    toast('Pengguna dihapus', 'success'); navigate();
  };
});