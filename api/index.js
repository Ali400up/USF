module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    name: 'UST Central Scientific Committee Bot API',
    routes: [
      '/api/webhook',
      '/api/admin/health',
      '/api/admin/auth',
      '/api/admin/channels',
      '/api/admin/files',
      '/api/admin/stats'
    ]
  });
};
