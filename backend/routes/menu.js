// routes/menu.js
// Menu fetch karna — sab logged-in users (staff + admin) use kar sakte hain.

const express = require('express');
const pool = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/menu — saara active menu
router.get('/', requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, category, item_name, price, variant_label
       FROM menu_items WHERE is_active = true
       ORDER BY category, item_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Menu fetch error:', err);
    res.status(500).json({ error: 'Menu load nahi ho paaya.' });
  }
});

// POST /api/menu — ADMIN ONLY: naya item add karna ya menu update karna
router.post('/', requireLogin, requireAdmin, async (req, res) => {
  const { category, item_name, price, variant_label } = req.body;
  if (!category || !item_name || price === undefined) {
    return res.status(400).json({ error: 'Category, item naam, aur price chahiye.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO menu_items (category, item_name, price, variant_label) VALUES ($1,$2,$3,$4) RETURNING *`,
      [category, item_name, price, variant_label || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Item add nahi ho paaya.' });
  }
});

module.exports = router;
