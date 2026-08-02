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

async function setupDatabase() { await pool.query(`
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
  `);) 

  await pool.query(`
    CREATE TABLE IF NOT EXISTS experiences (
      confession_id INTEGER,
      user_id BIGINT,
      PRIMARY KEY(confession_id, user_id)
    )
  `);

  await pool.query(`
CREATE TABLE IF NOT EXISTS reply_sessions (
    user_id BIGINT PRIMARY KEY,
    confession_id INTEGER
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

  if (query.data.startsWith("reply_")) {

  const confessionId = query.data.split("_")[1];

  await pool.query(
    `
    INSERT INTO reply_sessions(user_id, confession_id)
    VALUES($1,$2)
    ON CONFLICT(user_id)
    DO UPDATE SET confession_id=$2
    `,
    [
      query.from.id,
      confessionId
    ]
  );

  await bot.sendMessage(
    query.from.id,
    "💬 Silakan kirim balasanmu.\n\nBalasan akan dikirim secara anonim."
  );

  return bot.answerCallbackQuery(query.id);

}
  
  if (query.data.startsWith("support_")) {

  const confessionId = query.data.split("_")[1];
  const userId = query.from.id;

  // Cek apakah sudah pernah mendukung
  const check = await pool.query(
    "SELECT * FROM supports WHERE confession_id=$1 AND user_id=$2",
    [confessionId, userId]
  );

  if (check.rows.length > 0) {
    return bot.answerCallbackQuery(query.id, {
      text: "❤️ Kamu sudah memberikan dukungan."
    });
  }

  await pool.query(
    "INSERT INTO supports(confession_id,user_id) VALUES($1,$2)",
    [confessionId, userId]
  );

  await pool.query(
    "UPDATE confessions SET support_count = support_count + 1 WHERE id=$1",
    [confessionId]
  );

  const result = await pool.query(
    "SELECT support_count, experience_count FROM confessions WHERE id=$1",
    [confessionId]
  );

  const data = result.rows[0];

  await bot.editMessageReplyMarkup({
    inline_keyboard: [
      [{
        text: `❤️ Dukung (${data.support_count})`,
        callback_data: `support_${confessionId}`
      }],
      [{
        text: `🫂 Aku Pernah Mengalami (${data.experience_count})`,
        callback_data: `experience_${confessionId}`
      }],
      [{
        text: "💬 Balas",
        callback_data: `reply_${confessionId}`
      }]
    ]
  },{
    chat_id: query.message.chat.id,
    message_id: query.message.message_id
  });

  return bot.answerCallbackQuery(query.id,{
    text:"❤️ Terima kasih atas dukungannya."
  });

}
  if (query.data.startsWith("experience_")) {

  const confessionId = query.data.split("_")[1];
  const userId = query.from.id;

  const check = await pool.query(
    "SELECT * FROM experiences WHERE confession_id=$1 AND user_id=$2",
    [confessionId, userId]
  );

  if (check.rows.length > 0) {
    return bot.answerCallbackQuery(query.id,{
      text:"🫂 Kamu sudah memilih ini."
    });
  }

  await pool.query(
    "INSERT INTO experiences(confession_id,user_id) VALUES($1,$2)",
    [confessionId,userId]
  );

  await pool.query(
    "UPDATE confessions SET experience_count = experience_count + 1 WHERE id=$1",
    [confessionId]
  );

  const result = await pool.query(
    "SELECT support_count, experience_count FROM confessions WHERE id=$1",
    [confessionId]
  );

  const data = result.rows[0];

  await bot.editMessageReplyMarkup({
    inline_keyboard:[
      [{
        text:`❤️ Dukung (${data.support_count})`,
        callback_data:`support_${confessionId}`
      }],
      [{
        text:`🫂 Aku Pernah Mengalami (${data.experience_count})`,
        callback_data:`experience_${confessionId}`
      }],
      [{
        text:"💬 Balas",
        callback_data:`reply_${confessionId}`
      }]
    ]
  },{
    chat_id:query.message.chat.id,
    message_id:query.message.message_id
  });

  return bot.answerCallbackQuery(query.id,{
    text:"🫂 Terima kasih telah berbagi."
  });

  }
  
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

// =====================
// TERIMA CURHAT
// =====================

bot.on("message", async (msg) => {

  const chatId = msg.chat.id;

  // Hanya private chat
  if (msg.chat.type !== "private") return;

  // Abaikan command
  if (msg.text?.startsWith("/")) return;

  // User belum memilih Kirim Curhat
  if (!waitingCurhat[chatId]) return;

  try {

    const time = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit"
    });

    let sent;

    // =====================
    // TEXT
    // =====================

    if (msg.text) {

      sent = await bot.sendMessage(
        GROUP_ID,
`🫂 CURHAT

${msg.text}

━━━━━━━━━━━━
Anonim • ${time}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "❤️ Dukung (0)",
                  callback_data: "support_0"
                }
              ],
              [
                {
                  text: "🫂 Aku Pernah Mengalami (0)",
                  callback_data: "experience_0"
                }
              ],
              [
                {
                  text: "💬 Balas",
                  callback_data: "reply_0"
                }
              ]
            ]
          }
        }
      );

    }

    else {

      await bot.sendMessage(
        chatId,
        "Saat ini hanya teks yang didukung."
      );

      return;

    }

    // Simpan ke database
    const result = await pool.query(
      `
      INSERT INTO confessions
      (sender_id, group_message_id)
      VALUES ($1,$2)
      RETURNING id
      `,
      [
        msg.from.id,
        sent.message_id
      ]
    );

    const confessionId = result.rows[0].id;

    // Update callback tombol dengan ID database
    await bot.editMessageReplyMarkup(
      {
        inline_keyboard: [
          [
            {
              text: "❤️ Dukung (0)",
              callback_data: `support_${confessionId}`
            }
          ],
          [
            {
              text: "🫂 Aku Pernah Mengalami (0)",
              callback_data: `experience_${confessionId}`
            }
          ],
          [
            {
              text: "💬 Balas",
              callback_data: `reply_${confessionId}`
            }
          ]
        ]
      },
      {
        chat_id: GROUP_ID,
        message_id: sent.message_id
      }
    );

    delete waitingCurhat[chatId];

    await bot.sendMessage(
      chatId,
      "✅ Curhatanmu berhasil dikirim secara anonim."
    );

  } catch (error) {

    console.log(error);

    await bot.sendMessage(
      chatId,
      "❌ Gagal mengirim curhat."
    );

  }

});
