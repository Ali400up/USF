const KEY = "UST_CENTRAL_SCIENTIFIC_ADMIN_PASSWORD";
const app = document.getElementById("app");

const state = {
  password: localStorage.getItem(KEY) || "",
  view: "dashboard",
  channels: [],
  catalogs: [],
  contents: [],
  stats: null,
  logs: [],
  users: [],
  query: "",
  filters: { year_name: "", term_name: "", subject_name: "", section_name: "", content_type: "" },
  editingContent: null,
  editingChannel: null,
  editingCatalog: null
};

const viewTitles = {
  dashboard: "الرئيسية",
  channels: "القنوات",
  structure: "هيكل البوت",
  contents: "المكتبة والمحتوى",
  add: "إضافة محتوى",
  tools: "الأدوات"
};

const catalogTypes = {
  year: "سنة / مستوى",
  term: "ترم",
  subject: "مادة",
  section: "قسم",
  content_type: "نوع محتوى",
  tag: "وسم"
};

const icons = {
  dashboard: "fa-chart-pie",
  channels: "fa-tower-broadcast",
  structure: "fa-sitemap",
  contents: "fa-folder-open",
  add: "fa-cloud-arrow-up",
  tools: "fa-wand-magic-sparkles"
};

function fa(name){ return `<i class="fa-solid ${name.startsWith("fa-") ? name : `fa-${name}`}"></i>`; }
function safe(v){ return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function asArray(v){ return Array.isArray(v) ? v : []; }
function unique(arr){ return [...new Set(arr.filter(Boolean))]; }
function setView(view){ state.view = view; renderShell(); }
window.setView = setView;

function toast(message, type="info"){
  let box = document.querySelector(".toast-box");
  if(!box){ box = document.createElement("div"); box.className = "toast-box"; document.body.appendChild(box); }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${fa(type === "error" ? "triangle-exclamation" : type === "success" ? "circle-check" : "circle-info")} <span>${safe(message)}</span>`;
  box.appendChild(el);
  setTimeout(()=>{ el.style.opacity = "0"; el.style.transform = "translateY(16px)"; setTimeout(()=>el.remove(),250); }, 3600);
}

async function api(url, options={}){
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": state.password || localStorage.getItem(KEY) || "",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(()=>null);
  if(response.status === 401){ localStorage.removeItem(KEY); state.password = ""; renderLogin(); throw new Error(data?.message || "كلمة السر غير صحيحة"); }
  if(!response.ok || data?.ok === false){ throw new Error(data?.message || data?.error || "فشل الطلب"); }
  return data;
}

async function loadAll(){
  const [channels, catalogs, contents, stats] = await Promise.all([
    api("/api/admin/channels"),
    api("/api/admin/catalogs"),
    api("/api/admin/contents"),
    api("/api/admin/stats")
  ]);
  state.channels = channels.channels || [];
  state.catalogs = catalogs.catalogs || [];
  state.contents = contents.contents || contents.files || [];
  state.stats = stats.stats || null;
  state.logs = stats.recentLogs || [];
  state.users = stats.recentUsers || [];
}

function renderLogin(){
  document.body.classList.remove("menu-open");
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="brand-icon">${fa("staff-snake")}</div>
        <p class="eyebrow">بوت اللجنة العلمية المركزية</p>
        <h1>لوحة تحكم Telegram</h1>
        <p>بنفس روح تصميم موقع ملتقى الطالب الجامعي: أزرق، زجاجي، متجاوب، ومخصص لإدارة مواد وأقسام وفيديوهات وملفات البوت.</p>
        <form id="loginForm" class="login-form">
          <label>كلمة سر المدير</label>
          <div class="field">
            ${fa("lock")}
            <input id="password" type="password" placeholder="ADMIN_PASSWORD" autocomplete="current-password" required>
          </div>
          <button class="primary-btn" type="submit">${fa("right-to-bracket")} دخول اللوحة</button>
        </form>
        <p class="muted" style="margin-top:14px">الكلمة يجب أن تطابق Environment Variable باسم ADMIN_PASSWORD في Vercel.</p>
      </section>
    </main>`;
  document.getElementById("loginForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const password = document.getElementById("password").value.trim();
    if(!password) return toast("اكتب كلمة السر", "error");
    state.password = password;
    localStorage.setItem(KEY, password);
    try{
      await loadAll();
      toast("تم تسجيل الدخول", "success");
      renderShell();
    }catch(err){ toast(err.message, "error"); }
  });
}

