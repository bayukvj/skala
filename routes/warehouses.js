import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

// GET warehouses
router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM warehouses WHERE active=1 ORDER BY id DESC`).all();
  // Tambahkan total nilai stok per gudang
  const final = rows.map(w => {
    const products = db.prepare(`SELECT id FROM products WHERE warehouse_id=? AND active=1`).all(w.id);
    let totalValue = 0;
    let totalItems = 0;
    for (const p of products) {
      const stock = db.prepare(`
        SELECT COALESCE(SUM(
          CASE WHEN sm.type IN ('in','transfer') THEN sm.qty
               WHEN sm.type = 'out' THEN -sm.qty
               WHEN sm.type = 'adjustment' THEN sm.qty
          END
        ), 0) as stock
        FROM stock_movements sm WHERE sm.product_id=?
      `).get(p.id).stock || 0;
      const prod = db.prepare(`SELECT purchase_price FROM products WHERE id=?`).get(p.id);
      totalValue += stock * (prod?.purchase_price || 0);
      totalItems += stock;
    }
    return { ...w, total_items: totalItems, total_value: totalValue };
  });
  res.json(final);
});

// GET single warehouse
router.get('/:id', (req, res) => {
  const w = db.prepare('SELECT * FROM warehouses WHERE id=?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Warehouse tidak ditemukan' });
  res.json(w);
});

// POST create warehouse
router.post('/', (req, res) => {
  const { name, code, location, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name wajib' });
  try {
    const info = db.prepare(`
      INSERT INTO warehouses (name, code, location, description)
      VALUES (?,?,?,?)
    `).run(name, code || null, location || null, description || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update warehouse
router.put('/:id', (req, res) => {
  const { name, code, location, description, active } = req.body;
  const info = db.prepare(`
    UPDATE warehouses SET name=?, code=?, location=?, description=?, active=?
    WHERE id=?
  `).run(name, code || null, location || null, description || null, active ? 1 : 0, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Warehouse tidak ditemukan' });
  res.json({ ok: true });
});

// DELETE warehouse (soft delete)
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE warehouses SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// GET stock per warehouse (ringkasan)
router.get('/:id/stock', (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.sku, p.unit, p.min_stock,
      COALESCE(SUM(
        CASE WHEN sm.type IN ('in','transfer') THEN sm.qty
             WHEN sm.type = 'out' THEN -sm.qty
             WHEN sm.type = 'adjustment' THEN sm.qty
        END
      ), 0) as stock
    FROM products p
    LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.warehouse_id = ?
    WHERE p.warehouse_id = ? AND p.active = 1
    GROUP BY p.id
    ORDER BY p.name
  `).all(req.params.id, req.params.id);
  res.json(rows);
});

export default router;