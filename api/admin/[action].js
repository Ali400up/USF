// api/admin/[action].js
// لوحة تحكم بوت اللجنة العلمية المركزية - ملف API واحد لتجنب حد Vercel Hobby
// CommonJS فقط - لا تستخدم type: module

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function sendJson(res, status, data) {
  return res.status(status).json(data);
}

function getAction(req) {
  const q = req.query && req.query.action;
  if (q) return Array.isArray(q) ? q[0] : q;
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function requireAdmin(req) {
  const password = req.headers['x-admin-password'];
  if (!ADMIN_PASSWORD) return { ok: false, message: 'ADMIN_PASSWORD غير موجود في Vercel Environment Variables' };
  if (!password || password !== ADMIN_PASSWORD) return { ok: false, message: 'Unauthorized' };
  return { ok: true };
}

async function telegram(method, payload = {}) {
  if (!BOT_TOKEN) return { ok: false, description: 'BOT_TOKEN is missing' };
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجود');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  }
  return data;
}

function parseTelegramLink(link) {
  if (!link) return null;
  const text = String(link).trim();
  const privateMatch = text.match(/t\.me\/c\/(\d+)\/(\d+)/);
  if (privateMatch) {
    return { channel_id: `-100${privateMatch[1]}`, message_id: Number(privateMatch[2]) };
  }
  return null;
}

function cleanString(value) {
  return value === undefined || value === null ? null : String(value).trim();
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(cleanString).filter(Boolean);
  return String(tags).split(',').map(s => s.trim()).filter(Boolean);
}

async function handleAuth(req, res) {
  const admin = requireAdmin(req);
  if (!admin.ok) return sendJson(res, 401, { ok: false, message: admin.message });
  return sendJson(res, 200, { ok: true, message: 'تم تسجيل الدخول بنجاح' });
}

async function handleHealth(req, res) {
  const result = {
    ok: true,
    message: 'Admin API is working',
    action: 'health',
    time: new Date().toISOString(),
    env: {
      BOT_TOKEN: Boolean(BOT_TOKEN),
      SUPABASE_URL: Boolean(SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(SUPABASE_SERVICE_ROLE_KEY),
      ADMIN_PASSWORD: Boolean(ADMIN_PASSWORD)
    },
    telegram: { ok: false, message: 'Not checked' },
    supabase: { ok: false, message: 'Not checked' }
  };

  try {
    const me = await telegram('getMe');
    if (me.ok) {
      result.telegram = {
        ok: true,
        message: 'Telegram bot is working',
        bot: {
          id: me.result.id,
          first_name: me.result.first_name,
          username: me.result.username
        }
      };
    } else {
      result.telegram = { ok: false, message: me.description || 'Telegram check failed' };
    }
  } catch (error) {
    result.telegram = { ok: false, message: error.message };
  }

  try {
    const test = await supabaseRequest('bot_channels?select=id&limit=1');
    result.supabase = { ok: true, message: 'Supabase connection is working', test };
  } catch (error) {
    result.supabase = { ok: false, message: error.message };
  }

  return sendJson(res, 200, result);
}

async function handleStats(req, res) {
  const [channels, files, users] = await Promise.all([
    supabaseRequest('bot_channels?select=id,is_active'),
    supabaseRequest('bot_files?select=id,is_active,content_type,year_name,subject_name,section_name,views_count'),
    supabaseRequest('bot_users?select=chat_id')
  ]);

  const activeFiles = files.filter(f => f.is_active !== false).length;
  const inactiveFiles = files.filter(f => f.is_active === false).length;
  const years = [...new Set(files.map(f => f.year_name).filter(Boolean))];
  const subjects = [...new Set(files.map(f => f.subject_name).filter(Boolean))];
  const sections = [...new Set(files.map(f => f.section_name).filter(Boolean))];
  const totalViews = files.reduce((sum, f) => sum + Number(f.views_count || 0), 0);

  return sendJson(res, 200, {
    ok: true,
    stats: {
      channels: channels.length,
      active_channels: channels.filter(c => c.is_active !== false).length,
      files: files.length,
      active_files: activeFiles,
      inactive_files: inactiveFiles,
      years: years.length,
      subjects: subjects.length,
      sections: sections.length,
      users: users.length,
      views: totalViews
    }
  });
}

async function handleLists(req, res) {
  const files = await supabaseRequest('bot_files?select=year_name,term_name,subject_name,section_name,content_type');
  const unique = key => [...new Set(files.map(item => item[key]).filter(Boolean))].sort();
  return sendJson(res, 200, {
    ok: true,
    lists: {
      years: unique('year_name'),
      terms: unique('term_name'),
      subjects: unique('subject_name'),
      sections: unique('section_name'),
      content_types: unique('content_type')
    }
  });
}

async function handleChannels(req, res) {
  if (req.method === 'GET') {
    const channels = await supabaseRequest('bot_channels?select=*&order=created_at.desc');
    return sendJson(res, 200, { ok: true, channels });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const title = cleanString(body.title);
    const channel_id = cleanString(body.channel_id);
    if (!title || !channel_id) return sendJson(res, 400, { ok: false, message: 'اسم القناة و Channel ID مطلوبان' });

    const rows = await supabaseRequest('bot_channels', {
      method: 'POST',
      body: JSON.stringify({
        title,
        channel_id,
        username: cleanString(body.username),
        notes: cleanString(body.notes),
        is_active: body.is_active === false ? false : true,
        updated_at: new Date().toISOString()
      })
    });
    return sendJson(res, 200, { ok: true, channel: rows[0] });
  }

  return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });
}

