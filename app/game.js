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
const screens = { idle: $('screen-start'), playing: $('screen-play'), ended: $('screen-end') };
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
  render();
  $('btn-replay').focus({ preventScroll: true }); // F-11
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

/* ---------- Khởi động ---------- */
state.highScore = loadHighScore();
render();
$('btn-start').focus({ preventScroll: true });
