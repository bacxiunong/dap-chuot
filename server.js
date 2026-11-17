// Server Node.js nhỏ, không dùng thư viện ngoài.
// Phục vụ app/ ở "/" và design/ ở "/design" (game nạp ../design/tokens.css).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOTS = [
  { prefix: '/design/', dir: path.join(__dirname, 'design') },
  { prefix: '/',        dir: path.join(__dirname, 'app') },
];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }
  if (urlPath === '/healthz') return send(res, 200, 'ok');

  const root = ROOTS.find((r) => urlPath.startsWith(r.prefix));
  let filePath = path.join(root.dir, urlPath.slice(root.prefix.length));
  // Chặn truy cập ra ngoài thư mục được phép (path traversal)
  if (filePath !== root.dir && !filePath.startsWith(root.dir + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (err2) return send(res, 404, 'Not Found');
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
});

server.listen(PORT, HOST, () => console.log(`Đập Chuột đang chạy tại http://localhost:${PORT}`));

// Dừng gọn khi Docker gửi tín hiệu tắt
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
