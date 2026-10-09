// Seed data awal untuk Skala
import db from './connection.js';
import crypto from 'crypto';

const hashPassword = (pw) => crypto.createHash('sha256').update(String(pw)).digest('hex');

export function seed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM accounts').get().c;
  if (count > 0) {
    console.log('Data sudah ada, skip seeding.');
    return;
  }

  const insertAccount = db.prepare(`
    INSERT INTO accounts (code, name, type, parent_id, is_header, currency)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const accounts = [
    // ASET
    ['1001', 'Kas', 'asset', null, 0, 'IDR'],
    ['1002', 'Bank', 'asset', null, 0, 'IDR'],
    ['1003', 'Piutang', 'asset', null, 0, 'IDR'],
    ['1101', 'Persediaan', 'asset', null, 0, 'IDR'],
    ['1201', 'Perlengkapan', 'asset', null, 0, 'IDR'],
    // KEWAJIBAN
    ['2001', 'Hutang', 'liability', null, 0, 'IDR'],
    ['2002', 'Hutang Bank', 'liability', null, 0, 'IDR'],
    ['2101', 'Utang Gaji', 'liability', null, 0, 'IDR'],
    ['2201', 'Utang Pajak', 'liability', null, 0, 'IDR'],
    // MODAL
    ['3001', 'Modal', 'equity', null, 0, 'IDR'],
    ['3002', 'Modal Ditahan (Retained Earnings)', 'equity', null, 0, 'IDR'],
    // PENDAPATAN
    ['4001', 'Pendapatan Penjualan', 'revenue', null, 0, 'IDR'],
    ['4002', 'Pendapatan Jasa', 'revenue', null, 0, 'IDR'],
    ['4101', 'Pendapatan Lainnya', 'revenue', null, 0, 'IDR'],
    // BEBAN
    ['5001', 'Beban Gaji', 'expense', null, 0, 'IDR'],
    ['5002', 'Beban Sewa', 'expense', null, 0, 'IDR'],
    ['5003', 'Beban Listrik & Air', 'expense', null, 0, 'IDR'],
    ['5004', 'Beban Bahan Baku', 'expense', null, 0, 'IDR'],
    ['5005', 'Beban Transportasi', 'expense', null, 0, 'IDR'],
    ['5006', 'Beban Pemasaran', 'expense', null, 0, 'IDR'],
    ['5007', 'Beban Administrasi', 'expense', null, 0, 'IDR'],
    ['5008', 'Beban Lainnya', 'expense', null, 0, 'IDR'],
  ];

  const insertMany = db.transaction((rows) => {
    for (const r of rows) insertAccount.run(...r);
  });
  insertMany(accounts);

  // Pengaturan default
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('company_name', 'Skala Bisnis');
  insertSetting.run('currency', 'IDR');
  insertSetting.run('fiscal_year_start', '01-01');

  // Role default
  const allPerms = ['dashboard','journals','transactions','receivables','payables','projects','reports','accounts','users','roles','settings'];
  const insertRole = db.prepare('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)');
  const adminRoleId = insertRole.run('Administrator', 'Akses penuh semua fitur', JSON.stringify(allPerms)).lastInsertRowid;
  insertRole.run('Keuangan', 'Mengelola transaksi, piutang, hutang, dan laporan', JSON.stringify(['dashboard','journals','transactions','receivables','payables','reports']));
  insertRole.run('Manajer Proyek', 'Mengelola proyek dan melihat dashboard', JSON.stringify(['dashboard','projects']));

  // User admin default (password: admin123)
  db.prepare('INSERT INTO users (username, full_name, email, phone, password, role_id, active) VALUES (?,?,?,?,?,?,1)')
    .run('admin', 'Administrator', 'admin@skala.local', '0812-0000-0000', hashPassword('admin123'), adminRoleId);

  // ===== DATA CONTOH =====
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';

  const insertCustomer = db.prepare('INSERT INTO customers (name, phone, email, address) VALUES (?,?,?,?)');
  const insertSupplier = db.prepare('INSERT INTO suppliers (name, phone, email, address) VALUES (?,?,?,?)');
  const insertProject = db.prepare('INSERT INTO projects (name, code, customer_id, budget, start_date, end_date, status, description) VALUES (?,?,?,?,?,?,?,?)');
  const insertJournal = db.prepare('INSERT INTO journals (date, ref_no, description, project_id) VALUES (?,?,?,?)');
  const insertEntry = db.prepare('INSERT INTO journal_entries (journal_id, account_id, debit, credit, note) VALUES (?,?,?,?,?)');
  const insertReceivable = db.prepare('INSERT INTO receivables (customer_id, total_amount, due_date, description) VALUES (?,?,?,?)');
  const insertPayable = db.prepare('INSERT INTO payables (supplier_id, total_amount, due_date, description) VALUES (?,?,?,?)');

  const seedSample = db.transaction(() => {
    // Pelanggan & supplier
    const c1 = insertCustomer.run('Toko Makmur Jaya', '0812-3456-7890', 'makmur@example.com', 'Jl. Sudirman 10').lastInsertRowid;
    const c2 = insertCustomer.run('Kafe Senja', '0813-1111-2222', 'senja@example.com', 'Jl. Merdeka 5').lastInsertRowid;
    const s1 = insertSupplier.run('CV Sumber Bahan', '021-555-1234', 'sales@sumberbah.com', 'Jl. Industri 2').lastInsertRowid;
    const s2 = insertSupplier.run('Toko Perlengkapan ABC', '021-555-5678', 'info@abc.com', 'Jl. Pasar 1').lastInsertRowid;

    // Proyek
    const p1 = insertProject.run('Renovasi Kantor', 'PRJ-001', c1, 50000000, monthStart, today, 'active', 'Proyek renovasi kantor klien').lastInsertRowid;

    // Jurnal: Modal awal
    let j = insertJournal.run(today, 'MD-001', 'Setoran modal awal', null).lastInsertRowid;
    insertEntry.run(j, 1, 25000000, 0, 'Kas');
    insertEntry.run(j, 10, 0, 25000000, 'Modal');

    // Jurnal: Penjualan tunai
    j = insertJournal.run(today, 'INV-001', 'Penjualan tunai ke Toko Makmur', p1).lastInsertRowid;
    insertEntry.run(j, 1, 8500000, 0, 'Kas');
    insertEntry.run(j, 12, 0, 8500000, 'Penjualan');

    // Jurnal: Penjualan jasa
    j = insertJournal.run(today, 'INV-002', 'Pendapatan jasa konsultasi', p1).lastInsertRowid;
    insertEntry.run(j, 2, 4500000, 0, 'Bank');
    insertEntry.run(j, 13, 0, 4500000, 'Jasa');

    // Jurnal: Beban gaji
    j = insertJournal.run(today, 'JV-001', 'Bayar gaji karyawan', null).lastInsertRowid;
    const j_gaji_id = j;
    insertEntry.run(j, 15, 6000000, 0, 'Beban gaji');
    insertEntry.run(j, 1, 0, 6000000, 'Kas');

    // Jurnal: Beban sewa
    j = insertJournal.run(today, 'JV-002', 'Bayar sewa kantor', null).lastInsertRowid;
    insertEntry.run(j, 16, 3500000, 0, 'Beban sewa');
    insertEntry.run(j, 2, 0, 3500000, 'Bank');

    // Jurnal: Beban listrik
    j = insertJournal.run(today, 'JV-003', 'Bayar listrik & air', null).lastInsertRowid;
    insertEntry.run(j, 17, 850000, 0, 'Beban listrik');
    insertEntry.run(j, 1, 0, 850000, 'Kas');

    // Jurnal: Pembelian bahan baku (hutang)
    j = insertJournal.run(today, 'PB-001', 'Pembelian bahan baku dari CV Sumber Bahan', p1).lastInsertRowid;
    insertEntry.run(j, 4, 7200000, 0, 'Persediaan');
    insertEntry.run(j, 6, 0, 7200000, 'Hutang');

    // Piutang
    insertReceivable.run(c2, 12000000, today, 'Invoice jasa desain');
    insertReceivable.run(c1, 5500000, today, 'Invoice penjualan kredit');

    // Hutang
    insertPayable.run(s1, 7200000, today, 'Tagihan bahan baku');
    insertPayable.run(s2, 2800000, today, 'Tagihan perlengkapan');

    // ===== WAREHOUSE & PRODUK =====
    const insertWarehouse = db.prepare(`
      INSERT INTO warehouses (name, code, location, description)
      VALUES (?,?,?,?)
    `);
    const insertProduct = db.prepare(`
      INSERT INTO products (name, sku, barcode, category, unit, purchase_price, selling_price, min_stock, warehouse_id, description)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, warehouse_id, type, qty, reference_type, notes)
      VALUES (?,?,?,?,?,?)
    `);

    const w1 = insertWarehouse.run('Gudang Utama', 'WH-01', 'Jl. Industri 1', 'Gudang pusat').lastInsertRowid;

    const prd1 = insertProduct.run('Produk A', 'PRD-001', '8991234567890', 'Makanan', 'pcs', 4000000, 5000000, 5, w1, 'Produk makanan A').lastInsertRowid;
    const prd2 = insertProduct.run('Produk B', 'PRD-002', '8991234567891', 'Makanan', 'pcs', 3000000, 4000000, 10, w1, 'Produk makanan B').lastInsertRowid;
    const prd3 = insertProduct.run('Konsultasi Paket', 'SRV-001', null, 'Jasa', 'paket', 0, 5000000, 0, null, 'Paket jasa konsultasi').lastInsertRowid;

    // Stok awal
    insertMovement.run(prd1, w1, 'in', 20, 'initial', 'Stok awal');
    insertMovement.run(prd2, w1, 'in', 50, 'initial', 'Stok awal');

    // ===== KARYAWAN & PAYROLL (sinkron dengan beban gaji 6jt) =====
    const insertEmployee = db.prepare(`
      INSERT INTO employees (name, employee_no, phone, email, address, base_salary, position)
      VALUES (?,?,?,?,?,?,?)
    `);
    const insertPayroll = db.prepare(`
      INSERT INTO payrolls (period, employee_id, base_salary, allowances, deductions, net_pay, payment_date, status, notes, journal_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);

    const period = today.slice(0, 7); // YYYY-MM
    const e1 = insertEmployee.run('Siti Aminah', 'KRY-001', '0812-9999-9999', 'siti@skala.local', 'Jl. Mawar 3', 3800000, 'Manager').lastInsertRowid;
    const e2 = insertEmployee.run('Budi Santoso', 'KRY-002', '0813-8888-8888', 'budi@skala.local', 'Jl. Melati 5', 1900000, 'Staff').lastInsertRowid;

    // Payroll Siti: 3.8jt + 500rb tunjangan - 300rb potongan = 4jt
    insertPayroll.run(period, e1, 3800000, 500000, 300000, 4000000, today, 'paid', 'Gaji ' + period, j_gaji_id);
    // Payroll Budi: 1.9jt + 250rb tunjangan - 150rb potongan = 2jt
    insertPayroll.run(period, e2, 1900000, 250000, 150000, 2000000, today, 'paid', 'Gaji ' + period, j_gaji_id);
    // Total: 4jt + 2jt = 6jt (sesuai beban gaji di jurnal JV-001)
  });
  seedSample();

  console.log('Seed data selesai.');
}

if (import.meta.url === `file://${process.argv[1]}`) seed();