// routes/orders.js
// Order create karna, dekhna, EDIT karna, CANCEL karna — store_staff aur admin dono use karte hain.
// IMPORTANT: store_staff sirf apne store ka data dekh/save/edit/cancel kar sakta hai.
// Admin sab stores ka data dekh sakta hai (kisi ka edit/cancel nahi karta, sirf staff karta hai apne store ka).

const express = require('express');
const pool = require('../db/pool');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

// =====================================================================
// POST /api/orders — naya order save karo
// Body: { token_or_table, payment_mode, items: [{item_name, unit_price, quantity}] }
// =====================================================================
router.post('/', requireLogin, async (req, res) => {
  const { token_or_table, payment_mode, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order mein kam se kam ek item hona chahiye.' });
  }
  if (!['Cash', 'UPI', 'Card'].includes(payment_mode)) {
    return res.status(400).json({ error: 'Payment mode Cash, UPI, ya Card hona chahiye.' });
  }

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

// =====================================================================
// GET /api/orders/today — AAJ ke orders (backward-compatible route, purane frontend ke liye)
// =====================================================================
router.get('/today', requireLogin, async (req, res) => {
  req.query.date = new Date().toISOString().slice(0, 10);
  return fetchOrdersHandler(req, res);
});

// =====================================================================
// GET /api/orders/by-date — KISI BHI date ke orders (store_staff apna store, admin koi bhi store ya sab)
// Query params: ?date=YYYY-MM-DD (required), ?store_id= (admin ke liye), ?all=true (admin, sab stores)
// Har order ke saath uske items ka pura detail bhi aata hai (json_agg se)
// =====================================================================
router.get('/by-date', requireLogin, fetchOrdersHandler);

async function fetchOrdersHandler(req, res) {
  const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    let query, params;

    if (req.user.role === 'admin' && req.query.all === 'true') {
      query = `
        SELECT o.id, o.store_id, o.token_or_table, o.total_amount, o.payment_mode,
               o.order_date, o.created_at, o.is_cancelled, o.cancelled_at, o.is_edited, o.last_edited_at,
               s.store_name, s.store_code,
               COALESCE(json_agg(json_build_object('item_name', oi.item_name, 'unit_price', oi.unit_price, 'quantity', oi.quantity, 'line_total', oi.line_total)) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.order_date = $1
        GROUP BY o.id, s.store_name, s.store_code
        ORDER BY o.created_at DESC`;
      params = [reportDate];
    } else {
      const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
      if (!storeId) return res.status(400).json({ error: 'store_id chahiye.' });
      query = `
        SELECT o.id, o.store_id, o.token_or_table, o.total_amount, o.payment_mode,
               o.order_date, o.created_at, o.is_cancelled, o.cancelled_at, o.is_edited, o.last_edited_at,
               COALESCE(json_agg(json_build_object('item_name', oi.item_name, 'unit_price', oi.unit_price, 'quantity', oi.quantity, 'line_total', oi.line_total)) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.store_id = $1 AND o.order_date = $2
        GROUP BY o.id
        ORDER BY o.created_at DESC`;
      params = [storeId, reportDate];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: 'Orders fetch nahi ho paaye.' });
  }
}

// =====================================================================
// PATCH /api/orders/:id/cancel — order CANCEL karo (delete nahi, mark karte hain — record rehta hai)
// store_staff sirf apne store ka order cancel kar sakta hai. Admin kisi ka bhi.
// =====================================================================
router.patch('/:id/cancel', requireLogin, async (req, res) => {
  const orderId = req.params.id;
  try {
    const checkResult = await pool.query('SELECT store_id, is_cancelled FROM orders WHERE id = $1', [orderId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order nahi mila.' });
    }
    const order = checkResult.rows[0];

    if (req.user.role !== 'admin' && order.store_id !== req.user.store_id) {
      return res.status(403).json({ error: 'Aap sirf apne store ka order cancel kar sakte hain.' });
    }
    if (order.is_cancelled) {
      return res.status(400).json({ error: 'Yeh order already cancelled hai.' });
    }

    await pool.query(
      `UPDATE orders SET is_cancelled = true, cancelled_at = NOW(), cancelled_by_user_id = $1 WHERE id = $2`,
      [req.user.id, orderId]
    );
    res.json({ message: 'Order cancel ho gaya.' });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Order cancel nahi ho paaya.' });
  }
});

// =====================================================================
// PUT /api/orders/:id — order EDIT karo (items badalna — add/remove/quantity change)
// Body: { token_or_table, payment_mode, items: [{item_name, unit_price, quantity}] }
// Purane items delete karke naye daal dete hain, aur total recalculate hota hai.
// =====================================================================
router.put('/:id', requireLogin, async (req, res) => {
  const orderId = req.params.id;
  const { token_or_table, payment_mode, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order mein kam se kam ek item hona chahiye.' });
  }
  if (payment_mode && !['Cash', 'UPI', 'Card'].includes(payment_mode)) {
    return res.status(400).json({ error: 'Payment mode Cash, UPI, ya Card hona chahiye.' });
  }

  const client = await pool.connect();
  try {
    const checkResult = await client.query('SELECT store_id, is_cancelled FROM orders WHERE id = $1', [orderId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order nahi mila.' });
    }
    const order = checkResult.rows[0];

    if (req.user.role !== 'admin' && order.store_id !== req.user.store_id) {
      return res.status(403).json({ error: 'Aap sirf apne store ka order edit kar sakte hain.' });
    }
    if (order.is_cancelled) {
      return res.status(400).json({ error: 'Cancelled order edit nahi ho sakta.' });
    }

    const totalAmount = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

    await client.query('BEGIN');

    await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, item_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.item_name, item.unit_price, item.quantity, item.unit_price * item.quantity]
      );
    }

    await client.query(
      `UPDATE orders SET total_amount = $1, token_or_table = $2, payment_mode = COALESCE($3, payment_mode),
              is_edited = true, last_edited_at = NOW(), last_edited_by_user_id = $4
       WHERE id = $5`,
      [totalAmount, token_or_table || null, payment_mode || null, req.user.id, orderId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Order update ho gaya.', total_amount: totalAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Edit order error:', err);
    res.status(500).json({ error: 'Order edit nahi ho paaya.' });
  } finally {
    client.release();
  }
});

module.exports = router;
