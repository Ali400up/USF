const { adminGuard, fail, ok, supabaseCount, supabaseRequest } = require("../_utils.js");

module.exports = async function handler(req, res) {
  if (!adminGuard(req, res)) return;

  if (req.method !== "GET") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const [files, activeFiles, channels, activeChannels, users, logs] = await Promise.all([
      supabaseCount("bot_files"),
      supabaseCount("bot_files", "is_active=eq.true"),
      supabaseCount("bot_channels"),
      supabaseCount("bot_channels", "is_active=eq.true"),
      supabaseCount("bot_users"),
      supabaseCount("bot_activity_logs")
    ]);

    const topFiles = await supabaseRequest("bot_files?select=id,title,downloads_count,subject_name,section_name&order=downloads_count.desc&limit=7");
    const recentLogs = await supabaseRequest("bot_activity_logs?select=*&order=created_at.desc&limit=12");
    const recentUsers = await supabaseRequest("bot_users?select=chat_id,first_name,last_name,username,messages_count,last_seen&order=last_seen.desc&limit=8");

    return ok(res, {
      stats: { files, activeFiles, channels, activeChannels, users, logs },
      topFiles,
      recentLogs,
      recentUsers
    });
  } catch (error) {
    return fail(res, 500, error.message);
  }
};
