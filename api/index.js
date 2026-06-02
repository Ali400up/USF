module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "UST Central Scientific Committee Bot API is working",
    routes: [
      "/api/webhook",
      "/api/admin/health",
      "/api/admin/channels",
      "/api/admin/catalogs",
      "/api/admin/contents",
      "/api/admin/stats"
    ]
  });
};
