const { adminGuard, fail, ok, supabaseRequest } = require("../_utils.js");

async function countTable(table) {
  const rows = await supabaseRequest(`${table}?select=id`, {
    method: "GET",
    headers: { Prefer: "count=exact" }
  });
  return Array.isArray(rows) ? rows.length : 0;
}

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;
  if (req.method !== "GET") return fail(res, 405, "Method Not Allowed");

  try {
    const [channels, catalogs, contents, users, logs] = await Promise.all([
      supabaseRequest("bot_channels?select=*&order=created_at.desc"),
      supabaseRequest("bot_catalogs?select=*&order=created_at.desc"),
      supabaseRequest("bot_contents?select=*&order=created_at.desc"),
      supabaseRequest("bot_users?select=*&order=last_seen_at.desc&limit=20"),
      supabaseRequest("bot_activity_logs?select=*&order=created_at.desc&limit=30")
    ]);

    const activeContents = contents.filter(x => x.is_active !== false);
    const pinnedContents = contents.filter(x => x.is_pinned === true);
    const subjects = new Set(contents.map(x => x.subject_name).filter(Boolean));
    const sections = new Set(contents.map(x => x.section_name).filter(Boolean));

    return ok(res, {
      stats: {
        channels: channels.length,
        catalogs: catalogs.length,
        contents: contents.length,
        activeContents: activeContents.length,
        pinnedContents: pinnedContents.length,
        subjects: subjects.size,
        sections: sections.size,
        recentUsers: users.length,
        recentLogs: logs.length
      },
      recentUsers: users,
      recentLogs: logs
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
