const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function json(res, status, data) {
  return res.status(status).json(data);
}

function ok(res, data) {
  return json(res, 200, { ok: true, ...data });
}

function fail(res, status, message, extra) {
  return json(res, status, { ok: false, message, ...(extra || {}) });
}

function getAdminPassword(req) {
  return req.headers["x-admin-password"] || req.headers["authorization"]?.replace("Bearer ", "") || "";
}

function checkAdmin(req) {
  if (!ADMIN_PASSWORD) {
    return { ok: false, status: 500, message: "ADMIN_PASSWORD is missing in Vercel Environment Variables" };
  }

  const password = getAdminPassword(req);

  if (password !== ADMIN_PASSWORD) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  return { ok: true };
}

function checkTelegramSecret(req) {
  const telegramSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (SECRET_TOKEN && telegramSecret !== SECRET_TOKEN) return false;
  return true;
}

function assertSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in Vercel Environment Variables");
  }
}

async function supabaseRequest(path, options) {
  assertSupabase();

  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, {
    method: options?.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options?.prefer || "return=representation",
      ...(options?.headers || {})
    },
    body: options?.body
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  if (!response.ok) {
    const details = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Supabase Error ${response.status}: ${details}`);
  }

  return data;
}

async function supabaseCount(table, filter) {
  assertSupabase();
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*${filter ? `&${filter}` : ""}`;

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Range: "0-0",
      Prefer: "count=exact"
    }
  });

  if (!response.ok) return 0;

  const range = response.headers.get("content-range") || "0-0/0";
  const total = Number(range.split("/")[1] || 0);
  return Number.isFinite(total) ? total : 0;
}

async function telegram(method, data) {
  if (!BOT_TOKEN) {
    return { ok: false, description: "BOT_TOKEN is missing in Vercel Environment Variables" };
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data || {})
  });

  const result = await response.json();

  if (!result.ok) {
    console.error("Telegram API Error", method, result);
  }

  return result;
}

function replyKeyboard(rows) {
  return {
    keyboard: rows.map(row => row.map(text => ({ text }))),
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: "اختر من القائمة"
  };
}

function inlineKeyboard(rows) {
  return {
    inline_keyboard: rows.map(row => row.map(btn => ({ text: btn.text, callback_data: btn.data || btn.callback_data })))
  };
}

async function sendText(chatId, text, extra) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: extra?.parse_mode,
    reply_markup: extra?.reply_markup
  });
}

async function sendMenu(chatId, text, rows) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyKeyboard(rows)
  });
}

function chunk(items, size) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function uniqueValues(items, key) {
  const result = [];
  const seen = new Set();

  for (const item of items) {
    const value = item[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function eq(value) {
  return encodeURIComponent(value == null ? "" : String(value));
}

function parseTelegramMessageLink(link) {
  if (!link || typeof link !== "string") return null;

  const publicMatch = link.match(/https?:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)/);
  if (publicMatch && publicMatch[1] !== "c") {
    return {
      public_username: publicMatch[1],
      message_id: Number(publicMatch[2])
    };
  }

  const privateMatch = link.match(/https?:\/\/t\.me\/c\/(\d+)\/(\d+)/);
  if (!privateMatch) return null;

  return {
    channel_id: `-100${privateMatch[1]}`,
    message_id: Number(privateMatch[2])
  };
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(x => String(x).trim()).filter(Boolean);
  return String(tags)
    .split(/[،,\n]/)
    .map(x => x.trim())
    .filter(Boolean);
}

function adminGuard(req, res) {
  const admin = checkAdmin(req);
  if (!admin.ok) {
    fail(res, admin.status, admin.message);
    return false;
  }
  return true;
}

function getTelegramUser(message) {
  const from = message?.from || {};
  return {
    chat_id: message.chat.id,
    first_name: from.first_name || null,
    last_name: from.last_name || null,
    username: from.username || null,
    language_code: from.language_code || null,
    last_text: message.text || null,
    last_seen: new Date().toISOString()
  };
}

async function logActivity(chatId, action, details) {
  try {
    await supabaseRequest("bot_activity_logs", {
      method: "POST",
      body: JSON.stringify({ chat_id: chatId, action, details: details || {} })
    });
  } catch (error) {
    console.error("logActivity failed", error.message);
  }
}

module.exports = {
  adminGuard,
  checkAdmin,
  checkTelegramSecret,
  chunk,
  eq,
  fail,
  getTelegramUser,
  inlineKeyboard,
  json,
  logActivity,
  normalizeTags,
  ok,
  parseTelegramMessageLink,
  replyKeyboard,
  sendMenu,
  sendText,
  supabaseCount,
  supabaseRequest,
  telegram,
  uniqueValues
};
