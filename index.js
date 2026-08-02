require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

const GROUP_ID = process.env.GROUP_ID;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const waitingCurhat = {};

console.log("🫂 PalCurhat aktif...");

async function setupDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS confessions (
      id SERIAL PRIMARY KEY,
      sender_id BIGINT NOT NULL,
      group_message_id BIGINT,
      support_count INTEGER DEFAULT 0,
      experience_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS supports (
      confession_id INTEGER,
      user_id BIGINT,
      PRIMARY KEY(confession_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS experiences (
      confession_id INTEGER,
      user_id BIGINT,
      PRIMARY KEY(confession_id, user_id)
    )
  `);

  console.log("✅ Database siap");

}

setupDatabase();
