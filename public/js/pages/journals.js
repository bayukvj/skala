// Jurnal & Buku Besar page
route('/journals', async (el, query) => {
  document.getElementById('page-title').textContent = 'Jurnal & Buku Besar';

  const [journals, accounts, projects] = await Promise.all([
    get('/api/journals?limit=200'),
    get('/api/accounts'),
    get('/api/projects')
  ]);

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Jurnal Umum</div>
        <button class="btn btn-primary" onclick="newJournal()">+ Catat Jurnal</button>
      </div>
      <div class="filters">
        <input type="date" id="f-from" class="form-control" value="${query.date_from || ''}">
        <input type="date" id="f-to" class="form-control" value="${query.date_to || ''}">
        <button class="btn btn-ghost" onclick="filterJournals()">Filter</button>
      </div>
      ${journals.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Ref</th><th>Deskripsi</th><th>Proyek</th><th class="amount">Total</th><th></th></tr></thead>
        <tbody>${journals.map(j => `
          <tr>
            <td>${fmtDate(j.date)}</td>
            <td>${esc(j.ref_no || '-')}</td>
            <td>${esc(j.description || '-')}</td>
            <td>${esc(j.project_name || '-')}</td>
            <td class="amount">${fmtIDR(j.balance)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="viewJournal(${j.id})">Detail</button>
              <button class="btn-icon" onclick="deleteJournal(${j.id})" title="Hapus">🗑️</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>` : emptyState('📒', 'Belum ada jurnal. Klik "Catat Jurnal" untuk mulai.')}
    </div>
  `;

  window.filterJournals = () => {
    const from = document.getElementById('f-from').value;
    const to = document.getElementById('f-to').value;
    location.hash = `#/journals?date_from=${from}&date_to=${to}`;
  };

  window.viewJournal = async (id) => {
    const j = await get(`/api/journals/${id}`);
    const totalDebit = j.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = j.entries.reduce((s, e) => s + e.credit, 0);
    openModal(`Jurnal ${j.ref_no || j.date}`, `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Tanggal</label><input class="form-control" value="${j.date}" disabled></div>
        <div class="form-group"><label class="form-label">Referensi</label><input class="form-control" value="${esc(j.ref_no || '-')}" disabled></div>
      </div>
      <div class="form-group"><label class="form-label">Deskripsi</label><input class="form-control" value="${esc(j.description || '-')}" disabled></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Akun</th><th class="amount">Debit</th><th class="amount">Kredit</th></tr></thead>
        <tbody>${j.entries.map(e => `
          <tr>
            <td>${esc(e.account_code)} - ${esc(e.account_name)}</td>
            <td class="amount">${e.debit ? fmtIDR(e.debit) : '-'}</td>
            <td class="amount">${e.credit ? fmtIDR(e.credit) : '-'}</td>
          </tr>`).join('')}
          <tr style="font-weight:700;background:var(--gray-50)">
            <td>TOTAL</td>
            <td class="amount">${fmtIDR(totalDebit)}</td>
            <td class="amount">${fmtIDR(totalCredit)}</td>
          </tr>
        </tbody>
      </table></div>
    `);
  };

  window.deleteJournal = async (id) => {
    if (!confirm('Hapus jurnal ini?')) return;
    await del(`/api/journals/${id}`);
    toast('Jurnal dihapus', 'success');
    navigate();
  };

  window.newJournal = () => {
    const accountOptions = accounts.map(a => `<option value="${a.id}">${esc(a.code)} - ${esc(a.name)}</option>`).join('');
    const projectOptions = '<option value="">- Tanpa Proyek -</option>' + projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    openModal('Catat Jurnal Baru', `
      <form id="journal-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tanggal *</label>
            <input type="date" class="form-control" name="date" value="${todayStr()}" required>
          </div>
          <div class="form-group">
            <label class="form-label">No. Referensi</label>
            <input class="form-control" name="ref_no" placeholder="e.g. INV-001">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Deskripsi *</label>
          <input class="form-control" name="description" placeholder="Deskripsi transaksi" required>
        </div>
        <div class="form-group">
          <label class="form-label">Proyek</label>
          <select class="form-control" name="project_id">${projectOptions}</select>
        </div>
        <label class="form-label">Entry Jurnal (total Debit = total Kredit) *</label>
        <div id="entries-container">
          <div class="entry-row">
            <select class="form-control" name="account_id" required>${accountOptions}</select>
            <input type="number" class="form-control" name="debit" placeholder="Debit" min="0" step="0.01">
            <input type="number" class="form-control" name="credit" placeholder="Kredit" min="0" step="0.01">
            <button type="button" class="btn-icon" onclick="this.parentElement.remove()">✕</button>
          </div>
          <div class="entry-row">
            <select class="form-control" name="account_id" required>${accountOptions}</select>
            <input type="number" class="form-control" name="debit" placeholder="Debit" min="0" step="0.01">
            <input type="number" class="form-control" name="credit" placeholder="Kredit" min="0" step="0.01">
            <button type="button" class="btn-icon" onclick="this.parentElement.remove()">✕</button>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="addEntryRow()">+ Tambah Entry</button>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-primary">Simpan Jurnal</button>
        </div>
      </form>
    `);

    document.getElementById('journal-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const entries = [];
      form.querySelectorAll('.entry-row').forEach(row => {
        const account_id = row.querySelector('[name=account_id]').value;
        const debit = Number(row.querySelector('[name=debit]').value) || 0;
        const credit = Number(row.querySelector('[name=credit]').value) || 0;
        if (account_id && (debit || credit)) entries.push({ account_id: Number(account_id), debit, credit });
      });
      try {
        await post('/api/journals', {
          date: form.date.value,
          ref_no: form.ref_no.value || null,
          description: form.description.value,
          project_id: form.project_id.value ? Number(form.project_id.value) : null,
          entries
        });
        closeModal();
        toast('Jurnal tersimpan', 'success');
        navigate();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  };

  window.addEntryRow = () => {
    const container = document.getElementById('entries-container');
    const accountOptions = accounts.map(a => `<option value="${a.id}">${esc(a.code)} - ${esc(a.name)}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'entry-row';
    row.innerHTML = `
      <select class="form-control" name="account_id" required>${accountOptions}</select>
      <input type="number" class="form-control" name="debit" placeholder="Debit" min="0" step="0.01">
      <input type="number" class="form-control" name="credit" placeholder="Kredit" min="0" step="0.01">
      <button type="button" class="btn-icon" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
  };
});