function navButton(view){
  return `<button class="nav-btn ${state.view===view?'active':''}" onclick="setView('${view}')">${fa(icons[view])}<span>${viewTitles[view]}</span></button>`;
}
function bottomButton(view){ return `<button class="${state.view===view?'active':''}" onclick="setView('${view}')">${fa(icons[view])}<span>${viewTitles[view].split(' ')[0]}</span></button>`; }

function renderShell(){
  app.innerHTML = `
    <main class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">${fa("user-doctor")}</div>
          <div><h2>اللجنة العلمية</h2><span>Central Scientific Bot</span></div>
        </div>
        <nav class="nav">
          ${["dashboard","channels","structure","contents","add","tools"].map(navButton).join("")}
        </nav>
        <div class="side-footer">
          <button class="soft-btn" id="seedBtn">${fa("wand-magic-sparkles")} بيانات تجربة</button>
          <button class="danger-btn" id="logoutBtn">${fa("right-from-bracket")} خروج</button>
        </div>
      </aside>
      <section class="content">
        <header class="topbar">
          <button class="icon-btn" id="menuBtn">${fa("bars-staggered")}</button>
          <div>
            <p class="eyebrow">لوحة تحكم بوت اللجنة العلمية المركزية</p>
            <h1>${viewTitles[state.view]}</h1>
          </div>
          <div class="top-actions">
            <label class="search">
              ${fa("magnifying-glass")}
              <input id="globalSearch" type="search" placeholder="بحث داخل المواد والقنوات والمحتوى..." value="${safe(state.query)}">
            </label>
            <button class="icon-btn" id="refreshBtn" title="تحديث">${fa("rotate")}</button>
            <button class="icon-btn" id="healthBtn" title="فحص النظام">${fa("heart-pulse")}</button>
          </div>
        </header>
        <div id="viewRoot"></div>
      </section>
      <nav class="mobile-bottom">
        ${["dashboard","channels","structure","contents","add"].map(bottomButton).join("")}
      </nav>
    </main>`;
  document.getElementById("menuBtn").onclick = ()=>document.body.classList.toggle("menu-open");
  document.getElementById("logoutBtn").onclick = ()=>{ localStorage.removeItem(KEY); state.password=""; renderLogin(); };
  document.getElementById("refreshBtn").onclick = async()=>{ await loadAll(); renderShell(); toast("تم تحديث البيانات", "success"); };
  document.getElementById("healthBtn").onclick = checkHealth;
  document.getElementById("seedBtn").onclick = seedData;
  const search = document.getElementById("globalSearch");
  if(search) search.oninput = e=>{ state.query = e.target.value; renderViewOnly(); };
  renderViewOnly();
}

function renderViewOnly(){
  const root = document.getElementById("viewRoot");
  if(!root) return;
  if(state.view === "dashboard") root.innerHTML = dashboardView();
  if(state.view === "channels") { root.innerHTML = channelsView(); bindChannels(); }
  if(state.view === "structure") { root.innerHTML = structureView(); bindStructure(); }
  if(state.view === "contents") { root.innerHTML = contentsView(); bindContents(); }
  if(state.view === "add") { root.innerHTML = addContentView(); bindContentForm(); }
  if(state.view === "tools") { root.innerHTML = toolsView(); bindTools(); }
}

