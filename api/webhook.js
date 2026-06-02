const {
  telegramGuard,
  ok,
  fail,
  sendMenu,
  sendText,
  telegram,
  supabaseRequest,
  chunkButtons,
  encodeQueryValue
} = require("./_utils.js");

const HOME = "رجوع للرئيسية";
const BACK = "رجوع خطوة";
const ALL = "عرض الكل 📦";

function unique(items, key) {
  return [...new Set(items.map(x => x[key]).filter(Boolean))];
}

function niceType(type) {
  const map = {
    pdf: "PDF 📚",
    video: "Videos 🎥",
    audio: "Recordings 🎧",
    image: "Images 🖼️",
    link: "Links 🔗",
    text: "Notes 📝",
    quiz: "Questions ❓",
    lab: "Lab 🔬"
  };
  return map[type] || type;
}

function typeFromNice(text) {
  const map = {
    "PDF 📚": "pdf",
    "Videos 🎥": "video",
    "Recordings 🎧": "audio",
    "Images 🖼️": "image",
    "Links 🔗": "link",
    "Notes 📝": "text",
    "Questions ❓": "quiz",
    "Lab 🔬": "lab"
  };
  return map[text] || text;
}

async function getActiveContents() {
  return supabaseRequest("bot_contents?is_active=eq.true&select=*&order=is_pinned.desc,sort_order.asc,created_at.asc");
}

async function getCatalogs(type) {
  const path = type
    ? `bot_catalogs?item_type=eq.${encodeQueryValue(type)}&is_active=eq.true&select=*&order=sort_order.asc,created_at.asc`
    : "bot_catalogs?is_active=eq.true&select=*&order=item_type.asc,sort_order.asc";
  return supabaseRequest(path);
}

async function getUserState(chatId) {
  const rows = await supabaseRequest(`bot_user_states?chat_id=eq.${chatId}&select=*&limit=1`);
  return rows[0] || null;
}

async function setUserState(chatId, data) {
  await supabaseRequest("bot_user_states", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ chat_id: chatId, ...data, updated_at: new Date().toISOString() })
  });
}

async function clearUserState(chatId) {
  await supabaseRequest(`bot_user_states?chat_id=eq.${chatId}`, { method: "DELETE" });
}

async function saveUser(message) {
  const from = message.from || {};
  const chatId = message.chat.id;
  await supabaseRequest("bot_users", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      chat_id: chatId,
      first_name: from.first_name || message.chat.first_name || null,
      last_name: from.last_name || message.chat.last_name || null,
      username: from.username || message.chat.username || null,
      language_code: from.language_code || null,
      last_seen_at: new Date().toISOString()
    })
  });
}

async function logActivity(chatId, action, details = {}) {
  try {
    await supabaseRequest("bot_activity_logs", {
      method: "POST",
      body: JSON.stringify({ chat_id: chatId, action, details })
    });
  } catch (error) {
    console.error("Activity log error:", error.message);
  }
}

async function sendYears(chatId) {
  const contents = await getActiveContents();
  let years = unique(contents, "year_name");
  if (!years.length) {
    const catalogs = await getCatalogs("year");
    years = catalogs.map(x => x.name);
  }
  if (!years.length) return sendText(chatId, "لا توجد سنوات أو محتويات مضافة حالياً من لوحة التحكم.");

  await sendMenu(chatId, "👋 أهلاً بك في بوت اللجنة العلمية المركزية\n\nاختر السنة:", chunkButtons(years, 2));
}

async function sendTerms(chatId, yearName) {
  const contents = await getActiveContents();
  let terms = unique(contents.filter(x => x.year_name === yearName), "term_name");
  if (!terms.length) {
    const catalogs = await getCatalogs("term");
    terms = catalogs.map(x => x.name);
  }
  await sendMenu(chatId, `📘 السنة: <b>${yearName}</b>\nاختر الترم:`, [...chunkButtons(terms, 2), [HOME]]);
}

async function sendSubjects(chatId, yearName, termName) {
  const contents = await getActiveContents();
  const subjects = unique(contents.filter(x => x.year_name === yearName && x.term_name === termName), "subject_name");
  if (!subjects.length) return sendText(chatId, "لا توجد مواد مضافة لهذا الترم حالياً.", { reply_markup: { keyboard: [[HOME]], resize_keyboard: true } });
  await sendMenu(chatId, `📚 <b>${yearName}</b> / <b>${termName}</b>\nاختر المادة:`, [...chunkButtons(subjects, 2), [BACK, HOME]]);
}

async function sendSections(chatId, yearName, termName, subjectName) {
  const contents = await getActiveContents();
  const sections = unique(contents.filter(x => x.year_name === yearName && x.term_name === termName && x.subject_name === subjectName), "section_name");
  if (!sections.length) return sendText(chatId, "لا توجد أقسام لهذه المادة حالياً.", { reply_markup: { keyboard: [[HOME]], resize_keyboard: true } });
  await sendMenu(chatId, `🔬 المادة: <b>${subjectName}</b>\nاختر القسم:`, [...chunkButtons(sections, 2), [BACK, HOME]]);
}

