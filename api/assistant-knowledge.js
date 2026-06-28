const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";

const EMBEDDING_DIMENSIONS = 768;
const MAX_SYNC_ROWS = 20;

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(data));
}

async function readInput(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  await new Promise((resolve, reject) => {
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 20_000) reject(new Error("Request too large"));
    });
    req.on("end", resolve);
    req.on("error", reject);
  });
  return raw ? JSON.parse(raw) : {};
}

function serviceHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

async function getAdmin(req) {
  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user?.id) return null;

  const params = new URLSearchParams({
    select: "user_id,is_super_admin,allowed_tables,can_insert,can_update,is_active",
    user_id: `eq.${user.id}`,
    is_active: "eq.true",
    limit: "1"
  });
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?${params}`, {
    headers: serviceHeaders()
  });
  if (!profileResponse.ok) throw new Error(`Admin profile: ${profileResponse.status}`);
  const profiles = await profileResponse.json();
  return Array.isArray(profiles) ? profiles[0] || null : null;
}

function canManageKnowledge(admin, action) {
  if (!admin || admin.is_active !== true) return false;
  if (admin.is_super_admin === true) return true;
  const allowed = String(admin.allowed_tables || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  if (!allowed.includes("ai_knowledge") && !allowed.includes("*")) return false;
  return action === "embed_one" ? admin.can_update === true || admin.can_insert === true : admin.can_update === true;
}

async function selectKnowledge(options = {}) {
  const params = new URLSearchParams({
    select: "id,title,content,keywords,source_url,category,is_active",
    order: "id.asc",
    limit: String(options.limit || 1)
  });
  if (options.id) params.set("id", `eq.${options.id}`);
  if (options.missing) params.set("embedding", "is.null");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/ai_knowledge?${params}`, {
    headers: serviceHeaders()
  });
  if (!response.ok) throw new Error(`Read knowledge: ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function embeddingText(row) {
  return [
    row.title ? `العنوان: ${row.title}` : "",
    row.category ? `التصنيف: ${row.category}` : "",
    row.keywords ? `الكلمات المرتبطة: ${row.keywords}` : "",
    row.content ? `المعلومة المعتمدة: ${row.content}` : "",
    row.source_url ? `الرابط: ${row.source_url}` : ""
  ].filter(Boolean).join("\n").slice(0, 24_000);
}

async function requestEmbeddings(rows) {
  if (!rows.length) return [];
  const requests = rows.map(row => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: { parts: [{ text: embeddingText(row) }] },
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: EMBEDDING_DIMENSIONS
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_EMBEDDING_MODEL)}:batchEmbedContents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({ requests }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || `Embedding API: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const embeddings = Array.isArray(data.embeddings) ? data.embeddings : [];
    if (embeddings.length !== rows.length) throw new Error("Embedding response count mismatch");
    return embeddings.map(item => item.values || item.embedding?.values || []);
  } finally {
    clearTimeout(timeout);
  }
}

async function updateEmbedding(row, values) {
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Invalid embedding dimensions");
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ai_knowledge?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    headers: serviceHeaders({
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify({
      embedding: values,
      embedding_model: GEMINI_EMBEDDING_MODEL,
      embedded_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`Update embedding: ${response.status}`);
}

async function embedRows(rows) {
  const embeddings = await requestEmbeddings(rows);
  const results = await Promise.allSettled(rows.map((row, index) => updateEmbedding(row, embeddings[index])));
  return {
    processed: results.filter(result => result.status === "fulfilled").length,
    failed: results.filter(result => result.status === "rejected").length
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
    return send(res, 503, { error: "إعدادات الخادم اللازمة للمزامنة غير مكتملة." });
  }

  try {
    const input = await readInput(req);
    const action = input.action === "sync_missing" ? "sync_missing" : "embed_one";
    const admin = await getAdmin(req);
    if (!admin) return send(res, 401, { error: "انتهت جلسة الدخول. سجّل الدخول مجددًا." });
    if (!canManageKnowledge(admin, action)) return send(res, 403, { error: "لا تملك صلاحية مزامنة معرفة المساعد." });

    if (action === "embed_one") {
      const id = String(input.id || "");
      if (!/^\d+$/.test(id)) return send(res, 400, { error: "رقم سجل غير صالح." });
      const rows = await selectKnowledge({ id, limit: 1 });
      if (!rows.length) return send(res, 404, { error: "لم يتم العثور على المعلومة." });
      const result = await embedRows(rows);
      return send(res, 200, { ...result, has_more: false });
    }

    const limit = Math.max(1, Math.min(Number(input.limit) || 10, MAX_SYNC_ROWS));
    const rows = await selectKnowledge({ missing: true, limit: limit + 1 });
    const batch = rows.slice(0, limit);
    if (!batch.length) return send(res, 200, { processed: 0, failed: 0, has_more: false });
    const result = await embedRows(batch);
    return send(res, 200, { ...result, has_more: rows.length > limit });
  } catch (error) {
    console.error("Assistant knowledge sync failed", error.message);
    const quota = error.status === 429;
    return send(res, quota ? 429 : 500, {
      error: quota
        ? "حصة Gemini الخاصة بإنشاء بصمات البحث مستنفدة مؤقتًا. حاول لاحقًا."
        : "تعذرت مزامنة معرفة المساعد. تأكد من تشغيل ملف البحث المتجهي ثم حاول مجددًا."
    });
  }
};
