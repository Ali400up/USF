const {
  checkTelegramSecret,
  chunk,
  eq,
  getTelegramUser,
  json,
  logActivity,
  sendMenu,
  sendText,
  supabaseRequest,
  telegram,
  uniqueValues
} = require("./_utils.js");

async function getActiveFiles() {
  return supabaseRequest(
    "bot_files?is_active=eq.true&select=*&order=sort_order.asc,created_at.asc"
  );
}

async function upsertUser(message) {
  const user = getTelegramUser(message);

  try {
    const oldRows = await supabaseRequest(`bot_users?chat_id=eq.${user.chat_id}&select=chat_id,messages_count&limit=1`);
    const old = oldRows[0];

    if (old) {
      await supabaseRequest(`bot_users?chat_id=eq.${user.chat_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          language_code: user.language_code,
          last_text: user.last_text,
          last_seen: user.last_seen,
          messages_count: Number(old.messages_count || 0) + 1
        })
      });
    } else {
      await supabaseRequest("bot_users", {
        method: "POST",
        body: JSON.stringify({ ...user, messages_count: 1 })
      });
    }
  } catch (error) {
    console.error("upsertUser failed", error.message);
  }
}

async function getState(chatId) {
  const rows = await supabaseRequest(`bot_user_states?chat_id=eq.${chatId}&select=*&limit=1`);
  return rows[0] || null;
}

async function setState(chatId, data) {
  const current = await getState(chatId);

  if (current) {
    await supabaseRequest(`bot_user_states?chat_id=eq.${chatId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...data, updated_at: new Date().toISOString() })
    });
    return;
  }

  await supabaseRequest("bot_user_states", {
    method: "POST",
    body: JSON.stringify({ chat_id: chatId, ...data, updated_at: new Date().toISOString() })
  });
}

async function clearState(chatId) {
  await supabaseRequest(`bot_user_states?chat_id=eq.${chatId}`, { method: "DELETE" });
}

function mainRows(years) {
  return [
    ...chunk(years, 2),
    ["🔎 بحث", "ℹ️ معلومات البوت"]
  ];
}

async function sendStart(chatId) {
  const files = await getActiveFiles();
  const years = uniqueValues(files, "year_name");

  if (years.length === 0) {
    await sendText(chatId, "مرحباً بك 👋\n\nلا توجد ملفات مفعّلة حالياً. يرجى التواصل مع اللجنة العلمية.");
    return;
  }

  await sendMenu(
    chatId,
    "مرحباً بك دكتور/ة 👋\n\nبوت اللجنة العلمية - جامعة العلوم والتكنولوجيا - الطب البشري\n\nاختر السنة من القائمة بالأسفل 👇",
    mainRows(years)
  );
}

async function sendTerms(chatId, yearName) {
  const files = await getActiveFiles();
  const terms = uniqueValues(files.filter(file => file.year_name === yearName), "term_name");

  await sendMenu(chatId, `السنة: ${yearName}\n\nاختر الترم:`, [
    ...chunk(terms, 2),
    ["⬅️ رجوع خطوة", "رجوع للرئيسية"]
  ]);
}

async function sendSubjects(chatId, state) {
  const files = await getActiveFiles();
  const subjects = uniqueValues(
    files.filter(file => file.year_name === state.year_name && file.term_name === state.term_name),
    "subject_name"
  );

  await sendMenu(chatId, `${state.year_name} / ${state.term_name}\n\nاختر المادة:`, [
    ...chunk(subjects, 2),
    ["⬅️ رجوع خطوة", "رجوع للرئيسية"]
  ]);
}

async function sendSections(chatId, state) {
  const files = await getActiveFiles();
  const sections = uniqueValues(
    files.filter(
      file =>
        file.year_name === state.year_name &&
        file.term_name === state.term_name &&
        file.subject_name === state.subject_name
    ),
    "section_name"
  );

  await sendMenu(chatId, `${state.year_name} / ${state.term_name} / ${state.subject_name}\n\nاختر القسم:`, [
    ...chunk(sections, 2),
    ["⬅️ رجوع خطوة", "رجوع للرئيسية"]
  ]);
}

async function increaseDownload(fileId) {
  try {
    const rows = await supabaseRequest(`bot_files?id=eq.${fileId}&select=downloads_count&limit=1`);
    const count = Number(rows[0]?.downloads_count || 0) + 1;
    await supabaseRequest(`bot_files?id=eq.${fileId}`, {
      method: "PATCH",
      body: JSON.stringify({ downloads_count: count, updated_at: new Date().toISOString() })
    });
  } catch (error) {
    console.error("increaseDownload failed", error.message);
  }
}

async function sendFiles(chatId, state) {
  const files = await getActiveFiles();
  const selected = files.filter(
    file =>
      file.year_name === state.year_name &&
      file.term_name === state.term_name &&
      file.subject_name === state.subject_name &&
      file.section_name === state.section_name
  );

  if (selected.length === 0) {
    await sendText(chatId, "لا توجد ملفات حالياً في هذا القسم.");
    await logActivity(chatId, "empty_section", state);
    return;
  }

  await sendText(chatId, `تم العثور على ${selected.length} ملف ✅\nجاري الإرسال...`);

  for (const file of selected) {
    const titleLine = file.title ? `📚 ${file.title}` : "📚 ملف";
    const descLine = file.description ? `\n${file.description}` : "";
    await sendText(chatId, `${titleLine}${descLine}`);

    const result = await telegram("copyMessage", {
      chat_id: chatId,
      from_chat_id: file.channel_id,
      message_id: file.message_id,
      protect_content: false
    });

    if (result.ok) {
      await increaseDownload(file.id);
      await logActivity(chatId, "file_sent", { file_id: file.id, title: file.title });
    } else {
      await sendText(chatId, `تعذر إرسال الملف: ${file.title}\nالسبب غالباً: البوت ليس Admin في القناة أو MESSAGE_ID غير صحيح.`);
      await logActivity(chatId, "file_send_failed", { file_id: file.id, result });
    }
  }
}

