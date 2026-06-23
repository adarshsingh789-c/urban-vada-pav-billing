-- =====================================================================
-- URBAN VADA PAV — Multi-Store Billing System — Database Schema
-- =====================================================================
-- Yeh file Supabase (ya kisi bhi PostgreSQL database) mein chalani hai.
-- Step-by-step instructions niche README.md mein hain.
-- =====================================================================

-- 1. STORES TABLE — har store ka basic record
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  store_name TEXT NOT NULL,
  store_code TEXT UNIQUE NOT NULL,        -- jaise 'MUM01', 'DEL02' — unique ID per store
  city TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. USERS TABLE — sab logins yahan hain (store staff + founder/admin)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,            -- password kabhi plain text mein save nahi hota, hash hota hai
  role TEXT NOT NULL CHECK (role IN ('admin', 'store_staff')),
  store_id INTEGER REFERENCES stores(id), -- store_staff ke liye store_id hoga, admin ke liye NULL
  full_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. MENU_ITEMS TABLE — central menu (sab stores same menu use karte hain; chahe to per-store bhi kar sakte hain future mein)
CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  variant_label TEXT,                     -- jaise 'Regular', 'Large', '2pc', '4pc' — NULL agar variant nahi hai
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. ORDERS TABLE — har order ka header (kaunsa store, kab, kitna total, payment mode)
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  created_by_user_id INTEGER REFERENCES users(id),
  token_or_table TEXT,
  total_amount NUMERIC(10,2) NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Card')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,   -- reporting ke liye date alag rakhi hai (fast queries)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. ORDER_ITEMS TABLE — har order ke andar kaunse items the
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
);

-- =====================================================================
-- INDEXES — reports fast chalein, especially "day close" aur "all stores" queries ke liye
-- =====================================================================
CREATE INDEX idx_orders_store_date ON orders(store_id, order_date);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- =====================================================================
-- SAMPLE SEED DATA — pehla store + pehla admin login banane ke liye
-- (Password yahan plain text mein hai sirf reference ke liye —
--  asal app khud password ko hash karke save karega, signup/admin-panel se)
-- =====================================================================
INSERT INTO stores (store_name, store_code, city) VALUES
  ('Urban Vada Pav - Andheri', 'MUM01', 'Mumbai');

-- Admin aur store-staff users backend ke /setup route se banaye jayenge
-- (README mein bataya gaya hai), taaki password sahi se hash ho.
