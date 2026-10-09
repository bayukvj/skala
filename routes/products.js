import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// Helper: hitung stok produk
function getStock(productId, warehouseId = null) {
  let sql = `
    SELECT COALESCE(SUM(
      CASE WHEN sm.type IN ('in','transfer') THEN sm.qty
           WHEN sm.type = 'out' THEN -sm.qty
           WHEN sm.type = 'adjustment' THEN sm.qty
      END
    ), 0) as stock
    FROM stock_movements sm
    WHERE sm.product_id = ?
  `;
  const params = [productId];
  if (warehouseId) { sql += ' AND sm.warehouse_id = ?'; params.push(warehouseId); }
  return db.prepare(sql).get(...params).stock || 0;
}

// GET products
router.get('/', (req, res) => {
  const { category, warehouse_id, search } = req.query;
  let sql = `SELECT p.*, w.name as warehouse_name FROM products p LEFT JOIN warehouses w ON w.id = p.warehouse_id WHERE 1=1`;
  const params = [];
  if (category) { sql += ' AND p.category = ?'; params.push(category); }
  if (warehouse_id) { sql += ' AND p.warehouse_id = ?'; params.push(warehouse_id); }
  if (search) { sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY p.id DESC';
  const rows = db.prepare(sql).all(...params);
  // Tambahkan stok
  const final = rows.map(p => ({
    ...p,
    stock: getStock(p.id)
  }));
  res.json(final);
});

// GET single product
router.get('/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, w.name as warehouse_name FROM products p LEFT JOIN warehouses w ON w.id=p.warehouse_id WHERE p.id=?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  p.stock = getStock(p.id);
  p.movements = db.prepare(`
    SELECT sm.*, w.name as warehouse_name
    FROM stock_movements sm LEFT JOIN warehouses w ON w.id=sm.warehouse_id
    WHERE sm.product_id=? ORDER BY sm.created_at DESC, sm.id DESC LIMIT 50
  `).all(req.params.id);
  res.json(p);
});

// POST create product
router.post('/', (req, res) => {
  const { name, sku, barcode, category, unit, purchase_price, selling_price, min_stock, warehouse_id, description, initial_stock } = req.body;
  if (!name) return res.status(400).json({ error: 'name wajib' });
  try {
    const info = db.prepare(`
      INSERT INTO products (name, sku, barcode, category, unit, purchase_price, selling_price, min_stock, warehouse_id, description)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(name, sku || null, barcode || null, category || null, unit || 'pcs',
      Number(purchase_price) || 0, Number(selling_price) || 0, Number(min_stock) || 0,
      warehouse_id || null, description || null);
    const pid = info.lastInsertRowid;

    // Stok awal
    if (initial_stock && Number(initial_stock) > 0) {
      db.prepare(`
        INSERT INTO stock_movements (product_id, warehouse_id, type, qty, reference_type, notes)
        VALUES (?, ?, 'in', ?, 'initial', 'Stok awal')
      `).run(pid, warehouse_id || null, Number(initial_stock));
    }
    res.status(201).json({ id: pid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'SKU sudah digunakan' });
    res.status(500).json({ error: e.message });
  }
});

// PUT update product
router.put('/:id', (req, res) => {
  const { name, sku, barcode, category, unit, purchase_price, selling_price, min_stock, warehouse_id, description, active } = req.body;
  const info = db.prepare(`
    UPDATE products SET name=?, sku=?, barcode=?, category=?, unit=?, purchase_price=?, selling_price=?, min_stock=?, warehouse_id=?, description=?, active=?
    WHERE id=?
  `).run(name, sku || null, barcode || null, category || null, unit || 'pcs',
    Number(purchase_price) || 0, Number(selling_price) || 0, Number(min_stock) || 0,
    warehouse_id || null, description || null, active ? 1 : 0, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json({ ok: true });
});

// DELETE product (soft delete)
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST stock adjustment
router.post('/:id/adjust', (req, res) => {
  const { qty, notes, warehouse_id } = req.body;
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  if (!qty || Number(qty) === 0) return res.status(400).json({ error: 'qty wajib (positif atau negatif)' });

  db.prepare(`
    INSERT INTO stock_movements (product_id, warehouse_id, type, qty, reference_type, notes)
    VALUES (?, ?, 'adjustment', ?, 'adjustment', ?)
  `).run(req.params.id, warehouse_id || p.warehouse_id || null, Number(qty), notes || 'Penyesuaian stok');

  res.json({ ok: true, new_stock: getStock(req.params.id) });
});

// GET categories
router.get('/list/categories', (req, res) => {
  const rows = db.prepare(`SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND active=1 ORDER BY category`).all();
  res.json(rows.map(r => r.category));
});

export default router;