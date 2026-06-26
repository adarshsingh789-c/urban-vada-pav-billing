// routes/inventory.js
// Inventory items ka master list — SIRF ADMIN (CEO) add/edit/price-change kar sakta hai.
// Store staff sirf yeh list DEKH sakta hai aur apna OPENING/CLOSING quantity bhar sakta hai.

const express = require('express');
const pool = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// =====================================================================
// GET /api/inventory/items — saari active inventory items (sab dekh sakte hain — staff + admin)
// =====================================================================
router.get('/items', requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, item_name, unit, rate, is_active FROM inventory_items WHERE is_active = true ORDER BY item_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Inventory items fetch error:', err);
    res.status(500).json({ error: 'Inventory list load nahi ho paayi.' });
  }
});

// =====================================================================
// POST /api/inventory/items — SIRF ADMIN: naya inventory item add karo
// Body: { item_name, unit, rate }
// =====================================================================
router.post('/items', requireLogin, requireAdmin, async (req, res) => {
  const { item_name, unit, rate } = req.body;
  if (!item_name || !unit || rate === undefined) {
    return res.status(400).json({ error: 'Item naam, unit, aur rate teeno chahiye.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO inventory_items (item_name, unit, rate) VALUES ($1, $2, $3) RETURNING *`,
      [item_name, unit, rate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Inventory item add error:', err);
    res.status(500).json({ error: 'Item add nahi ho paaya.' });
  }
});

// =====================================================================
// PATCH /api/inventory/items/:id — SIRF ADMIN: rate/naam/unit edit karo (price change ke liye yahi use hoga)
// Body: { item_name, unit, rate } (jo bhejna ho)
// =====================================================================
router.patch('/items/:id', requireLogin, requireAdmin, async (req, res) => {
  const { item_name, unit, rate } = req.body;
  try {
    const result = await pool.query(
      `UPDATE inventory_items SET
         item_name = COALESCE($1, item_name),
         unit = COALESCE($2, unit),
         rate = COALESCE($3, rate),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [item_name || null, unit || null, rate ?? null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item nahi mila.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Inventory item update error:', err);
    res.status(500).json({ error: 'Item update nahi ho paaya.' });
  }
});

// =====================================================================
// PATCH /api/inventory/items/:id/deactivate — SIRF ADMIN: item hata dena (list se gayab, history rahegi)
// =====================================================================
router.patch('/items/:id/deactivate', requireLogin, requireAdmin, async (req, res) => {
  try {
    await pool.query(`UPDATE inventory_items SET is_active = false WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Item list se hata diya.' });
  } catch (err) {
    res.status(500).json({ error: 'Hata nahi paaya.' });
  }
});

// =====================================================================
// GET /api/inventory/entries — kisi store ke kisi din ke entries dekho
// Query: ?date=YYYY-MM-DD (default aaj), ?store_id= (admin ke liye, staff apna khud lega)
// =====================================================================
router.get('/entries', requireLogin, async (req, res) => {
  const entryDate = req.query.date || new Date().toISOString().slice(0, 10);
  const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
  if (!storeId) return res.status(400).json({ error: 'store_id chahiye.' });

  try {
    // Saari active items lao, aur jo entry already bhari hui hai wo bhi saath mein (LEFT JOIN)
    const result = await pool.query(
      `SELECT ii.id AS inventory_item_id, ii.item_name, ii.unit, ii.rate,
              ie.opening_qty, ie.closing_qty, ie.rate_at_entry, ie.id AS entry_id
       FROM inventory_items ii
       LEFT JOIN inventory_entries ie ON ie.inventory_item_id = ii.id AND ie.store_id = $1 AND ie.entry_date = $2
       WHERE ii.is_active = true
       ORDER BY ii.item_name`,
      [storeId, entryDate]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Inventory entries fetch error:', err);
    res.status(500).json({ error: 'Entries load nahi ho paaye.' });
  }
});

// =====================================================================
// POST /api/inventory/entries — Opening YA Closing quantity save karo (ek item ke liye)
// Body: { inventory_item_id, type: 'opening'|'closing', quantity, date (optional, default aaj) }
// Store staff sirf apne store ke liye bhar sakta hai.
// =====================================================================
router.post('/entries', requireLogin, async (req, res) => {
  const { inventory_item_id, type, quantity, date } = req.body;
  const entryDate = date || new Date().toISOString().slice(0, 10);
  const storeId = req.user.store_id;

  if (!storeId) return res.status(400).json({ error: 'Yeh login kisi store se linked nahi hai.' });
  if (!inventory_item_id || !['opening', 'closing'].includes(type) || quantity === undefined) {
    return res.status(400).json({ error: 'inventory_item_id, type (opening/closing), aur quantity chahiye.' });
  }

  try {
    const itemResult = await pool.query('SELECT rate FROM inventory_items WHERE id = $1', [inventory_item_id]);
    if (itemResult.rows.length === 0) return res.status(404).json({ error: 'Inventory item nahi mila.' });
    const currentRate = itemResult.rows[0].rate;

    const column = type === 'opening' ? 'opening_qty' : 'closing_qty';

    const result = await pool.query(
      `INSERT INTO inventory_entries (store_id, inventory_item_id, entry_date, ${column}, rate_at_entry, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (store_id, inventory_item_id, entry_date)
       DO UPDATE SET ${column} = $4, updated_at = NOW()
       RETURNING *`,
      [storeId, inventory_item_id, entryDate, quantity, currentRate, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Inventory entry save error:', err);
    res.status(500).json({ error: 'Entry save nahi ho paayi.' });
  }
});

// =====================================================================
// GET /api/inventory/expense-summary — kisi store ke kisi din ka total expense
// Query: ?date=YYYY-MM-DD, ?store_id= (admin ke liye)
// =====================================================================
router.get('/expense-summary', requireLogin, async (req, res) => {
  const entryDate = req.query.date || new Date().toISOString().slice(0, 10);
  const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
  if (!storeId) return res.status(400).json({ error: 'store_id chahiye.' });

  try {
    const result = await pool.query(
      `SELECT inventory_item_id, opening_qty, closing_qty, rate_at_entry
       FROM inventory_entries WHERE store_id = $1 AND entry_date = $2
       AND opening_qty IS NOT NULL AND closing_qty IS NOT NULL`,
      [storeId, entryDate]
    );
    const totalExpense = result.rows.reduce((sum, row) => {
      const used = parseFloat(row.opening_qty) - parseFloat(row.closing_qty);
      return sum + (used > 0 ? used * parseFloat(row.rate_at_entry) : 0);
    }, 0);
    res.json({ date: entryDate, total_expense: totalExpense, items_counted: result.rows.length });
  } catch (err) {
    console.error('Expense summary error:', err);
    res.status(500).json({ error: 'Expense calculate nahi ho paaya.' });
  }
});

module.exports = router;
