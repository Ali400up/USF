const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (req.body && typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function requireAdmin(req, res, body = {}) {
  const headerPassword = req.headers["x-admin-password"];
  const password = headerPassword || body.password;

  if (!ADMIN_PASSWORD) {
    res.status(500).json({ ok: false, error: "ADMIN_PASSWORD is missing in Vercel Environment Variables" });
    return false;
  }

  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ ok: false, error: "Unauthorized admin request" });
    return false;
  }

  return true;
}

function assertSupabase() {
  if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing in Vercel Environment Variables");
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing in Vercel Environment Variables");
}

async function supabase(path, options = {}) {
  assertSupabase();

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(options.headers || {})
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : JSON.stringify(data));
  }

  return data;
}

async function telegram(method, data = {}) {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing in Vercel Environment Variables");
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}

async function telegramMultipart(method, formData) {
  if (!BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing in Vercel Environment Variables");
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    body: formData
  });

  const result = await response.json();
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}

function parseTelegramMessageLink(link = "") {
  const value = String(link).trim();

  const privateMatch = value.match(/t\.me\/c\/(\d+)\/(\d+)/i);
  if (privateMatch) {
    return {
      type: "private",
      channel_id: `-100${privateMatch[1]}`,
      message_id: Number(privateMatch[2])
    };
  }

  const publicMatch = value.match(/t\.me\/([A-Za-z0-9_]+)\/(\d+)/i);
  if (publicMatch) {
    return {
      type: "public",
      username: `@${publicMatch[1]}`,
      message_id: Number(publicMatch[2])
    };
  }

  const idOnly = value.match(/^\d+$/);
  if (idOnly) {
    return { type: "id_only", message_id: Number(value) };
  }

  throw new Error("رابط رسالة تليجرام غير صحيح. الصيغة: https://t.me/c/CHANNEL/MESSAGE أو رقم message_id فقط");
}

function safeKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "item";
}

function json(res, status, body) {
  res.status(status).json(body);
}


module.exports = {
  readJson,
  requireAdmin,
  assertSupabase,
  supabase,
  telegram,
  telegramMultipart,
  parseTelegramMessageLink,
  safeKey,
  json
};