async function handleDeleteChannel(req, res) {
  const id = (req.body && req.body.id) || (req.query && req.query.id);
  if (!id) return sendJson(res, 400, { ok: false, message: 'id مطلوب' });
  await supabaseRequest(`bot_channels?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return sendJson(res, 200, { ok: true, message: 'تم حذف القناة' });
}

async function handleFiles(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });
  const files = await supabaseRequest('bot_files?select=*&order=is_pinned.desc,sort_order.asc,created_at.desc');
  return sendJson(res, 200, { ok: true, files });
}

async function handleAddFile(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });
  const body = req.body || {};

  let channelId = cleanString(body.channel_id);
  let messageId = body.message_id ? Number(body.message_id) : null;
  const telegramLink = cleanString(body.telegram_link);

  if (telegramLink) {
    const parsed = parseTelegramLink(telegramLink);
    if (parsed) {
      channelId = parsed.channel_id;
      messageId = parsed.message_id;
    }
  }

  const title = cleanString(body.title);
  const year_name = cleanString(body.year_name);
  const term_name = cleanString(body.term_name);
  const subject_name = cleanString(body.subject_name);
  const section_name = cleanString(body.section_name);
  const content_type = cleanString(body.content_type || body.file_type || 'file');
  const text_content = cleanString(body.text_content);
  const external_url = cleanString(body.external_url);

  if (!title || !year_name || !term_name || !subject_name || !section_name) {
    return sendJson(res, 400, { ok: false, message: 'العنوان والسنة والترم والمادة والقسم مطلوبة' });
  }

  if (!text_content && !external_url && (!channelId || !messageId)) {
    return sendJson(res, 400, { ok: false, message: 'أضف رابط رسالة تليجرام أو Channel ID + Message ID أو رابط خارجي أو نص' });
  }

  const rows = await supabaseRequest('bot_files', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: cleanString(body.description),
      year_name,
      term_name,
      subject_name,
      section_name,
      content_type,
      channel_id: channelId,
      message_id: messageId,
      telegram_link: telegramLink,
      external_url,
      text_content,
      thumbnail_url: cleanString(body.thumbnail_url),
      tags: normalizeTags(body.tags),
      sort_order: Number(body.sort_order || 0),
      is_pinned: Boolean(body.is_pinned),
      is_active: body.is_active === false ? false : true,
      updated_at: new Date().toISOString()
    })
  });

  return sendJson(res, 200, { ok: true, file: rows[0] });
}

async function handleUpdateFile(req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });
  const body = req.body || {};
  if (!body.id) return sendJson(res, 400, { ok: false, message: 'id مطلوب' });

  let channelId = cleanString(body.channel_id);
  let messageId = body.message_id ? Number(body.message_id) : null;
  const telegramLink = cleanString(body.telegram_link);
  if (telegramLink) {
    const parsed = parseTelegramLink(telegramLink);
    if (parsed) {
      channelId = parsed.channel_id;
      messageId = parsed.message_id;
    }
  }

  const patch = {
    title: cleanString(body.title),
    description: cleanString(body.description),
    year_name: cleanString(body.year_name),
    term_name: cleanString(body.term_name),
    subject_name: cleanString(body.subject_name),
    section_name: cleanString(body.section_name),
    content_type: cleanString(body.content_type || body.file_type || 'file'),
    channel_id: channelId,
    message_id: messageId,
    telegram_link: telegramLink,
    external_url: cleanString(body.external_url),
    text_content: cleanString(body.text_content),
    thumbnail_url: cleanString(body.thumbnail_url),
    tags: normalizeTags(body.tags),
    sort_order: Number(body.sort_order || 0),
    is_pinned: Boolean(body.is_pinned),
    is_active: body.is_active === false ? false : true,
    updated_at: new Date().toISOString()
  };

  const rows = await supabaseRequest(`bot_files?id=eq.${encodeURIComponent(body.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return sendJson(res, 200, { ok: true, file: rows[0] });
}

async function handleToggleFile(req, res) {
  const body = req.body || {};
  if (!body.id) return sendJson(res, 400, { ok: false, message: 'id مطلوب' });
  const rows = await supabaseRequest(`bot_files?id=eq.${encodeURIComponent(body.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: Boolean(body.is_active), updated_at: new Date().toISOString() })
  });
  return sendJson(res, 200, { ok: true, file: rows[0] });
}

async function handleDeleteFile(req, res) {
  const id = (req.body && req.body.id) || (req.query && req.query.id);
  if (!id) return sendJson(res, 400, { ok: false, message: 'id مطلوب' });
  await supabaseRequest(`bot_files?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return sendJson(res, 200, { ok: true, message: 'تم حذف المحتوى' });
}

async function handleUsers(req, res) {
  const users = await supabaseRequest('bot_users?select=*&order=last_seen.desc&limit=200');
  return sendJson(res, 200, { ok: true, users });
}

async function handleSendTest(req, res) {
  const body = req.body || {};
  const target = cleanString(body.chat_id || body.channel_id);
  if (!target) return sendJson(res, 400, { ok: false, message: 'chat_id أو channel_id مطلوب' });
  const result = await telegram('sendMessage', {
    chat_id: target,
    text: cleanString(body.text) || '✅ رسالة اختبار من لوحة تحكم بوت اللجنة العلمية المركزية'
  });
  return sendJson(res, 200, { ok: result.ok, result });
}

async function handleSeed(req, res) {
  const exampleChannelId = cleanString(req.body && req.body.channel_id) || '-1003917305732';
  await supabaseRequest('bot_channels', {
    method: 'POST',
    body: JSON.stringify({ title: 'القناة التجريبية', channel_id: exampleChannelId, notes: 'قناة تجريبية', is_active: true })
  }).catch(() => null);

  const rows = await supabaseRequest('bot_files', {
    method: 'POST',
    body: JSON.stringify({
      title: 'ملف Anatomy تجريبي',
      description: 'محتوى تجريبي للتأكد من عمل البوت',
      year_name: '1st year 🔴',
      term_name: 'ترم اول',
      subject_name: 'anatomy',
      section_name: 'PDF 📚',
      content_type: 'pdf',
      channel_id: exampleChannelId,
      message_id: 3,
      tags: ['demo', 'anatomy'],
      is_active: true
    })
  });
  return sendJson(res, 200, { ok: true, file: rows[0] });
}

module.exports = async function handler(req, res) {
  const action = getAction(req);

  try {
    if (action === 'health') return handleHealth(req, res);

    const publicActions = [];
    if (!publicActions.includes(action)) {
      const admin = requireAdmin(req);
      if (!admin.ok) return sendJson(res, 401, { ok: false, message: admin.message });
    }

    if (action === 'auth') return handleAuth(req, res);
    if (action === 'stats') return handleStats(req, res);
    if (action === 'lists') return handleLists(req, res);
    if (action === 'channels') return handleChannels(req, res);
    if (action === 'delete-channel') return handleDeleteChannel(req, res);
    if (action === 'files') return handleFiles(req, res);
    if (action === 'add-file') return handleAddFile(req, res);
    if (action === 'update-file') return handleUpdateFile(req, res);
    if (action === 'toggle-file') return handleToggleFile(req, res);
    if (action === 'delete-file') return handleDeleteFile(req, res);
    if (action === 'users') return handleUsers(req, res);
    if (action === 'send-test') return handleSendTest(req, res);
    if (action === 'seed') return handleSeed(req, res);

    return sendJson(res, 404, {
      ok: false,
      message: 'Admin action not found',
      action,
      hint: 'استخدم رابط مثل /api/admin/health أو /api/admin/files وليس /api/admin فقط'
    });
  } catch (error) {
    console.error('Admin API error:', error);
    return sendJson(res, 500, { ok: false, message: error.message });
  }
};
