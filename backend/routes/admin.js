// routes/admin.js
// SIRF ADMIN (founder) yeh routes use kar sakta hai —
// naye store add karna, naya staff login banana, sab stores ki list dekhna.

const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Saare routes mein pehle login check, phir admin check
router.use(requireLogin, requireAdmin);

// GET /api/admin/stores — sab stores ki list (pan India)
router.get('/stores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stores ORDER BY store_name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Stores load nahi ho paaye.' });
  }
});

// POST /api/admin/stores — naya store add karo
// Body: { store_name, store_code, city, address }
router.post('/stores', async (req, res) => {
  const { store_name, store_code, city, address } = req.body;
  if (!store_name || !store_code) {
    return res.status(400).json({ error: 'Store ka naam aur code dono chahiye.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO stores (store_name, store_code, city, address) VALUES ($1, $2, $3, $4) RETURNING *`,
      [store_name, store_code, city || null, address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // duplicate store_code
      return res.status(400).json({ error: 'Yeh store code already use ho raha hai. Alag code daalein.' });
    }
    console.error('Add store error:', err);
    res.status(500).json({ error: 'Store add nahi ho paaya.' });
  }
});

// POST /api/admin/users — naya login banao (store staff ya admin)
// Body: { username, password, role: 'store_staff'|'admin', store_id, full_name }
router.post('/users', async (req, res) => {
  const { username, password, role, store_id, full_name } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, aur role chahiye.' });
  }
  if (role === 'store_staff' && !store_id) {
    return res.status(400).json({ error: 'Store staff ke liye store_id zaroori hai.' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, store_id, full_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, store_id, full_name`,
      [username, passwordHash, role, role === 'admin' ? null : store_id, full_name || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Yeh username already exist karta hai.' });
    }
    console.error('Add user error:', err);
    res.status(500).json({ error: 'Login create nahi ho paaya.' });
  }
});

// GET /api/admin/users — sab logins ki list
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.role, u.full_name, u.is_active, s.store_name, s.store_code
       FROM users u LEFT JOIN stores s ON u.store_id = s.id ORDER BY u.id`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Users load nahi ho paaye.' });
  }
});

// PATCH /api/admin/users/:id/deactivate — kisi staff ka login band karna (job chhodne par, etc.)
router.patch('/users/:id/deactivate', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Login deactivate ho gaya.' });
  } catch (err) {
    res.status(500).json({ error: 'Deactivate nahi ho paaya.' });
  }
});

module.exports = router;