function dashboardView(){
  const s = state.stats || {};
  return `
    <section class="hero">
      <div>
        <p class="eyebrow" style="color:#EAF6FF">UST Medical Committee</p>
        <h2>لوحة بوت اللجنة العلمية المركزية</h2>
        <p>أدر القنوات، السنوات، المواد، الأقسام، الفيديوهات، الملخصات، التسجيلات، الروابط، وأي محتوى آخر من لوحة واحدة بتصميم قريب من موقع الملتقى.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;justify-content:flex-start">
          <button class="primary-btn" onclick="setView('add')">${fa("plus")} إضافة محتوى الآن</button>
          <button class="soft-btn" style="background:rgba(255,255,255,.22);color:white;border-color:rgba(255,255,255,.26)" onclick="setView('structure')">${fa("sitemap")} إدارة الهيكل</button>
        </div>
      </div>
      <div class="hero-mark">${fa("robot")}</div>
    </section>
    <section class="stats">
      ${statCard("tower-broadcast", s.channels || state.channels.length, "القنوات")}
      ${statCard("book-medical", s.subjects || 0, "المواد")}
      ${statCard("folder-open", s.contents || state.contents.length, "المحتوى")}
      ${statCard("circle-check", s.activeContents || 0, "المفعل")}
    </section>
    <section class="grid-2">
      <div class="panel-card">
        <div class="panel-title"><h2>${fa("clock-rotate-left")} آخر نشاط</h2></div>
        <div class="list">${state.logs.length ? state.logs.slice(0,8).map(log=>`
          <div class="item"><div class="item-icon">${fa("bolt")}</div><div><h3>${safe(log.action)}</h3><p>${safe(JSON.stringify(log.details || {})).slice(0,110)}</p></div><span class="badge good">${new Date(log.created_at).toLocaleTimeString('ar')}</span></div>
        `).join("") : `<p class="empty">لا يوجد نشاط بعد.</p>`}</div>
      </div>
      <div class="panel-card">
        <div class="panel-title"><h2>${fa("users")} آخر الطلاب</h2></div>
        <div class="list">${state.users.length ? state.users.slice(0,8).map(user=>`
          <div class="item"><div class="item-icon">${fa("user")}</div><div><h3>${safe((user.first_name || '') + ' ' + (user.last_name || ''))}</h3><p>@${safe(user.username || 'بدون username')} - ${safe(user.chat_id)}</p></div></div>
        `).join("") : `<p class="empty">لا يوجد طلاب بعد.</p>`}</div>
      </div>
    </section>`;
}

function statCard(icon, value, label){ return `<div class="stat-card"><span>${fa(icon)}</span><h3>${safe(value)}</h3><p>${safe(label)}</p></div>`; }

function channelsView(){
  const list = filterGlobal(state.channels, ["title","channel_id","username","category","notes"]);
  return `
    <section class="grid-2">
      <form class="panel-card form-card" id="channelForm">
        <div class="panel-title"><h2>${fa("tower-broadcast")} ${state.editingChannel ? 'تعديل قناة' : 'إضافة قناة'}</h2></div>
        <input type="hidden" name="id" value="${safe(state.editingChannel?.id || '')}">
        <label>اسم القناة</label><input name="title" required placeholder="قناة السنة الأولى" value="${safe(state.editingChannel?.title || '')}">
        <label>Channel ID</label><input name="channel_id" required placeholder="-1003917305732" value="${safe(state.editingChannel?.channel_id || '')}">
        <div class="form-grid">
          <div><label>Username</label><input name="username" placeholder="@channel" value="${safe(state.editingChannel?.username || '')}"></div>
          <div><label>التصنيف</label><input name="category" placeholder="main / videos / pdf" value="${safe(state.editingChannel?.category || 'main')}"></div>
          <div><label>الأيقونة</label><input name="icon" value="${safe(state.editingChannel?.icon || 'fa-solid fa-tower-broadcast')}"></div>
          <div><label>اللون</label><input name="color" type="color" value="${safe(state.editingChannel?.color || '#0B5ED7')}"></div>
        </div>
        <label>ملاحظات</label><textarea name="notes" placeholder="اختياري">${safe(state.editingChannel?.notes || '')}</textarea>
        <button class="primary-btn" type="submit">${fa("floppy-disk")} حفظ القناة</button>
        ${state.editingChannel ? `<button class="soft-btn" type="button" id="cancelChannel">إلغاء التعديل</button>` : ''}
      </form>
      <div class="panel-card">
        <div class="panel-title"><h2>${fa("list")} القنوات الحالية</h2><span class="badge good">${list.length}</span></div>
        <div class="list">${list.length ? list.map(ch=>`
          <div class="item">
            <div class="item-icon" style="background:${safe(ch.color || '#0B5ED7')}"><i class="${safe(ch.icon || 'fa-solid fa-tower-broadcast')}"></i></div>
            <div><h3>${safe(ch.title)}</h3><p>${safe(ch.channel_id)} ${ch.username ? ' - '+safe(ch.username) : ''}</p><span class="badge ${ch.is_active===false?'bad':'good'}">${ch.is_active===false?'معطلة':'مفعلة'}</span></div>
            <div class="item-actions"><button class="chip-btn" onclick="editChannel(${ch.id})">${fa("pen")} تعديل</button><button class="chip-btn" onclick="deleteChannel(${ch.id})">${fa("trash")} حذف</button></div>
          </div>`).join("") : `<p class="empty">لا توجد قنوات بعد.</p>`}</div>
      </div>
    </section>`;
}

