// Payroll page
route('/payroll', async (el) => {
  document.getElementById('page-title').textContent = 'Payroll';

  const [payrolls, employees, summary, accounts] = await Promise.all([
    get('/api/payroll'),
    get('/api/payroll/employees'),
    get('/api/payroll/summary/period'),
    get('/api/accounts')
  ]);

  const cashAccounts = accounts.filter(a => ['1001', '1002'].includes(a.code));
  const currentPeriod = new Date().toISOString().slice(0, 7);

  el.innerHTML = `
    <div class="tabs">
      <button class="tab active" onclick="switchPayrollTab('list')">Daftar Payroll</button>
      <button class="tab" onclick="switchPayrollTab('employees')">Karyawan</button>
      <button class="tab" onclick="switchPayrollTab('summary')">Ringkasan Periode</button>
    </div>

    <div id="tab-list">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Daftar Payroll</div>
          <button class="btn btn-primary" onclick="newPayroll()">+ Buat Payroll</button>
        </div>
        ${payrolls.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Periode</th><th>Karyawan</th><th>Jabatan</th><th class="amount">Gaji Pokok</th><th class="amount">Tunjangan</th><th class="amount">Potongan</th><th class="amount">Gaji Bersih</th><th>Status</th><th></th></tr></thead>
          <tbody>${payrolls.map(p => `
            <tr>
              <td><strong>${esc(p.period)}</strong></td>
              <td>${esc(p.employee_name)}</td>
              <td>${esc(p.position || '-')}</td>
              <td class="amount">${fmtIDR(p.base_salary)}</td>
              <td class="amount">${fmtIDR(p.allowances)}</td>
              <td class="amount">${fmtIDR(p.deductions)}</td>
              <td class="amount positive">${fmtIDR(p.net_pay)}</td>
              <td>${p.status === 'paid' ? '<span class="badge badge-success">Dibayar</span>' : '<span class="badge badge-gray">Draft</span>'}</td>
              <td>
                ${p.status === 'draft' ? `<button class="btn btn-success btn-sm" onclick="payPayroll(${p.id})">Proses Bayar</button>` : ''}
                ${p.status === 'draft' ? `<button class="btn btn-ghost btn-sm" onclick="editPayroll(${p.id})">Edit</button>` : ''}
                ${p.status === 'draft' ? `<button class="btn-icon" onclick="deletePayroll(${p.id})" title="Hapus">🗑️</button>` : ''}
              ${p.status === 'paid' ? `<button class="btn btn-ghost btn-sm" onclick="previewSlip(${p.id})">Preview Slip</button>` : ''}
              ${p.status === 'paid' ? `<button class="btn btn-ghost btn-sm" onclick="printSlip(${p.id})">🖨️ Cetak Slip</button>` : ''}
              </td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('💳', 'Belum ada payroll')}
      </div>
    </div>

    <div id="tab-employees" class="hidden">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Data Karyawan</div>
          <button class="btn btn-primary" onclick="newEmployee()">+ Tambah Karyawan</button>
        </div>
        ${employees.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Nama</th><th>No. Karyawan</th><th>Jabatan</th><th class="amount">Gaji Pokok</th><th>Telepon</th><th></th></tr></thead>
          <tbody>${employees.map(e => `
            <tr>
              <td><strong>${esc(e.name)}</strong></td>
              <td>${esc(e.employee_no || '-')}</td>
              <td>${esc(e.position || '-')}</td>
              <td class="amount">${fmtIDR(e.base_salary)}</td>
              <td>${esc(e.phone || '-')}</td>
              <td>
                <button class="btn btn-ghost btn-sm" onclick="editEmployee(${e.id})">Edit</button>
                <button class="btn-icon" onclick="deleteEmployee(${e.id})" title="Nonaktifkan">🗑️</button>
              </td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('👤', 'Belum ada karyawan')}
      </div>
    </div>

    <div id="tab-summary" class="hidden">
      <div class="card">
        <div class="card-header"><div class="card-title">Ringkasan Payroll per Periode</div></div>
        ${summary.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Periode</th><th class="amount">Karyawan</th><th class="amount">Total Gaji Pokok</th><th class="amount">Total Tunjangan</th><th class="amount">Total Potongan</th><th class="amount">Total Gaji Bersih</th></tr></thead>
          <tbody>${summary.map(s => `
            <tr>
              <td><strong>${esc(s.period)}</strong></td>
              <td class="amount">${s.employee_count}</td>
              <td class="amount">${fmtIDR(s.total_base)}</td>
              <td class="amount">${fmtIDR(s.total_allowances)}</td>
              <td class="amount">${fmtIDR(s.total_deductions)}</td>
              <td class="amount positive">${fmtIDR(s.total_net_pay)}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : emptyState('📊', 'Belum ada data payroll')}
      </div>
    </div>
  `;

  window.switchPayrollTab = (tab) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    ['list', 'employees', 'summary'].forEach(t => {
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab);
    });
  };

  const empOptions = (sel) => employees.map(e =>
    `<option value="${e.id}" ${sel === e.id ? 'selected' : ''}>${esc(e.name)} — ${fmtIDR(e.base_salary)}</option>`).join('');
  const cashOptions = () => cashAccounts.map(a =>
    `<option value="${a.id}">${esc(a.code)} - ${esc(a.name)}</option>`).join('');

  // ===== EMPLOYEE CRUD =====
  const employeeForm = (e = {}) => `
    <form id="form-emp">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Nama *</label><input class="form-control" name="name" value="${esc(e.name || '')}" required></div>
        <div class="form-group"><label class="form-label">No. Karyawan</label><input class="form-control" name="employee_no" value="${esc(e.employee_no || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Jabatan</label><input class="form-control" name="position" value="${esc(e.position || '')}"></div>
        <div class="form-group"><label class="form-label">Gaji Pokok</label><input type="number" class="form-control" name="base_salary" value="${e.base_salary || 0}" min="0" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Telepon</label><input class="form-control" name="phone" value="${esc(e.phone || '')}"></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-control" name="email" value="${esc(e.email || '')}"></div>
      </div>
      <div class="form-group"><label class="form-label">Alamat</label><textarea class="form-control" name="address" rows="2">${esc(e.address || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>
  `;

  window.newEmployee = () => {
    openModal('Tambah Karyawan', employeeForm());
    document.getElementById('form-emp').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/payroll/employees', {
          name: f.name.value, employee_no: f.employee_no.value || null,
          position: f.position.value || null,
          base_salary: Number(f.base_salary.value) || 0,
          phone: f.phone.value || null, email: f.email.value || null,
          address: f.address.value || null
        });
        closeModal(); toast('Karyawan ditambahkan', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editEmployee = async (id) => {
    const all = await get('/api/payroll/employees');
    const e = all.find(x => x.id === id);
    if (!e) return toast('Karyawan tidak ditemukan', 'error');
    openModal('Edit Karyawan', employeeForm(e));
    document.getElementById('form-emp').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      try {
        await put(`/api/payroll/employees/${id}`, {
          name: f.name.value, employee_no: f.employee_no.value || null,
          position: f.position.value || null,
          base_salary: Number(f.base_salary.value) || 0,
          phone: f.phone.value || null, email: f.email.value || null,
          address: f.address.value || null, active: true
        });
        closeModal(); toast('Karyawan diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deleteEmployee = async (id) => {
    if (!confirm('Nonaktifkan karyawan ini?')) return;
    await del(`/api/payroll/employees/${id}`);
    toast('Karyawan dinonaktifkan', 'success'); navigate();
  };

  // ===== PAYROLL CRUD =====
  const payrollForm = (p = {}) => `
    <form id="form-payroll">
      <div class="form-row">
        <div class="form-group"><label class="form-label">Periode (YYYY-MM) *</label><input class="form-control" name="period" value="${esc(p.period || currentPeriod)}" placeholder="2026-10" required></div>
        <div class="form-group"><label class="form-label">Karyawan *</label><select class="form-control" name="employee_id" id="payroll-emp" required>${empOptions(p.employee_id)}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Gaji Pokok *</label><input type="number" class="form-control" name="base_salary" id="payroll-base" value="${p.base_salary || 0}" min="0" step="0.01" required></div>
        <div class="form-group"><label class="form-label">Tunjangan</label><input type="number" class="form-control" name="allowances" id="payroll-allow" value="${p.allowances || 0}" min="0" step="0.01"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Potongan</label><input type="number" class="form-control" name="deductions" id="payroll-ded" value="${p.deductions || 0}" min="0" step="0.01"></div>
        <div class="form-group"><label class="form-label">Gaji Bersih</label><input class="form-control" id="payroll-net" value="0" readonly></div>
      </div>
      <div class="form-group"><label class="form-label">Catatan</label><textarea class="form-control" name="notes" rows="2">${esc(p.notes || '')}</textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan Draft</button>
      </div>
    </form>
  `;

  const recalcPayroll = () => {
    const base = Number(document.getElementById('payroll-base')?.value) || 0;
    const allow = Number(document.getElementById('payroll-allow')?.value) || 0;
    const ded = Number(document.getElementById('payroll-ded')?.value) || 0;
    const net = document.getElementById('payroll-net');
    if (net) net.value = base + allow - ded;
  };

  window.newPayroll = () => {
    openModal('Buat Payroll', payrollForm());
    const form = document.getElementById('form-payroll');
    ['payroll-base', 'payroll-allow', 'payroll-ded'].forEach(id => {
      document.getElementById(id).addEventListener('input', recalcPayroll);
    });
    // Isi gaji pokok otomatis dari karyawan
    const empSelect = document.getElementById('payroll-emp');
    const fillSalary = () => {
      const emp = employees.find(e => e.id === Number(empSelect.value));
      if (emp) document.getElementById('payroll-base').value = emp.base_salary;
      recalcPayroll();
    };
    empSelect.addEventListener('change', fillSalary);
    fillSalary();
    recalcPayroll();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post('/api/payroll', {
          period: f.period.value,
          employee_id: Number(f.employee_id.value),
          base_salary: Number(f.base_salary.value) || 0,
          allowances: Number(f.allowances.value) || 0,
          deductions: Number(f.deductions.value) || 0,
          notes: f.notes.value || null
        });
        closeModal(); toast('Payroll dibuat (draft)', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.editPayroll = async (id) => {
    const p = await get(`/api/payroll/${id}`);
    openModal('Edit Payroll', payrollForm(p));
    ['payroll-base', 'payroll-allow', 'payroll-ded'].forEach(xid => {
      document.getElementById(xid).addEventListener('input', recalcPayroll);
    });
    recalcPayroll();
    document.getElementById('form-payroll').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await put(`/api/payroll/${id}`, {
          period: f.period.value,
          employee_id: Number(f.employee_id.value),
          base_salary: Number(f.base_salary.value) || 0,
          allowances: Number(f.allowances.value) || 0,
          deductions: Number(f.deductions.value) || 0,
          notes: f.notes.value || null
        });
        closeModal(); toast('Payroll diperbarui', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.payPayroll = (id) => {
    openModal('Proses Pembayaran Payroll', `
      <form id="form-pay">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tanggal Bayar</label><input type="date" class="form-control" name="payment_date" value="${todayStr()}"></div>
          <div class="form-group"><label class="form-label">Rekening Kas/Bank</label><select class="form-control" name="cash_account_id">${cashOptions()}</select></div>
        </div>
        <p style="color:var(--gray-500)">Ini akan membuat jurnal: Beban Gaji (debit) & Kas/Bank (kredit).</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button type="submit" class="btn btn-success">Proses Bayar</button>
        </div>
      </form>
    `);
    document.getElementById('form-pay').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await post(`/api/payroll/${id}/pay`, {
          payment_date: f.payment_date.value,
          cash_account_id: Number(f.cash_account_id.value)
        });
        closeModal(); toast('Payroll dibayar, jurnal dibuat', 'success'); navigate();
      } catch (err) { toast(err.message, 'error'); }
    });
  };

  window.deletePayroll = async (id) => {
    if (!confirm('Hapus payroll draft ini?')) return;
    await del(`/api/payroll/${id}`);
    toast('Payroll dihapus', 'success'); navigate();
  };

  // ===== SLIP GAJI PREVIEW & PRINT =====
  const buildSlipDoc = (p, company) => {
    return `
      <div class="print-doc">
        <div class="doc-header">
          <div>
            <div class="doc-title">${esc(company.company_name || 'Skala Bisnis')}</div>
            <div class="doc-subtitle">SLIP GAJI</div>
          </div>
          <div class="doc-meta">
            <div><strong>Periode: ${esc(p.period)}</strong></div>
            <div>Tanggal Bayar: ${fmtDate(p.payment_date)}</div>
          </div>
        </div>
        <div class="doc-section">
          <div class="doc-section-title">Karyawan</div>
          <strong>${esc(p.employee_name)}</strong>
          ${p.employee_no ? `<div>No. Karyawan: ${esc(p.employee_no)}</div>` : ''}
          ${p.position ? `<div>Jabatan: ${esc(p.position)}</div>` : ''}
        </div>
        <div class="doc-section">
          <div class="doc-section-title">Rincian</div>
          <table>
            <tbody>
              <tr><td>Gaji Pokok</td><td class="amount">${fmtIDR(p.base_salary)}</td></tr>
              <tr><td>Tunjangan</td><td class="amount">${fmtIDR(p.allowances)}</td></tr>
              <tr><td>Potongan</td><td class="amount negative">(${fmtIDR(p.deductions)})</td></tr>
            </tbody>
          </table>
        </div>
        <div class="doc-totals">
          <div class="row grand"><span>Gaji Bersih</span><span>${fmtIDR(p.net_pay)}</span></div>
        </div>
        ${p.notes ? `<div class="doc-section"><div class="doc-section-title">Catatan</div><div>${esc(p.notes)}</div></div>` : ''}
        <div class="doc-signature">
          <div>Hormat kami,</div>
          <div class="line">${esc(company.company_name || 'Skala Bisnis')}</div>
        </div>
      </div>
    `;
  };

  window.previewSlip = async (id) => {
    const [p, company] = await Promise.all([
      get(`/api/payroll/${id}`),
      get('/api/settings')
    ]);
    openModal(`Slip Gaji — ${p.employee_name} (${p.period})`, `
      ${buildSlipDoc(p, company)}
      <div class="no-print" style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" onclick="closeModal()">Tutup</button>
        <button class="btn btn-primary" onclick="printSlip(${p.id})">🖨️ Cetak</button>
      </div>
    `);
    document.querySelector('.modal').style.maxWidth = '700px';
  };

  window.printSlip = async (id) => {
    const [p, company] = await Promise.all([
      get(`/api/payroll/${id}`),
      get('/api/settings')
    ]);
    printDocument(buildSlipDoc(p, company));
  };
});