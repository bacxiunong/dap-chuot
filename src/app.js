// Lõi ứng dụng Đập Chuột — dùng chung cho server.js (Docker) và api/index.js (Vercel).
// Phục vụ game (app/), design (design/), API đăng ký và trang quản trị.
// Quy tắc: docs/02-chuc-nang.html (F-12…F-24), docs/04-quy-tac-du-lieu.html (P-xx, A-Rx).
'use strict';
const fs = require('fs');
const path = require('path');
const { pool, waitForDb, migrate } = require('./db');
const v = require('./validate');
const { hashPassword, verifyPassword, newToken, sha256 } = require('./auth');

const SESSION_HOURS = 8;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const PAGE_SIZE = 20;
const COOKIE = 'dc_admin';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

const APP_DIR = path.join(__dirname, '..', 'app');
const DESIGN_DIR = path.join(__dirname, '..', 'design');
const PUBLIC_ADMIN = new Set(['/admin/login.html', '/admin/admin.css', '/admin/admin.js']);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

/* ---------------- Tiện ích HTTP ---------------- */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...headers,
  });
  res.end(data === undefined ? '' : JSON.stringify(data));
}

function sendText(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}

function noContent(res) {
  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
      return reject(new HttpError(415, 'Yêu cầu phải gửi dạng JSON.'));
    }
    // Vercel (khi chưa tắt NODEJS_HELPERS) có thể đã đọc sẵn body vào req.body
    const pre = Object.prototype.hasOwnProperty.call(req, 'body') ? req.body : undefined;
    if (pre !== undefined && req.readableEnded) {
      const raw = Buffer.isBuffer(pre) ? pre.toString('utf8') : (typeof pre === 'string' ? pre : JSON.stringify(pre));
      if (Buffer.byteLength(raw) > 10 * 1024) return reject(new HttpError(413, 'Dữ liệu gửi lên quá lớn.'));
      try {
        const data = JSON.parse(raw || '{}');
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
        return resolve(data);
      } catch { return reject(new HttpError(400, 'JSON không hợp lệ.')); }
    }
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 10 * 1024) { reject(new HttpError(413, 'Dữ liệu gửi lên quá lớn.')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
        resolve(data);
      } catch { reject(new HttpError(400, 'JSON không hợp lệ.')); }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* bỏ qua */ }
    }
  }
  return out;
}

// A-R7: thao tác thay đổi dữ liệu phải đến từ chính trang này
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return; // công cụ dòng lệnh không gửi Origin
  if (origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
    throw new HttpError(403, 'Yêu cầu không đến từ trang hợp lệ.');
  }
}

function bearer(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  return m ? m[1] : null;
}

/* ---------------- Người chơi ---------------- */
async function registerPlayer(req, res) {
  checkOrigin(req);
  const body = await readJson(req);
  const { errors, value } = v.validateRegistration(body);
  if (errors) return sendJson(res, 400, { message: 'Thông tin chưa hợp lệ.', errors });
  const token = newToken();
  try {
    await pool.query(
      `INSERT INTO players (full_name, email, phone, consent_at, token_hash) VALUES ($1, $2, $3, now(), $4)`,
      [value.fullName, value.email, value.phone, sha256(token)],
    );
  } catch (err) {
    if (err.code === '23505') {
      return sendJson(res, 409, {
        message: 'Email này đã đăng ký.',
        errors: { email: 'Email này đã đăng ký. Bấm “Tôi đã đăng ký” để chơi tiếp.' },
      });
    }
    throw err;
  }
  sendJson(res, 201, { token, fullName: value.fullName });
}

async function resumePlayer(req, res) {
  checkOrigin(req);
  const body = await readJson(req);
  const email = v.validateEmail(body.email);
  const phone = v.validatePhone(body.phone);
  const notFound = { message: 'Không tìm thấy người chơi với email và số điện thoại này.' };
  if (email.error || phone.error) return sendJson(res, 404, notFound);
  const token = newToken();
  const { rows } = await pool.query(
    `UPDATE players SET token_hash = $3 WHERE email = $1 AND phone = $2 RETURNING full_name`,
    [email.value, phone.value, sha256(token)],
  );
  if (!rows.length) return sendJson(res, 404, notFound);
  sendJson(res, 200, { token, fullName: rows[0].full_name });
}

async function findPlayerByToken(req) {
  const token = bearer(req);
  if (!token) return null;
  const { rows } = await pool.query(`SELECT id, full_name FROM players WHERE token_hash = $1`, [sha256(token)]);
  return rows[0] || null;
}

async function me(req, res) {
  const player = await findPlayerByToken(req);
  if (!player) return sendJson(res, 401, { message: 'Mã người chơi không còn hợp lệ.' });
  sendJson(res, 200, { fullName: player.full_name });
}