function structureView(){
  const grouped = Object.keys(catalogTypes).map(type=>({type, items: filterGlobal(state.catalogs.filter(x=>x.item_type===type), ["name","display_name","notes"])}));
  return `
    <section class="grid-2">
      <form class="panel-card form-card" id="catalogForm">
        <div class="panel-title"><h2>${fa("sitemap")} ${state.editingCatalog ? 'تعديل عنصر' : 'إضافة للهيكل'}</h2></div>
        <input type="hidden" name="id" value="${safe(state.editingCatalog?.id || '')}">
        <div class="form-grid">
          <div><label>النوع</label><select name="item_type" required>${Object.entries(catalogTypes).map(([k,v])=>`<option value="${k}" ${state.editingCatalog?.item_type===k?'selected':''}>${v}</option>`).join("")}</select></div>
          <div><label>الاسم الذي يظهر في البوت</label><input name="name" required placeholder="anatomy / PDF 📚" value="${safe(state.editingCatalog?.name || '')}"></div>
          <div><label>اسم للعرض في اللوحة</label><input name="display_name" placeholder="اختياري" value="${safe(state.editingCatalog?.display_name || '')}"></div>
          <div><label>تابع لـ</label><input name="parent_name" placeholder="اختياري" value="${safe(state.editingCatalog?.parent_name || '')}"></div>
          <div><label>أيقونة Font Awesome</label><input name="icon" value="${safe(state.editingCatalog?.icon || 'fa-solid fa-circle-dot')}"></div>
          <div><label>اللون</label><input name="color" type="color" value="${safe(state.editingCatalog?.color || '#0B5ED7')}"></div>
          <div><label>الترتيب</label><input name="sort_order" type="number" value="${safe(state.editingCatalog?.sort_order || 0)}"></div>
        </div>
        <label>ملاحظات</label><textarea name="notes">${safe(state.editingCatalog?.notes || '')}</textarea>
        <button class="primary-btn" type="submit">${fa("floppy-disk")} حفظ العنصر</button>
        ${state.editingCatalog ? `<button class="soft-btn" type="button" id="cancelCatalog">إلغاء التعديل</button>` : ''}
      </form>
      <div class="panel-card">
        <div class="panel-title"><h2>${fa("diagram-project")} عناصر الهيكل</h2></div>
        <div class="list">${grouped.map(group=>`
          <div style="display:grid;gap:8px;margin-bottom:14px">
            <h3 style="font-weight:900;color:var(--primary)">${safe(catalogTypes[group.type])} <span class="badge good">${group.items.length}</span></h3>
            ${group.items.length ? group.items.map(item=>`
              <div class="item">
                <div class="item-icon" style="background:${safe(item.color || '#0B5ED7')}"><i class="${safe(item.icon || 'fa-solid fa-circle-dot')}"></i></div>
                <div><h3>${safe(item.name)}</h3><p>${safe(item.display_name || '')} ${item.parent_name ? ' - تابع: '+safe(item.parent_name) : ''}</p></div>
                <div class="item-actions"><button class="chip-btn" onclick="editCatalog(${item.id})">${fa("pen")}</button><button class="chip-btn" onclick="deleteCatalog(${item.id})">${fa("trash")}</button></div>
              </div>`).join("") : `<p class="muted">لا يوجد.</p>`}
          </div>`).join("")}</div>
      </div>
    </section>`;
}

