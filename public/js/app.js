// Skala SPA - Router & Utilities
const API = '';

// ===== API Client =====
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.detail || 'Request gagal');
    err.data = data;
    throw err;
  }
  return data;
}

const get = (p) => api(p);
const post = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body) });
const put = (p, body) => api(p, { method: 'PUT', body: JSON.stringify(body) });
const del = (p) => api(p, { method: 'DELETE' });

// ===== Formatters =====
const fmtIDR = (n) => {
  n = Number(n) || 0;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
};
const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(Number(n) || 0);
const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
const todayStr = () => new Date().toISOString().slice(0, 10);

// ===== Toast =====
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ===== Modal =====
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ===== Router =====
const routes = {};
function route(path, handler) { routes[path] = handler; }

async function navigate() {
  // Proteksi: jika belum login, redirect ke login
  if (!isLoggedIn()) {
    location.href = '/login';
    return;
  }

  const hash = location.hash.slice(1) || '/';
  const [path, queryStr] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryStr || ''));

  // Tutup sidebar mobile setelah navigasi
  closeSidebar();

  // Set active nav
  const navKey = path.split('/')[1] || 'dashboard';
  document.querySelectorAll('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === navKey);
  });

  const handler = routes[path] || routes['/'];
  const content = document.getElementById('app-content');
  content.innerHTML = '<div class="loading">Memuat...</div>';
  try {
    await handler(content, query);
  } catch (e) {
    content.innerHTML = `<div class="card"><div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div></div>`;
  }
}

window.addEventListener('hashchange', navigate);

// ===== Helpers =====
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function statusBadge(status) {
  const map = {
    paid: 'badge-success', unpaid: 'badge-danger', partial: 'badge-warning',
    overdue: 'badge-danger', active: 'badge-info', completed: 'badge-success',
    on_hold: 'badge-warning', cancelled: 'badge-gray'
  };
  const label = { paid: 'Lunas', unpaid: 'Belum Bayar', partial: 'Sebagian', overdue: 'Jatuh Tempo', active: 'Aktif', completed: 'Selesai', on_hold: 'Tertunda', cancelled: 'Batal' };
  return `<span class="badge ${map[status] || 'badge-gray'}">${label[status] || status}</span>`;
}

function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="icon">${icon}</div><p>${msg}</p></div>`;
}

// ===== Sidebar toggle (mobile) =====
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('hidden', !isOpen);
}

// Tutup sidebar saat navigasi (mobile)
function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
  }
}

// ===== Auth (login session) =====
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('skala_user') || 'null');
  } catch (e) { return null; }
}

function isLoggedIn() {
  return !!getCurrentUser();
}

function logout() {
  localStorage.removeItem('skala_user');
  location.href = '/login';
}

// ===== Print standalone document =====
function printDocument(docHtml) {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) {
    toast('Blokir popup. Izinkan popup untuk mencetak.', 'error');
    return;
  }
  w.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Cetak</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: #1f2937; font-size: 14px; line-height: 1.5; padding: 24px; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .amount.negative { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #f3f4f6; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; background: #f9fafb; }
  .print-doc { background: white; padding: 8px; max-width: 700px; margin: 0 auto; }
  .print-doc .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
  .print-doc .doc-title { font-size: 22px; font-weight: 800; color: #111827; }
  .print-doc .doc-subtitle { font-size: 12px; color: #6b7280; }
  .print-doc .doc-meta { font-size: 12px; text-align: right; color: #4b5563; }
  .print-doc .doc-section { margin: 20px 0; }
  .print-doc .doc-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 700; margin-bottom: 8px; }
  .print-doc .doc-totals { margin-left: auto; width: 280px; }
  .print-doc .doc-totals .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .print-doc .doc-totals .row.grand { font-size: 18px; font-weight: 800; border-top: 2px solid #111827; margin-top: 8px; padding-top: 8px; }
  .print-doc .doc-footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #4b5563; }
  .print-doc .doc-signature { text-align: center; margin-top: 60px; }
  .print-doc .doc-signature .line { border-top: 1px solid #9ca3af; width: 200px; margin: 40px auto 4px; padding-top: 4px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
${docHtml}
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 200); };
</script>
</body>
</html>`);
  w.document.close();
}

// Start
document.addEventListener('DOMContentLoaded', async () => {
  // Proteksi: jika belum login, redirect ke login
  if (!isLoggedIn()) {
    location.href = '/login';
    return;
  }

  const user = getCurrentUser();
  try {
    const settings = await get('/api/settings');
    if (settings.company_name) document.getElementById('company-name').textContent = settings.company_name;
  } catch (e) {}

  // Tampilkan user & tombol logout di topbar
  const topbarActions = document.querySelector('.topbar-actions');
  if (topbarActions && user) {
    const userBadge = document.createElement('div');
    userBadge.style.cssText = 'display:flex;align-items:center;gap:10px';
    userBadge.innerHTML = `
      <span style="font-size:12px;color:var(--gray-500)">${esc(user.full_name || user.username)}${user.role_name ? ' • ' + esc(user.role_name) : ''}</span>
      <button class="btn btn-ghost btn-sm" onclick="logout()" title="Logout">🚪 Keluar</button>
    `;
    topbarActions.appendChild(userBadge);
  }

  navigate();
});