async function saveRound(req, res) {
  checkOrigin(req);
  const body = await readJson(req);
  const player = await findPlayerByToken(req);
  if (!player) return sendJson(res, 401, { message: 'Mã người chơi không còn hợp lệ.' });
  if (!v.validateScore(body.score)) return sendJson(res, 400, { message: 'Điểm không hợp lệ.' });
  await pool.query(`INSERT INTO rounds (player_id, score) VALUES ($1, $2)`, [player.id, body.score]);
  sendJson(res, 201, { ok: true });
}

/* ---------------- Admin: phiên đăng nhập ---------------- */
async function currentAdmin(req) {
  const sid = parseCookies(req)[COOKIE];
  if (!sid) return null;
  const { rows } = await pool.query(
    `SELECT a.id, a.username FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.id = $1 AND s.expires_at > now()`, [sha256(sid)],
  );
  return rows[0] || null;
}

async function requireAdmin(req) {
  const admin = await currentAdmin(req);
  if (!admin) throw new HttpError(401, 'Bạn cần đăng nhập.');
  return admin;
}

function sessionCookie(value, maxAgeSec) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${COOKIE_SECURE ? '; Secure' : ''}`;
}

// Dùng khi tên đăng nhập không tồn tại, để thời gian phản hồi giống khi sai mật khẩu
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

async function adminLogin(req, res) {
  checkOrigin(req);
  const body = await readJson(req);
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fail = { message: 'Sai tên đăng nhập hoặc mật khẩu.' };
  const { rows } = await pool.query(`SELECT * FROM admins WHERE username = $1`, [username]);
  const admin = rows[0];
  if (!admin) { await verifyPassword(password, DUMMY_HASH); return sendJson(res, 401, fail); }

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
    return sendJson(res, 429, { message: `Tài khoản tạm khoá do nhập sai nhiều lần. Thử lại sau ${minutes} phút.` });
  }
  if (!(await verifyPassword(password, admin.password_hash))) {
    // A-R3: sai 5 lần liên tiếp → khoá 15 phút
    const { rows: upd } = await pool.query(
      `UPDATE admins SET failed_logins = failed_logins + 1 WHERE id = $1 RETURNING failed_logins`, [admin.id]);
    if (upd[0].failed_logins >= MAX_FAILED) {
      await pool.query(
        `UPDATE admins SET failed_logins = 0, locked_until = now() + make_interval(mins => $2) WHERE id = $1`,
        [admin.id, LOCK_MINUTES]);
    }
    return sendJson(res, 401, fail);
  }

  const sid = newToken();
  await pool.query(`UPDATE admins SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`, [admin.id]);
  await pool.query(
    `INSERT INTO admin_sessions (id, admin_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [sha256(sid), admin.id, SESSION_HOURS]);
  sendJson(res, 200, { username: admin.username }, { 'Set-Cookie': sessionCookie(sid, SESSION_HOURS * 3600) });
}

async function adminLogout(req, res) {
  checkOrigin(req);
  const sid = parseCookies(req)[COOKIE];
  if (sid) await pool.query(`DELETE FROM admin_sessions WHERE id = $1`, [sha256(sid)]);
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
}

async function adminMe(req, res) {
  sendJson(res, 200, await requireAdmin(req));
}

/* ---------------- Admin: người chơi ---------------- */
function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}

function searchClause(q) {
  const text = String(q || '').trim().slice(0, 100);
  if (!text) return { where: '', params: [] };
  const phone = v.normalizePhone(text);
  return {
    where: `WHERE p.full_name ILIKE $1 OR p.email ILIKE $1 OR p.phone ILIKE $1 OR p.phone ILIKE $2`,
    params: ['%' + escapeLike(text) + '%', '%' + escapeLike(phone || text) + '%'],
  };
}

const PLAYER_COLUMNS = `p.id, p.full_name, p.email, p.phone, p.created_at,
  COUNT(r.id)::int AS rounds, MAX(r.score) AS best_score, MAX(r.played_at) AS last_played_at`;

async function listPlayers(req, res, url) {
  await requireAdmin(req);
  const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
  const { where, params } = searchClause(url.searchParams.get('q'));
  const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM players p ${where}`, params)).rows[0].n;
  const { rows } = await pool.query(
    `SELECT ${PLAYER_COLUMNS} FROM players p LEFT JOIN rounds r ON r.player_id = p.id ${where}
     GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, params);
  sendJson(res, 200, { items: rows, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
}

async function deletePlayer(req, res, id) {
  checkOrigin(req);
  await requireAdmin(req);
  const { rowCount } = await pool.query(`DELETE FROM players WHERE id = $1`, [id]);
  if (!rowCount) return sendJson(res, 404, { message: 'Không tìm thấy người chơi.' });
  noContent(res);
}

// A-R8: CSV UTF-8 có BOM; chặn chèn công thức Excel
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function vnTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}

