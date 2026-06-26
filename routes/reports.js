// routes/reports.js
// Excel reports — user ke diye gaye exact templates follow karte hain:
//   1. DAILY SALES DETAILS  -> /excel (single day, single store)
//   2. MONTHLY PROFIT LOSS  -> /monthly-report (single store, ek mahine ka, Sheet1+Sheet2)
//   3. CEO REPORT           -> /ceo-monthly-report (sab stores, Sheet1+Sheet2+Sheet3, sirf admin)
//
// NOTE: Cancelled orders TOTAL SALE mein nahi ginte (lekin Excel mein dikhte hain, "Cancelled" ke saath, transparency ke liye).
// NOTE: Payment categories Excel mein 2 hain — CASH aur ONLINE (UPI+Card dono "Online" ke neeche aate hain).

const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function toOnlineOrCash(paymentMode) {
  return paymentMode === 'Cash' ? 'Cash' : 'Online';
}

// =====================================================================
// GET /api/reports/day-summary — kisi bhi date ka quick summary (dashboard widgets ke liye)
// =====================================================================
router.get('/day-summary', requireLogin, async (req, res) => {
  try {
    const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
    const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
    const isAllStores = req.user.role === 'admin' && req.query.all === 'true';

    let ordersQuery, params;
    if (isAllStores) {
      ordersQuery = `SELECT o.*, s.store_name, s.store_code FROM orders o
                      JOIN stores s ON o.store_id = s.id WHERE o.order_date = $1`;
      params = [reportDate];
    } else {
      ordersQuery = `SELECT * FROM orders WHERE store_id = $1 AND order_date = $2`;
      params = [storeId, reportDate];
    }

    const ordersResult = await pool.query(ordersQuery, params);
    const allOrders = ordersResult.rows;
    const activeOrders = allOrders.filter(o => !o.is_cancelled);

    const totalSale = activeOrders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
    const byMode = {};
    activeOrders.forEach(o => { byMode[o.payment_mode] = (byMode[o.payment_mode] || 0) + parseFloat(o.total_amount); });

    res.json({
      total_orders: activeOrders.length,
      cancelled_orders: allOrders.length - activeOrders.length,
      total_sale: totalSale,
      by_payment_mode: byMode
    });
  } catch (err) {
    console.error('Day summary error:', err);
    res.status(500).json({ error: 'Summary load nahi ho paaya.' });
  }
});

