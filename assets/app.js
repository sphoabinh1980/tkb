(function () {
  'use strict';
  var CFG = window.TKB_CONFIG || {}, P = window.TKBParser;
  var DAYS = [2, 3, 4, 5, 6, 7];
  var $ = function (id) { return document.getElementById(id); };
  var state = { tab: 'gv', date: null, who: null, versions: [], data: null, T: null, cache: {} };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function vnDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('tkb.' + k); localStorage.setItem('tkb.' + k, v); } catch (e) { return null; } }
  function subjName(s) { return (P.SUBJECTS[s] || s); }
  function lastName(gv) { var p = gv.replace(/\s*\(.*\)$/, '').split(/[.\s]+/); return p[p.length - 1]; }

  function getJSON(url) {
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); });
  }

  /* ---------- tham số URL ---------- */
  function readURL() {
    var q = new URLSearchParams(location.search);
    state.tab = q.get('xem') === 'lop' ? 'lop' : (q.get('xem') === 'gv' ? 'gv' : (store('tab') || 'gv'));
    state.date = q.get('ngay');
    state.who = q.get(state.tab === 'gv' ? 'gv' : 'lop') || store(state.tab === 'gv' ? 'gv' : 'lop');
  }
  function writeURL() {
    var q = new URLSearchParams();
    q.set('xem', state.tab);
    if (state.date && state.date !== state.defDate) q.set('ngay', state.date);   // link luôn trỏ bản đang áp dụng
    if (state.who) q.set(state.tab === 'gv' ? 'gv' : 'lop', state.who);
    history.replaceState(null, '', '?' + q.toString());
    store('tab', state.tab);
    if (state.who) store(state.tab === 'gv' ? 'gv' : 'lop', state.who);
  }

  /* ---------- phiên bản (ngày áp dụng) ---------- */
  function pickDefaultDate() {
    var t = today(), vs = state.versions;
    if (state.date && vs.some(function (v) { return v.date === state.date; })) return state.date;
    var cur = vs.filter(function (v) { return v.date <= t; })[0];      // versions xếp giảm dần
    return cur ? cur.date : vs[vs.length - 1].date;
  }
  function fillDates() {
    var t = today(), curSet = false, sel = $('ngay');
    sel.innerHTML = state.versions.map(function (v) {
      var tag = '';
      if (v.date > t) tag = ' (sắp áp dụng)';
      else if (!curSet) { tag = ' (đang áp dụng)'; curSet = true; }
      return '<option value="' + v.date + '">' + vnDate(v.date) + tag + '</option>';
    }).join('');
    sel.value = state.date;
  }

  function loadVersion(date) {
    var v = state.versions.filter(function (x) { return x.date === date; })[0];
    if (state.cache[date]) return Promise.resolve(state.cache[date]);
    return getJSON('data/' + v.file).then(function (d) { d._v = v; state.cache[date] = d; return d; });
  }

  /* ---------- danh sách chọn ---------- */
  function fillWho() {
    var sel = $('ai'), d = state.data, html = '';
    if (state.tab === 'gv') {
      var T = state.T, groups = {};
      Object.keys(T).forEach(function (k) { var m = T[k].main; (groups[m] = groups[m] || []).push(k); });
      var order = Object.keys(groups).sort(function (a, b) { return subjName(a).localeCompare(subjName(b), 'vi'); });
      html = '<option value="">— Chọn giáo viên —</option>' + order.map(function (m) {
        var list = groups[m].sort(function (a, b) { return lastName(a).localeCompare(lastName(b), 'vi') || a.localeCompare(b, 'vi'); });
        return '<optgroup label="' + esc(subjName(m)) + '">' + list.map(function (k) {
          return '<option value="' + esc(k) + '">' + esc(subjName(m)) + ' – ' + esc(k) + '</option>';
        }).join('') + '</optgroup>';
      }).join('');
    } else {
      var byK = {};
      d.classes.forEach(function (c) { (byK[c.khoi] = byK[c.khoi] || []).push(c); });
      html = '<option value="">— Chọn lớp —</option>' + Object.keys(byK).sort().map(function (k) {
        return '<optgroup label="Khối ' + k + '">' + byK[k].map(function (c) {
          return '<option value="' + esc(c.code) + '">' + esc(c.code) + '</option>';
        }).join('') + '</optgroup>';
      }).join('');
    }
    sel.innerHTML = html;
    var ok = Array.prototype.some.call(sel.options, function (o) { return o.value === state.who; });
    sel.value = ok ? state.who : '';
    return ok;
  }

  /* ---------- bảng ---------- */
  function usedPeriods(b) {        // số tiết thực sự có dạy trong buổi (toàn trường)
    var g = state.data.grid[b] || {}, mx = 0;
    Object.keys(g).forEach(function (c) { Object.keys(g[c]).forEach(function (d) {
      Object.keys(g[c][d]).forEach(function (p) { if (+p > mx) mx = +p; }); }); });
    return mx;
  }
  function cellHTML(items) {
    if (!items || !items.length) return '';
    return items.map(function (it) {
      return '<div class="multi" title="' + esc(subjName(it[0]) + (it[2] ? ' – ' + it[2] : '')) + '"><div class="sub">' + esc(it[0]) + '</div>' +
             (it[1] ? '<div class="who">' + esc(it[1]) + '</div>' : '') + '</div>';
    }).join('');
  }
  function lookup(b, d, p) {
    if (state.tab === 'gv') {
      var t = state.T[state.who]; return t && t[b][d] && t[b][d][p];
    }
    var g = state.data.grid[b][state.who], v = g && g[d] && g[d][p];
    return v ? [v] : null;
  }
  function render() {
    var out = $('out'), d = state.data;
    if (!state.who) { out.innerHTML = '<div class="msg">Chọn ' + (state.tab === 'gv' ? 'giáo viên' : 'lớp') + ' rồi bấm <b>Tìm kiếm</b>.</div>'; return; }
    var rows = '', bs = [['S', 'SÁNG', Math.max(usedPeriods('S'), 1)], ['C', 'CHIỀU', Math.max(usedPeriods('C'), 2)]];
    bs.forEach(function (bb) {
      for (var p = 1; p <= bb[2]; p++) {
        rows += '<tr class="' + (bb[0] === 'C' ? 'pm' : 'am') + '">' +
          (p === 1 ? '<td class="buoi" rowspan="' + bb[2] + '"><span>' + bb[1] + '</span></td>' : '') +
          '<td class="tiet">' + p + '</td>' +
          DAYS.map(function (dd) { return '<td>' + cellHTML(lookup(bb[0], dd, p)) + '</td>'; }).join('') + '</tr>';
      }
    });
    var info = [];
    var v = d._v;
    info.push('Áp dụng từ: <b>' + vnDate(v.date) + '</b>' + (v.label ? ' · ' + esc(v.label) : ''));
    if (state.tab === 'gv') {
      var t = state.T[state.who];
      var subs = Object.keys(t.subjects).map(function (s) { return subjName(s) + ' ' + t.subjects[s]; }).join(', ');
      if (t.abbr && t.abbr !== state.who) info.push('Tên trên TKB: <b>' + esc(t.abbr) + '</b>');
      info.push('Tổng: <b>' + t.total + ' tiết/tuần</b> (' + esc(subs) + ')');
      var cls = {}; ['S', 'C'].forEach(function (b) { Object.keys(t[b]).forEach(function (dd) { Object.keys(t[b][dd]).forEach(function (p) { t[b][dd][p].forEach(function (x) { cls[x[1]] = 1; }); }); }); });
      info.push('Lớp dạy: <b>' + esc(Object.keys(cls).join(', ')) + '</b>');
    } else {
      var c = d.classes.filter(function (x) { return x.code === state.who; })[0];
      if (c && c.gvcn) info.push('GVCN: <b>' + esc(c.gvcn) + '</b>');
    }
    out.innerHTML = '<div class="tablewrap"><table class="tkb"><colgroup><col class="c-buoi"><col class="c-tiet">' +
      DAYS.map(function () { return '<col>'; }).join('') + '</colgroup><thead><tr><th>BUỔI</th><th>TIẾT</th>' +
      DAYS.map(function (x) { return '<th>THỨ ' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + rows +
      '</tbody></table></div><div class="info">' + info.map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</div>';
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('on', a.dataset.tab === tab); });
    $('title').textContent = tab === 'gv' ? 'THỜI KHÓA BIỂU CỦA GIÁO VIÊN' : 'THỜI KHÓA BIỂU CỦA LỚP';
    $('aiLabel').textContent = tab === 'gv' ? 'Giáo viên:' : 'Lớp:';
    document.title = $('title').textContent;
  }

  function show() {
    return loadVersion(state.date).then(function (d) {
      state.data = d; state.T = P.teacherIndex(d);
      var ok = fillWho();
      if (!ok && state.who) {
        $('out').innerHTML = '<div class="msg warn">' + (state.tab === 'gv' ? 'Giáo viên' : 'Lớp') + ' <b>' + esc(state.who) +
          '</b> không có trong thời khóa biểu áp dụng từ ' + vnDate(state.date) + '.</div>';
        state.who = null; writeURL(); return;
      }
      writeURL(); render();
    }).catch(function (e) { $('out').innerHTML = '<div class="msg err">Không tải được dữ liệu: ' + esc(e.message) + '</div>'; });
  }

  function init() {
    if (CFG.schoolName) $('school').textContent = CFG.schoolName;
    if (CFG.schoolYear) $('year').textContent = 'Thời khóa biểu năm học ' + CFG.schoolYear;
    readURL(); setTab(state.tab);
    getJSON('data/index.json').then(function (idx) {
      state.versions = (idx.versions || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
      if (!state.versions.length) { $('out').innerHTML = '<div class="msg">Chưa có thời khóa biểu nào được đăng.</div>'; return; }
      var want = state.date; state.date = null; state.defDate = pickDefaultDate(); state.date = want; state.date = pickDefaultDate(); fillDates(); show();
    }).catch(function (e) { $('out').innerHTML = '<div class="msg err">Không tải được danh sách thời khóa biểu: ' + esc(e.message) + '</div>'; });

    $('ngay').addEventListener('change', function () { state.date = this.value; show(); });
    $('ai').addEventListener('change', function () { state.who = this.value || null; writeURL(); render(); });
    $('tim').addEventListener('click', function () { state.who = $('ai').value || null; writeURL(); render(); });
    document.querySelectorAll('.tabs a').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (a.dataset.tab === state.tab) return;
        setTab(a.dataset.tab);
        state.who = store(state.tab === 'gv' ? 'gv' : 'lop');
        if (state.data) show();
      });
    });
    $('copy').addEventListener('click', function () {
      var b = this, done = function () { b.textContent = 'Đã sao chép ✓'; setTimeout(function () { b.textContent = 'Sao chép link'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { prompt('Link:', location.href); });
      else prompt('Link:', location.href);
    });
  }
  init();
})();
