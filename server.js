// Server Đập Chuột cho Docker / chạy local — lõi xử lý nằm trong src/app.js.
// Trên Vercel, file này KHÔNG chạy; Vercel dùng api/index.js.
'use strict';
const http = require('http');
const { handler, init, cleanupSessions, pool } = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(handler);

async function main() {
  await init({ dbRetries: 30 });
  setInterval(cleanupSessions, 3600 * 1000).unref();
  server.listen(PORT, HOST, () =>
    console.log(`Đập Chuột đang chạy tại http://localhost:${PORT} — trang quản trị: http://localhost:${PORT}/admin`));
}

main().catch((err) => {
  console.error('[lỗi khởi động]', err.code || err.name, err.message);
  process.exit(1);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => pool.end().finally(() => process.exit(0))));
}
