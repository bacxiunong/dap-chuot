/* Đập Chuột — game.js
   Luật & dữ liệu theo docs/04-quy-tac-du-lieu.html (R-xx, D-xx),
   chức năng theo docs/02-chuc-nang.html (F-xx). */
'use strict';

/* ---------- Hằng số ---------- */
const GRID_SIZE = 9;
const ROUND_SECONDS = 30;
const MOLE_MIN_MS = 800;
const MOLE_MAX_MS = 1200;
const POINTS_PER_HIT = 1;
const LOW_TIME_SECONDS = 5;
const STORAGE_KEY = 'dapchuot.highScore';
const HIT_FLASH_MS = 150; // F-09

/* ---------- Trạng thái (một đối tượng duy nhất) ---------- */
const state = {
  phase: 'idle',      // 'idle' | 'playing' | 'ended'
  score: 0,
  timeLeft: ROUND_SECONDS,
  endsAt: 0,
  moleIndex: null,
  lastIndex: null,
  highScore: null,    // null = không lưu/đọc được (D-03)
  isNewRecord: false,
};
let moleTimer = null;
let tickTimer = null;

/* ---------- Lưu kỷ lục (D-01…D-05) ---------- */
function loadHighScore() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;                                // D-03
  }
  return /^\d+$/.test(raw || '') ? parseInt(raw, 10) : 0;   // D-02
}
function saveHighScore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));  // D-01
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------- Tiện ích ---------- */
function randomInt(min, max) { // gồm cả min và max
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickNextIndex() { // R-04: ngẫu nhiên đều trong các ô khác lastIndex
  const choices = [];
  for (let i = 0; i < GRID_SIZE; i++) if (i !== state.lastIndex) choices.push(i);
  return choices[randomInt(0, choices.length - 1)];
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const screens = { register: $('screen-register'), idle: $('screen-start'), playing: $('screen-play'), ended: $('screen-end') };
const grid = $('grid');
const cells = [];
for (let i = 0; i < GRID_SIZE; i++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.index = String(i);
  const mole = document.createElement('span');
  mole.className = 'mole';
  mole.textContent = '🐭';
  mole.setAttribute('aria-hidden', 'true');
  cell.appendChild(mole);
  grid.appendChild(cell);
  cells.push(cell);
}

function render() {
  for (const [phase, el] of Object.entries(screens)) el.hidden = phase !== state.phase;

  const hasRecord = state.highScore !== null;
  $('start-record').hidden = !hasRecord;
  $('start-record-value').textContent = hasRecord ? state.highScore : '';

  $('hud-score').textContent = state.score;
  $('hud-time').textContent = state.timeLeft;
  $('hud-time-wrap').classList.toggle('low', state.timeLeft < LOW_TIME_SECONDS);
  cells.forEach((c, i) => c.classList.toggle('has-mole', i === state.moleIndex));

  $('end-score').textContent = state.score;
  $('end-new-record').hidden = !state.isNewRecord;
  $('end-record').hidden = !hasRecord;
  $('end-record-value').textContent = hasRecord ? state.highScore : '';

  // v1.1: lời chào người chơi và báo lỗi lưu điểm
  const named = Boolean(player.name);
  $('start-greeting').hidden = !named;
  $('start-player-name').textContent = player.name || '';
  $('btn-not-me').hidden = !named;
  $('end-save-error').hidden = !state.saveFailed;
}

/* ---------- Chuột ---------- */
function spawnMole() { // R-04, R-05, R-06
  if (state.phase !== 'playing') return;
  const index = pickNextIndex();
  state.moleIndex = index;
  state.lastIndex = index;
  clearTimeout(moleTimer);
  moleTimer = setTimeout(() => {
    if (state.phase === 'playing' && state.moleIndex === index) {
      state.moleIndex = null;
      spawnMole();
      render();
    }
  }, randomInt(MOLE_MIN_MS, MOLE_MAX_MS));
}

/* ---------- Đồng hồ (R-07) ---------- */
function updateTime() {
  const remainingMs = state.endsAt - Date.now();
  state.timeLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  if (remainingMs <= 0) {
    endRound();
    return true;
  }
  return false;
}
function tick() {
  if (state.phase !== 'playing') return;
  if (!updateTime()) render();
}

/* ---------- Lượt chơi ---------- */
function startRound() { // F-01, F-08, R-09
  clearTimeout(moleTimer);
  clearInterval(tickTimer);
  state.score = 0;
  state.lastIndex = null;
  state.moleIndex = null;
  state.isNewRecord = false;
  state.timeLeft = ROUND_SECONDS;
  state.endsAt = Date.now() + ROUND_SECONDS * 1000;
  state.phase = 'playing';
  spawnMole();
  tickTimer = setInterval(tick, 100);
  render();
}

function endRound() { // F-06, R-08, D-04
  if (state.phase !== 'playing') return;
  clearTimeout(moleTimer);
  clearInterval(tickTimer);
  state.moleIndex = null;
  state.timeLeft = 0;
  state.phase = 'ended';
  if (state.highScore !== null && state.score > state.highScore) {
    state.highScore = state.score;
    state.isNewRecord = true;
    saveHighScore(state.score);
  }
  state.saveFailed = false;
  render();
  $('btn-replay').focus({ preventScroll: true }); // F-11
  submitScore(state.score); // F-16
}

function handleHit(index) { // F-04, R-01, R-02, R-03
  if (state.phase !== 'playing') return;
  if (updateTime()) return;                 // bấm đúng lúc hết giờ: không tính
  if (index !== state.moleIndex) return;    // ô trống: không làm gì
  state.moleIndex = null;                   // R-03: làm trước tiên
  state.score += POINTS_PER_HIT;
  flashHit(index);
  spawnMole();
  render();
}

function flashHit(index) { // F-09
  const cell = cells[index];
  cell.classList.add('hit');
  setTimeout(() => cell.classList.remove('hit'), HIT_FLASH_MS);
  const plus = document.createElement('span');
  plus.className = 'plus';
  plus.textContent = '+' + POINTS_PER_HIT;
  plus.addEventListener('animationend', () => plus.remove());
  cell.appendChild(plus);
}

/* ---------- Sự kiện ---------- */
// pointerdown: nhận ngay khi chạm (F-10), dùng chung cho chuột và cảm ứng
grid.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  e.preventDefault();
  handleHit(Number(cell.dataset.index));
});
$('btn-start').addEventListener('click', startRound);   // click hỗ trợ cả Enter/Space (F-11)
$('btn-replay').addEventListener('click', startRound);