async function handleSearch(chatId, text) {
  const query = text.replace("بحث:", "").replace("/search", "").trim();

  if (!query) {
    await sendText(chatId, "اكتب البحث بهذا الشكل:\nبحث: anatomy\nأو\n/search anatomy");
    return;
  }

  const files = await getActiveFiles();
  const q = query.toLowerCase();
  const matched = files.filter(file => {
    const haystack = [
      file.title,
      file.description,
      file.year_name,
      file.term_name,
      file.subject_name,
      file.section_name,
      ...(file.tags || [])
    ].join(" ").toLowerCase();

    return haystack.includes(q);
  }).slice(0, 20);

  if (matched.length === 0) {
    await sendText(chatId, "لم أجد ملفات مطابقة للبحث.");
    await logActivity(chatId, "search_empty", { query });
    return;
  }

  await sendText(chatId, `نتائج البحث عن: ${query}\nعدد النتائج: ${matched.length}`);

  for (const file of matched) {
    await sendText(chatId, `📌 ${file.title}\n${file.year_name} / ${file.term_name} / ${file.subject_name} / ${file.section_name}`);
    const result = await telegram("copyMessage", {
      chat_id: chatId,
      from_chat_id: file.channel_id,
      message_id: file.message_id,
      protect_content: false
    });

    if (result.ok) await increaseDownload(file.id);
  }

  await logActivity(chatId, "search", { query, results: matched.length });
}

async function goBack(chatId, state) {
  if (!state || !state.year_name) {
    await clearState(chatId);
    await sendStart(chatId);
    return;
  }

  if (state.section_name) {
    await setState(chatId, { ...state, section_name: null });
    await sendSections(chatId, { ...state, section_name: null });
    return;
  }

  if (state.subject_name) {
    const newState = { ...state, subject_name: null, section_name: null };
    await setState(chatId, newState);
    await sendSubjects(chatId, newState);
    return;
  }

  if (state.term_name) {
    const newState = { ...state, term_name: null, subject_name: null, section_name: null };
    await setState(chatId, newState);
    await sendTerms(chatId, state.year_name);
    return;
  }

  await clearState(chatId);
  await sendStart(chatId);
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;

  await upsertUser(message);

  if (!text) return;

  if (text === "/start" || text === "رجوع للرئيسية") {
    await clearState(chatId);
    await logActivity(chatId, "start", { text });
    await sendStart(chatId);
    return;
  }

  if (text === "ℹ️ معلومات البوت") {
    await sendText(chatId, "بوت اللجنة العلمية - الطب البشري\nيرسل ملفات PDF، تسجيلات، ملخصات، وملفات المختبر من قنوات اللجنة الخاصة.");
    return;
  }

  if (text === "🔎 بحث" || text.startsWith("/search") || text.startsWith("بحث:")) {
    await handleSearch(chatId, text);
    return;
  }

  const state = await getState(chatId);

  if (text === "⬅️ رجوع خطوة") {
    await goBack(chatId, state);
    return;
  }

  const files = await getActiveFiles();
  const years = uniqueValues(files, "year_name");

  if (years.includes(text)) {
    await setState(chatId, {
      year_name: text,
      term_name: null,
      subject_name: null,
      section_name: null
    });
    await logActivity(chatId, "select_year", { year_name: text });
    await sendTerms(chatId, text);
    return;
  }

  if (state?.year_name && !state.term_name) {
    const terms = uniqueValues(files.filter(file => file.year_name === state.year_name), "term_name");

    if (terms.includes(text)) {
      const newState = { year_name: state.year_name, term_name: text, subject_name: null, section_name: null };
      await setState(chatId, newState);
      await logActivity(chatId, "select_term", newState);
      await sendSubjects(chatId, newState);
      return;
    }
  }

  if (state?.year_name && state?.term_name && !state.subject_name) {
    const subjects = uniqueValues(
      files.filter(file => file.year_name === state.year_name && file.term_name === state.term_name),
      "subject_name"
    );

    if (subjects.includes(text)) {
      const newState = { ...state, subject_name: text, section_name: null };
      await setState(chatId, newState);
      await logActivity(chatId, "select_subject", newState);
      await sendSections(chatId, newState);
      return;
    }
  }

  if (state?.year_name && state?.term_name && state?.subject_name && !state.section_name) {
    const sections = uniqueValues(
      files.filter(
        file =>
          file.year_name === state.year_name &&
          file.term_name === state.term_name &&
          file.subject_name === state.subject_name
      ),
      "section_name"
    );

    if (sections.includes(text)) {
      const newState = { ...state, section_name: text };
      await setState(chatId, newState);
      await logActivity(chatId, "select_section", newState);
      await sendFiles(chatId, newState);
      return;
    }
  }

  await sendText(chatId, "اختر من الأزرار بالأسفل 👇\nأو اكتب /start للعودة للرئيسية.");
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("UST Medical Committee Telegram Bot is running.");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  if (!checkTelegramSecret(req)) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const update = req.body || {};

    if (update.message) {
      await handleMessage(update.message);
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return json(res, 200, { ok: false, error: error.message });
  }
};
