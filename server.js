// server.js
// Yeh main file hai jo server ko start karti hai.
// Local pe test karne ke liye: npm install, phir npm start
// Live deploy karne ke liye: README.md dekhen (Railway/Render steps).

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const menuRoutes = require('./routes/menu');
const inventoryRoutes = require('./routes/inventory');

const app = express();
app.use(cors());
app.use(express.json());

// Health check — yeh URL khol ke check kar sakte ho ki server zinda hai
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Urban Vada Pav billing server chal raha hai.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/inventory', inventoryRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server chal raha hai port ${PORT} par`);
});
