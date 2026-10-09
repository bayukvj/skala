# Skala — Aplikasi Manajemen Keuangan Bisnis

Aplikasi web untuk mengelola keuangan bisnis: uang masuk/keluar, piutang, hutang, jurnal buku besar, laba rugi, neraca, arus kas, kesehatan bisnis, dan manajemen proyek. Menggunakan sistem **akuntansi double-entry** (setiap transaksi harus seimbang debit = kredit).

## Fitur

- **Dashboard** — ringkasan kesehatan bisnis: saldo kas, pendapatan, laba bersih, piutang, hutang, grafik tren & rincian beban
- **Uang Masuk & Keluar** — pencatatan cepat pendapatan, beban, dan transfer antar rekening
- **Jurnal & Buku Besar** — jurnal umum double-entry, buku besar per akun dengan saldo berjalan
- **Piutang** — tagihan pelanggan, catat pembayaran, status (belum bayar/sebagian/lunas/jatuh tempo)
- **Invoice** — buat/edit/hapus invoice, kirim (otomatis jurnal piutang & pendapatan + stok keluar), catat pembayaran
- **Payroll** — data karyawan, payroll (gaji pokok, tunjangan, potongan, gaji bersih), proses bayar (otomatis jurnal beban gaji), ringkasan per periode
- **Produk** — master produk (SKU, barcode, kategori, harga beli/jual, stok minimum), stok awal, penyesuaian stok, riwayat perpindahan
- **Warehouse** — master gudang, ringkasan stok & nilai per gudang

Integrasi: penjualan via invoice otomatis mengurangi stok produk.
- **Hutang** — tagihan supplier, catat pembayaran, status
- **Proyek** — anggaran vs biaya realisasi, laba/rugi per proyek
- **Laporan** — Laba Rugi, Neraca, Arus Kas, Neraca Saldo, Buku Besar
- **Akun (COA)** — kelola chart of accounts
- **Pengguna** — manajemen pengguna (buat, edit, hapus, aktif/nonaktif)
- **Role** — buat role dengan permissi per menu
- **Pengaturan** — nama perusahaan, mata uang, tahun fiskal

Proyek mendukung **PIC (penanggung jawab)** dan status: Aktif, Tertunda, Selesai, Batal.

## Teknologi

- Backend: Node.js + Express
- Database: SQLite (better-sqlite3) — file `data/skala.db`
- Frontend: HTML/CSS/JS (SPA hash routing), Chart.js

## Cara Menjalankan

```bash
npm install
npm start
```

Buka http://localhost:3000

Mode development (auto-reload):
```bash
npm run dev
```

## Deploy ke Render

1. Push project ke GitHub
2. Buka https://render.com → New → Web Service
3. Connect repo GitHub kamu
4. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
5. Deploy

Atau gunakan `render.yaml` (Infrastructure → New → Blueprint):
```bash
# Upload render.yaml dari repo
```

**Catatan penting:**
- Render free tier: server "sleep" setelah 15 menit tidak aktif (cold start ~30 detik)
- SQLite di Render free tier bersifat **ephemeral** — data reset saat redeploy
- Untuk data persisten:
  - Upgrade ke **Starter ($7/bulan)** + attach Disk, atau
  - Pindah ke **PostgreSQL** (Render menyediakan PostgreSQL gratis)

Login default: `admin` / `admin123`

## API

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | /api/dashboard/summary | Ringkasan dashboard |
| GET | /api/dashboard/trend | Tren 6 bulan |
| GET | /api/accounts | Daftar akun |
| POST | /api/accounts | Tambah akun |
| GET | /api/journals | Daftar jurnal |
| POST | /api/journals | Buat jurnal (validasi debit=kredit) |
| GET | /api/journals/:id | Detail jurnal |
| DELETE | /api/journals/:id | Hapus jurnal |
| GET/POST | /api/receivables | Piutang |
| POST | /api/receivables/:id/payments | Bayar piutang |
| GET/POST | /api/payables | Hutang |
| POST | /api/payables/:id/payments | Bayar hutang |
| GET/POST | /api/projects | Proyek |
| GET | /api/reports/profit-loss | Laba rugi |
| GET | /api/reports/balance-sheet | Neraca |
| GET | /api/reports/cash-flow | Arus kas |
| GET | /api/reports/ledger/:accountId | Buku besar |
| GET | /api/journals/reports/trial-balance | Neraca saldo |
| GET/PUT | /api/settings | Pengaturan |
| GET/POST/PUT/DELETE | /api/users | Pengguna |
| POST | /api/users/login | Login |
| GET/POST/PUT/DELETE | /api/roles | Role & permisi |
| GET/POST/PUT/DELETE | /api/invoices | Invoice |
| POST | /api/invoices/:id/send | Kirim invoice (buat jurnal) |
| POST | /api/invoices/:id/payments | Bayar invoice |
| GET/POST/PUT/DELETE | /api/payroll | Payroll |
| GET/POST/PUT/DELETE | /api/payroll/employees | Karyawan |
| POST | /api/payroll/:id/pay | Proses bayar payroll (buat jurnal) |
| GET | /api/payroll/summary/period | Ringkasan per periode |
| GET/POST/PUT/DELETE | /api/products | Produk |
| POST | /api/products/:id/adjust | Penyesuaian stok |
| GET/POST/PUT/DELETE | /api/warehouses | Warehouse |
| GET | /api/warehouses/:id/stock | Stok per warehouse |

## Struktur Proyek

```
skala/
├── server.js            # Entry point Express
├── db/
│   ├── connection.js    # Koneksi SQLite
│   ├── schema.sql       # Skema database
│   └── seed.js          # Data awal + contoh
├── routes/
│   ├── accounts.js      # Chart of accounts
│   ├── journals.js      # Jurnal umum
│   ├── receivables.js   # Piutang
│   ├── payables.js      # Hutang
│   ├── projects.js      # Proyek
│   ├── reports.js       # Laporan keuangan
│   ├── dashboard.js     # Ringkasan dashboard
│   ├── settings.js      # Pengaturan
│   ├── users.js       # Pengguna
│   ├── roles.js       # Role & permisi
│   ├── invoices.js    # Invoice
│   ├── payroll.js     # Payroll & karyawan
│   ├── products.js    # Produk & stok
│   ├── warehouses.js  # Warehouse
│   └── crud.js          # Customers & suppliers
└── public/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── app.js       # Router & utility
        └── pages/       # Halaman SPA
```

## Catatan

- Database disimpan di `data/skala.db`. Hapus file ini untuk reset & seed ulang.
- Semua nilai dalam Rupiah (IDR) secara default.
- Setiap jurnal wajib memenuhi prinsip double-entry: total debit = total kredit.
- User default: `admin` / `admin123` (role Administrator, akses penuh).
- Password disimpan sebagai hash SHA-256. Untuk produksi, gunakan bcrypt + HTTPS.
