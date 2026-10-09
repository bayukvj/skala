-- Skala - Database Schema (SQLite)
-- Double-entry accounting system for Indonesian small business

PRAGMA foreign_keys = ON;

-- ===== MASTER DATA =====

-- Chart of Accounts (Akun)
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,          -- e.g. 1001, 4001, 5001
    name TEXT NOT NULL,                 -- e.g. Kas, Penjulan, Beban Gaji
    type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
    parent_id INTEGER,
    is_header INTEGER DEFAULT 0,       -- 1 = akun induk (hanya kategori)
    currency TEXT DEFAULT 'IDR',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- ===== TRANSAKSI =====

-- Jurnal (Buku Besar)
CREATE TABLE IF NOT EXISTS journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                 -- YYYY-MM-DD
    ref_no TEXT,                        -- nomor bukti/transaksi
    description TEXT,
    project_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Jurnal Entries (detail debit/kredit)
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journal_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    note TEXT,
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- ===== PIUTANG & HUTANG =====

-- Piutang (Accounts Receivable)
CREATE TABLE IF NOT EXISTS receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    journal_id INTEGER,                 -- referensi jurnal when created
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    due_date TEXT,
    status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','overdue')),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (journal_id) REFERENCES journals(id)
);

-- Piutang pembayaran (riwayat)
CREATE TABLE IF NOT EXISTS receivable_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receivable_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    method TEXT,                        -- transfer, kas, dll
    journal_id INTEGER,
    note TEXT,
    FOREIGN KEY (receivable_id) REFERENCES receivables(id) ON DELETE CASCADE,
    FOREIGN KEY (journal_id) REFERENCES journals(id)
);

-- Hutang (Accounts Payable)
CREATE TABLE IF NOT EXISTS payables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    journal_id INTEGER,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    due_date TEXT,
    status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','overdue')),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (journal_id) REFERENCES journals(id)
);

-- Hutang pembayaran (riwayat)
CREATE TABLE IF NOT EXISTS payable_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payable_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    method TEXT,
    journal_id INTEGER,
    note TEXT,
    FOREIGN KEY (payable_id) REFERENCES payables(id) ON DELETE CASCADE,
    FOREIGN KEY (journal_id) REFERENCES journals(id)
);

-- ===== MASTER DATA LAIN =====

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ===== PROYEK =====

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    customer_id INTEGER,
    pic_user_id INTEGER,
    budget REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','on_hold','cancelled')),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (pic_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ===== INVOICE =====

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    due_date TEXT,
    subtotal REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','partial','overdue','cancelled')),
    notes TEXT,
    journal_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (journal_id) REFERENCES journals(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    qty REAL DEFAULT 1,
    price REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    product_id INTEGER,
    revenue_account_id INTEGER,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (revenue_account_id) REFERENCES accounts(id)
);

-- ===== PAYROLL =====

CREATE TABLE IF NOT EXISTS payrolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,              -- e.g. 2026-10
    employee_id INTEGER NOT NULL,
    base_salary REAL DEFAULT 0,
    allowances REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_pay REAL DEFAULT 0,
    payment_date TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','paid','cancelled')),
    notes TEXT,
    journal_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (journal_id) REFERENCES journals(id)
);

-- ===== PRODUK & WAREHOUSE =====

CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    location TEXT,
    description TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    barcode TEXT,
    category TEXT,
    unit TEXT DEFAULT 'pcs',
    purchase_price REAL DEFAULT 0,
    selling_price REAL DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    warehouse_id INTEGER,
    active INTEGER DEFAULT 1,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    warehouse_id INTEGER,
    type TEXT NOT NULL CHECK(type IN ('in','out','adjustment','transfer')),
    qty REAL NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
);

-- ===== KARYAWAN =====

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    employee_no TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    base_salary REAL DEFAULT 0,
    position TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ===== PENGGUNA & ROLE =====

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT DEFAULT '[]',   -- JSON array of permission keys
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password TEXT NOT NULL,          -- SHA-256 hash
    role_id INTEGER,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- ===== PENGATURAN =====

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journals_date ON journals(date);
CREATE INDEX IF NOT EXISTS idx_entries_journal ON journal_entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_entries_account ON journal_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);