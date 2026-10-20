/* Tab Quản trị: tải file Excel, chọn ngày áp dụng, đăng lên GitHub */
(function () {
  'use strict';
  var CFG = window.TKB_CONFIG || {}, P = window.TKBParser, R = window.TKB;
  var esc = R.esc, vnDate = R.vnDate;
  var root, ctx, cur = null, mounted = false, pvCombo;

  function q(sel) { return root.querySelector(sel); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem('tkbadmin.' + k); if (v === null) localStorage.removeItem('tkbadmin.' + k); else localStorage.setItem('tkbadmin.' + k, v); } catch (e) { return null; } }
  function log(html, cls) { if (!root.querySelector('#a-log')) return; var d = document.createElement('div'); d.className = cls || ''; d.innerHTML = html; q('#a-log').appendChild(d); }
  var ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';

  /* ---------- base64 ---------- */
  function bytesToB64(bytes) { var s = '', CH = 0x8000; for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(s); }
  function strToB64(str) { return bytesToB64(new TextEncoder().encode(str)); }
  function b64ToStr(b64) { var bin = atob(b64.replace(/\s/g, '')), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }

  /* ---------- GitHub ---------- */
  var TOKEN = '';  // token chỉ giữ trong bộ nhớ / phiên làm việc, không lưu lâu dài
  function gh() {
    return { owner: (ls('owner') || '').trim(), repo: (ls('repo') || '').trim(), branch: (ls('branch') || 'main').trim(), token: TOKEN };
  }
  function api(method, path, body) {
    var g = gh();
    return fetch('https://api.github.com/repos/' + encodeURIComponent(g.owner) + '/' + encodeURIComponent(g.repo) + path, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + g.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 404 && method === 'GET') return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) throw new Error('Token không hợp lệ hoặc đã hết hạn.');
        if (!r.ok) throw new Error((j && j.message) || ('HTTP ' + r.status));
        return j;
      });
    });
  }
  function getFile(path) { return api('GET', '/contents/' + path + '?ref=' + encodeURIComponent(gh().branch) + '&t=' + Date.now()); }
  function putFile(path, b64, msg) {
    return getFile(path).then(function (old) {
      var body = { message: msg, content: b64, branch: gh().branch };
      if (old && old.sha) body.sha = old.sha;
      return api('PUT', '/contents/' + path, body);
    });
  }
  function delFile(path, msg) {
    return getFile(path).then(function (old) { return old ? api('DELETE', '/contents/' + path, { message: msg, sha: old.sha, branch: gh().branch }) : null; });
  }
  function readIndexRemote() { return getFile('data/index.json').then(function (f) { return f ? JSON.parse(b64ToStr(f.content)) : { versions: [] }; }); }

  function defaults() {
    var host = location.hostname, owner = CFG.githubOwner, repo = CFG.githubRepo;
    if (!owner && /\.github\.io$/.test(host)) { owner = host.split('.')[0]; var seg = location.pathname.split('/').filter(Boolean)[0]; repo = repo || (seg && !/\.html$/.test(seg) ? seg : host); }
    if (!ls('owner') && owner) ls('owner', owner);
    if (!ls('repo') && repo) ls('repo', repo);
    if (!ls('branch')) ls('branch', CFG.githubBranch || 'main');
  }
  /* ---------- xác thực: đăng nhập bằng tên + mật khẩu quản trị ----------
     Trang là trang tĩnh: không thể giấu mật khẩu trong mã nguồn.
     Vì vậy token GitHub (quyền ghi kho) được MÃ HÓA bằng tên đăng nhập + mật khẩu
     (PBKDF2-SHA256, 600 000 vòng → AES-GCM 256 bit) và lưu ở data/admin-auth.json.
     Đăng nhập = giải mã được token VÀ GitHub xác nhận token thuộc quản trị viên kho.
     Không biết mật khẩu thì không có token, không xem được giao diện, không ghi/xóa được gì. */
  var AUTH_PATH = 'data/admin-auth.json', ITER = 600000;
  var authed = false;
  var te = new TextEncoder(), td = new TextDecoder();
  function b64(u8) { return bytesToB64(u8); }
  function unb64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function keyFrom(user, pass, salt, iter) {
    return crypto.subtle.importKey('raw', te.encode(user.trim().toLowerCase() + '\n' + pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (k) { return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); });
  }
  function seal(user, pass, token) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return keyFrom(user, pass, salt, ITER).then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, te.encode(token)); })
      .then(function (ct) { return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct)), updated: new Date().toISOString() }; });
  }
  function unseal(rec, user, pass) {
    return keyFrom(user, pass, unb64(rec.salt), rec.iter || ITER)
      .then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, k, unb64(rec.data)); })
      .then(function (pt) { return td.decode(pt); }, function () { throw new Error('Sai tên đăng nhập hoặc mật khẩu.'); });
  }
  function readAuth() {
    return fetch(AUTH_PATH + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (j) { return j && j.data ? j : null; });
  }
  // GitHub kiểm tra: token hợp lệ và thuộc tài khoản có quyền QUẢN TRỊ kho
  function verify(token) {
    var g = gh();
    if (token !== undefined) g.token = (token || '').trim();
    if (!g.owner || !g.repo || !g.token) return Promise.reject(new Error('Chưa có mã truy cập.'));
    return fetch('https://api.github.com/repos/' + encodeURIComponent(g.owner) + '/' + encodeURIComponent(g.repo) + '?t=' + Date.now(), {
      headers: { 'Authorization': 'Bearer ' + g.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      cache: 'no-store'
    }).then(function (r) {
      if (r.status === 401) throw new Error('Mã truy cập GitHub không đúng hoặc đã hết hạn.');
      if (r.status === 403 || r.status === 404) throw new Error('Mã truy cập này không có quyền với kho ' + g.owner + '/' + g.repo + '.');
      if (!r.ok) throw new Error('Không kiểm tra được (mã ' + r.status + '). Thử lại sau.');
      return r.json();
    }).then(function (j) {
      var pm = j.permissions || {};
      if (!pm.admin) throw new Error('Tài khoản GitHub này không phải người quản trị kho.');
      if (!pm.push) throw new Error('Mã truy cập chỉ có quyền đọc. Cần quyền Contents: Read and write.');
      return j;
    });
  }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem('tkbadmin.' + k); if (v === null) sessionStorage.removeItem('tkbadmin.' + k); else sessionStorage.setItem('tkbadmin.' + k, v); } catch (e) { return null; } }
  function enter(token, user, j) {
    TOKEN = token; ss('t', token); ss('u', user || '');
    authed = true;
    build(j, user);
  }
  function logout(msg) {
    TOKEN = ''; ss('t', null); ss('u', null);
    authed = false; mounted = true; cur = null;
    gate(msg);
  }
  // dùng trước mỗi thao tác ghi / xóa: kiểm tra lại, sai thì đăng xuất ngay
  function checkConn() {
    return verify().then(function () { return true; }).catch(function (e) { logout(esc(e.message)); return false; });
  }

  /* ---------- màn hình đăng nhập (người chưa đăng nhập chỉ thấy phần này) ---------- */
  function shell(title, inner) {
    root.innerHTML =
      '<div class="head"><div><p class="who-kind">Khu vực hạn chế</p><h1 class="who-name">Quản trị</h1>' +
      '<div class="facts"><span>Chỉ quản trị viên mới vào được. Giáo viên và học sinh xem lịch ở hai tab Giáo viên và Lớp học.</span></div></div></div>' +
      '<div class="adm"><section class="panel" style="max-width:520px;margin:0 auto;width:100%"><h2>' + title + '</h2>' + inner +
      '<div class="conn" id="g-msg" style="margin-top:12px"></div></section></div>';
  }
  function say(msg, ok) { var m = q('#g-msg'); if (m) m.innerHTML = msg ? '<span class="dot' + (ok ? ' on' : '') + '"></span><span>' + msg + '</span>' : ''; }
  function field(id, label, type, ph, ac) {
    return '<div class="field" style="flex:1 1 100%"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" type="' + type + '"' +
      (ph ? ' placeholder="' + ph + '"' : '') + ' autocomplete="' + (ac || 'off') + '"></div>';
  }
  function busy(on) { root.querySelectorAll('.adm button, .adm input').forEach(function (x) { x.disabled = on; }); }

  function gate(msg) {
    // phiên đang mở (chưa đóng trình duyệt): vào thẳng nếu token vẫn hợp lệ
    if (!authed && ss('t')) {
      shell('Đăng nhập quản trị', '<p class="lead">Đang kiểm tra phiên đăng nhập…</p>');
      var t0 = ss('t'), u0 = ss('u');
      verify(t0).then(function (j) { enter(t0, u0, j); }, function () { ss('t', null); gate(msg); });
      return;
    }
    shell('Đăng nhập quản trị', '<p class="lead">Đang tải…</p>');
    readAuth().then(function (rec) {
      if (!rec) return setupForm(msg);
      loginForm(rec, msg);
    });
  }

  function loginForm(rec, msg) {
    shell('Đăng nhập quản trị',
      '<form id="g-form" class="row" autocomplete="on" onsubmit="return false">' +
        field('g-user', 'Tên đăng nhập', 'text', '', 'username') +
        field('g-pass', 'Mật khẩu', 'password', '', 'current-password') +
        '<button class="btn primary" id="g-go" type="submit" style="height:44px;width:100%">Đăng nhập</button></form>' +
      '<details class="help" style="margin-top:14px"><summary>Quên mật khẩu?</summary>' +
        '<p class="lead" style="margin-top:8px">Quản trị viên đăng nhập bằng mã truy cập (token) GitHub để đặt lại tên đăng nhập và mật khẩu.</p>' +
        '<button class="btn" id="g-reset" type="button">Đặt lại bằng token GitHub</button></details>');
    if (msg) say(msg);
    q('#g-user').focus();
    q('#g-form').onsubmit = function () {
      var u = q('#g-user').value, pw = q('#g-pass').value;
      if (!u.trim() || !pw) { say('Nhập tên đăng nhập và mật khẩu.'); return false; }
      busy(true); say('Đang kiểm tra…');
      unseal(rec, u, pw).then(function (token) {
        return verify(token).then(function (j) { enter(token, u.trim(), j); }, function (e) {
          throw new Error('Mật khẩu đúng nhưng ' + e.message.charAt(0).toLowerCase() + e.message.slice(1) + ' Hãy dùng “Quên mật khẩu?” để cập nhật token mới.');
        });
      }).catch(function (e) { busy(false); q('#g-pass').value = ''; say(esc(e.message)); });
      return false;
    };
    q('#g-reset').onclick = function () { setupForm('', true); };
  }

  // lần đầu (chưa có tài khoản) hoặc đặt lại: cần token GitHub của quản trị viên kho
  function setupForm(msg, reset) {
    shell(reset ? 'Đặt lại tài khoản quản trị' : 'Tạo tài khoản quản trị (lần đầu)',
      '<p class="lead">Chỉ quản trị viên kho <b>' + esc(gh().owner + '/' + gh().repo) + '</b> làm được bước này: cần mã truy cập (token) GitHub có quyền quản trị kho. ' +
      'Sau bước này, chỉ cần tên đăng nhập và mật khẩu.</p>' +
      '<form id="s-form" class="row" onsubmit="return false">' +
        field('s-token', 'Mã truy cập GitHub', 'password', 'github_pat_…') +
        field('s-user', 'Tên đăng nhập mới', 'text', 'ví dụ: admin', 'username') +
        field('s-pass', 'Mật khẩu mới (ít nhất 10 kí tự)', 'password', '', 'new-password') +
        field('s-pass2', 'Nhập lại mật khẩu', 'password', '', 'new-password') +
        '<button class="btn primary" type="submit" style="height:44px;width:100%">' + (reset ? 'Đặt lại và đăng nhập' : 'Tạo tài khoản và đăng nhập') + '</button></form>' +
      (reset ? '<p style="margin-top:10px"><button class="btn" id="s-back" type="button">← Quay lại đăng nhập</button></p>' : '') +
      '<details class="help" style="margin-top:14px"><summary>Cách tạo token</summary><ol>' +
        '<li>Trên GitHub: ảnh đại diện → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>' +
        '<li><i>Repository access</i>: <b>Only select repositories</b> → chọn kho thời khóa biểu.</li>' +
        '<li><i>Permissions</i> → <i>Contents</i>: <b>Read and write</b>. Bấm <b>Generate token</b> và sao chép.</li></ol></details>');
    if (msg) say(msg);
    if (reset) q('#s-back').onclick = function () { gate(); };
    q('#s-form').onsubmit = function () {
      var tk = q('#s-token').value.trim(), u = q('#s-user').value.trim(), p1 = q('#s-pass').value, p2 = q('#s-pass2').value;
      if (!tk || !u) { say('Nhập đủ mã truy cập và tên đăng nhập.'); return false; }
      if (p1.length < 10) { say('Mật khẩu cần ít nhất 10 kí tự.'); return false; }
      if (p1 !== p2) { say('Hai lần nhập mật khẩu không khớp.'); return false; }
      busy(true); say('Đang kiểm tra quyền quản trị…');
      verify(tk).then(function (j) {
        TOKEN = tk;
        say('Đang lưu tài khoản…');
        return seal(u, p1, tk).then(function (rec) {
          return putFile(AUTH_PATH, strToB64(JSON.stringify(rec, null, 2)), 'Cập nhật tài khoản quản trị');
        }).then(function () { enter(tk, u, j); });
      }).catch(function (e) { TOKEN = ''; busy(false); say(esc(e.message)); });
      return false;
    };
  }

  function drawConn(j, user) {
    q('#a-conn').innerHTML = '<span class="dot on"></span><span>Đang đăng nhập' + (user ? ' với tên <b>' + esc(user) + '</b>' : '') +
      ' (quản trị kho <b>' + esc(j.full_name) + '</b>)</span>' +
      '<button class="btn" type="button" id="a-chpw">Đổi mật khẩu</button>' +
      '<button class="btn danger" type="button" id="a-forget">Đăng xuất</button>';
    q('#a-forget').onclick = function () { logout('Đã đăng xuất.'); };
    q('#a-chpw').onclick = function () {
      var box = q('#a-pw');
      if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = '<form class="row" id="p-form" onsubmit="return false" style="margin-top:12px">' +
        '<div class="field"><label for="p-user">Tên đăng nhập</label><input class="input" id="p-user" autocomplete="username"></div>' +
        '<div class="field"><label for="p-pass">Mật khẩu mới</label><input class="input" id="p-pass" type="password" autocomplete="new-password"></div>' +
        '<div class="field"><label for="p-pass2">Nhập lại</label><input class="input" id="p-pass2" type="password" autocomplete="new-password"></div>' +
        '<button class="btn primary" type="submit" style="height:44px">Lưu</button></form><div class="log" id="p-msg"></div>';
      q('#p-user').value = user || '';
      q('#p-form').onsubmit = function () {
        var u = q('#p-user').value.trim(), p1 = q('#p-pass').value, p2 = q('#p-pass2').value, m = q('#p-msg');
        if (!u) { m.innerHTML = '<div class="bad">Nhập tên đăng nhập.</div>'; return false; }
        if (p1.length < 10) { m.innerHTML = '<div class="bad">Mật khẩu cần ít nhất 10 kí tự.</div>'; return false; }
        if (p1 !== p2) { m.innerHTML = '<div class="bad">Hai lần nhập mật khẩu không khớp.</div>'; return false; }
        m.innerHTML = 'Đang lưu…';
        checkConn().then(function (ok) {
          if (!ok) return;
          return seal(u, p1, TOKEN).then(function (rec) { return putFile(AUTH_PATH, strToB64(JSON.stringify(rec, null, 2)), 'Đổi mật khẩu quản trị'); })
            .then(function () { user = u; ss('u', u); m.innerHTML = '<div class="ok">Đã đổi. Lần đăng nhập sau dùng tên và mật khẩu mới (có hiệu lực sau khoảng 1–2 phút).</div>'; });
        }).catch(function (e) { m.innerHTML = '<div class="bad">' + esc(e.message) + '</div>'; });
        return false;
      };
    };
  }

  /* ---------- đọc file ---------- */
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve();
    return new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = 'assets/vendor/xlsx.full.min.js';
      s.onload = ok; s.onerror = function () { bad(new Error('Không tải được thư viện đọc Excel.')); };
      document.head.appendChild(s);
    });
  }
  function readFile(f) {
    cur = null; q('#a-result').hidden = true; q('#a-log').innerHTML = '';
    q('#a-drop').querySelector('b').textContent = 'Đang đọc ' + f.name + '…';
    loadXLSX().then(function () { return f.arrayBuffer(); }).then(function (buf) {
      var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      var p = P.parseWorkbook(XLSX, wb), nCls = Object.keys(p.classes).length;
      if (!nCls) throw new Error(p.warnings.join(' ') || 'Không tìm thấy thời khóa biểu trong file.');
      var data = P.toData(p, {}), T = P.teacherIndex(data), cells = 0, clashes = [];
      ['S', 'C'].forEach(function (b) { Object.keys(data.grid[b]).forEach(function (c) { Object.keys(data.grid[b][c]).forEach(function (d) { cells += Object.keys(data.grid[b][c][d]).length; }); }); });
      Object.keys(T).forEach(function (k) { ['S', 'C'].forEach(function (b) { Object.keys(T[k][b]).forEach(function (d) { Object.keys(T[k][b][d]).forEach(function (pp) {
        var it = T[k][b][d][pp];
        if (it.length > 1) clashes.push(k + ': Thứ ' + d + ' ' + (b === 'S' ? 'sáng' : 'chiều') + ' tiết ' + pp + ' (' + it.map(function (x) { return x[1]; }).join(', ') + ')');
      }); }); }); });
      data._T = T;
      cur = { data: data, buf: new Uint8Array(buf), name: f.name, label: p.label };
      q('#a-drop').querySelector('b').textContent = f.name;
      q('#a-drop').querySelector('span').textContent = 'Bấm để chọn file khác';
      q('#a-date').value = p.applyDate || q('#a-date').value;
      q('#a-stats').innerHTML =
        '<div><b>' + nCls + '</b>lớp</div><div><b>' + Object.keys(T).length + '</b>giáo viên</div><div><b>' + cells + '</b>ô có tiết</div>' +
        '<div><b>' + (p.applyDate ? vnDate(p.applyDate) : '—') + '</b>ngày ghi trong file</div>';
      var notes = '<div class="note ok">Đã đọc các sheet ' + esc(p.sheetsUsed.join(', ')) + '. ' +
        (p.dirSheets ? 'Đã tra họ tên đầy đủ của giáo viên từ bảng phân công trong file.' : 'File không có sheet phân công nên giáo viên hiển thị theo tên viết tắt.') + '</div>';
      if (p.skipped) notes += '<div class="note">Đã bỏ ' + p.skipped + ' tiết Ôn TN buổi chiều (khối 12 có thời khóa biểu riêng).</div>';
      notes += p.warnings.map(function (w) { return '<div class="note warn">' + esc(w) + '</div>'; }).join('');
      if (clashes.length) notes += '<div class="note warn"><b>' + clashes.length + ' trường hợp giáo viên trùng tiết.</b> Kiểm tra lại trước khi đăng:<br>' + clashes.slice(0, 12).map(esc).join('<br>') + (clashes.length > 12 ? '<br>…' : '') + '</div>';
      q('#a-notes').innerHTML = notes;
      var opts = data.classes.map(function (c) { return { value: 'lop|' + c.code, label: c.code, hint: R.clsName(c.code), group: 'Lớp – khối ' + c.khoi }; })
        .concat(Object.keys(T).sort(function (a, b) { return a.localeCompare(b, 'vi'); }).map(function (k) { return { value: 'gv|' + k, label: k, hint: R.subj(T[k].main), group: 'Giáo viên', keys: T[k].abbr }; }));
      pvCombo.set(opts, opts[0].value); preview(opts[0].value);
      q('#a-result').hidden = false; setBtns();
    }).catch(function (e) {
      q('#a-drop').querySelector('b').textContent = 'Kéo file Excel vào đây';
      q('#a-notes').innerHTML = '<div class="note err">Không đọc được file: ' + esc(e.message) + '</div>';
      q('#a-result').hidden = false; q('#a-stats').innerHTML = ''; q('#a-pv').innerHTML = '';
    });
  }
  function preview(v) {
    if (!cur) return;
    var i = v.indexOf('|'), mode = v.slice(0, i), who = v.slice(i + 1);
    q('#a-pv').innerHTML = R.timetable(cur.data, cur.data._T, mode, who, {}).html;
  }
  function setBtns() { if (!root.querySelector('#a-pub')) return; var ok = !!cur && /^\d{4}-\d{2}-\d{2}$/.test(q('#a-date').value); q('#a-pub').disabled = !ok; q('#a-dl').disabled = !ok; }

  function buildPayload(idx) {
    var date = q('#a-date').value, now = new Date().toISOString();
    var meta = { date: date, label: cur.label || '', note: q('#a-note').value.trim(), source: cur.name, uploaded: now };
    var data = { version: cur.data.version, meta: meta, nper: cur.data.nper, classes: cur.data.classes, grid: cur.data.grid };
    idx = idx || { versions: [] };
    idx.versions = (idx.versions || []).filter(function (v) { return v.date !== date; });
    var entry = { date: date, file: 'tkb/' + date + '.json', label: meta.label, note: meta.note, source: cur.name, uploaded: now };
    if (q('#a-keep').checked) entry.xlsx = 'xlsx/' + date + '.xlsx';
    idx.versions.push(entry);
    idx.versions.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return { date: date, data: data, idx: idx, entry: entry };
  }

  function publish() {
    q('#a-log').innerHTML = ''; q('#a-pub').disabled = true;
    var date = q('#a-date').value;
    checkConn().then(function (ok) {
      if (!ok) throw new Error('Chưa kết nối GitHub. Nhập token ở mục Kết nối GitHub phía dưới.');
      return readIndexRemote();
    }).then(function (idx) {
      if ((idx.versions || []).some(function (v) { return v.date === date; }) &&
          !confirm('Đã có thời khóa biểu áp dụng từ ' + vnDate(date) + '. Thay bằng file mới?')) throw new Error('Đã hủy, chưa đăng gì.');
      var pl = buildPayload(idx), msg = 'TKB áp dụng từ ' + vnDate(date) + (pl.entry.note ? ' – ' + pl.entry.note : '');
      log('Đang đăng thời khóa biểu…');
      var chain = putFile('data/tkb/' + date + '.json', strToB64(JSON.stringify(pl.data)), msg).then(function () { log('✓ Dữ liệu thời khóa biểu', 'ok'); });
      if (pl.entry.xlsx) chain = chain.then(function () { return putFile('data/' + pl.entry.xlsx, bytesToB64(cur.buf), msg + ' (file gốc)'); }).then(function () { log('✓ File Excel gốc', 'ok'); });
      return chain.then(function () { return putFile('data/index.json', strToB64(JSON.stringify(pl.idx, null, 2)), msg + ' (danh sách)'); })
        .then(function () {
          log('✓ Danh sách ngày áp dụng', 'ok');
          log('<b>Đã đăng.</b> Sau khoảng 1–2 phút, giáo viên và học sinh tải lại trang sẽ thấy thời khóa biểu từ ' + vnDate(date) + '.', 'ok');
          drawVersions(pl.idx);
          if (ctx && ctx.reload) setTimeout(ctx.reload, 90000);
        });
    }).catch(function (e) { log(esc(e.message), 'bad'); }).then(setBtns);
  }

  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function downloadLocal() {
    fetch('data/index.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { versions: [] }; })
      .catch(function () { return { versions: [] }; }).then(function (idx) {
        q('#a-keep').checked = false;
        var pl = buildPayload(idx);
        download(pl.date + '.json', JSON.stringify(pl.data));
        setTimeout(function () { download('index.json', JSON.stringify(pl.idx, null, 2)); }, 400);
        q('#a-log').innerHTML = '<div class="note">Đã tải 2 file về máy. Trên GitHub, đưa <b>' + pl.date + '.json</b> vào thư mục <b>data/tkb/</b> và thay file <b>data/index.json</b> bằng file <b>index.json</b> vừa tải.</div>';
      });
  }

  /* ---------- các bản đã đăng ---------- */
  function drawVersions(idx) {
    var vs = ((idx && idx.versions) || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); }), t = R.today();
    var curDate = (vs.filter(function (v) { return v.date <= t; })[0] || {}).date;
    if (!vs.length) { q('#a-vers').innerHTML = '<p class="lead">Chưa có bản nào.</p>'; return; }
    q('#a-vers').innerHTML = '<div style="overflow-x:auto"><table class="list"><thead><tr><th>Áp dụng từ</th><th>Trạng thái</th><th class="hide-sm">Ghi chú</th><th class="hide-sm">File gốc</th><th class="hide-sm">Đăng lúc</th><th></th></tr></thead><tbody>' +
      vs.map(function (v) {
        var tag = v.date > t ? '<span class="tag next">Sắp áp dụng</span>' : v.date === curDate ? '<span class="tag cur">Đang áp dụng</span>' : '<span class="tag">Đã thay</span>';
        return '<tr><td><b>' + vnDate(v.date) + '</b>' + (v.label ? ' <small style="color:var(--ink-3)">' + esc(v.label) + '</small>' : '') + '</td><td>' + tag + '</td>' +
          '<td class="hide-sm">' + esc(v.note || '') + '</td><td class="hide-sm">' + (v.xlsx ? '<a href="data/' + esc(v.xlsx) + '">' + esc(v.source || 'Tải về') + '</a>' : esc(v.source || '')) + '</td>' +
          '<td class="hide-sm">' + (v.uploaded ? new Date(v.uploaded).toLocaleString('vi-VN') : '') + '</td>' +
          '<td style="text-align:right;white-space:nowrap"><a class="btn" href="./?xem=lop&ngay=' + v.date + '">Xem</a> <button class="btn danger" type="button" data-del="' + v.date + '">Xóa</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    root.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { removeVersion(b.dataset.del); }; });
  }
  function removeVersion(date) {
    if (!confirm('Xóa thời khóa biểu áp dụng từ ' + vnDate(date) + '? Giáo viên và học sinh sẽ không xem được bản này nữa.')) return;
    var msg = 'Xóa TKB áp dụng từ ' + vnDate(date);
    checkConn().then(function (ok) {
      if (!ok) throw new Error('Chưa kết nối GitHub.');
      return readIndexRemote();
    }).then(function (idx) {
      var v = (idx.versions || []).filter(function (x) { return x.date === date; })[0];
      idx.versions = (idx.versions || []).filter(function (x) { return x.date !== date; });
      return putFile('data/index.json', strToB64(JSON.stringify(idx, null, 2)), msg)
        .then(function () { return v ? delFile('data/' + v.file, msg) : null; })
        .then(function () { return v && v.xlsx ? delFile('data/' + v.xlsx, msg) : null; })
        .then(function () { drawVersions(idx); alert('Đã xóa. Trang cập nhật sau khoảng 1–2 phút.'); });
    }).catch(function (e) { alert(e.message); });
  }

  /* ---------- dựng giao diện ---------- */
  function mount(el, c) {
    ctx = c;
    if (!root) { root = el; defaults(); try { localStorage.removeItem('tkbadmin.token'); } catch (e) {} }
    if (mounted) return;
    mounted = true;
    if (authed) return;
    gate();
  }

  // chỉ gọi sau khi đã xác thực quyền quản trị
  function build(j, user) {
    root.innerHTML =
      '<div class="head"><div><p class="who-kind">Dành cho người xếp thời khóa biểu</p><h1 class="who-name">Quản trị</h1>' +
      '<div class="facts"><span>Tải file Excel lên, chọn ngày áp dụng rồi bấm Đăng. Giáo viên và học sinh sẽ thấy bản mới ở hai tab Giáo viên và Lớp học.</span></div></div></div>' +
      '<div class="adm">' +
      '<section class="panel"><h2>Đăng thời khóa biểu mới</h2><p class="lead">File Excel đúng mẫu TKB của trường (các sheet theo khối hoặc TKB_SANG / TKB_CHIEU).</p>' +
        '<label class="drop" id="a-drop" tabindex="0">' + ICON_UP + '<b>Kéo file Excel vào đây</b><span>hoặc bấm để chọn file .xlsx</span>' +
        '<input type="file" id="a-file" accept=".xlsx,.xlsm,.xls" hidden></label>' +
        '<div id="a-result" hidden><div class="stats" id="a-stats"></div><div id="a-notes"></div>' +
          '<div class="row" style="margin-top:14px"><div class="field"><label for="a-date">Ngày áp dụng</label><input class="input" type="date" id="a-date"></div>' +
          '<div class="field" style="flex:2 1 260px"><label for="a-note">Ghi chú</label><input class="input" id="a-note" placeholder="Ví dụ: điều chỉnh tuần 7"></div></div>' +
          '<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:14px"><input type="checkbox" id="a-keep" checked> Lưu kèm file Excel gốc để lưu trữ</label>' +
          '<div class="pv-bar"><b>Xem thử</b><div class="combo" style="width:280px"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
            '<input class="input" id="a-pvin" placeholder="Lớp hoặc giáo viên…" autocomplete="off"><div class="combo-list" id="a-pvlist" hidden></div></div></div>' +
          '<div id="a-pv"></div>' +
          '<div class="row" style="margin-top:18px"><button class="btn primary lg" id="a-pub" type="button" disabled>Đăng thời khóa biểu</button>' +
          '<button class="btn lg" id="a-dl" type="button" disabled>Tải dữ liệu về máy</button></div><div class="log" id="a-log" style="margin-top:12px"></div></div>' +
      '</section>' +
      '<section class="panel"><h2>Các bản đã đăng</h2><p class="lead">Trang xem tự chọn bản đang áp dụng theo ngày hôm nay.</p><div id="a-vers">Đang tải…</div></section>' +
      '<section class="panel"><h2>Tài khoản quản trị</h2><p class="lead">Phiên đăng nhập tự hết khi đóng trình duyệt. Dùng máy chung thì nhớ bấm Đăng xuất.</p>' +
        '<div class="conn" id="a-conn"></div><div id="a-pw" hidden></div></section></div>';
    drawConn(j, user);

    var drop = q('#a-drop'), file = q('#a-file');
    file.onchange = function () { if (file.files[0]) readFile(file.files[0]); };
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readFile(f); });
    pvCombo = new R.Combo(q('#a-pvin'), q('#a-pvlist'), preview);
    q('#a-date').addEventListener('input', setBtns);
    q('#a-pub').onclick = publish;
    q('#a-dl').onclick = downloadLocal;
    fetch('data/index.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(drawVersions)
      .catch(function () { q('#a-vers').innerHTML = '<p class="lead">Chưa có bản nào.</p>'; });
  }

  window.TKBAdmin = { mount: mount };
})();
