const { adminGuard, fail, ok, supabaseRequest } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "Method Not Allowed");

  try {
    const catalogs = [
      { item_type: "subject", name: "anatomy", display_name: "Anatomy", icon: "fa-solid fa-bone", color: "#0B5ED7", sort_order: 1 },
      { item_type: "subject", name: "physiology", display_name: "Physiology", icon: "fa-solid fa-heart-pulse", color: "#ef4444", sort_order: 2 },
      { item_type: "subject", name: "histology", display_name: "Histology", icon: "fa-solid fa-microscope", color: "#16a34a", sort_order: 3 },
      { item_type: "subject", name: "biochemistry", display_name: "Biochemistry", icon: "fa-solid fa-flask", color: "#7c3aed", sort_order: 4 },
      { item_type: "section", name: "Summaries 📝", display_name: "ملخصات", icon: "fa-solid fa-clipboard-list", color: "#f97316", sort_order: 5 },
      { item_type: "section", name: "Questions ❓", display_name: "أسئلة", icon: "fa-solid fa-circle-question", color: "#0ea5e9", sort_order: 6 }
    ];

    for (const item of catalogs) {
      await supabaseRequest("bot_catalogs", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(item)
      });
    }

    return ok(res, { message: "تمت إضافة بيانات تجربة للمواد والأقسام" });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
