// Pengaturan page
route('/settings', async (el) => {
  document.getElementById('page-title').textContent = 'Pengaturan';

  const settings = await get('/api/settings');

  el.innerHTML = `
    <div class="card" style="max-width:560px">
      <div class="card-header"><div class="card-title">Pengaturan Perusahaan</div></div>
      <form id="form-settings">
        <div class="form-group">
          <label class="form-label">Nama Perusahaan</label>
          <input class="form-control" name="company_name" value="${esc(settings.company_name || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Mata Uang</label>
          <select class="form-control" name="currency">
            <option value="IDR" ${settings.currency === 'IDR' ? 'selected' : ''}>IDR - Rupiah</option>
            <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD - Dolar</option>
            <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Awal Tahun Fiskal (MM-DD)</label>
          <input class="form-control" name="fiscal_year_start" value="${esc(settings.fiscal_year_start || '01-01')}" placeholder="01-01">
        </div>
        <button type="submit" class="btn btn-primary">Simpan Pengaturan</button>
      </form>
    </div>

    <div class="card" style="max-width:560px">
      <div class="card-header"><div class="card-title">Tentang Skala</div></div>
      <p style="color:var(--gray-600)">Skala v1.0 — Aplikasi manajemen keuangan bisnis dengan sistem akuntansi double-entry.</p>
      <p style="color:var(--gray-600);margin-top:8px">Fitur: Jurnal umum, buku besar, piutang, hutang, laba rugi, neraca, arus kas, dan manajemen proyek.</p>
    </div>
  `;

  document.getElementById('form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await put('/api/settings', {
      company_name: f.company_name.value,
      currency: f.currency.value,
      fiscal_year_start: f.fiscal_year_start.value
    });
    document.getElementById('company-name').textContent = f.company_name.value;
    toast('Pengaturan disimpan', 'success');
  });
});