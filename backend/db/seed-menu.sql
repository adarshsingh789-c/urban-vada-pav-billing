-- =====================================================================
-- URBAN VADA PAV — Complete Menu Seed Data
-- Yeh file database setup ke baad ek baar chalani hai, taaki pura
-- menu (130+ items) automatically database mein aa jaye.
-- =====================================================================

INSERT INTO menu_items (category, item_name, price, variant_label) VALUES
-- Veg Vada Pav
('Veg Vada Pav','Chotu Vada Pav',29,NULL),
('Veg Vada Pav','Signature Vada Pav',45,NULL),
('Veg Vada Pav','Bombay Vada Pav',59,NULL),
('Veg Vada Pav','Aloo Tikki Vada Pav',55,NULL),
('Veg Vada Pav','Masala Vada Pav',65,NULL),
('Veg Vada Pav','Chilli Potato Vada Pav',59,NULL),
('Veg Vada Pav','Crispy Vada Pav',65,NULL),
('Veg Vada Pav','Makka Palak Vada Pav',65,NULL),
('Veg Vada Pav','Cheese Vada Pav',65,NULL),
('Veg Vada Pav','Schezwan Vada Pav',65,NULL),
('Veg Vada Pav','Chatpata Vada Pav',65,NULL),
('Veg Vada Pav','Mix Veg Vada Pav',75,NULL),
('Veg Vada Pav','Urban Maharaja Vada Pav',79,NULL),
('Veg Vada Pav','Cheesy Pizza Vada Pav',79,NULL),
('Veg Vada Pav','Cheesy Jain Vada Pav',79,NULL),
('Veg Vada Pav','Chataka Paneer Vada Pav',109,NULL),
('Veg Vada Pav','Tandoori Vada Pav',69,NULL),
('Veg Vada Pav','New Urban Mumbaiya Green Chutney Vada Pav',59,NULL),

-- Urban Sides
('Urban Sides','Urban Hot Coffee',39,NULL),
('Urban Sides','Urban Masala Tea',25,NULL),
('Urban Sides','French Fries',69,'Regular'),
('Urban Sides','French Fries',109,'Large'),
('Urban Sides','Peri Peri Masala French Fries',79,'Regular'),
('Urban Sides','Peri Peri Masala French Fries',119,'Large'),
('Urban Sides','Peri Peri Masala Loaded Fries',119,'Regular'),
('Urban Sides','Peri Peri Masala Loaded Fries',189,'Large'),

-- Veg Grilled Wrap
('Veg Grilled Wrap','Aloo Tikki Wrap',129,NULL),
('Veg Grilled Wrap','Herb Potato Wrap',139,NULL),
('Veg Grilled Wrap','Tandoori Wrap',139,NULL),
('Veg Grilled Wrap','Cheesy Pizza Wrap',149,NULL),
('Veg Grilled Wrap','Makka Palak Wrap',139,NULL),
('Veg Grilled Wrap','Big Veggie Wrap',139,NULL),
('Veg Grilled Wrap','Signature Urban Spicy Wrap',139,NULL),
('Veg Grilled Wrap','Mixveg Corn Wrap',139,NULL),
('Veg Grilled Wrap','New Mexican Cheese Wrap',149,NULL),
('Veg Grilled Wrap','Chatpata Paneer Wrap',159,NULL),

-- Urban Maggi
('Urban Maggi','Masala Vegetable Maggi',79,NULL),
('Urban Maggi','Cheese Masala Maggi',89,NULL),
('Urban Maggi','Butter Masala Maggi',89,NULL),
('Urban Maggi','Tandoori Masala Maggi',99,NULL),
('Urban Maggi','Urban Schezwan Maggi',99,NULL),

-- Urban Pasta
('Urban Pasta','White Sauce Pasta',115,NULL),
('Urban Pasta','Red Sauce Pasta',115,NULL),
('Urban Pasta','Mix Sauce Pasta',125,NULL),
('Urban Pasta','New Peri Peri Pasta',135,NULL),

-- Veg Nuggets
('Veg Nuggets','Chilli Flakes Nuggets (10pcs)',55,NULL),
('Veg Nuggets','Cheese Corn Bites (8pcs)',125,NULL),
('Veg Nuggets','Pizza Puff',69,'2pc'),
('Veg Nuggets','Pizza Puff',115,'4pc'),
('Veg Nuggets','New Sabudana Vada (4pcs)',109,NULL),
('Veg Nuggets','New Urban Desi Mini Samosa (5pcs)',69,NULL),
('Veg Nuggets','New Urban Cheese Potato Kieves (10pcs)',149,NULL),

