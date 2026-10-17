/* Trang xem thời khóa biểu (giáo viên / lớp) + chuyển sang tab quản trị */
(function () {
  'use strict';
  var CFG = window.TKB_CONFIG || {}, P = window.TKBParser, R = window.TKB;
  var $ = function (id) { return document.getElementById(id); };
  var esc = R.esc, vnDate = R.vnDate;
  var S = { tab: 'gv', date: null, defDate: null, who: null, versions: [], data: null, T: null, cache: {} };
  var combo;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem('tkb.' + k); localStorage.setItem('tkb.' + k, v); } catch (e) { return null; } }
  function getJSON(url) {
    return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Không tải được ' + url + ' (mã ' + r.status + ')'); return r.json(); });
  }
  function lastName(n) { var p = n.replace(/\s*\(.*\)$/, '').split(/[.\s]+/); return p[p.length - 1]; }
  function whoKey() { return S.tab === 'gv' ? 'gv' : 'lop'; }

  /* ---------- URL ---------- */
  function readURL() {
    var q = new URLSearchParams(location.search), x = q.get('xem');
    S.tab = (x === 'lop' || x === 'gv' || x === 'quantri') ? x : (store('tab') || 'gv');
    if (S.tab === 'quantri' && x !== 'quantri') S.tab = 'gv';
    S.date = q.get('ngay');
    if (S.tab !== 'quantri') S.who = q.get(whoKey()) || store(whoKey());
  }
  function writeURL() {
    var q = new URLSearchParams();
    q.set('xem', S.tab);
    if (S.tab !== 'quantri') {
      if (S.date && S.date !== S.defDate) q.set('ngay', S.date);
      if (S.who) q.set(whoKey(), S.who);
      store('tab', S.tab);
      if (S.who) store(whoKey(), S.who);
    }
    history.replaceState(null, '', '?' + q.toString());
  }

  /* ---------- phiên bản ---------- */
  function currentDate(vs) {
    var t = R.today(), cur = vs.filter(function (v) { return v.date <= t; })[0];
    return cur ? cur.date : vs[vs.length - 1].date;
  }
  function fillDates() {
    var t = R.today();
    $('ngay').innerHTML = S.versions.map(function (v) {
      var tag = v.date > t ? ' (sắp áp dụng)' : (v.date === S.defDate ? ' (đang áp dụng)' : '');
      return '<option value="' + v.date + '">Từ ' + vnDate(v.date) + tag + '</option>';
    }).join('');
    $('ngay').value = S.date;
  }
  function loadVersion(date) {
    if (S.cache[date]) return Promise.resolve(S.cache[date]);
    var v = S.versions.filter(function (x) { return x.date === date; })[0];
    return getJSON('data/' + v.file).then(function (d) { d._v = v; d._T = P.teacherIndex(d); S.cache[date] = d; return d; });
  }

  /* ---------- danh sách chọn ---------- */
  function options() {
    if (S.tab === 'gv') {
      var T = S.T;
      return Object.keys(T).map(function (k) {
        return { value: k, label: k, hint: R.subj(T[k].main), group: R.subj(T[k].main), keys: T[k].abbr };
      }).sort(function (a, b) {
        return a.group.localeCompare(b.group, 'vi') || lastName(a.label).localeCompare(lastName(b.label), 'vi') || a.label.localeCompare(b.label, 'vi');
      });
    }
    return S.data.classes.map(function (c) {
      return { value: c.code, label: c.code, hint: R.clsName(c.code), group: 'Khối ' + c.khoi, keys: c.gvcn };
    });
  }

  /* ---------- hiển thị ---------- */
  function setHead(kind, name, facts, placeholder) {
    $('kind').textContent = kind;
    $('name').textContent = name;
    $('name').classList.toggle('placeholder', !!placeholder);
    $('facts').innerHTML = (facts || []).map(function (f) { return '<span>' + f + '</span>'; }).join('');
  }
  function render() {
    var d = S.data, isGV = S.tab === 'gv';
    $('below').hidden = true;
    if (!S.who) {
      setHead(isGV ? 'Thời khóa biểu giáo viên' : 'Thời khóa biểu lớp', isGV ? 'Chọn giáo viên' : 'Chọn lớp', [], true);
      $('out').innerHTML = '<div class="sheet"><div class="empty"><b>' + (isGV ? 'Thầy cô gõ tên mình vào ô tìm kiếm' : 'Chọn lớp ở ô bên phải') +
        '</b>Gõ không dấu cũng được, ví dụ “' + (isGV ? 'xuan' : '11 tin') + '”.</div></div>';
      document.title = 'Thời khóa biểu';
      return;
    }
    var thu = new Date().getDay() + 1, isCur = S.date === S.defDate;
    var tt = R.timetable(d, S.T, S.tab, S.who, { today: isCur && thu >= 2 && thu <= 7 ? thu : null });
    var facts = ['Áp dụng từ <b>' + vnDate(S.date) + '</b>'];
    if (isGV) {
      var t = S.T[S.who], cls = {}, days = {};
      ['S', 'C'].forEach(function (b) { Object.keys(t[b]).forEach(function (x) { days[x] = 1; Object.keys(t[b][x]).forEach(function (p) { t[b][x][p].forEach(function (z) { cls[z[1]] = 1; }); }); }); });
      var off = R.DAYS.filter(function (x) { return !days[x]; });
      facts.push('<b>' + t.total + '</b> tiết mỗi tuần');
      facts.push('Lớp: <b>' + esc(Object.keys(cls).join(', ')) + '</b>');
      if (off.length) facts.push('Nghỉ: <b>' + off.map(function (x) { return 'Thứ ' + x; }).join(', ') + '</b>');
      setHead('Giáo viên ' + R.subj(t.main), S.who, facts);
    } else {
      var c = d.classes.filter(function (x) { return x.code === S.who; })[0];
      if (c && c.gvcn) facts.push('Chủ nhiệm: <b>' + esc(c.gvcn) + '</b>');
      facts.push('<b>' + tt.total + '</b> tiết mỗi tuần');
      setHead('Thời khóa biểu lớp', 'Lớp ' + R.clsName(S.who), facts);
    }
    document.title = (isGV ? S.who : 'Lớp ' + S.who) + ' – Thời khóa biểu';
    $('out').innerHTML = tt.html;
    $('legend').innerHTML = tt.legend;
    $('below').hidden = false;
  }

  function show() {
    return loadVersion(S.date).then(function (d) {
      S.data = d; S.T = d._T;
      combo.set(options(), S.who);
      if (S.who && !combo.value(S.who)) {
        var missing = S.who; S.who = null; render();
        $('out').insertAdjacentHTML('afterbegin', '<div class="note warn">Không có <b>' + esc(missing) + '</b> trong thời khóa biểu áp dụng từ ' + vnDate(S.date) + '.</div>');
      } else render();
      writeURL();
    }).catch(function (e) { $('out').innerHTML = '<div class="note err">' + esc(e.message) + '</div>'; });
  }

  function setTab(tab) {
    S.tab = tab;
    document.querySelectorAll('.nav a').forEach(function (a) {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var admin = tab === 'quantri';
    $('view').hidden = admin; $('admin').hidden = !admin;
    if (admin) { document.title = 'Quản trị – Thời khóa biểu'; writeURL(); window.TKBAdmin.mount($('admin'), { reload: reloadIndex }); return; }
    $('timLabel').textContent = tab === 'gv' ? 'Giáo viên' : 'Lớp';
    combo.placeholder(tab === 'gv' ? 'Gõ tên giáo viên…' : 'Gõ tên lớp…');
  }

  function reloadIndex() {
    S.cache = {};
    return getJSON('data/index.json').then(function (idx) {
      S.versions = (idx.versions || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
      return S.versions;
    });
  }

  function init() {
    if (CFG.schoolName) $('school').textContent = CFG.schoolName;
    $('year').textContent = 'Thời khóa biểu năm học ' + (CFG.schoolYear || '');
    combo = new R.Combo($('tim'), $('timList'), function (v) { S.who = v; writeURL(); render(); });
    readURL(); setTab(S.tab);
    reloadIndex().then(function (vs) {
      if (!vs.length) { setHead('Thời khóa biểu', 'Chưa có thời khóa biểu', [], true); $('out').innerHTML = '<div class="sheet"><div class="empty"><b>Chưa có bản nào được đăng</b>Vào tab Quản trị để tải file Excel lên.</div></div>'; return; }
      S.defDate = currentDate(vs);
      if (!S.date || !vs.some(function (v) { return v.date === S.date; })) S.date = S.defDate;
      fillDates();
      if (S.tab !== 'quantri') show();
    }).catch(function (e) { $('out').innerHTML = '<div class="note err">' + esc(e.message) + '</div>'; });

    $('ngay').addEventListener('change', function () { S.date = this.value; show(); });
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (a.dataset.tab === S.tab) return;
        setTab(a.dataset.tab);
        if (S.tab === 'quantri') return;
        S.who = store(whoKey());
        if (!S.versions.length) return;
        var d0 = S.defDate; S.defDate = currentDate(S.versions);
        if (!S.date || S.date === d0 || !S.versions.some(function (v) { return v.date === S.date; })) S.date = S.defDate;
        fillDates(); show();
      });
    });
    $('copy').addEventListener('click', function () {
      var span = this.querySelector('span'), done = function () { span.textContent = 'Đã sao chép'; setTimeout(function () { span.textContent = 'Sao chép link'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { prompt('Link:', location.href); });
      else prompt('Link:', location.href);
    });
  }
  init();
})();