function contentsView(){
  const filtered = getFilteredContents();
  return `
    <section class="panel-card">
      <div class="panel-title"><h2>${fa("folder-open")} مكتبة المحتوى</h2><button class="primary-btn" onclick="setView('add')">${fa("plus")} إضافة</button></div>
      <div class="filters">
        ${filterSelect('year_name','السنة')}
        ${filterSelect('term_name','الترم')}
        ${filterSelect('subject_name','المادة')}
        ${filterSelect('section_name','القسم')}
        ${filterSelect('content_type','النوع')}
      </div>
      <div class="table-wrap"><table><thead><tr><th>المحتوى</th><th>المسار</th><th>النوع</th><th>القناة/الرابط</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
        ${filtered.length ? filtered.map(item=>contentRow(item)).join("") : `<tr><td colspan="6" class="empty">لا يوجد محتوى مطابق.</td></tr>`}
      </tbody></table></div>
    </section>`;
}

function contentRow(item){
  return `<tr>
    <td><b>${safe(item.title)}</b><br><small class="muted">${safe(item.description || '').slice(0,90)}</small></td>
    <td>${safe(item.year_name)} / ${safe(item.term_name)}<br>${safe(item.subject_name)} / ${safe(item.section_name)}</td>
    <td><span class="badge good">${safe(item.content_type)}</span> ${item.is_pinned ? '<span class="badge pin">مثبت</span>' : ''}</td>
    <td>${safe(item.channel_id || '')} ${item.message_id ? '#'+safe(item.message_id) : ''}<br><small>${safe(item.external_url || '')}</small></td>
    <td><span class="badge ${item.is_active===false?'bad':'good'}">${item.is_active===false?'معطل':'مفعل'}</span></td>
    <td><div class="item-actions"><button class="chip-btn" onclick="editContent(${item.id})">${fa("pen")}</button><button class="chip-btn" onclick="toggleContent(${item.id}, ${item.is_active===false})">${item.is_active===false?fa('eye'):fa('eye-slash')}</button><button class="chip-btn" onclick="pinContent(${item.id}, ${!item.is_pinned})">${fa("thumbtack")}</button><button class="chip-btn" onclick="deleteContent(${item.id})">${fa("trash")}</button></div></td>
  </tr>`;
}

function filterSelect(key,label){
  const values = unique(state.contents.map(x=>x[key]));
  return `<select data-filter="${key}"><option value="">${label}: الكل</option>${values.map(v=>`<option value="${safe(v)}" ${state.filters[key]===v?'selected':''}>${safe(v)}</option>`).join("")}</select>`;
}

function addContentView(){ return contentForm(state.editingContent); }

