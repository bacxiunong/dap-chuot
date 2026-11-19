// Vercel Function: mọi đường dẫn được vercel.json chuyển vào đây.
// Dùng chung lõi src/app.js với server Docker, nên luật chơi, API và trang admin giống hệt nhau.
'use strict';
const { handler, init } = require('../src/app');

module.exports = async (req, res) => {
  try {
    await init({ dbRetries: 3 });
  } catch (err) {
    console.error('[lỗi khởi tạo database]', err.code || err.name);
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ message: 'Hệ thống đang bận, vui lòng thử lại sau.' }));
  }
  return handler(req, res);
};
