// middleware/auth.js
// Yeh check karta hai ki request bhejne wala login hai ya nahi,
// aur agar route "admin only" hai to verify karta hai ki banda admin hi hai.

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Step 1: Verify ki user logged in hai (valid token bheja hai)
function requireLogin(req, res, next) {
  const authHeader = req.headers.authorization; // format: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Login required. Please log in again.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, store_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Step 2: Verify ki user ADMIN hai (founder/owner level access)
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only.' });
  }
  next();
}

module.exports = { requireLogin, requireAdmin, JWT_SECRET };