function contentForm(item=null){
  const datalist = (id, values)=>`<datalist id="${id}">${unique(values).map(v=>`<option value="${safe(v)}"></option>`).join("")}</datalist>`;
  return `
    <form class="panel-card form-card" id="contentForm">
      <div class="panel-title"><h2>${fa("cloud-arrow-up")} ${item ? 'تعديل محتوى' : 'إضافة محتوى جديد'}</h2><span class="badge good">أي نوع: PDF / فيديو / رابط / نص / صوت</span></div>
      <input type="hidden" name="id" value="${safe(item?.id || '')}">
      <div class="form-grid-3">
        <div><label>عنوان المحتوى</label><input name="title" required placeholder="Lecture 1 - Anatomy" value="${safe(item?.title || '')}"></div>
        <div><label>نوع المحتوى</label><input list="typesList" name="content_type" required placeholder="pdf / video / link" value="${safe(item?.content_type || 'pdf')}"></div>
        <div><label>ترتيب</label><input name="sort_order" type="number" value="${safe(item?.sort_order || 0)}"></div>
        <div><label>السنة</label><input list="yearsList" name="year_name" required placeholder="1st year 🔴" value="${safe(item?.year_name || '')}"></div>
        <div><label>الترم</label><input list="termsList" name="term_name" required placeholder="ترم اول" value="${safe(item?.term_name || '')}"></div>
        <div><label>المادة</label><input list="subjectsList" name="subject_name" required placeholder="anatomy" value="${safe(item?.subject_name || '')}"></div>
        <div><label>القسم</label><input list="sectionsList" name="section_name" required placeholder="PDF 📚" value="${safe(item?.section_name || '')}"></div>
        <div><label>القناة</label><select name="channel_id"><option value="">اختر قناة أو استخدم رابط الرسالة</option>${state.channels.map(ch=>`<option value="${safe(ch.channel_id)}" ${item?.channel_id===ch.channel_id?'selected':''}>${safe(ch.title)} - ${safe(ch.channel_id)}</option>`).join("")}</select></div>
        <div><label>Message ID</label><input name="message_id" type="number" placeholder="3" value="${safe(item?.message_id || '')}"></div>
      </div>
      <label>رابط رسالة تليجرام</label><input name="telegram_link" placeholder="https://t.me/c/3917305732/3" value="${safe(item?.telegram_link || '')}">
      <div class="form-grid">
        <div><label>رابط خارجي / فيديو / Google Drive / YouTube</label><input name="external_url" placeholder="https://..." value="${safe(item?.external_url || '')}"></div>
        <div><label>رابط صورة مصغرة</label><input name="thumbnail_url" placeholder="https://..." value="${safe(item?.thumbnail_url || '')}"></div>
      </div>
      <label>وصف قصير</label><textarea name="description" placeholder="شرح مختصر يظهر قبل الإرسال">${safe(item?.description || '')}</textarea>
      <label>نص مباشر يرسله البوت، اختياري</label><textarea name="text_content" placeholder="اكتب نصًا أو ملاحظات أو إعلانًا">${safe(item?.text_content || '')}</textarea>
      <div class="form-grid">
        <div><label>وسوم</label><input name="tags" placeholder="lecture, important, exam" value="${safe(asArray(item?.tags).join(', '))}"></div>
        <div><label>أيقونة</label><input name="icon" value="${safe(item?.icon || 'fa-solid fa-file-lines')}"></div>
        <div><label>لون</label><input name="color" type="color" value="${safe(item?.color || '#0B5ED7')}"></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <label class="soft-btn"><input type="checkbox" name="is_pinned" ${item?.is_pinned?'checked':''} style="width:auto"> تثبيت</label>
        <label class="soft-btn"><input type="checkbox" name="is_active" ${item?.is_active===false?'':'checked'} style="width:auto"> مفعل</label>
      </div>
      <button class="primary-btn" type="submit">${fa("floppy-disk")} حفظ المحتوى</button>
      ${item ? `<button class="soft-btn" type="button" id="cancelContent">إلغاء التعديل</button>` : ''}
      ${datalist('yearsList', state.catalogs.filter(x=>x.item_type==='year').map(x=>x.name).concat(state.contents.map(x=>x.year_name)))}
      ${datalist('termsList', state.catalogs.filter(x=>x.item_type==='term').map(x=>x.name).concat(state.contents.map(x=>x.term_name)))}
      ${datalist('subjectsList', state.catalogs.filter(x=>x.item_type==='subject').map(x=>x.name).concat(state.contents.map(x=>x.subject_name)))}
      ${datalist('sectionsList', state.catalogs.filter(x=>x.item_type==='section').map(x=>x.name).concat(state.contents.map(x=>x.section_name)))}
      ${datalist('typesList', state.catalogs.filter(x=>x.item_type==='content_type').map(x=>x.name).concat(['pdf','video','audio','image','link','text','quiz','lab']))}
    </form>`;
}

