// routes/reports.js
// Day-close summary aur Excel download — yahi sabse zaroori feature hai.
// Store-staff sirf apne store ka Excel le sakta hai.
// Admin (founder) kisi bhi store ka, ya SAARE stores ka combined Excel le sakta hai.

const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/day-summary — aaj ka quick summary (numbers, Excel se pehle dashboard pe dikhane ke liye)
router.get('/day-summary', requireLogin, async (req, res) => {
  try {
    const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
    const isAllStores = req.user.role === 'admin' && req.query.all === 'true';

    let ordersQuery, params;
    if (isAllStores) {
      ordersQuery = `SELECT o.*, s.store_name, s.store_code FROM orders o
                      JOIN stores s ON o.store_id = s.id WHERE o.order_date = CURRENT_DATE`;
      params = [];
    } else {
      ordersQuery = `SELECT * FROM orders WHERE store_id = $1 AND order_date = CURRENT_DATE`;
      params = [storeId];
    }

    const ordersResult = await pool.query(ordersQuery, params);
    const orders = ordersResult.rows;

    const totalSale = orders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
    const byMode = {};
    orders.forEach(o => { byMode[o.payment_mode] = (byMode[o.payment_mode] || 0) + parseFloat(o.total_amount); });

    res.json({
      total_orders: orders.length,
      total_sale: totalSale,
      by_payment_mode: byMode
    });
  } catch (err) {
    console.error('Day summary error:', err);
    res.status(500).json({ error: 'Summary load nahi ho paaya.' });
  }
});

