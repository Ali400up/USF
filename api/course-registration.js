// api/course-registration.js
// يستقبل تسجيل الطالب في الدورة من صفحات الموقع وصفحات /courses/:id
// ويحفظ البيانات الديناميكية داخل course_registrations.registration_data

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://bvkcfdagsfmqrhyqspan.supabase.co").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function pickByLabel(data = {}, keywords = []) {
  const entries = Object.entries(data || {});
  const found = entries.find(([label]) => keywords.some(k => String(label).toLowerCase().includes(String(k).toLowerCase())));
  return found ? String(found[1] || "") : "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return send(res, 500, { error: "Supabase keys are not configured" });
    }

    let body = "";
    await new Promise((resolve, reject) => {
      req.on("data", chunk => { body += chunk; });
      req.on("end", resolve);
      req.on("error", reject);
    });

    const input = body ? JSON.parse(body) : {};
    const registrationData = input.registration_data && typeof input.registration_data === "object"
      ? input.registration_data
      : {};

    const studentName =
      input.student_full_name ||
      pickByLabel(registrationData, ["الاسم", "name"]) ||
      Object.values(registrationData)[0] ||
      "";

    const academicNumber =
      input.academic_number ||
      pickByLabel(registrationData, ["أكاديمي", "اكاديمي", "academic", "الرقم الجامعي"]) ||
      "";

    const payload = {
      course_id: input.course_id || null,
      course_title: input.course_title || "",
      student_full_name: studentName,
      academic_number: academicNumber,
      registration_data: registrationData,
      status: "pending"
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/course_registrations`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
      return send(res, response.status, {
        error: text || "Failed to save registration"
      });
    }

    return send(res, 200, { ok: true });
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
};