function toolsView(){
  return `
    <section class="grid-2">
      <div class="panel-card form-card">
        <div class="panel-title"><h2>${fa("heart-pulse")} فحص النظام</h2></div>
        <p class="muted">يفحص Telegram Bot Token و Supabase والمتغيرات.</p>
        <button class="primary-btn" id="toolHealth">${fa("stethoscope")} افحص الآن</button>
        <pre id="healthOutput" style="white-space:pre-wrap;background:rgba(7,33,63,.06);padding:14px;border-radius:18px;overflow:auto;max-height:420px"></pre>
      </div>
      <div class="panel-card form-card">
        <div class="panel-title"><h2>${fa("paper-plane")} إرسال نص للقناة</h2></div>
        <form id="sendChannelForm" class="form-card">
          <label>القناة</label><select name="channel_id" required>${state.channels.map(ch=>`<option value="${safe(ch.channel_id)}">${safe(ch.title)}</option>`).join("")}</select>
          <label>النص</label><textarea name="text" required placeholder="رسالة تجريبية للقناة"></textarea>
          <button class="primary-btn" type="submit">${fa("paper-plane")} إرسال</button>
        </form>
      </div>
      <div class="panel-card form-card">
        <div class="panel-title"><h2>${fa("download")} تصدير</h2></div>
        <button class="soft-btn" id="exportBtn">${fa("file-export")} تصدير JSON</button>
      </div>
    </section>`;
}

function filterGlobal(arr, keys){
  const q = state.query.trim().toLowerCase();
  if(!q) return arr;
  return arr.filter(item => keys.some(k => String(item[k] || '').toLowerCase().includes(q)));
}

function getFilteredContents(){
  let arr = filterGlobal(state.contents, ["title","description","year_name","term_name","subject_name","section_name","content_type","channel_id","external_url"]);
  Object.entries(state.filters).forEach(([k,v])=>{ if(v) arr = arr.filter(x=>String(x[k] || '') === v); });
  return arr;
}

