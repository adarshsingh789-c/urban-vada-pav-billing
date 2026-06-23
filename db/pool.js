// db/pool.js
// Database connection — Supabase/PostgreSQL se connect karta hai.
// DATABASE_URL environment variable mein connection string aati hai
// (yeh Supabase ke dashboard se milegi — README mein step-by-step bataya gaya hai)

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Supabase/cloud databases ko SSL chahiye hota hai
});

module.exports = pool;
