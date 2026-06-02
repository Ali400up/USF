const { supabase, telegram } = require("./_utils.js");

const SECRET_TOKEN = process.env.SECRET_TOKEN;

function inlineKeyboard(rows) {
  return { inline_keyboard: rows };
}

function chunkButtons(items, perRow = 2) {
  const rows = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

function uniqueBy(items, keyField, labelField) {
  const map = new Map();
  for (const item of items) {
    const key = item[keyField];
    if (key && !map.has(key)) map.set(key, { key, label: item[labelField] });
  }
  return [...map.values()];
}

async function getActiveFiles(filters = {}) {
  const parts = ["is_active=eq.true", "select=*", "order=sort_order.asc", "order=id.asc"];
  for (const [key, value] of Object.entries(filters)) {
    if (value) parts.push(`${key}=eq.${encodeURIComponent(value)}`);
  }
  return supabase(`bot_files?${parts.join("&")}`, { method: "GET" });
}

async function sendText(chatId, text, replyMarkup = null) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup || undefined
  });
}

async function editText(chatId, messageId, text, replyMarkup = null) {
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup || undefined
  });
}

async function showYears(chatId, messageId = null) {
  const files = await getActiveFiles();
  const years = uniqueBy(files, "year_key", "year_label");

  const rows = chunkButtons(
    years.map(y => ({ text: y.label, callback_data: `year:${y.key}` })),
    2
  );

  const text = "مرحباً بك دكتور/ة 👋\n\nبوت اللجنة العلمية - جامعة العلوم والتكنولوجيا - الطب البشري.\n\nاختر السنة 👇";
  const markup = inlineKeyboard(rows.length ? rows : [[{ text: "لا توجد ملفات حالياً", callback_data: "noop" }]]);

  if (messageId) return editText(chatId, messageId, text, markup);
  return sendText(chatId, text, markup);
}

async function showTerms(chatId, messageId, yearKey) {
  const files = await getActiveFiles({ year_key: yearKey });
  const terms = uniqueBy(files, "term_key", "term_label");

  const rows = chunkButtons(
    terms.map(t => ({ text: t.label, callback_data: `term:${yearKey}:${t.key}` })),
    2
  );
  rows.push([{ text: "⬅️ رجوع للرئيسية", callback_data: "home" }]);

  return editText(chatId, messageId, "اختر الترم 👇", inlineKeyboard(rows));
}

async function showSubjects(chatId, messageId, yearKey, termKey) {
  const files = await getActiveFiles({ year_key: yearKey, term_key: termKey });
  const subjects = uniqueBy(files, "subject_key", "subject_label");

  const rows = chunkButtons(
    subjects.map(s => ({ text: s.label, callback_data: `subject:${yearKey}:${termKey}:${s.key}` })),
    2
  );
  rows.push([{ text: "⬅️ رجوع", callback_data: `year:${yearKey}` }, { text: "🏠 الرئيسية", callback_data: "home" }]);

  return editText(chatId, messageId, "اختر المادة 👇", inlineKeyboard(rows));
}

async function showSections(chatId, messageId, yearKey, termKey, subjectKey) {
  const files = await getActiveFiles({ year_key: yearKey, term_key: termKey, subject_key: subjectKey });
  const sections = uniqueBy(files, "section_key", "section_label");

  const rows = chunkButtons(
    sections.map(s => ({ text: s.label, callback_data: `files:${yearKey}:${termKey}:${subjectKey}:${s.key}` })),
    2
  );
  rows.push([{ text: "⬅️ رجوع", callback_data: `term:${yearKey}:${termKey}` }, { text: "🏠 الرئيسية", callback_data: "home" }]);

  return editText(chatId, messageId, "اختر القسم 👇", inlineKeyboard(rows));
}

async function sendFiles(chatId, yearKey, termKey, subjectKey, sectionKey) {
  const files = await getActiveFiles({
    year_key: yearKey,
    term_key: termKey,
    subject_key: subjectKey,
    section_key: sectionKey
  });

  if (!files.length) {
    return sendText(chatId, "لا توجد ملفات حالياً في هذا القسم.");
  }

  await sendText(chatId, `جاري إرسال ${files.length} ملف/رسالة...`);

  for (const file of files) {
    await telegram("copyMessage", {
      chat_id: chatId,
      from_chat_id: file.channel_id,
      message_id: file.message_id,
      protect_content: false
    });
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || "";

  if (text === "/start" || text === "start" || text === "رجوع للرئيسية") {
    await showYears(chatId);
    return;
  }

  await sendText(chatId, "اضغط /start لفتح قائمة البوت 👇");
}

async function handleCallback(callbackQuery) {
  const data = callbackQuery.data || "";
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  await telegram("answerCallbackQuery", { callback_query_id: callbackQuery.id });

  if (data === "noop") return;
  if (data === "home") return showYears(chatId, messageId);

  const parts = data.split(":");
  const action = parts[0];

  if (action === "year") return showTerms(chatId, messageId, parts[1]);
  if (action === "term") return showSubjects(chatId, messageId, parts[1], parts[2]);
  if (action === "subject") return showSections(chatId, messageId, parts[1], parts[2], parts[3]);
  if (action === "files") return sendFiles(chatId, parts[1], parts[2], parts[3], parts[4]);
}

module.exports = async function handler(req, res) {
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

    if (update.message) await handleMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