// =====================================================================
// GET /api/reports/all-stores-summary — SIRF ADMIN: dashboard "Sales Overview" tab ke liye (JSON, Excel nahi)
// =====================================================================
router.get('/all-stores-summary', requireLogin, requireAdmin, async (req, res) => {
  const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const storesResult = await pool.query('SELECT id, store_name, store_code, city FROM stores WHERE is_active = true ORDER BY store_name');
    const stores = storesResult.rows;

    const ordersResult = await pool.query(
      `SELECT store_id, payment_mode, total_amount, is_cancelled FROM orders WHERE order_date = $1`,
      [reportDate]
    );
    const orders = ordersResult.rows.filter(o => !o.is_cancelled);

    const summary = stores.map(store => {
      const storeOrders = orders.filter(o => o.store_id === store.id);
      const totalSale = storeOrders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
      const byMode = {};
      storeOrders.forEach(o => { byMode[o.payment_mode] = (byMode[o.payment_mode] || 0) + parseFloat(o.total_amount); });
      return {
        store_id: store.id, store_name: store.store_name, store_code: store.store_code, city: store.city,
        total_orders: storeOrders.length, total_sale: totalSale, by_payment_mode: byMode
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

// =====================================================================
// GET /api/reports/excel — TEMPLATE 1: "DAILY SALES DETAILS" (single day, single store)
// Columns: SR.NO | ORDER NO | ORDER NAME (items) | TOTAL | PAYMENT MODE | PAYMENT TIME
// =====================================================================
router.get('/excel', requireLogin, async (req, res) => {
  const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
  const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
  if (!storeId) return res.status(400).json({ error: 'store_id chahiye.' });

  try {
    const storeResult = await pool.query('SELECT store_name, store_code FROM stores WHERE id = $1', [storeId]);
    const store = storeResult.rows[0];
    const storeName = store ? store.store_name : `Store ${storeId}`;

    const ordersResult = await pool.query(
      `SELECT o.id, o.total_amount, o.payment_mode, o.created_at, o.is_cancelled,
              array_agg(oi.item_name || ' x' || oi.quantity) AS items
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.store_id = $1 AND o.order_date = $2
       GROUP BY o.id ORDER BY o.created_at`,
      [storeId, reportDate]
    );

    const workbook = buildDailySalesSheet(storeName, ordersResult.rows);
    const fileName = `${(store ? store.store_code : storeId)}_DailySales_${reportDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Excel banane mein gadbad hui.' });
  }
});

// Helper: builds the "DAILY SALES DETAILS" sheet exactly per template
function buildDailySalesSheet(storeName, orders) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `    URBAN VADA PAV  "${storeName.toUpperCase()}" DAILY SALES DETAILS`;
  sheet.getCell('A1').font = { bold: true };

  sheet.getRow(2).values = ['SR.NO', 'ORDER NO', 'ORDER NAME', 'TOTAL', 'PAYMENT MODE', 'PAYMENT TIME'];

  let srNo = 1;
  orders.forEach(o => {
    const orderName = o.items.join(', ') + (o.is_cancelled ? ' (CANCELLED)' : '');
    const time = new Date(o.created_at).toLocaleTimeString('en-IN');
    sheet.addRow([srNo++, o.id, orderName, parseFloat(o.total_amount), o.payment_mode, time]);
  });

  sheet.getColumn(2).width = 10.3;
  sheet.getColumn(3).width = 65;
  sheet.getColumn(4).width = 15.7;
  sheet.getColumn(5).width = 17.3;
  sheet.getColumn(6).width = 14.4;

  return workbook;
}

// =====================================================================
// GET /api/reports/monthly-report — TEMPLATE 2: "MONTHLY PROFIT LOSS" (single store, ek mahine ka)
// Sheet1: Daily Sales Details (sirf last day, ya specific date ka detail — same as /excel)
// Sheet2: MONTHLY PROFIT LOSS — har din ek row: SR NO, DATE, DAY, CASH, ONLINE, TOTAL REVENUE, TOTAL EXPENSE, TOTAL PROFIT
// Query: ?month=YYYY-MM (default current month), ?store_id= (admin ke liye)
// =====================================================================
router.get('/monthly-report', requireLogin, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
  if (!storeId) return res.status(400).json({ error: 'store_id chahiye.' });

  try {
    const storeResult = await pool.query('SELECT store_name, store_code FROM stores WHERE id = $1', [storeId]);
    const store = storeResult.rows[0];
    const storeName = store ? store.store_name : `Store ${storeId}`;

    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Saare orders is mahine ke (cancelled bhi, exclude karenge calculation mein)
    const ordersResult = await pool.query(
      `SELECT order_date, payment_mode, total_amount, is_cancelled FROM orders
       WHERE store_id = $1 AND order_date >= $2 AND order_date <= $3`,
      [storeId, `${month}-01`, `${month}-${String(daysInMonth).padStart(2, '0')}`]
    );
    const orders = ordersResult.rows.filter(o => !o.is_cancelled);

    // Saari expense entries is mahine ki
    const expenseResult = await pool.query(
      `SELECT entry_date, opening_qty, closing_qty, rate_at_entry FROM inventory_entries
       WHERE store_id = $1 AND entry_date >= $2 AND entry_date <= $3
       AND opening_qty IS NOT NULL AND closing_qty IS NOT NULL`,
      [storeId, `${month}-01`, `${month}-${String(daysInMonth).padStart(2, '0')}`]
    );

    const workbook = new ExcelJS.Workbook();

    // Sheet1: Daily Sales Details — latest available day ka (ya aaj agar isi mahine mein hai)
    const todayStr = new Date().toISOString().slice(0, 10);
    const detailDate = todayStr.startsWith(month) ? todayStr : `${month}-01`;
    const dayOrdersResult = await pool.query(
      `SELECT o.id, o.total_amount, o.payment_mode, o.created_at, o.is_cancelled,
              array_agg(oi.item_name || ' x' || oi.quantity) AS items
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.store_id = $1 AND o.order_date = $2
       GROUP BY o.id ORDER BY o.created_at`,
      [storeId, detailDate]
    );
    const sheet1Wb = buildDailySalesSheet(storeName, dayOrdersResult.rows);
    const sheet1 = sheet1Wb.worksheets[0];
    workbook.addWorksheet('Sheet1');
    copySheetContent(sheet1, workbook.getWorksheet('Sheet1'));

    // Sheet2: MONTHLY PROFIT LOSS
    const sheet2 = workbook.addWorksheet('Sheet2');
    buildMonthlyProfitLossSheet(sheet2, storeName, year, monthNum, daysInMonth, orders, expenseResult.rows);

    const fileName = `${(store ? store.store_code : storeId)}_MonthlyReport_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ error: 'Monthly report banane mein gadbad hui.' });
  }
});

// Helper: copies cell values/styles/merges from one worksheet to another (same workbook merge trick)
function copySheetContent(sourceSheet, targetSheet) {
  sourceSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const targetRow = targetSheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = cell.value;
      targetCell.font = cell.font;
    });
    targetRow.commit();
  });
  sourceSheet._merges && Object.keys(sourceSheet._merges).forEach(key => {
    try { targetSheet.mergeCells(sourceSheet._merges[key].shortRange || key); } catch (e) { /* ignore */ }
  });
  Object.keys(sourceSheet.columns || {}).forEach(idx => {
    if (sourceSheet.getColumn(parseInt(idx) + 1).width) {
      targetSheet.getColumn(parseInt(idx) + 1).width = sourceSheet.getColumn(parseInt(idx) + 1).width;
    }
  });
  for (let i = 1; i <= 8; i++) {
    const w = sourceSheet.getColumn(i).width;
    if (w) targetSheet.getColumn(i).width = w;
  }
}