async function exportCsv(req, res, url) {
  await requireAdmin(req);
  const { where, params } = searchClause(url.searchParams.get('q'));
  const { rows } = await pool.query(
    `SELECT ${PLAYER_COLUMNS} FROM players p LEFT JOIN rounds r ON r.player_id = p.id ${where}
     GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC`, params);
  const header = ['Họ tên', 'Email', 'Số điện thoại', 'Ngày đăng ký', 'Số lượt', 'Điểm cao nhất', 'Lượt gần nhất'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([r.full_name, r.email, r.phone, vnTime(r.created_at), r.rounds, r.best_score ?? '', vnTime(r.last_played_at)]
      .map(csvCell).join(','));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="nguoi-choi-${stamp}.csv"`,
  });
  res.end('﻿' + lines.join('\r\n') + '\r\n');
}

/* ---------------- Admin: quản lý admin ---------------- */
async function listAdmins(req, res) {
  const admin = await requireAdmin(req);
  const { rows } = await pool.query(`SELECT id, username, created_at, last_login_at FROM admins ORDER BY id`);
  sendJson(res, 200, { me: admin, items: rows });
}

async function createAdmin(req, res) {
  checkOrigin(req);
  await requireAdmin(req);
  const body = await readJson(req);
  const u = v.validateUsername(body.username);
  const p = v.validatePassword(body.password);
  const errors = {};
  if (u.error) errors.username = u.error;
  if (p.error) errors.password = p.error;
  if (Object.keys(errors).length) return sendJson(res, 400, { message: 'Thông tin chưa hợp lệ.', errors });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at`,
      [u.value, await hashPassword(p.value)]);
    sendJson(res, 201, rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return sendJson(res, 409, { message: 'Tên đăng nhập đã tồn tại.', errors: { username: 'Tên đăng nhập đã tồn tại.' } });
    }
    throw err;
  }
}