/* ==========================================================
   v1.1 · Đăng ký người chơi (F-12 … F-17)
   Chỉ hoạt động khi game chạy cùng server (bản Docker).
   Không có API (GitHub Pages, mở file) → chạy như v1.0.
   ========================================================== */
const TOKEN_KEY = 'dapchuot.playerToken';
const player = { token: null, name: null, apiAvailable: false };

function loadToken() {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}
function storeToken(token) {
  player.token = token;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* trình duyệt chặn lưu: giữ trong bộ nhớ */ }
}

async function api(method, url, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (player.token) headers.Authorization = 'Bearer ' + player.token;
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  return { status: res.status, isJson, data: isJson ? await res.json().catch(() => ({})) : null };
}

function showScreen(phase) {
  state.phase = phase;
  render();
}

function goRegister() {
  storeToken(null);
  player.name = null;
  $('form-register').reset();
  $('form-resume').reset();
  clearErrors($('form-register'));
  clearErrors($('form-resume'));
  $('form-register').hidden = false;
  $('form-resume').hidden = true;
  showScreen('register');
  $('reg-name').focus({ preventScroll: true });
}

function goStart(name) {
  player.name = name;
  showScreen('idle');
  $('btn-start').focus({ preventScroll: true });
}

/* ---------- Kiểm tra trên trình duyệt (P-01 … P-05) — server kiểm tra lại ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;
function normalizePhone(v) {
  let p = String(v || '').replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (/^84\d{9}$/.test(p)) p = '0' + p.slice(2);
  return p;
}
function checkEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  if (!e) return 'Vui lòng nhập email.';
  if (e.length > 254 || !EMAIL_RE.test(e)) return 'Email chưa đúng định dạng.';
  return '';
}
function checkPhone(v) {
  if (!String(v || '').trim()) return 'Vui lòng nhập số điện thoại.';
  if (!/^0(3|5|7|8|9)\d{8}$/.test(normalizePhone(v))) return 'Số điện thoại chưa đúng (10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09).';
  return '';
}
function checkName(v) {
  const n = String(v || '').replace(/\s+/g, ' ').trim();
  if (!n) return 'Vui lòng nhập họ và tên.';
  if (n.length < 2 || n.length > 100) return 'Họ và tên dài từ 2 đến 100 ký tự.';
  if (!/\p{L}/u.test(n)) return 'Họ và tên phải có chữ cái.';
  return '';
}

function clearErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}
function showErrors(form, errors) {
  clearErrors(form);
  let first = null;
  for (const [field, msg] of Object.entries(errors)) {
    if (!msg) continue;
    const box = form.querySelector(`[data-error-for="${field}"]`);
    if (box) box.textContent = msg;
    const input = form.elements[field];
    if (input && input.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      if (!first) first = input;
    }
  }
  if (first) first.focus();
  return Object.values(errors).some(Boolean);
}

async function submitForm(form, url, payload, localErrors) {
  if (showErrors(form, localErrors)) return null;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const r = await api('POST', url, payload);
    if (r.status === 200 || r.status === 201) return r.data;
    const errs = (r.data && r.data.errors) || {};
    if (!Object.keys(errs).length) errs._form = (r.data && r.data.message) || 'Hệ thống đang bận, vui lòng thử lại sau.';
    showErrors(form, errs);
  } catch (e) {
    showErrors(form, { _form: 'Không kết nối được máy chủ, vui lòng thử lại.' });
  } finally {
    btn.disabled = false;
  }
  return null;
}

$('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const payload = {
    fullName: f.elements.fullName.value, email: f.elements.email.value,
    phone: f.elements.phone.value, consent: f.elements.consent.checked,
  };
  const local = {
    fullName: checkName(payload.fullName), email: checkEmail(payload.email), phone: checkPhone(payload.phone),
    consent: payload.consent ? '' : 'Bạn cần đồng ý cho lưu thông tin để đăng ký.',
  };
  const data = await submitForm(f, '/api/players', payload, local);
  if (data) { storeToken(data.token); goStart(data.fullName); }
});

$('form-resume').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const payload = { email: f.elements.email.value, phone: f.elements.phone.value };
  const local = { email: checkEmail(payload.email), phone: checkPhone(payload.phone) };
  const data = await submitForm(f, '/api/players/resume', payload, local);
  if (data) { storeToken(data.token); goStart(data.fullName); }
});

$('btn-show-resume').addEventListener('click', () => {
  $('form-register').hidden = true;
  $('form-resume').hidden = false;
  clearErrors($('form-resume'));
  $('res-email').focus();
});
$('btn-show-register').addEventListener('click', () => {
  $('form-resume').hidden = true;
  $('form-register').hidden = false;
  $('reg-name').focus();
});
$('btn-not-me').addEventListener('click', goRegister);

// Xoá lỗi của ô khi người chơi sửa lại ô đó
for (const form of [$('form-register'), $('form-resume')]) {
  form.addEventListener('input', (e) => {
    const name = e.target.name;
    if (!name) return;
    e.target.removeAttribute('aria-invalid');
    const box = form.querySelector(`[data-error-for="${name}"]`);
    if (box) box.textContent = '';
    const formBox = form.querySelector('[data-error-for="_form"]');
    if (formBox) formBox.textContent = '';
  });
}

async function submitScore(score) { // F-16
  if (!player.apiAvailable || !player.token) return;
  try {
    const r = await api('POST', '/api/rounds', { score });
    if (r.status === 401) { storeToken(null); player.name = null; } // người chơi đã bị xoá
    if (r.status !== 201) { state.saveFailed = true; render(); }
  } catch (e) {
    state.saveFailed = true;
    render();
  }
}

/* ---------- Khởi động ---------- */
async function boot() {
  state.highScore = loadHighScore();
  player.token = loadToken();
  if (!window.DAPCHUOT_API) return goStart(null); // F-17: bản tĩnh, chạy như v1.0
  try {
    const r = await api('GET', '/api/me');
    if (r.isJson && (r.status === 200 || r.status === 401)) {
      player.apiAvailable = true;
      if (r.status === 200) return goStart(r.data.fullName);
      return goRegister();
    }
  } catch (e) { /* không có server */ }
  goStart(null); // F-17: chạy như v1.0
}

state.phase = 'boot';
render();
boot();
