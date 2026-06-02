const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SECRET_TOKEN = process.env.SECRET_TOKEN;

// ضع هنا أرقام رسائل الملفات من القناة الخاصة.
// مثال: إذا رابط الملف https://t.me/c/1234567890/25
// فإن message_id هو 25
const FILES = {
  anatomy_lab: [2,3],
  anatomy_pdf: [],
  anatomy_recordings: []
};

async function telegram(method, data = {}) {
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is missing in Environment Variables");
    return { ok: false, error: "BOT_TOKEN is missing" };
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!result.ok) {
    console.error("Telegram API Error:", result);
  }

  return result;
}

function replyKeyboard(rows) {
  return {
    keyboard: rows.map(row => row.map(text => ({ text }))),
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

async function sendText(chatId, text) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text
  });
}

async function sendMenu(chatId, text, rows) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyKeyboard(rows)
  });
}

async function sendFiles(chatId, fileKey) {
  const messageIds = FILES[fileKey] || [];

  if (!CHANNEL_ID) {
    await sendText(chatId, "خطأ: لم يتم ضبط CHANNEL_ID في Vercel.");
    return;
  }

  if (messageIds.length === 0) {
    await sendText(chatId, "لا توجد ملفات حالياً في هذا القسم.");
    return;
  }

  await sendText(chatId, "جاري إرسال الملفات...");

  for (const messageId of messageIds) {
    await telegram("copyMessage", {
      chat_id: chatId,
      from_chat_id: CHANNEL_ID,
      message_id: messageId,
      protect_content: false
    });
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;

  if (!text) return;

  if (text === "/start" || text === "رجوع للرئيسية") {
    await sendMenu(
      chatId,
      "مرحباً بك دكتور/ة 👋\n\nأهلاً بك في بوت اللجنة العلمية - جامعة العلوم والتكنولوجيا - الطب البشري.\n\nاختر السنة من القائمة بالأسفل 👇",
      [
        ["1st year 🔴", "2nd year 🟠"],
        ["3rd year 🟡", "4th year 🟢"],
        ["5th year 🔵", "6th year 🟣"]
      ]
    );
    return;
  }

  if (text === "1st year 🔴") {
    await sendMenu(chatId, "اختر الترم:", [
      ["ترم اول", "ترم ثاني"],
      ["رجوع للرئيسية"]
    ]);
    return;
  }

  if (text === "ترم اول") {
    await sendMenu(chatId, "اختر المادة:", [
      ["anatomy", "physiology"],
      ["histology", "biochemistry"],
      ["رجوع للرئيسية"]
    ]);
    return;
  }

  if (text === "anatomy") {
    await sendMenu(chatId, "اختر القسم:", [
      ["Lab 🔬", "PDF 📚"],
      ["Recordings 🎧"],
      ["رجوع للرئيسية"]
    ]);
    return;
  }

  if (text === "Lab 🔬") {
    await sendFiles(chatId, "anatomy_lab");
    return;
  }

  if (text === "PDF 📚") {
    await sendFiles(chatId, "anatomy_pdf");
    return;
  }

  if (text === "Recordings 🎧") {
    await sendFiles(chatId, "anatomy_recordings");
    return;
  }

  await sendText(chatId, "اختر من الأزرار بالأسفل 👇");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("UST Medical Committee Telegram Bot is running.");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const telegramSecret = req.headers["x-telegram-bot-api-secret-token"];

    if (SECRET_TOKEN && telegramSecret !== SECRET_TOKEN) {
      return res.status(401).send("Unauthorized");
    }

    const update = req.body;

    if (update.message) {
      await handleMessage(update.message);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook Error:", error);

    return res.status(200).json({
      ok: false,
      error: error.message
    });
  }
}
