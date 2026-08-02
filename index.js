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

bot.onText(/\/start/, async (msg) => {

  await bot.sendMessage(
    msg.chat.id,
    "🫂 Selamat datang di PalCurhat\n\nTempat berbagi cerita secara anonim.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✍️ Kirim Curhat",
              callback_data: "send_curhat"
            }
          ],
          [
            {
              text: "📖 Cara Kerja",
              callback_data: "help"
            }
          ]
        ]
      }
    }
  );

});

bot.on("callback_query", async (query) => {

  const chatId = query.message.chat.id;

  if (query.data === "send_curhat") {

    waitingCurhat[chatId] = true;

    await bot.sendMessage(
      chatId,
      "🫂 Silakan kirim curhatanmu.\n\nBisa berupa teks, foto, atau video.\n\nIdentitasmu akan disembunyikan."
    );

  }

  if (query.data === "help") {

    await bot.sendMessage(
      chatId,
      "📖 Cara Kerja\n\n1. Kirim curhat melalui bot.\n2. Bot mempostingnya secara anonim ke grup.\n3. Member lain bisa memberi dukungan ❤️, menekan 🫂 Aku Pernah Mengalami, atau membalas secara anonim."
    );

  }

  await bot.answerCallbackQuery(query.id);

});
