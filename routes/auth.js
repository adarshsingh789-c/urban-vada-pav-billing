// routes/auth.js
// Login route — store staff aur admin (founder) dono yahin se login karte hain.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
// Body: { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username aur password dono chahiye.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.role, u.store_id, u.full_name, u.is_active,
              s.store_name, s.store_code
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Galat username ya password.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Yeh login band kar diya gaya hai. Admin se baat karein.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Galat username ya password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '12h' } // ek shift ke liye kaafi hai; agle din phir login karna hoga
    );

    res.json({
      token,
      user: {
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        store_id: user.store_id,
        store_name: user.store_name,
        store_code: user.store_code
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server mein kuch gadbad hui. Thodi der baad try karein.' });
  }
});

module.exports = router;
