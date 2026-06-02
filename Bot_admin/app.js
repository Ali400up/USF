const state = {
  password: localStorage.getItem("UST_ADMIN_PASSWORD") || "",
  channels: [],
  files: []
};

const YEARS = [
  ["y1", "1st year 🔴"],
  ["y2", "2nd year 🟠"],
  ["y3", "3rd year 🟡"],
  ["y4", "4th year 🟢"],
  ["y5", "5th year 🔵"],
  ["y6", "6th year 🟣"]
];

const TERMS = [
  ["t1", "ترم اول"],
  ["t2", "ترم ثاني"]
];

const SUBJECTS = [
  ["anatomy", "Anatomy"],
  ["physiology", "Physiology"],
  ["histology", "Histology"],
  ["biochemistry", "Biochemistry"],
  ["pathology", "Pathology"],
  ["pharmacology", "Pharmacology"],
  ["microbiology", "Microbiology"],
  ["immunology", "Immunology"],
  ["community", "Community Medicine"]
];

const SECTIONS = [
  ["lab", "Lab 🔬"],
  ["pdf", "PDF 📚"],
  ["recordings", "Recordings 🎧"]
];

const $ = (id) => document.getElementById(id);

function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.style.borderColor = isError ? "rgba(255,120,120,.45)" : "rgba(113,199,255,.25)";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3300);
}

function fillSelect(select, items) {
  select.innerHTML = items.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
}

function fillAllStaticSelects() {
  ["yearSelect", "uploadYearSelect"].forEach(id => fillSelect($(id), YEARS));
  ["termSelect", "uploadTermSelect"].forEach(id => fillSelect($(id), TERMS));
  ["subjectSelect", "uploadSubjectSelect"].forEach(id => fillSelect($(id), SUBJECTS));
  ["sectionSelect", "uploadSectionSelect"].forEach(id => fillSelect($(id), SECTIONS));
}

function getPair(list, key) {
  return list.find(item => item[0] === key) || [key, key];
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": state.password,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "حدث خطأ غير معروف");
  }
  return data;
}

async function loadAll() {
  const [channelsData, filesData] = await Promise.all([
    api("/api/admin/channels"),
    api("/api/admin/files")
  ]);

  state.channels = channelsData.channels || [];
  state.files = filesData.files || [];
  render();
}

function render() {
  $("filesCount").textContent = state.files.length;
  $("channelsCount").textContent = state.channels.length;
  $("activeCount").textContent = state.files.filter(f => f.is_active).length;

  const channelOptions = state.channels
    .filter(c => c.is_active)
    .map(c => `<option value="${c.id}">${c.channel_title} — ${c.channel_id}</option>`)
    .join("");
  $("channelSelect").innerHTML = channelOptions || `<option value="">أضف قناة أولاً</option>`;
  $("uploadChannelSelect").innerHTML = channelOptions || `<option value="">أضف قناة أولاً</option>`;

  renderChannels();
  renderFiles();
}

function renderChannels() {
  const box = $("channelsList");
  if (!state.channels.length) {
    box.innerHTML = `<p class="hint">لا توجد قنوات بعد.</p>`;
    return;
  }

  box.innerHTML = state.channels.map(c => `
    <div class="channel-pill">
      <strong><i class="fa-brands fa-telegram"></i> ${escapeHtml(c.channel_title)}</strong>
      <span>${escapeHtml(c.channel_id)}</span><br />
      <span>${escapeHtml(c.channel_username || "بدون معرف")}</span>
    </div>
  `).join("");
}

