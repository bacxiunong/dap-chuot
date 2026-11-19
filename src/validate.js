'use strict';
// Quy tắc dữ liệu đăng ký — docs/04-quy-tac-du-lieu.html (P-01…P-07, A-R4)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]+$/;
const PHONE_RE = /^0(3|5|7|8|9)\d{8}$/;
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function cleanName(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeEmail(v) {
  return String(v ?? '').trim().toLowerCase();
}

function normalizePhone(v) {
  let p = String(v ?? '').replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = '0' + p.slice(3);
  else if (/^84\d{9}$/.test(p)) p = '0' + p.slice(2);
  return p;
}

function validateName(v) {
  const name = cleanName(v);
  if (!name) return { error: 'Vui lòng nhập họ và tên.' };
  if (name.length < 2 || name.length > 100) return { error: 'Họ và tên dài từ 2 đến 100 ký tự.' };
  if (!/\p{L}/u.test(name)) return { error: 'Họ và tên phải có chữ cái.' };
  return { value: name };
}

function validateEmail(v) {
  const email = normalizeEmail(v);
  if (!email) return { error: 'Vui lòng nhập email.' };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: 'Email chưa đúng định dạng.' };
  return { value: email };
}

function validatePhone(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return { error: 'Vui lòng nhập số điện thoại.' };
  const phone = normalizePhone(raw);
  if (!PHONE_RE.test(phone)) return { error: 'Số điện thoại chưa đúng (10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09).' };
  return { value: phone };
}

function validateRegistration(body) {
  const errors = {};
  const name = validateName(body.fullName);
  const email = validateEmail(body.email);
  const phone = validatePhone(body.phone);
  if (name.error) errors.fullName = name.error;
  if (email.error) errors.email = email.error;
  if (phone.error) errors.phone = phone.error;
  if (body.consent !== true) errors.consent = 'Bạn cần đồng ý cho lưu thông tin để đăng ký.';
  if (Object.keys(errors).length) return { errors };
  return { value: { fullName: name.value, email: email.value, phone: phone.value } };
}

function validateScore(v) {
  return Number.isInteger(v) && v >= 0 && v <= 300;
}

function validateUsername(v) {
  const u = String(v ?? '').trim().toLowerCase();
  if (!USERNAME_RE.test(u)) return { error: 'Tên đăng nhập 3–32 ký tự: chữ thường, số, dấu chấm, gạch dưới, gạch ngang.' };
  return { value: u };
}

function validatePassword(v) {
  const p = String(v ?? '');
  if (p.length < 10) return { error: 'Mật khẩu tối thiểu 10 ký tự.' };
  if (p.length > 200) return { error: 'Mật khẩu quá dài.' };
  return { value: p };
}

module.exports = {
  normalizeEmail, normalizePhone, validateEmail, validatePhone,
  validateRegistration, validateScore, validateUsername, validatePassword,
};
