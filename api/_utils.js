const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function ok(res, data = {}, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}

function fail(res, status = 500, message = "حدث خطأ") {
  return res.status(status).json({ ok: false, message });
}

function adminGuard(req, res) {
  const password = req.headers["x-admin-password"] || req.headers["X-Admin-Password"];

  if (!ADMIN_PASSWORD) {
    fail(res, 401, "ADMIN_PASSWORD غير موجود في Vercel Environment Variables");
    return false;
  }

  if (password !== ADMIN_PASSWORD) {
    fail(res, 401, "كلمة سر لوحة التحكم غير صحيحة");
    return false;
  }

  return true;
}

function telegramGuard(req, res) {
  const telegramSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (SECRET_TOKEN && telegramSecret !== SECRET_TOKEN) {
    res.status(401).send("Unauthorized");
    return false;
  }
  return true;
}

async function telegram(method, data = {}) {
  if (!BOT_TOKEN) {
    return { ok: false, description: "BOT_TOKEN is missing" };
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await response.json().catch(() => ({ ok: false, description: "Bad Telegram response" }));
  if (!result.ok) console.error("Telegram API Error:", method, result);
  return result;
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجود");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  }

  return data;
}

function encodeQueryValue(value) {
  return encodeURIComponent(String(value || "").replaceAll("*", ""));
}

function replyKeyboard(rows) {
  return {
    keyboard: rows.map(row => row.map(text => ({ text }))),
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: "اختر من القائمة"
  };
}

function chunkButtons(items, size = 2) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

async function sendText(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    ...extra
  });
}

async function sendMenu(chatId, text, rows) {
  return sendText(chatId, text, { reply_markup: replyKeyboard(rows) });
}

function parseTelegramMessageLink(link) {
  if (!link) return null;
  const clean = String(link).trim();
  const privateMatch = clean.match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (privateMatch) return { channel_id: `-100${privateMatch[1]}`, message_id: Number(privateMatch[2]) };
  const publicMatch = clean.match(/t\.me\/([A-Za-z0-9_]+)\/(\d+)/);
  if (publicMatch) return { channel_username: `@${publicMatch[1]}`, message_id: Number(publicMatch[2]) };
  return null;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(x => String(x).trim()).filter(Boolean);
  return String(tags || "")
    .split(/[،,\n]/)
    .map(x => x.trim())
    .filter(Boolean);
}

function cleanString(value) {
  return String(value || "").trim();
}

module.exports = {
  ok,
  fail,
  adminGuard,
  telegramGuard,
  telegram,
  supabaseRequest,
  encodeQueryValue,
  replyKeyboard,
  chunkButtons,
  sendText,
  sendMenu,
  parseTelegramMessageLink,
  normalizeTags,
  cleanString
};