// Helper: builds "MONTHLY PROFIT LOSS" sheet exactly per template (Sheet2)
// Layout: A1:K1 title | Row2-4 headers (SR NO, DATE, DAY, TOTAL SALE[CASH|ONLINE], TOTAL REVENUE, TOTAL EXPENSE, TOTAL PROFIT) | rows 5..(5+days-1) data | last row TOTAL
function buildMonthlyProfitLossSheet(sheet, storeName, year, monthNum, daysInMonth, orders, expenseRows) {
  sheet.mergeCells('A1:K1');
  sheet.getCell('A1').value = `URBAN VADA PAV " ${storeName.toUpperCase()}" MONTHLY PROFIT LOSS`;
  sheet.getCell('A1').font = { bold: true };

  sheet.mergeCells('A2:A4'); sheet.getCell('A2').value = 'SR NO.';
  sheet.mergeCells('B2:B4'); sheet.getCell('B2').value = 'DATE ';
  sheet.mergeCells('C2:C4'); sheet.getCell('C2').value = 'DAY';
  sheet.mergeCells('D2:E3'); sheet.getCell('D2').value = 'TOTAL SALE';
  sheet.getCell('D4').value = 'CASH ';
  sheet.getCell('E4').value = 'ONLINE';
  sheet.mergeCells('F2:G4'); sheet.getCell('F2').value = 'TOAL REVENUE';
  sheet.mergeCells('H2:I4'); sheet.getCell('H2').value = 'TOTAL EXPENSE';
  sheet.mergeCells('J2:K4'); sheet.getCell('J2').value = 'TOTAL PROFIT';

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let totalCash = 0, totalOnline = 0, totalExpenseAll = 0;
  let rowNum = 5;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthNum).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayOrders = orders.filter(o => o.order_date.toISOString ? o.order_date.toISOString().slice(0,10) === dateStr : String(o.order_date) === dateStr);
    const cashTotal = dayOrders.filter(o => o.payment_mode === 'Cash').reduce((s,o)=>s+parseFloat(o.total_amount),0);
    const onlineTotal = dayOrders.filter(o => o.payment_mode !== 'Cash').reduce((s,o)=>s+parseFloat(o.total_amount),0);
    const revenue = cashTotal + onlineTotal;

    const dayExpenseRows = expenseRows.filter(e => e.entry_date.toISOString ? e.entry_date.toISOString().slice(0,10) === dateStr : String(e.entry_date) === dateStr);
    const expense = dayExpenseRows.reduce((sum, row) => {
      const used = parseFloat(row.opening_qty) - parseFloat(row.closing_qty);
      return sum + (used > 0 ? used * parseFloat(row.rate_at_entry) : 0);
    }, 0);
    const profit = revenue - expense;

    totalCash += cashTotal; totalOnline += onlineTotal; totalExpenseAll += expense;

    const dayOfWeek = dayNames[new Date(dateStr).getDay()];
    const row = sheet.getRow(rowNum);
    row.getCell(1).value = d;
    row.getCell(2).value = dateStr;
    row.getCell(3).value = dayOfWeek;
    row.getCell(4).value = cashTotal;
    row.getCell(5).value = onlineTotal;
    sheet.mergeCells(`F${rowNum}:G${rowNum}`); row.getCell(6).value = revenue;
    sheet.mergeCells(`H${rowNum}:I${rowNum}`); row.getCell(8).value = expense;
    sheet.mergeCells(`J${rowNum}:K${rowNum}`); row.getCell(10).value = profit;
    rowNum++;
  }

  const totalRow = sheet.getRow(rowNum);
  totalRow.getCell(3).value = 'TOTAL';
  totalRow.getCell(4).value = totalCash;
  totalRow.getCell(5).value = totalOnline;
  sheet.mergeCells(`F${rowNum}:G${rowNum}`); totalRow.getCell(6).value = totalCash + totalOnline;
  sheet.mergeCells(`H${rowNum}:I${rowNum}`); totalRow.getCell(8).value = totalExpenseAll;
  sheet.mergeCells(`J${rowNum}:K${rowNum}`); totalRow.getCell(10).value = (totalCash + totalOnline) - totalExpenseAll;
  totalRow.font = { bold: true };

  sheet.getColumn(2).width = 9.6;
  sheet.getColumn(4).width = 11.1;
  sheet.getColumn(6).width = 14.3;
  sheet.getColumn(7).width = 12.3;
}