async function deleteAdmin(req, res, id) {
  checkOrigin(req);
  const admin = await requireAdmin(req);
  if (admin.id === id) return sendJson(res, 400, { message: 'Không thể tự xoá tài khoản đang đăng nhập.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE admins IN SHARE ROW EXCLUSIVE MODE');
    const n = (await client.query(`SELECT COUNT(*)::int AS n FROM admins`)).rows[0].n;
    if (n <= 1) {
      await client.query('ROLLBACK');
      return sendJson(res, 400, { message: 'Không thể xoá admin cuối cùng.' });
    }
    const { rowCount } = await client.query(`DELETE FROM admins WHERE id = $1`, [id]);
    await client.query('COMMIT');
    if (!rowCount) return sendJson(res, 404, { message: 'Không tìm thấy admin.' });
    noContent(res);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function changePassword(req, res) {
  checkOrigin(req);
  const admin = await requireAdmin(req);
  const body = await readJson(req);
  const { rows } = await pool.query(`SELECT password_hash FROM admins WHERE id = $1`, [admin.id]);
  if (!(await verifyPassword(String(body.currentPassword || ''), rows[0].password_hash))) {
    return sendJson(res, 400, { message: 'Mật khẩu hiện tại không đúng.', errors: { currentPassword: 'Mật khẩu hiện tại không đúng.' } });
  }
  const p = v.validatePassword(body.newPassword);
  if (p.error) return sendJson(res, 400, { message: p.error, errors: { newPassword: p.error } });
  await pool.query(`UPDATE admins SET password_hash = $2 WHERE id = $1`, [admin.id, await hashPassword(p.value)]);
  // Đăng xuất các phiên khác của admin này
  const sid = parseCookies(req)[COOKIE];
  await pool.query(`DELETE FROM admin_sessions WHERE admin_id = $1 AND id <> $2`, [admin.id, sha256(sid)]);
  noContent(res);
}

/* ---------------- File tĩnh ---------------- */
function serveFile(req, res, filePath, extraHeaders = {}) {
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (err2) return sendText(res, 404, 'Not Found');
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', ...extraHeaders,
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

function safeJoin(root, rel) {
  const p = path.join(root, rel);
  return p === root || p.startsWith(root + path.sep) ? p : null;
}

async function serveStatic(req, res, urlPath) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method Not Allowed');

  if (urlPath.startsWith('/design/')) {
    const p = safeJoin(DESIGN_DIR, urlPath.slice('/design/'.length));
    return p ? serveFile(req, res, p) : sendText(res, 403, 'Forbidden');
  }

  // A-R1: trang quản trị phải đăng nhập (trừ màn đăng nhập và file giao diện của nó)
  if (urlPath === '/admin' || urlPath.startsWith('/admin/')) {
    if (!PUBLIC_ADMIN.has(urlPath) && !(await currentAdmin(req))) {
      res.writeHead(302, { Location: '/admin/login.html', 'Cache-Control': 'no-store' });
      return res.end();
    }
    const p = safeJoin(APP_DIR, (urlPath === '/admin' ? '/admin/' : urlPath).slice(1));
    return p ? serveFile(req, res, p, { 'Cache-Control': 'no-store' }) : sendText(res, 403, 'Forbidden');
  }

  const p = safeJoin(APP_DIR, urlPath.slice(1));
  return p ? serveFile(req, res, p) : sendText(res, 403, 'Forbidden');
}

/* ---------------- Định tuyến ---------------- */
async function route(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let urlPath;
  try { urlPath = decodeURIComponent(url.pathname); } catch { return sendText(res, 400, 'Bad Request'); }
  const m = req.method;
  let mm;

  if (urlPath === '/healthz') return sendText(res, 200, 'ok');
  // Báo cho game biết đang chạy cùng server (có API đăng ký) — bản tĩnh dùng app/env.js = false
  if (urlPath === '/env.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end('window.DAPCHUOT_API = true;\n');
  }
  if (!urlPath.startsWith('/api/')) return serveStatic(req, res, urlPath);

  if (m === 'POST' && urlPath === '/api/players') return registerPlayer(req, res);
  if (m === 'POST' && urlPath === '/api/players/resume') return resumePlayer(req, res);
  if (m === 'GET' && urlPath === '/api/me') return me(req, res);
  if (m === 'POST' && urlPath === '/api/rounds') return saveRound(req, res);
  if (m === 'POST' && urlPath === '/api/admin/login') return adminLogin(req, res);
  if (m === 'POST' && urlPath === '/api/admin/logout') return adminLogout(req, res);
  if (m === 'GET' && urlPath === '/api/admin/me') return adminMe(req, res);
  if (m === 'GET' && urlPath === '/api/admin/players') return listPlayers(req, res, url);
  if (m === 'GET' && urlPath === '/api/admin/players.csv') return exportCsv(req, res, url);
  if (m === 'DELETE' && (mm = /^\/api\/admin\/players\/(\d+)$/.exec(urlPath))) return deletePlayer(req, res, Number(mm[1]));
  if (m === 'GET' && urlPath === '/api/admin/admins') return listAdmins(req, res);
  if (m === 'POST' && urlPath === '/api/admin/admins') return createAdmin(req, res);
  if (m === 'DELETE' && (mm = /^\/api\/admin\/admins\/(\d+)$/.exec(urlPath))) return deleteAdmin(req, res, Number(mm[1]));
  if (m === 'POST' && urlPath === '/api/admin/password') return changePassword(req, res);
  return sendJson(res, 404, { message: 'Không tìm thấy API.' });
}

/* ---------------- Xử lý một request ---------------- */
function handler(req, res) {
  return route(req, res).catch((err) => {
    if (err instanceof HttpError) return sendJson(res, err.status, { message: err.message });
    // A-R9: chỉ ghi loại lỗi, không ghi dữ liệu người chơi
    console.error(`[lỗi] ${req.method} ${req.url.split('?')[0]} → ${err.code || err.name}`);
    if (!res.headersSent) sendJson(res, 503, { message: 'Hệ thống đang bận, vui lòng thử lại sau.' });
  });
}

/* ---------------- Khởi tạo database (chạy 1 lần mỗi tiến trình) ---------------- */
async function ensureFirstAdmin() {
  const n = (await pool.query(`SELECT COUNT(*)::int AS n FROM admins`)).rows[0].n;
  if (n > 0) return;
  const u = v.validateUsername(process.env.ADMIN_USERNAME);
  const p = v.validatePassword(process.env.ADMIN_PASSWORD);
  if (u.error || p.error) {
    console.warn('[cảnh báo] Chưa có admin nào và ADMIN_USERNAME/ADMIN_PASSWORD trong .env chưa hợp lệ — trang /admin chưa đăng nhập được.');
    return;
  }
  await pool.query(`INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [u.value, await hashPassword(p.value)]);
  console.log(`Đã tạo admin đầu tiên: ${u.value}`);
}

function cleanupSessions() {
  return pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`).catch(() => {});
}

let initPromise = null;
// opts.dbRetries: số lần chờ database (Docker: 30 lần; Vercel: ít hơn để không treo request)
function init(opts = {}) {
  if (!initPromise) {
    initPromise = (async () => {
      await waitForDb(opts.dbRetries || 30);
      try { await migrate(); } catch (err) {
        // Hai tiến trình tạo bảng cùng lúc (Vercel cold start) có thể va nhau — thử lại 1 lần
        if (err.code !== '23505' && err.code !== '42P07') throw err;
        await migrate();
      }
      await ensureFirstAdmin();
      await cleanupSessions();
    })().catch((err) => { initPromise = null; throw err; });
  }
  return initPromise;
}

module.exports = { handler, init, cleanupSessions, pool };
