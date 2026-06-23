// routes/orders.js
// Order create karna, aaj ke orders dekhna — store_staff aur admin dono use karte hain.
// IMPORTANT: store_staff sirf apne store ka data dekh/save kar sakta hai.
// Admin sab stores ka data dekh sakta hai.

const express = require('express');
const pool = require('../db/pool');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders — naya order save karo
// Body: { token_or_table, payment_mode, items: [{item_name, unit_price, quantity}] }
router.post('/', requireLogin, async (req, res) => {
  const { token_or_table, payment_mode, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order mein kam se kam ek item hona chahiye.' });
  }
  if (!['Cash', 'UPI', 'Card'].includes(payment_mode)) {
    return res.status(400).json({ error: 'Payment mode Cash, UPI, ya Card hona chahiye.' });
  }

  // store_staff ke liye store_id unke login se aata hai (security: khud se kisi aur store ka order nahi daal sakte)
  const storeId = req.user.store_id;
  if (!storeId) {
    return res.status(400).json({ error: 'Yeh login kisi store se linked nahi hai.' });
  }

  const totalAmount = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders (store_id, created_by_user_id, token_or_table, total_amount, payment_mode, order_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
       RETURNING id, created_at`,
      [storeId, req.user.id, token_or_table || null, totalAmount, payment_mode]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, item_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.item_name, item.unit_price, item.quantity, item.unit_price * item.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ order_id: orderId, total_amount: totalAmount, created_at: orderResult.rows[0].created_at });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Order save error:', err);
    res.status(500).json({ error: 'Order save nahi ho paaya. Phir try karein.' });
  } finally {
    client.release();
  }
});

// GET /api/orders/today — aaj ke apne store ke orders (store_staff) ya sab stores (admin agar ?all=true)
router.get('/today', requireLogin, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'admin' && req.query.all === 'true') {
      query = `SELECT o.*, s.store_name, s.store_code FROM orders o
                JOIN stores s ON o.store_id = s.id
                WHERE o.order_date = CURRENT_DATE ORDER BY o.created_at DESC`;
      params = [];
    } else {
      const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
      query = `SELECT * FROM orders WHERE store_id = $1 AND order_date = CURRENT_DATE ORDER BY created_at DESC`;
      params = [storeId];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch today orders error:', err);
    res.status(500).json({ error: 'Orders fetch nahi ho paaye.' });
  }
});

module.exports = router;
