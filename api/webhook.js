// api/webhook.js
// بوت اللجنة العلمية المركزية - CommonJS بدون type: module

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function keyboard(rows) {
  return { keyboard: rows.map(row => row.map(text => ({ text }))), resize_keyboard: true, one_time_keyboard: false };
}

function chunk(items, size = 2) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function uniq(items, key) {
  return [...new Set(items.map(item => item[key]).filter(Boolean))];
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

async function sendText(chatId, text, rows) {
  const payload = { chat_id: chatId, text };
  if (rows) payload.reply_markup = keyboard(rows);
  return telegram('sendMessage', payload);
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
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
  if (!response.ok) throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  return data;
}

async function getFiles() {
  return supabaseRequest('bot_files?is_active=eq.true&select=*&order=is_pinned.desc,sort_order.asc,created_at.asc');
}

async function getState(chatId) {
  const rows = await supabaseRequest(`bot_user_states?chat_id=eq.${chatId}&select=*&limit=1`);
  return rows[0] || null;
}

async function setState(chatId, data) {
  return supabaseRequest('bot_user_states', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ chat_id: chatId, ...data, updated_at: new Date().toISOString() })
  });
}

async function clearState(chatId) {
  return supabaseRequest(`bot_user_states?chat_id=eq.${chatId}`, { method: 'DELETE' }).catch(() => null);
}

async function saveUser(message) {
  const user = message.from || {};
  const chat = message.chat || {};
  await supabaseRequest('bot_users', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      chat_id: chat.id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      language_code: user.language_code || null,
      last_seen: new Date().toISOString(),
      use_count: 1
    })
  }).catch(() => null);
}

async function showYears(chatId) {
  const files = await getFiles();
  const years = uniq(files, 'year_name');
  if (!years.length) {
    await sendText(chatId, 'لا توجد ملفات مضافة حالياً. أضف المحتوى من لوحة التحكم أولاً.');
    return;
  }
  await sendText(chatId, 'مرحباً بك دكتور/ة 👋\n\nبوت اللجنة العلمية المركزية - الطب البشري\n\nاختر السنة:', [
    ...chunk(years, 2)
  ]);
}

async function showTerms(chatId, year) {
  const files = await getFiles();
  const terms = uniq(files.filter(f => f.year_name === year), 'term_name');
  await sendText(chatId, `السنة: ${year}\nاختر الترم:`, [...chunk(terms, 2), ['رجوع للرئيسية']]);
}

async function showSubjects(chatId, year, term) {
  const files = await getFiles();
  const subjects = uniq(files.filter(f => f.year_name === year && f.term_name === term), 'subject_name');
  await sendText(chatId, `الترم: ${term}\nاختر المادة:`, [...chunk(subjects, 2), ['رجوع للرئيسية']]);
}

async function showSections(chatId, year, term, subject) {
  const files = await getFiles();
  const sections = uniq(files.filter(f => f.year_name === year && f.term_name === term && f.subject_name === subject), 'section_name');
  await sendText(chatId, `المادة: ${subject}\nاختر القسم:`, [...chunk(sections, 2), ['رجوع للرئيسية']]);
}

async function incrementView(fileId) {
  try {
    const rows = await supabaseRequest(`bot_files?id=eq.${fileId}&select=views_count&limit=1`);
    const current = Number(rows[0]?.views_count || 0);
    await supabaseRequest(`bot_files?id=eq.${fileId}`, { method: 'PATCH', body: JSON.stringify({ views_count: current + 1 }) });
  } catch (_) {}
}

async function sendSelectedFiles(chatId, state, section) {
  const files = await getFiles();
  const selected = files.filter(f =>
    f.year_name === state.year_name &&
    f.term_name === state.term_name &&
    f.subject_name === state.subject_name &&
    f.section_name === section
  );

  if (!selected.length) {
    await sendText(chatId, 'لا يوجد محتوى في هذا القسم حالياً.', [['رجوع للرئيسية']]);
    return;
  }

  await sendText(chatId, `تم العثور على ${selected.length} عنصر. جاري الإرسال...`);

  for (const item of selected) {
    const titleLine = `${item.is_pinned ? '📌 ' : ''}${item.title || 'محتوى'}`;
    if (item.description) await sendText(chatId, `${titleLine}\n${item.description}`);
    else await sendText(chatId, titleLine);

    if (item.text_content) {
      await sendText(chatId, item.text_content);
    }

    if (item.external_url) {
      await sendText(chatId, `🔗 ${item.external_url}`);
    }

    if (item.channel_id && item.message_id) {
      const copied = await telegram('copyMessage', {
        chat_id: chatId,
        from_chat_id: item.channel_id,
        message_id: Number(item.message_id),
        protect_content: false
      });
      if (!copied.ok) await sendText(chatId, `تعذر إرسال: ${item.title}\nالسبب: ${copied.description || 'خطأ غير معروف'}`);
    }

    await incrementView(item.id);
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;
  if (!text) return;

  await saveUser(message);

  if (text === '/start' || text === 'رجوع للرئيسية') {
    await clearState(chatId);
    await showYears(chatId);
    return;
  }

  const files = await getFiles();
  const state = await getState(chatId);
  const years = uniq(files, 'year_name');

  if (years.includes(text)) {
    await setState(chatId, { year_name: text, term_name: null, subject_name: null, section_name: null });
    await showTerms(chatId, text);
    return;
  }

  if (state?.year_name && !state.term_name) {
    const terms = uniq(files.filter(f => f.year_name === state.year_name), 'term_name');
    if (terms.includes(text)) {
      await setState(chatId, { year_name: state.year_name, term_name: text, subject_name: null, section_name: null });
      await showSubjects(chatId, state.year_name, text);
      return;
    }
  }

  if (state?.year_name && state?.term_name && !state.subject_name) {
    const subjects = uniq(files.filter(f => f.year_name === state.year_name && f.term_name === state.term_name), 'subject_name');
    if (subjects.includes(text)) {
      await setState(chatId, { year_name: state.year_name, term_name: state.term_name, subject_name: text, section_name: null });
      await showSections(chatId, state.year_name, state.term_name, text);
      return;
    }
  }

  if (state?.year_name && state?.term_name && state?.subject_name && !state.section_name) {
    const sections = uniq(files.filter(f => f.year_name === state.year_name && f.term_name === state.term_name && f.subject_name === state.subject_name), 'section_name');
    if (sections.includes(text)) {
      await setState(chatId, { year_name: state.year_name, term_name: state.term_name, subject_name: state.subject_name, section_name: text });
      await sendSelectedFiles(chatId, state, text);
      return;
    }
  }

  await sendText(chatId, 'اختر من الأزرار بالأسفل أو اضغط /start للعودة للرئيسية.');
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).send('UST Central Scientific Committee Telegram Bot is running.');
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const telegramSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (SECRET_TOKEN && telegramSecret !== SECRET_TOKEN) return res.status(401).send('Unauthorized');

  try {
    const update = req.body;
    if (update.message) await handleMessage(update.message);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
};