async function sendTypes(chatId, yearName, termName, subjectName, sectionName) {
  const contents = await getActiveContents();
  const selected = contents.filter(x => x.year_name === yearName && x.term_name === termName && x.subject_name === subjectName && x.section_name === sectionName);
  if (!selected.length) return sendText(chatId, "لا يوجد محتوى في هذا القسم حالياً.");

  const types = unique(selected, "content_type").map(niceType);
  await sendMenu(chatId, `📦 القسم: <b>${sectionName}</b>\nاختر نوع المحتوى أو اعرض الكل:`, [...chunkButtons([ALL, ...types], 2), [BACK, HOME]]);
}

async function sendSelectedContents(chatId, filters) {
  const contents = await getActiveContents();
  let selected = contents.filter(x =>
    x.year_name === filters.year_name &&
    x.term_name === filters.term_name &&
    x.subject_name === filters.subject_name &&
    x.section_name === filters.section_name
  );

  if (filters.content_type && filters.content_type !== "all") {
    selected = selected.filter(x => x.content_type === filters.content_type);
  }

  if (!selected.length) {
    await sendText(chatId, "لا يوجد محتوى مطابق حالياً.");
    return;
  }

  await sendText(chatId, `جاري إرسال ${selected.length} عنصر...`);

  for (const item of selected) {
    const header = `📌 <b>${item.title}</b>${item.description ? `\n${item.description}` : ""}`;
    await sendText(chatId, header);

    if (item.channel_id && item.message_id) {
      await telegram("copyMessage", {
        chat_id: chatId,
        from_chat_id: item.channel_id,
        message_id: item.message_id,
        protect_content: false
      });
    }

    if (item.external_url) {
      await sendText(chatId, `🔗 الرابط:\n${item.external_url}`);
    }

    if (item.text_content) {
      await sendText(chatId, item.text_content);
    }

    try {
      const sends = Number(item.sends_count || 0) + 1;
      await supabaseRequest(`bot_contents?id=eq.${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sends_count: sends, updated_at: new Date().toISOString() })
      });
    } catch {}
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;
  if (!text) return;

  await saveUser(message);

  if (text === "/start" || text === HOME) {
    await clearUserState(chatId);
    await setUserState(chatId, { step: "year" });
    await logActivity(chatId, "start");
    await sendYears(chatId);
    return;
  }

  const state = await getUserState(chatId) || { step: "year" };

  if (text === BACK) {
    if (state.step === "term") {
      await setUserState(chatId, { step: "year", year_name: null, term_name: null, subject_name: null, section_name: null, content_type: null });
      return sendYears(chatId);
    }
    if (state.step === "subject") {
      await setUserState(chatId, { step: "term", term_name: null, subject_name: null, section_name: null, content_type: null });
      return sendTerms(chatId, state.year_name);
    }
    if (state.step === "section") {
      await setUserState(chatId, { step: "subject", subject_name: null, section_name: null, content_type: null });
      return sendSubjects(chatId, state.year_name, state.term_name);
    }
    if (state.step === "type") {
      await setUserState(chatId, { step: "section", section_name: null, content_type: null });
      return sendSections(chatId, state.year_name, state.term_name, state.subject_name);
    }
  }

  if (state.step === "year" || !state.year_name) {
    await setUserState(chatId, { step: "term", year_name: text, term_name: null, subject_name: null, section_name: null, content_type: null });
    await logActivity(chatId, "select_year", { year_name: text });
    return sendTerms(chatId, text);
  }

  if (state.step === "term" || !state.term_name) {
    await setUserState(chatId, { step: "subject", year_name: state.year_name, term_name: text, subject_name: null, section_name: null, content_type: null });
    await logActivity(chatId, "select_term", { year_name: state.year_name, term_name: text });
    return sendSubjects(chatId, state.year_name, text);
  }

  if (state.step === "subject" || !state.subject_name) {
    await setUserState(chatId, { step: "section", year_name: state.year_name, term_name: state.term_name, subject_name: text, section_name: null, content_type: null });
    await logActivity(chatId, "select_subject", { subject_name: text });
    return sendSections(chatId, state.year_name, state.term_name, text);
  }

  if (state.step === "section" || !state.section_name) {
    await setUserState(chatId, { step: "type", year_name: state.year_name, term_name: state.term_name, subject_name: state.subject_name, section_name: text, content_type: null });
    await logActivity(chatId, "select_section", { section_name: text });
    return sendTypes(chatId, state.year_name, state.term_name, state.subject_name, text);
  }

  if (state.step === "type") {
    const contentType = text === ALL ? "all" : typeFromNice(text);
    await setUserState(chatId, { ...state, content_type: contentType });
    await logActivity(chatId, "send_contents", { ...state, content_type: contentType });
    return sendSelectedContents(chatId, { ...state, content_type: contentType });
  }

  await sendText(chatId, "اختر من الأزرار بالأسفل 👇");
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") return res.status(200).send("UST Central Scientific Committee Telegram Bot is running.");
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  if (!telegramGuard(req, res)) return;

  try {
    const update = req.body;
    if (update.message) await handleMessage(update.message);
    return ok(res, { received: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return fail(res, 200, error.message);
  }
};