// =====================================================================
// GET /api/reports/ceo-monthly-report — TEMPLATE 3: "CEO REPORT" (SIRF ADMIN) — sab stores combined
// Sheet1: ek store ka daily sales detail (pehla active store, sample ke roop mein)
// Sheet2: ek store ka monthly profit/loss (pehla active store)
// Sheet3: MONTHLY SALES MONTHLY DATA — har din ek row, har store ke liye Name+Sales+Profit columns (DYNAMIC, jitne stores hain)
// Query: ?month=YYYY-MM (default current month)
// =====================================================================
router.get('/ceo-monthly-report', requireLogin, requireAdmin, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  try {
    const storesResult = await pool.query('SELECT id, store_name, store_code FROM stores WHERE is_active = true ORDER BY store_name');
    const stores = storesResult.rows;
    if (stores.length === 0) return res.status(400).json({ error: 'Koi active store nahi hai.' });

    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    // Saare stores ke orders + expenses ek saath le aate hain
    const allOrdersResult = await pool.query(
      `SELECT store_id, order_date, payment_mode, total_amount, is_cancelled FROM orders
       WHERE order_date >= $1 AND order_date <= $2`,
      [monthStart, monthEnd]
    );
    const allOrders = allOrdersResult.rows.filter(o => !o.is_cancelled);

    const allExpenseResult = await pool.query(
      `SELECT store_id, entry_date, opening_qty, closing_qty, rate_at_entry FROM inventory_entries
       WHERE entry_date >= $1 AND entry_date <= $2 AND opening_qty IS NOT NULL AND closing_qty IS NOT NULL`,
      [monthStart, monthEnd]
    );

    const workbook = new ExcelJS.Workbook();

    // Sheet1 + Sheet2: pehle store ka sample detail (CEO is overall report ko Sheet3 ke liye zyada use karega)
    const firstStore = stores[0];
    const todayStr = new Date().toISOString().slice(0, 10);
    const detailDate = todayStr.startsWith(month) ? todayStr : monthStart;
    const dayOrdersResult = await pool.query(
      `SELECT o.id, o.total_amount, o.payment_mode, o.created_at, o.is_cancelled,
              array_agg(oi.item_name || ' x' || oi.quantity) AS items
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.store_id = $1 AND o.order_date = $2
       GROUP BY o.id ORDER BY o.created_at`,
      [firstStore.id, detailDate]
    );
    const sheet1Wb = buildDailySalesSheet(firstStore.store_name, dayOrdersResult.rows);
    workbook.addWorksheet('Sheet1');
    copySheetContent(sheet1Wb.worksheets[0], workbook.getWorksheet('Sheet1'));

    const sheet2 = workbook.addWorksheet('Sheet2');
    const firstStoreOrders = allOrders.filter(o => o.store_id === firstStore.id);
    const firstStoreExpenses = allExpenseResult.rows.filter(e => e.store_id === firstStore.id);
    buildMonthlyProfitLossSheet(sheet2, firstStore.store_name, year, monthNum, daysInMonth, firstStoreOrders, firstStoreExpenses);

    // Sheet3: MONTHLY SALES MONTHLY DATA — dynamic, sab stores
    const sheet3 = workbook.addWorksheet('Sheet3');
    buildCeoMonthlySheet(sheet3, stores, year, monthNum, daysInMonth, allOrders, allExpenseResult.rows);

    const fileName = `CEO_Report_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('CEO monthly report error:', err);
    res.status(500).json({ error: 'CEO report banane mein gadbad hui.' });
  }
});

// Helper: "MONTHLY SALES MONTHLY DATA" sheet — DYNAMIC columns, 3 per store (Name, Total Sales, Total Profit)
function buildCeoMonthlySheet(sheet, stores, year, monthNum, daysInMonth, allOrders, allExpenseRows) {
  sheet.mergeCells(`A1:${colLetter(3 + stores.length * 3)}1`);
  sheet.getCell('A1').value = 'URBAN VADA PAV MONTHLY SALES MONTHLY DATA';
  sheet.getCell('A1').font = { bold: true };

  // Header row 2
  sheet.getCell('A2').value = 'SR NO.';
  sheet.getCell('B2').value = 'DATE ';
  sheet.getCell('C2').value = 'DAY';
  stores.forEach((store, idx) => {
    const baseCol = 4 + idx * 3; // D=4 for first store
    sheet.getCell(rowCol(2, baseCol)).value = `${store.store_name.toUpperCase()} NAME`;
    sheet.getCell(rowCol(2, baseCol + 1)).value = 'TOTAL SALES';
    sheet.getCell(rowCol(2, baseCol + 2)).value = 'TOTAL PROFIT';
  });

  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let rowNum = 3;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthNum).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayOfWeek = dayNames[new Date(dateStr).getDay()];
    const row = sheet.getRow(rowNum);
    row.getCell(1).value = d;
    row.getCell(2).value = dateStr;
    row.getCell(3).value = dayOfWeek;

    stores.forEach((store, idx) => {
      const baseCol = 4 + idx * 3;
      const dayOrders = allOrders.filter(o => o.store_id === store.id &&
        (o.order_date.toISOString ? o.order_date.toISOString().slice(0,10) : String(o.order_date)) === dateStr);
      const sales = dayOrders.reduce((s,o)=>s+parseFloat(o.total_amount),0);

      const dayExpenses = allExpenseRows.filter(e => e.store_id === store.id &&
        (e.entry_date.toISOString ? e.entry_date.toISOString().slice(0,10) : String(e.entry_date)) === dateStr);
      const expense = dayExpenses.reduce((sum, row2) => {
        const used = parseFloat(row2.opening_qty) - parseFloat(row2.closing_qty);
        return sum + (used > 0 ? used * parseFloat(row2.rate_at_entry) : 0);
      }, 0);
      const profit = sales - expense;

      row.getCell(baseCol).value = store.store_name;
      row.getCell(baseCol + 1).value = sales;
      row.getCell(baseCol + 2).value = profit;
    });
    rowNum++;
  }

  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 12.1;
  sheet.getColumn(6).width = 13.3;
}

function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function rowCol(row, col) { return `${colLetter(col)}${row}`; }

// =====================================================================
// GET /api/reports/excel-all-stores — SIRF ADMIN: ek hi din ka, sab stores combined Excel (quick day-close use case)
// =====================================================================
router.get('/excel-all-stores', requireLogin, requireAdmin, async (req, res) => {
  const reportDate = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const storesResult = await pool.query('SELECT id, store_name, store_code FROM stores WHERE is_active = true ORDER BY store_name');
    const stores = storesResult.rows;

    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Overall Summary');
    summarySheet.addRow(['URBAN VADA PAV — Pan India Sales Summary']);
    summarySheet.addRow(['Date', reportDate]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Store', 'Total Orders (active)', 'Total Sale (₹)']);

    let grandTotal = 0, grandOrders = 0;
    const perStoreData = [];

    for (const store of stores) {
      const ordersResult = await pool.query(
        `SELECT o.id, o.total_amount, o.payment_mode, o.created_at, o.is_cancelled,
                array_agg(oi.item_name || ' x' || oi.quantity) AS items
         FROM orders o JOIN order_items oi ON oi.order_id = o.id
         WHERE o.store_id = $1 AND o.order_date = $2
         GROUP BY o.id ORDER BY o.created_at`,
        [store.id, reportDate]
      );
      const activeOrders = ordersResult.rows.filter(o => !o.is_cancelled);
      const storeTotal = activeOrders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
      grandTotal += storeTotal; grandOrders += activeOrders.length;
      summarySheet.addRow([`${store.store_name} (${store.store_code})`, activeOrders.length, storeTotal]);
      perStoreData.push({ store, orders: ordersResult.rows });
    }
    summarySheet.addRow([]);
    summarySheet.addRow(['GRAND TOTAL (All Stores)', grandOrders, grandTotal]);
    summarySheet.getColumn(1).width = 30;
    summarySheet.getColumn(2).width = 18;
    summarySheet.getColumn(3).width = 18;

    perStoreData.forEach(({ store, orders }) => {
      const sheetWb = buildDailySalesSheet(store.store_name, orders);
      const sheetName = store.store_code.substring(0, 28);
      workbook.addWorksheet(sheetName);
      copySheetContent(sheetWb.worksheets[0], workbook.getWorksheet(sheetName));
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="AllStores_Sales_${reportDate}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('All-stores excel error:', err);
    res.status(500).json({ error: 'Combined Excel banane mein gadbad hui.' });
  }
});

module.exports = router;
