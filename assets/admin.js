(function () {
  'use strict';
  var CFG = window.TKB_CONFIG || {}, P = window.TKBParser;
  var $ = function (id) { return document.getElementById(id); };
  var cur = null;            // {data, buf, name}
  var DAYS = [2, 3, 4, 5, 6, 7];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function vnDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem('tkbadmin.' + k); if (v === null) localStorage.removeItem('tkbadmin.' + k); else localStorage.setItem('tkbadmin.' + k, v); } catch (e) { return null; } }
  function log(html, cls) { var d = document.createElement('div'); d.className = cls || ''; d.innerHTML = html; $('log').appendChild(d); }

  /* ---------- base64 ---------- */
  function bytesToB64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function strToB64(str) { return bytesToB64(new TextEncoder().encode(str)); }
  function b64ToStr(b64) {
    var bin = atob(b64.replace(/\s/g, '')), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(u);
  }

  /* ---------- GitHub ---------- */
  function gh() { return { owner: $('owner').value.trim(), repo: $('repo').value.trim(), branch: $('branch').value.trim() || 'main', token: $('token').value.trim() }; }
  function api(method, path, body) {
    var g = gh();
    return fetch('https://api.github.com/repos/' + encodeURIComponent(g.owner) + '/' + encodeURIComponent(g.repo) + path, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + g.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (r.status === 404 && method === 'GET') return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
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
    return getFile(path).then(function (old) {
      if (!old) return null;
      return api('DELETE', '/contents/' + path, { message: msg, sha: old.sha, branch: gh().branch });
    });
  }
  function readIndexRemote() {
    return getFile('data/index.json').then(function (f) { return f ? JSON.parse(b64ToStr(f.content)) : { versions: [] }; });
  }

  /* ---------- kết nối ---------- */
  function initConn() {
    var host = location.hostname, owner = CFG.githubOwner, repo = CFG.githubRepo;
    if (!owner && /\.github\.io$/.test(host)) {
      owner = host.split('.')[0];
      var seg = location.pathname.split('/').filter(Boolean)[0];
      repo = repo || (seg && !/\.html$/.test(seg) ? seg : host);
    }
    $('owner').value = ls('owner') || owner || '';
    $('repo').value = ls('repo') || repo || '';
    $('branch').value = ls('branch') || CFG.githubBranch || 'main';
    $('token').value = ls('token') || '';
    if (CFG.schoolName) $('school').textContent = CFG.schoolName;
  }
  function checkConn() {
    var g = gh();
    ['owner', 'repo', 'branch', 'token'].forEach(function (k) { ls(k, g[k]); });
    $('conn').innerHTML = 'Đang kiểm tra…';
    if (!g.owner || !g.repo || !g.token) { $('conn').innerHTML = '<span class="bad">Nhập đủ chủ kho, tên kho và token.</span>'; return Promise.resolve(false); }
    return api('GET', '').then(function (j) {
      if (!j) throw new Error('Không thấy kho ' + g.owner + '/' + g.repo + ' (sai tên hoặc token không được cấp quyền kho này).');
      if (j.permissions && !j.permissions.push) throw new Error('Token chỉ có quyền đọc – cần quyền Contents: Read and write.');
      $('conn').innerHTML = '<span class="ok">✓ Đã kết nối ' + esc(j.full_name) + '</span>';
      return true;
    }).catch(function (e) { $('conn').innerHTML = '<span class="bad">✗ ' + esc(e.message) + '</span>'; return false; });
  }

  /* ---------- đọc file ---------- */
  function preview(data, code) {
    var rows = '';
    [['S', 'SÁNG'], ['C', 'CHIỀU']].forEach(function (b) {
      var n = data.nper[b[0]] || 0;
      for (var p = 1; p <= n; p++) {
        rows += '<tr class="' + (b[0] === 'C' ? 'pm' : '') + '">' + (p === 1 ? '<td class="buoi" rowspan="' + n + '"><span>' + b[1] + '</span></td>' : '') +
          '<td class="tiet">' + p + '</td>' + DAYS.map(function (d) {
            var g = data.grid[b[0]][code], v = g && g[d] && g[d][p];
            return '<td>' + (v ? '<div class="sub">' + esc(v[0]) + '</div>' + (v[1] ? '<div class="who">' + esc(v[1]) + '</div>' : '') : '') + '</td>';
          }).join('') + '</tr>';
      }
    });
    return '<div class="tablewrap"><table class="tkb"><colgroup><col class="c-buoi"><col class="c-tiet">' + DAYS.map(function () { return '<col>'; }).join('') +
      '</colgroup><thead><tr><th>BUỔI</th><th>TIẾT</th>' + DAYS.map(function (d) { return '<th>THỨ ' + d + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function onFile() {
    var f = $('file').files[0];
    $('parsed').innerHTML = ''; $('log').innerHTML = ''; cur = null; setBtns();
    if (!f) return;
    $('parsed').innerHTML = '<p class="hint">Đang đọc file…</p>';
    f.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      var p = P.parseWorkbook(XLSX, wb);
      var nCls = Object.keys(p.classes).length;
      if (!nCls) throw new Error(p.warnings.join(' ') || 'Không đọc được thời khóa biểu trong file.');
      if (p.applyDate && !$('ngay').value) $('ngay').value = p.applyDate;
      var data = P.toData(p, {});
      var T = P.teacherIndex(data), nCells = 0;
      ['S', 'C'].forEach(function (b) { Object.keys(data.grid[b]).forEach(function (c) { Object.keys(data.grid[b][c]).forEach(function (d) { nCells += Object.keys(data.grid[b][c][d]).length; }); }); });
      // GV trùng tiết (cảnh báo, không chặn)
      var clashes = [];
      Object.keys(T).forEach(function (k) { ['S', 'C'].forEach(function (b) { Object.keys(T[k][b]).forEach(function (d) { Object.keys(T[k][b][d]).forEach(function (pp) {
        var it = T[k][b][d][pp]; if (it.length > 1) clashes.push(k + ' – Thứ ' + d + ' ' + (b === 'S' ? 'sáng' : 'chiều') + ' tiết ' + pp + ': ' + it.map(function (x) { return x[1]; }).join(', '));
      }); }); }); });
      cur = { data: data, buf: new Uint8Array(buf), name: f.name, label: p.label };
      var opts = data.classes.map(function (c) { return '<option>' + esc(c.code) + '</option>'; }).join('');
      $('parsed').innerHTML =
        '<div class="sum"><div><b>' + nCls + '</b>lớp</div><div><b>' + Object.keys(T).length + '</b>giáo viên</div><div><b>' + nCells + '</b>ô có tiết học</div>' +
        '<div><b>' + data.nper.S + ' / ' + data.nper.C + '</b>tiết sáng / chiều</div><div><b>' + (p.applyDate ? vnDate(p.applyDate) : '—') + '</b>ngày ghi trong file</div></div>' +
        '<p class="hint">Sheet đã đọc: ' + esc(p.sheetsUsed.join(', ')) + (p.dirSheets ? ' · Tra họ tên GV từ: ' + esc(p.dirSheets.join(', ')) : ' · (không có sheet phân công – GV hiển thị theo tên viết tắt)') + (p.label ? ' · ' + esc(p.label) : '') + '</p>' +
        p.warnings.map(function (w) { return '<div class="msg warn">' + esc(w) + '</div>'; }).join('') +
        (clashes.length ? '<div class="msg warn"><b>Giáo viên trùng tiết (' + clashes.length + '):</b><br>' + clashes.slice(0, 15).map(esc).join('<br>') + (clashes.length > 15 ? '<br>…' : '') + '</div>' : '') +
        '<div class="row"><b>Xem thử lớp:</b> <select id="pvc" class="btn ghost sm">' + opts + '</select></div><div id="pv" style="margin-top:10px"></div>';
      var show = function () { $('pv').innerHTML = preview(data, $('pvc').value); };
      $('pvc').addEventListener('change', show); show();
      setBtns();
    }).catch(function (e) { $('parsed').innerHTML = '<div class="msg err">Lỗi đọc file: ' + esc(e.message) + '</div>'; });
  }
  function setBtns() { var ok = !!cur && /^\d{4}-\d{2}-\d{2}$/.test($('ngay').value); $('publish').disabled = !ok; $('dl').disabled = !ok; }

  function buildPayload(idx) {
    var date = $('ngay').value, now = new Date().toISOString();
    var meta = { date: date, label: cur.label || '', note: $('note').value.trim(), source: cur.name, uploaded: now };
    var data = JSON.parse(JSON.stringify(cur.data)); data.meta = meta;
    idx = idx || { versions: [] };
    idx.versions = (idx.versions || []).filter(function (v) { return v.date !== date; });
    var entry = { date: date, file: 'tkb/' + date + '.json', label: meta.label, note: meta.note, source: cur.name, uploaded: now };
    if ($('keep').checked) entry.xlsx = 'xlsx/' + date + '.xlsx';
    idx.versions.push(entry);
    idx.versions.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return { date: date, data: data, idx: idx, entry: entry };
  }

  function publish() {
    $('log').innerHTML = ''; $('publish').disabled = true;
    var date = $('ngay').value;
    checkConn().then(function (ok) {
      if (!ok) throw new Error('Chưa kết nối được GitHub (mục 1).');
      return readIndexRemote();
    }).then(function (idx) {
      if ((idx.versions || []).some(function (v) { return v.date === date; }) &&
          !confirm('Đã có thời khóa biểu áp dụng từ ' + vnDate(date) + '. Ghi đè?')) throw new Error('Đã hủy.');
      var pl = buildPayload(idx), msg = 'TKB áp dụng từ ' + vnDate(date) + (pl.entry.note ? ' – ' + pl.entry.note : '');
      log('Đang tải dữ liệu thời khóa biểu…');
      var chain = putFile('data/tkb/' + date + '.json', strToB64(JSON.stringify(pl.data)), msg).then(function () { log('✓ data/tkb/' + date + '.json', 'ok'); });
      if (pl.entry.xlsx) chain = chain.then(function () { log('Đang lưu file Excel gốc…'); return putFile('data/' + pl.entry.xlsx, bytesToB64(cur.buf), msg + ' (file gốc)'); })
                                     .then(function () { log('✓ data/' + pl.entry.xlsx, 'ok'); });
      return chain.then(function () { return putFile('data/index.json', strToB64(JSON.stringify(pl.idx, null, 2)), msg + ' (danh sách)'); })
        .then(function () {
          log('✓ data/index.json', 'ok');
          log('<b class="ok">Đăng xong.</b> GitHub Pages cập nhật sau khoảng 1–2 phút; giáo viên và học sinh tải lại trang là thấy ngày ' + vnDate(date) + '.');
          renderVersions(pl.idx);
        });
    }).catch(function (e) { log('✗ ' + esc(e.message), 'bad'); }).then(setBtns);
  }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function downloadLocal() {
    fetch('data/index.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { versions: [] }; })
      .catch(function () { return { versions: [] }; }).then(function (idx) {
        $('keep').checked = false;
        var pl = buildPayload(idx);
        download(pl.date + '.json', JSON.stringify(pl.data));
        setTimeout(function () { download('index.json', JSON.stringify(pl.idx, null, 2)); }, 400);
        $('log').innerHTML = '<div class="msg">Đã tải 2 file. Trên GitHub: đưa <b>' + pl.date + '.json</b> vào thư mục <b>data/tkb/</b> và thay file <b>data/index.json</b> bằng file <b>index.json</b> vừa tải.</div>';
      });
  }

  /* ---------- danh sách phiên bản ---------- */
  function renderVersions(idx) {
    var vs = (idx && idx.versions) || [];
    if (!vs.length) { $('versions').innerHTML = '<p class="hint">Chưa có.</p>'; return; }
    $('versions').innerHTML = '<div class="tablewrap"><table class="list"><thead><tr><th>Ngày áp dụng</th><th>Lần</th><th>Ghi chú</th><th>File gốc</th><th>Đăng lúc</th><th></th></tr></thead><tbody>' +
      vs.map(function (v) {
        return '<tr><td><b>' + vnDate(v.date) + '</b></td><td>' + esc(v.label || '') + '</td><td>' + esc(v.note || '') + '</td><td>' +
          (v.xlsx ? '<a href="data/' + esc(v.xlsx) + '">' + esc(v.source || 'xlsx') + '</a>' : esc(v.source || '')) + '</td><td>' +
          (v.uploaded ? new Date(v.uploaded).toLocaleString('vi-VN') : '') + '</td><td><a href="./?ngay=' + v.date + '">Xem</a> · ' +
          '<a href="#" data-del="' + v.date + '" class="bad">Xóa</a></td></tr>';
      }).join('') + '</tbody></table></div>';
    $('versions').querySelectorAll('[data-del]').forEach(function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); removeVersion(a.dataset.del); });
    });
  }
  function removeVersion(date) {
    if (!confirm('Xóa thời khóa biểu áp dụng từ ' + vnDate(date) + '? (Giáo viên, học sinh sẽ không xem được bản này nữa)')) return;
    var msg = 'Xóa TKB áp dụng từ ' + vnDate(date);
    checkConn().then(function (ok) {
      if (!ok) throw new Error('Chưa kết nối được GitHub (mục 1).');
      return readIndexRemote();
    }).then(function (idx) {
      var v = (idx.versions || []).filter(function (x) { return x.date === date; })[0];
      idx.versions = (idx.versions || []).filter(function (x) { return x.date !== date; });
      return putFile('data/index.json', strToB64(JSON.stringify(idx, null, 2)), msg)
        .then(function () { return v ? delFile('data/' + v.file, msg) : null; })
        .then(function () { return v && v.xlsx ? delFile('data/' + v.xlsx, msg) : null; })
        .then(function () { renderVersions(idx); alert('Đã xóa. Trang sẽ cập nhật sau 1–2 phút.'); });
    }).catch(function (e) { alert('Lỗi: ' + e.message); });
  }

  initConn();
  $('save').addEventListener('click', checkConn);
  $('forget').addEventListener('click', function () { ls('token', null); $('token').value = ''; $('conn').textContent = 'Đã xóa token.'; });
  $('file').addEventListener('change', onFile);
  $('ngay').addEventListener('input', setBtns);
  $('publish').addEventListener('click', publish);
  $('dl').addEventListener('click', downloadLocal);
  fetch('data/index.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(renderVersions)
    .catch(function () { $('versions').innerHTML = '<p class="hint">Chưa có dữ liệu.</p>'; });
})();