// GET /api/reports/excel — Excel file download (single store)
// Query param: ?date=YYYY-MM-DD (default aaj), ?store_id= (admin ke liye zaroori, store_staff apna khud lega)
router.get('/excel', requireLogin, async (req, res) => {
  const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
  const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;

  if (!storeId) {
    return res.status(400).json({ error: 'store_id chahiye.' });
  }

  try {
    const storeResult = await pool.query('SELECT store_name, store_code FROM stores WHERE id = $1', [storeId]);
    const store = storeResult.rows[0];

    const ordersResult = await pool.query(
      `SELECT o.id, o.token_or_table, o.total_amount, o.payment_mode, o.created_at,
              array_agg(oi.item_name || ' x' || oi.quantity) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.store_id = $1 AND o.order_date = $2
       GROUP BY o.id
       ORDER BY o.created_at`,
      [storeId, reportDate]
    );
    const orders = ordersResult.rows;

    const workbook = buildWorkbook(store ? store.store_name : `Store ${storeId}`, reportDate, [
      { storeName: store ? store.store_name : `Store ${storeId}`, orders }
    ]);

    const fileName = `${(store ? store.store_code : storeId)}_Sales_${reportDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Excel banane mein gadbad hui.' });
  }
});

// GET /api/reports/excel-all-stores — SIRF ADMIN: saare 80+ stores ka combined Excel, ek sheet per store + overall summary
router.get('/excel-all-stores', requireLogin, requireAdmin, async (req, res) => {
  const reportDate = req.query.date || new Date().toISOString().slice(0, 10);

  try {
    const storesResult = await pool.query('SELECT id, store_name, store_code FROM stores WHERE is_active = true ORDER BY store_name');
    const stores = storesResult.rows;

    const storeReports = [];
    for (const store of stores) {
      const ordersResult = await pool.query(
        `SELECT o.id, o.token_or_table, o.total_amount, o.payment_mode, o.created_at,
                array_agg(oi.item_name || ' x' || oi.quantity) AS items
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.store_id = $1 AND o.order_date = $2
         GROUP BY o.id
         ORDER BY o.created_at`,
        [store.id, reportDate]
      );
      storeReports.push({ storeName: store.store_name, storeCode: store.store_code, orders: ordersResult.rows });
    }

    const workbook = buildWorkbook('All Stores (Pan India)', reportDate, storeReports, true);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="AllStores_Sales_${reportDate}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('All-stores excel error:', err);
    res.status(500).json({ error: 'Combined Excel banane mein gadbad hui.' });
  }
});

// GET /api/reports/all-stores-summary — SIRF ADMIN: dashboard pe har store ki aaj ki sale ek saath dikhane ke liye (JSON, Excel nahi)
router.get('/all-stores-summary', requireLogin, requireAdmin, async (req, res) => {
  const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const storesResult = await pool.query('SELECT id, store_name, store_code, city FROM stores WHERE is_active = true ORDER BY store_name');
    const stores = storesResult.rows;

    const ordersResult = await pool.query(
      `SELECT store_id, payment_mode, total_amount FROM orders WHERE order_date = $1`,
      [reportDate]
    );
    const orders = ordersResult.rows;

    const summary = stores.map(store => {
      const storeOrders = orders.filter(o => o.store_id === store.id);
      const totalSale = storeOrders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
      const byMode = {};
      storeOrders.forEach(o => { byMode[o.payment_mode] = (byMode[o.payment_mode] || 0) + parseFloat(o.total_amount); });
      return {
        store_id: store.id,
        store_name: store.store_name,
        store_code: store.store_code,
        city: store.city,
        total_orders: storeOrders.length,
        total_sale: totalSale,
        by_payment_mode: byMode
      };
    });

    const grandTotal = summary.reduce((s, x) => s + x.total_sale, 0);
    const grandOrders = summary.reduce((s, x) => s + x.total_orders, 0);

    res.json({ date: reportDate, stores: summary, grand_total_sale: grandTotal, grand_total_orders: grandOrders });
  } catch (err) {
    console.error('All stores summary error:', err);
    res.status(500).json({ error: 'Summary load nahi ho paaya.' });
  }
});

// Helper: ExcelJS workbook banata hai — overall summary sheet + per-store detail sheet(s)
function buildWorkbook(title, reportDate, storeReports, includeOverallSummary = false) {
  const workbook = new ExcelJS.Workbook();

  if (includeOverallSummary) {
    const summarySheet = workbook.addWorksheet('Overall Summary');
    summarySheet.addRow(['URBAN VADA PAV — Pan India Sales Summary']);
    summarySheet.addRow(['Date', reportDate]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Store', 'Total Orders', 'Total Sale (₹)']);
    let grandTotal = 0, grandOrders = 0;
    storeReports.forEach(sr => {
      const storeTotal = sr.orders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
      grandTotal += storeTotal;
      grandOrders += sr.orders.length;
      summarySheet.addRow([`${sr.storeName} (${sr.storeCode})`, sr.orders.length, storeTotal]);
    });
    summarySheet.addRow([]);
    summarySheet.addRow(['GRAND TOTAL (All Stores)', grandOrders, grandTotal]);
    summarySheet.getColumn(1).width = 30;
    summarySheet.getColumn(2).width = 16;
    summarySheet.getColumn(3).width = 18;
  }

  storeReports.forEach(sr => {
    const sheetName = (sr.storeCode || sr.storeName).substring(0, 28); // Excel sheet name limit
    const sheet = workbook.addWorksheet(sheetName);
    sheet.addRow([sr.storeName]);
    sheet.addRow(['Date', reportDate]);
    sheet.addRow([]);
    sheet.addRow(['Order ID', 'Time', 'Token/Table', 'Items', 'Payment Mode', 'Amount (₹)']);

    let total = 0;
    const byMode = {};
    sr.orders.forEach(o => {
      const time = new Date(o.created_at).toLocaleTimeString('en-IN');
      sheet.addRow([o.id, time, o.token_or_table || '-', o.items.join(', '), o.payment_mode, parseFloat(o.total_amount)]);
      total += parseFloat(o.total_amount);
      byMode[o.payment_mode] = (byMode[o.payment_mode] || 0) + parseFloat(o.total_amount);
    });

    sheet.addRow([]);
    sheet.addRow(['', '', '', '', 'TOTAL', total]);
    sheet.addRow([]);
    sheet.addRow(['Payment mode breakdown:']);
    Object.entries(byMode).forEach(([mode, amt]) => sheet.addRow(['', mode, amt]));

    sheet.getColumn(1).width = 10;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 14;
    sheet.getColumn(4).width = 50;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 14;
  });

  return workbook;
}

module.exports = router;