-- Veg Grilled Sandwich
('Veg Grilled Sandwich','Tandoori Sandwich',79,'2pc'),
('Veg Grilled Sandwich','Tandoori Sandwich',139,'4pc'),
('Veg Grilled Sandwich','Cheese Tandoori Sandwich',89,'2pc'),
('Veg Grilled Sandwich','Cheese Tandoori Sandwich',149,'4pc'),
('Veg Grilled Sandwich','Mix Veg Corn Sandwich',79,'2pc'),
('Veg Grilled Sandwich','Mix Veg Corn Sandwich',139,'4pc'),
('Veg Grilled Sandwich','Mix Veg Cheese Corn Sandwich',89,'2pc'),
('Veg Grilled Sandwich','Mix Veg Cheese Corn Sandwich',149,'4pc'),
('Veg Grilled Sandwich','Chatpata Paneer Sandwich',99,'2pc'),
('Veg Grilled Sandwich','Chatpata Paneer Sandwich',169,'4pc'),
('Veg Grilled Sandwich','Cheese Chatpata Paneer Sandwich',109,'2pc'),
('Veg Grilled Sandwich','Cheese Chatpata Paneer Sandwich',179,'4pc'),
('Veg Grilled Sandwich','Cheesey Pizza Sandwich',99,'2pc'),
('Veg Grilled Sandwich','Cheesey Pizza Sandwich',179,'4pc'),
('Veg Grilled Sandwich','Chilli Garlic Sandwich',89,'2pc'),
('Veg Grilled Sandwich','Chilli Garlic Sandwich',159,'4pc'),
('Veg Grilled Sandwich','Chilli Garlic Cheese Sandwich',99,'2pc'),
('Veg Grilled Sandwich','Chilli Garlic Cheese Sandwich',159,'4pc'),
('Veg Grilled Sandwich','Herb Potato Loded Sandwich',89,'2pc'),
('Veg Grilled Sandwich','Herb Potato Loded Sandwich',149,'4pc'),
('Veg Grilled Sandwich','Herb Potato Loded Cheese Sandwich',99,'2pc'),
('Veg Grilled Sandwich','Herb Potato Loded Cheese Sandwich',159,'4pc'),

-- Cold Coffee & Shakes
('Cold Coffee & Shakes','Premium Cold Coffee',115,NULL),
('Cold Coffee & Shakes','Butter Scotch Shake',125,NULL),
('Cold Coffee & Shakes','Oreo Shake',125,NULL),
('Cold Coffee & Shakes','Double Oreo Shake',135,NULL),
('Cold Coffee & Shakes','Chocolate Shake',125,NULL),
('Cold Coffee & Shakes','Black Currant Shake',125,NULL),
('Cold Coffee & Shakes','Strawberry Shake',125,NULL),
('Cold Coffee & Shakes','Mango Shake',125,NULL),
('Cold Coffee & Shakes','Urban Cold Coffee',135,NULL),
('Cold Coffee & Shakes','Urban Loaded Choco Brownie Shake',149,NULL),

-- Ice Tea & Mojito
('Ice Tea & Mojito','New Urban Masala Soda Shikanji',79,NULL),
('Ice Tea & Mojito','New Urban Kesariya Thandhai',69,NULL),
('Ice Tea & Mojito','Lemon Iced Tea',75,NULL),
('Ice Tea & Mojito','Virgin Mojito',105,NULL),
('Ice Tea & Mojito','Strawberry Mojito',105,NULL),
('Ice Tea & Mojito','Blue Lagoon Mojito',105,NULL),
('Ice Tea & Mojito','Green Apple Soda',105,NULL),
('Ice Tea & Mojito','New Spicy Mango Mojito',125,NULL),
('Ice Tea & Mojito','New Watermelon Mojito',115,NULL),

-- Urban Special Pizza 9"
('Urban Special Pizza 9"','Urban Margherita Pizza',135,NULL),
('Urban Special Pizza 9"','Urban Capsicum Pizza',145,NULL),
('Urban Special Pizza 9"','Urban Mix Corn Pizza',155,NULL),
('Urban Special Pizza 9"','Urban Onion Pizza',145,NULL),
('Urban Special Pizza 9"','Urban Cheese Burst Pizza',199,NULL),
('Urban Special Pizza 9"','Urban Peppy Paneer Pizza',185,NULL),
('Urban Special Pizza 9"','Urban Smoky Pepper Pizza',169,NULL),
('Urban Special Pizza 9"','Urban Sweet Corn Pizza',145,NULL),
('Urban Special Pizza 9"','New Urban Maxican Cheese Pizza',149,NULL),
('Urban Special Pizza 9"','New Urban Farm House Pizza',249,NULL),
('Urban Special Pizza 9"','New Urban American Delight Pizza',249,NULL),
('Urban Special Pizza 9"','New Urban Spl. Makhani Pizza',249,NULL),

-- Burger
('Burger','Urban Crispy Aloo Burger',59,NULL),
('Burger','Urban Signature Masala Burger',69,NULL),
('Burger','Urban Veggie Delight Burger',79,NULL),
('Burger','New Urban Veg Cheese Burger',89,NULL),
('Burger','Urban Special Maharaja Burger',85,NULL),
('Burger','New Urban Veggie Peri Peri Burger',99,NULL),
('Burger','Urban Cheesy Delight Burger',109,NULL),
('Burger','New Mexican Cheese Burger',109,NULL),
('Burger','Urban Crispy Paneer Burger',129,NULL),

-- Brownie
('Brownie','Urban Choco Brownie',119,NULL),
('Brownie','Urban Sizzler Brownie with Vanilla',175,NULL),
('Brownie','Urban Choco Fudge',175,NULL),

-- New Arrival
('New Arrival','New Urban Peri Peri Fried Idli (4pc)',99,NULL),
('New Arrival','New Urban Spl. Fried Poha',69,NULL),
('New Arrival','New Urban Spl. South Upma',99,NULL),

-- Add On Items
('Add On Items','Extra Sauce Dip',29,NULL),
('Add On Items','Extra Ketchup Sachet',2,NULL),
('Add On Items','Extra Garlic Powder',19,NULL),
('Add On Items','Extra Pizza Veggies',35,NULL),
('Add On Items','Extra Mozzrella Cheese',45,NULL);
