const { adminGuard, fail, ok, supabaseRequest } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const channelRows = await supabaseRequest("bot_channels", {
      method: "POST",
      body: JSON.stringify({
        title: "القناة التجريبية",
        channel_id: "-1003917305732",
        username: null,
        category: "1st year",
        color: "#2563eb",
        icon: "fa-solid fa-vial",
        notes: "قناة تجربة للملفات"
      })
    });

    const fileRows = await supabaseRequest("bot_files", {
      method: "POST",
      body: JSON.stringify({
        title: "Anatomy Lab - ملف تجريبي",
        description: "هذا ملف تجربة من القناة الخاصة",
        year_name: "1st year 🔴",
        term_name: "ترم اول",
        subject_name: "anatomy",
        section_name: "Lab 🔬",
        channel_id: "-1003917305732",
        message_id: 3,
        telegram_link: "https://t.me/c/3917305732/3",
        file_type: "pdf",
        tags: ["anatomy", "lab", "test"],
        sort_order: 1,
        is_active: true
      })
    });

    return ok(res, { channel: channelRows[0], file: fileRows[0] });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
