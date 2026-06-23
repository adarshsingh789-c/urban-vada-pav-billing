// setup-first-admin.js
// ===========================================================================
// Yeh script SIRF EK BAAR chalani hai — pehla ADMIN (founder) login banane ke liye.
// Terminal mein yeh command chalayein:
//
//     node setup-first-admin.js
//
// Yeh aapse username aur password poochega, aur use database mein safely save karega.
// ===========================================================================

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('./db/pool');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('--- Urban Vada Pav: Pehla Admin (Founder) Login Banayein ---\n');
  const username = await ask('Admin username (jaise: founder): ');
  const password = await ask('Admin password (kam se kam 8 characters): ');
  const fullName = await ask('Aapka naam: ');

  if (!username || !password || password.length < 8) {
    console.log('\nUsername chahiye aur password kam se kam 8 characters ka hona chahiye. Phir try karein.');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role, full_name) VALUES ($1, $2, 'admin', $3)`,
      [username, passwordHash, fullName]
    );
    console.log(`\nAdmin login ban gaya! Username: "${username}" se aap login kar sakte ho.`);
  } catch (err) {
    if (err.code === '23505') {
      console.log('\nYeh username already exist karta hai. Alag username try karein.');
    } else {
      console.error('\nError:', err.message);
    }
  } finally {
    rl.close();
    pool.end();
  }
}

main();