function renderFiles() {
  const q = ($("searchInput").value || "").toLowerCase().trim();
  const rows = state.files.filter(f => {
    const text = `${f.title} ${f.year_label} ${f.term_label} ${f.subject_label} ${f.section_label} ${f.channel_id} ${f.message_id}`.toLowerCase();
    return text.includes(q);
  });

  $("filesTable").innerHTML = rows.map(f => `
    <tr>
      <td><span class="status ${f.is_active ? "on" : "off"}"><i class="fa-solid ${f.is_active ? "fa-circle-check" : "fa-circle-pause"}"></i>${f.is_active ? "نشط" : "موقوف"}</span></td>
      <td>${escapeHtml(f.title)}</td>
      <td>${escapeHtml(f.year_label)} / ${escapeHtml(f.term_label)} / ${escapeHtml(f.subject_label)} / ${escapeHtml(f.section_label)}</td>
      <td>${escapeHtml(f.channel_id)}</td>
      <td>${f.message_id}</td>
      <td>
        <button class="btn ghost small-btn" onclick="toggleFile(${f.id}, ${!f.is_active})">
          <i class="fa-solid ${f.is_active ? "fa-eye-slash" : "fa-eye"}"></i>
          ${f.is_active ? "إيقاف" : "تفعيل"}
        </button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="6">لا توجد ملفات مطابقة.</td></tr>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildFilePayload(form) {
  const data = new FormData(form);
  const year = getPair(YEARS, data.get("year"));
  const term = getPair(TERMS, data.get("term"));
  const section = getPair(SECTIONS, data.get("section"));

  let subject = getPair(SUBJECTS, data.get("subject"));
  const customSubjectKey = String(data.get("custom_subject_key") || "").trim();
  const customSubjectLabel = String(data.get("custom_subject_label") || "").trim();
  if (customSubjectKey && customSubjectLabel) subject = [customSubjectKey, customSubjectLabel];

  return {
    channel_db_id: data.get("channel_db_id"),
    title: data.get("title"),
    message_link: data.get("message_link"),
    year_key: year[0], year_label: year[1],
    term_key: term[0], term_label: term[1],
    subject_key: subject[0], subject_label: subject[1],
    section_key: section[0], section_label: section[1],
    sort_order: Number(data.get("sort_order") || 0)
  };
}

window.toggleFile = async function(id, isActive) {
  try {
    await api("/api/admin/toggle-file", {
      method: "POST",
      body: JSON.stringify({ id, is_active: isActive })
    });
    toast(isActive ? "تم تفعيل الملف" : "تم إيقاف الملف");
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  }
};

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  state.password = $("adminPassword").value;
  localStorage.setItem("UST_ADMIN_PASSWORD", state.password);
  try {
    await loadAll();
    $("loginModal").classList.remove("active");
    toast("تم الدخول بنجاح");
  } catch (error) {
    toast(error.message, true);
  }
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("UST_ADMIN_PASSWORD");
  state.password = "";
  $("loginModal").classList.add("active");
});

$("refreshBtn").addEventListener("click", async () => {
  try { await loadAll(); toast("تم التحديث"); } catch (error) { toast(error.message, true); }
});

$("channelForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    await api("/api/admin/channels", { method: "POST", body: JSON.stringify(data) });
    e.target.reset();
    toast("تمت إضافة القناة");
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  }
});

$("fileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin/add-file", {
      method: "POST",
      body: JSON.stringify(buildFilePayload(e.target))
    });
    e.target.reset();
    fillAllStaticSelects();
    toast("تم حفظ الملف في قاعدة البيانات");
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  }
});

$("directUploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const file = data.get("file");

  if (!file || !file.size) return toast("اختر ملفاً أولاً", true);
  if (file.size > 2_800_000) {
    return toast("الملف كبير للرفع المباشر. ارفعه في القناة ثم أضفه بالرابط.", true);
  }

  const year = getPair(YEARS, data.get("year"));
  const term = getPair(TERMS, data.get("term"));
  const subject = getPair(SUBJECTS, data.get("subject"));
  const section = getPair(SECTIONS, data.get("section"));
  const base64 = await fileToBase64(file);

  try {
    await api("/api/admin/upload-direct", {
      method: "POST",
      body: JSON.stringify({
        channel_db_id: data.get("channel_db_id"),
        title: data.get("title"),
        year_key: year[0], year_label: year[1],
        term_key: term[0], term_label: term[1],
        subject_key: subject[0], subject_label: subject[1],
        section_key: section[0], section_label: section[1],
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        file_base64: base64
      })
    });
    e.target.reset();
    fillAllStaticSelects();
    toast("تم رفع الملف إلى القناة وحفظه");
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$("searchInput").addEventListener("input", renderFiles);

fillAllStaticSelects();
if (state.password) {
  loadAll()
    .then(() => $("loginModal").classList.remove("active"))
    .catch(() => $("loginModal").classList.add("active"));
}
