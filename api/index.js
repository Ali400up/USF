// api/index.js
// CommonJS - no type: module
module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    project: "UST Central Scientific Committee Telegram Bot",
    message: "API is working",
    routes: [
      "/api/webhook",
      "/api/admin/health",
      "/api/admin/dashboard",
      "/api/admin/channels",
      "/api/admin/nodes",
      "/api/admin/contents",
      "/api/admin/users",
      "/api/admin/logs",
      "/api/admin/settings"
    ],
    time: new Date().toISOString()
  });
};
