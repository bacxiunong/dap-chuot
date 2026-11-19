/* Trang quản trị Đập Chuột — F-18 … F-24 */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const page = document.body.dataset.page || 'login';

  async function api(method, url, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (res.status === 401 && page !== 'login') {
      window.location.href = '/admin/login.html';
      throw new Error('unauthorized');
    }
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    return { status: res.status, data: isJson ? await res.json().catch(() => ({})) : null };
  }

  function fmtTime(v) {
    if (!v) return '—';
    return new Date(v).toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function td(text, cls) {
    const el = document.createElement('td');
    el.textContent = text === null || text === undefined || text === '' ? '—' : String(text);
    if (cls) el.className = cls;
    return el;
  }

  function showFieldErrors(form, errors) {
    form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    for (const [k, msg] of Object.entries(errors || {})) {
      const box = form.querySelector(`[data-error-for="${k}"]`);
      if (box) box.textContent = msg;
      if (form.elements[k]) form.elements[k].setAttribute('aria-invalid', 'true');
    }
  }

  /* ---------- Đăng nhập (A-01) ---------- */
  if (page === 'login') {
    $('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = f.querySelector('button[type="submit"]');
      $('login-error').textContent = '';
      btn.disabled = true;
      try {
        const r = await api('POST', '/api/admin/login', { username: f.username.value, password: f.password.value });
        if (r.status === 200) { window.location.href = '/admin/'; return; }
        $('login-error').textContent = (r.data && r.data.message) || 'Không đăng nhập được.';
        f.password.value = '';
        f.password.focus();
      } catch (err) {
        $('login-error').textContent = 'Không kết nối được máy chủ.';
      } finally {
        btn.disabled = false;
      }
    });
    return;
  }

  /* ---------- Chung cho các trang cần đăng nhập ---------- */
  let me = null;
  api('GET', '/api/admin/me').then((r) => {
    if (r.status === 200) { me = r.data; $('who').textContent = me.username; }
  }).catch(() => {});

  $('btn-logout').addEventListener('click', async () => {
    try { await api('POST', '/api/admin/logout', {}); } catch (e) { /* bỏ qua */ }
    window.location.replace('/admin/login.html');
  });

  /* ---------- Người chơi (A-02) ---------- */
  if (page === 'players') {
    const state = { q: '', page: 1, pages: 1 };
    let timer = null;

    function csvHref() {
      return '/api/admin/players.csv' + (state.q ? '?q=' + encodeURIComponent(state.q) : '');
    }

    async function load() {
      $('list-error').textContent = '';
      const params = new URLSearchParams({ page: String(state.page) });
      if (state.q) params.set('q', state.q);
      let r;
      try { r = await api('GET', '/api/admin/players?' + params.toString()); } catch (e) { return; }
      if (r.status !== 200) { $('list-error').textContent = (r.data && r.data.message) || 'Không tải được danh sách.'; return; }
      const { items, total, pages } = r.data;
      state.pages = pages;
      if (state.page > pages) { state.page = pages; return load(); }
      $('total').textContent = `(${total})`;
      $('page-info').textContent = `Trang ${state.page}/${pages}`;
      $('prev').disabled = state.page <= 1;
      $('next').disabled = state.page >= pages;
      $('btn-csv').href = csvHref();

      const tbody = $('rows');
      tbody.textContent = '';
      if (!items.length) {
        const tr = document.createElement('tr');
        const cell = td(state.q ? 'Không có người chơi nào khớp từ khoá.' : 'Chưa có người chơi nào.', 'empty');
        cell.colSpan = 8;
        tr.appendChild(cell);
        tbody.appendChild(tr);
        return;
      }
      for (const p of items) {
        const tr = document.createElement('tr');
        tr.append(td(p.full_name), td(p.email), td(p.phone), td(fmtTime(p.created_at)),
          td(p.rounds, 'num'), td(p.best_score, 'num'), td(fmtTime(p.last_played_at)));
        const act = document.createElement('td');
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'link-btn danger';
        del.textContent = 'Xoá';
        del.addEventListener('click', () => confirmDelete(p));
        act.appendChild(del);
        tr.appendChild(act);
        tbody.appendChild(tr);
      }
    }

    function confirmDelete(p) {
      const dlg = $('confirm-delete');
      $('del-name').textContent = p.full_name;
      $('del-email').textContent = p.email;
      dlg.returnValue = '';
      dlg.onclose = async () => {
        if (dlg.returnValue !== 'ok') return;
        const r = await api('DELETE', '/api/admin/players/' + p.id).catch(() => null);
        if (!r || (r.status !== 204 && r.status !== 404)) {
          $('list-error').textContent = (r && r.data && r.data.message) || 'Không xoá được, vui lòng thử lại.';
        }
        load();
      };
      dlg.showModal();
    }

    $('search').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; load(); }, 300);
    });
    $('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
    $('next').addEventListener('click', () => { if (state.page < state.pages) { state.page++; load(); } });
    load();
  }

  /* ---------- Quản lý admin (A-03) ---------- */
  if (page === 'admins') {
    async function loadAdmins() {
      $('admins-error').textContent = '';
      let r;
      try { r = await api('GET', '/api/admin/admins'); } catch (e) { return; }
      if (r.status !== 200) { $('admins-error').textContent = 'Không tải được danh sách admin.'; return; }
      const tbody = $('admin-rows');
      tbody.textContent = '';
      for (const a of r.data.items) {
        const tr = document.createElement('tr');
        tr.append(td(a.username + (a.id === r.data.me.id ? ' (bạn)' : '')), td(fmtTime(a.created_at)), td(fmtTime(a.last_login_at)));
        const act = document.createElement('td');
        if (a.id !== r.data.me.id) {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'link-btn danger';
          del.textContent = 'Xoá';
          del.addEventListener('click', async () => {
            if (!window.confirm(`Xoá admin "${a.username}"?`)) return;
            const d = await api('DELETE', '/api/admin/admins/' + a.id).catch(() => null);
            if (!d || d.status !== 204) $('admins-error').textContent = (d && d.data && d.data.message) || 'Không xoá được.';
            loadAdmins();
          });
          act.appendChild(del);
        }
        tr.appendChild(act);
        tbody.appendChild(tr);
      }
    }

    async function handleForm(form, url, okText, after) {
      const ok = form.querySelector('[data-ok]');
      ok.textContent = '';
      ok.className = 'help';
      const body = {};
      for (const el of form.elements) if (el.name) body[el.name] = el.value;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const r = await api('POST', url, body);
        if (r.status === 201 || r.status === 204) {
          showFieldErrors(form, {});
          form.reset();
          ok.textContent = okText;
          ok.className = 'help ok';
          if (after) after();
        } else {
          showFieldErrors(form, (r.data && r.data.errors) || {});
          if (!(r.data && r.data.errors)) { ok.textContent = (r.data && r.data.message) || 'Có lỗi, vui lòng thử lại.'; ok.className = 'help error'; }
        }
      } catch (e) { /* đã chuyển về đăng nhập */ } finally {
        btn.disabled = false;
      }
    }

    $('form-add-admin').addEventListener('submit', (e) => {
      e.preventDefault();
      handleForm(e.currentTarget, '/api/admin/admins', 'Đã thêm admin.', loadAdmins);
    });
    $('form-password').addEventListener('submit', (e) => {
      e.preventDefault();
      handleForm(e.currentTarget, '/api/admin/password', 'Đã đổi mật khẩu.');
    });
    loadAdmins();
  }
})();