function bindChannels(){
  document.getElementById("channelForm").onsubmit = async e=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = Object.fromEntries(f.entries());
    try{
      await api("/api/admin/channels", { method: payload.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      state.editingChannel = null; await loadAll(); renderShell(); toast("تم حفظ القناة", "success");
    }catch(err){ toast(err.message,"error"); }
  };
  const cancel = document.getElementById("cancelChannel"); if(cancel) cancel.onclick = ()=>{ state.editingChannel=null; renderShell(); };
}

function bindStructure(){
  document.getElementById("catalogForm").onsubmit = async e=>{
    e.preventDefault();
    const f = new FormData(e.target); const payload = Object.fromEntries(f.entries());
    try{
      await api("/api/admin/catalogs", { method: payload.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      state.editingCatalog = null; await loadAll(); renderShell(); toast("تم حفظ عنصر الهيكل", "success");
    }catch(err){ toast(err.message,"error"); }
  };
  const cancel = document.getElementById("cancelCatalog"); if(cancel) cancel.onclick = ()=>{ state.editingCatalog=null; renderShell(); };
}

function bindContents(){
  document.querySelectorAll("[data-filter]").forEach(sel=> sel.onchange = e=>{ state.filters[e.target.dataset.filter] = e.target.value; renderViewOnly(); });
}

function bindContentForm(){
  document.getElementById("contentForm").onsubmit = async e=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = Object.fromEntries(f.entries());
    payload.is_pinned = f.get("is_pinned") === "on";
    payload.is_active = f.get("is_active") === "on";
    try{
      await api("/api/admin/contents", { method: payload.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      state.editingContent = null; await loadAll(); state.view="contents"; renderShell(); toast("تم حفظ المحتوى", "success");
    }catch(err){ toast(err.message,"error"); }
  };
  const cancel = document.getElementById("cancelContent"); if(cancel) cancel.onclick = ()=>{ state.editingContent=null; state.view="contents"; renderShell(); };
}

function bindTools(){
  document.getElementById("toolHealth").onclick = async()=>{
    const out = document.getElementById("healthOutput");
    try{ const data = await api("/api/admin/health"); out.textContent = JSON.stringify(data, null, 2); toast("الفحص اكتمل", "success"); }
    catch(err){ out.textContent = err.message; toast(err.message,"error"); }
  };
  document.getElementById("sendChannelForm").onsubmit = async e=>{
    e.preventDefault(); const payload = Object.fromEntries(new FormData(e.target).entries());
    try{ await api("/api/admin/upload-direct", { method:"POST", body:JSON.stringify(payload) }); toast("تم الإرسال للقناة", "success"); e.target.reset(); }
    catch(err){ toast(err.message,"error"); }
  };
  document.getElementById("exportBtn").onclick = ()=>{
    const blob = new Blob([JSON.stringify({ channels: state.channels, catalogs: state.catalogs, contents: state.contents }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="ust-bot-export.json"; a.click(); URL.revokeObjectURL(url);
  };
}

async function checkHealth(){
  try{ const data = await api("/api/admin/health"); toast(data.telegram?.ok && data.supabase?.ok ? "Telegram و Supabase يعملان" : "الفحص اكتمل مع ملاحظات", data.telegram?.ok && data.supabase?.ok ? "success" : "error"); console.log(data); }
  catch(err){ toast(err.message,"error"); }
}

async function seedData(){
  if(!confirm("إضافة مواد وأقسام تجريبية؟")) return;
  try{ await api("/api/admin/seed", { method:"POST", body:"{}" }); await loadAll(); renderShell(); toast("تمت إضافة بيانات التجربة", "success"); }
  catch(err){ toast(err.message,"error"); }
}

window.editChannel = id=>{ state.editingChannel = state.channels.find(x=>x.id===id); renderShell(); };
window.deleteChannel = async id=>{ if(!confirm("حذف القناة؟")) return; try{ await api(`/api/admin/channels?id=${id}`, { method:"DELETE" }); await loadAll(); renderShell(); toast("تم الحذف", "success"); }catch(err){ toast(err.message,"error"); } };
window.editCatalog = id=>{ state.editingCatalog = state.catalogs.find(x=>x.id===id); renderShell(); };
window.deleteCatalog = async id=>{ if(!confirm("حذف العنصر؟")) return; try{ await api(`/api/admin/catalogs?id=${id}`, { method:"DELETE" }); await loadAll(); renderShell(); toast("تم الحذف", "success"); }catch(err){ toast(err.message,"error"); } };
window.editContent = id=>{ state.editingContent = state.contents.find(x=>x.id===id); state.view="add"; renderShell(); };
window.deleteContent = async id=>{ if(!confirm("حذف المحتوى؟")) return; try{ await api(`/api/admin/contents?id=${id}`, { method:"DELETE" }); await loadAll(); renderShell(); toast("تم الحذف", "success"); }catch(err){ toast(err.message,"error"); } };
window.toggleContent = async (id, newStatus)=>{ try{ await api("/api/admin/toggle-content", { method:"POST", body:JSON.stringify({ id, is_active:newStatus }) }); await loadAll(); renderShell(); toast("تم تغيير الحالة", "success"); }catch(err){ toast(err.message,"error"); } };
window.pinContent = async (id, status)=>{ try{ await api("/api/admin/toggle-content", { method:"POST", body:JSON.stringify({ id, is_pinned:status }) }); await loadAll(); renderShell(); toast("تم تغيير التثبيت", "success"); }catch(err){ toast(err.message,"error"); } };

(async function init(){
  app.innerHTML = document.getElementById("loaderTpl").innerHTML;
  if(!state.password) return renderLogin();
  try{ await loadAll(); renderShell(); }catch(err){ toast(err.message,"error"); renderLogin(); }
})();
