/* Phần hiển thị dùng chung cho trang xem và trang quản trị */
(function () {
  'use strict';
  var DAYS = [2, 3, 4, 5, 6, 7];
  var SHORT = {
    'T': 'Toán', 'L': 'Vật lí', 'H': 'Hóa học', 'S': 'Sinh học', 'V': 'Ngữ văn', 'A': 'Tiếng Anh',
    'N': 'Tiếng Nga', 'P': 'Tiếng Pháp', 'TQ': 'Tiếng Trung', 'SU': 'Lịch sử', 'Đ': 'Địa lí',
    'KTPL': 'KT & Pháp luật', 'Tin': 'Tin học', 'CN': 'Công nghệ', 'QPAN': 'QP – AN', 'GDQP': 'QP – AN',
    'GDTC': 'Thể chất', 'GDĐP': 'GD địa phương', 'TrN': 'Trải nghiệm', 'TrNg': 'Trải nghiệm',
    'Ôn TN': 'Ôn thi TN', 'Nâng cao': 'Nâng cao', 'Ôn HSG Tỉnh': 'Ôn HSG tỉnh'
  };
  var COLORED = { T: 1, L: 1, H: 1, S: 1, V: 1, A: 1, N: 1, P: 1, TQ: 1, SU: 1, 'Đ': 1, KTPL: 1, Tin: 1, CN: 1, QPAN: 1, GDTC: 1, TrN: 1, 'GDĐP': 1 };
  var CLS_NAME = { A1: 'Anh 1', A2: 'Anh 2', T1: 'Toán 1', T2: 'Toán 2', T: 'Toán', L: 'Lý', H: 'Hóa', S: 'Sinh', TIN: 'Tin',
    V1: 'Văn 1', V2: 'Văn 2', V: 'Văn', 'SỬ': 'Sử', 'Đ': 'Địa', P: 'Pháp', N: 'Nga', TQ: 'Trung' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function vnDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function fold(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function subj(s) { return SHORT[s] || s; }
  function clsName(code) { var k = code.slice(0, 2), r = code.slice(2); return k + ' ' + (CLS_NAME[r] || r); }
  function person(v) { return v[2] ? v[2].replace(/\s*\(.*\)$/, '') : (v[1] || ''); }

  /* Ô của một đối tượng (lớp hoặc GV) tại buổi b, thứ d, tiết p -> mảng mục */
  function items(data, T, mode, who, b, d, p) {
    if (mode === 'gv') {
      var t = T[who], x = t && t[b][d] && t[b][d][p];
      return x ? x.map(function (z) { return { s: z[0], top: z[1], sub: subj(z[0]) }; }) : null;
    }
    var g = data.grid[b][who], v = g && g[d] && g[d][p];
    return v ? [{ s: v[0], top: subj(v[0]), sub: person(v), title: v[2] || v[1] }] : null;
  }
  function tileHTML(list, h) {
    if (!list) return '';
    if (list.length > 1 && list.every(function (x) { return x.s === list[0].s; })) {     // 1 GV dạy gộp nhiều lớp
      list = [{ s: list[0].s, top: list.map(function (x) { return x.top; }).join(', '), sub: list[0].sub }];
    }
    return list.map(function (x) {
      var cls = 'tile' + (COLORED[x.s] ? ' s-' + x.s : ' soft');
      return '<div class="' + cls + '"' + (h ? ' style="min-height:' + h + 'px"' : '') + ' title="' + esc(subj(x.s) + (x.title ? ' – ' + x.title : '')) + '">' +
        '<b>' + esc(x.top) + '</b>' + (x.sub ? '<i>' + esc(x.sub) + '</i>' : '') + '</div>';
    }).join('');
  }
  function key(list) { return list ? JSON.stringify(list) : ''; }

  /**
   * Dựng bảng (máy tính) + danh sách theo ngày (điện thoại).
   * opts.today: thứ cần tô sáng (2..7) hoặc null
   */
  function timetable(data, T, mode, who, opts) {
    opts = opts || {};
    var used = {}, total = 0, html = '', mob = {}, sess = [['S', 'Buổi sáng'], ['C', 'Buổi chiều']];
    DAYS.forEach(function (d) { mob[d] = ''; });
    html += '<div class="sheet grid-view"><table class="tt"><colgroup><col class="c-p">' + DAYS.map(function () { return '<col>'; }).join('') + '</colgroup>' +
      '<thead><tr><th>Tiết</th>' + DAYS.map(function (d) {
        return '<th class="day' + (opts.today === d ? ' today' : '') + '">Thứ ' + d + (opts.today === d ? '<span class="dsub">Hôm nay</span>' : '') + '</th>';
      }).join('') + '</tr></thead><tbody>';
    sess.forEach(function (bs, si) {
      var b = bs[0], n = 0, M = {};
      for (var p = 1; p <= (data.nper[b] || 0); p++) DAYS.forEach(function (d) {
        var it = items(data, T, mode, who, b, d, p);
        (M[p] = M[p] || {})[d] = it;
        if (it) { n = Math.max(n, p); total += 1; it.forEach(function (x) { used[x.s] = 1; }); }
      });
      if (b === 'S') n = Math.max(n, data.nper.S || 5);
      var cnt = 0; for (p = 1; p <= n; p++) DAYS.forEach(function (d) { if (M[p][d]) cnt++; });
      html += '<tr class="sess' + (si === 0 ? ' first' : '') + '"><td colspan="7">' + bs[1] + '<span>' + (cnt ? cnt + ' tiết' : 'Không có tiết') + '</span></td></tr>';
      // gộp các tiết liền nhau giống nhau
      var span = {}, skip = {};
      DAYS.forEach(function (d) {
        for (var p = 1; p <= n; p++) {
          if (skip[p + '|' + d] || !M[p][d]) continue;
          var k = key(M[p][d]), q = p + 1;
          while (q <= n && key(M[q][d]) === k) { skip[q + '|' + d] = 1; q++; }
          span[p + '|' + d] = q - p;
        }
      });
      for (p = 1; p <= n; p++) {
        html += '<tr><td class="p">' + p + '</td>';
        DAYS.forEach(function (d) {
          if (skip[p + '|' + d]) return;
          var s = span[p + '|' + d] || 1, td = opts.today === d ? ' class="today"' : '';
          html += '<td' + td + (s > 1 ? ' rowspan="' + s + '"' : '') + '>' + tileHTML(M[p][d], s > 1 ? s * 64 - 9 : 0) + '</td>';
        });
        html += '</tr>';
      }
      // danh sách theo ngày
      DAYS.forEach(function (d) {
        var rows = '';
        for (var p = 1; p <= n; p++) {
          if (skip[p + '|' + d] || !M[p][d]) continue;
          var s = span[p + '|' + d] || 1;
          rows += '<div class="drow"><span class="pl">Tiết ' + p + (s > 1 ? '–' + (p + s - 1) : '') + '</span>' + tileHTML(M[p][d]) + '</div>';
        }
        if (rows) mob[d] += '<div class="dsess">' + bs[1] + '</div>' + rows;
      });
    });
    html += '</tbody></table></div><div class="days">' + DAYS.map(function (d) {
      var t = opts.today === d;
      return '<div class="dcard' + (t ? ' today' : '') + '"><h3>Thứ ' + d + (t ? '<small>Hôm nay</small>' : '') + '</h3>' +
        (mob[d] || '<div class="dnone">Không có tiết</div>') + '</div>';
    }).join('') + '</div>';
    var legend = Object.keys(used).filter(function (s) { return COLORED[s]; })
      .sort(function (a, b) { return subj(a).localeCompare(subj(b), 'vi'); })
      .map(function (s) { return '<span class="s-' + s + '">' + esc(subj(s)) + '</span>'; }).join('');
    return { html: html, legend: legend, total: total };
  }

  /* Hộp chọn có tìm kiếm (gõ không dấu vẫn tìm được) */
  function Combo(input, list, onPick) {
    var opts = [], shown = [], act = -1, self = this, value = null;
    function label(o) { return o ? o.label : ''; }
    function draw() {
      var q = fold(input.value.trim()), html = '', g = null;
      shown = opts.filter(function (o) { return !q || o._f.indexOf(q) >= 0; });
      if (!shown.length) html = '<div class="combo-empty">Không tìm thấy “' + esc(input.value) + '”</div>';
      shown.forEach(function (o, i) {
        if (o.group !== g) { g = o.group; html += '<div class="combo-group">' + esc(g) + '</div>'; }
        html += '<div class="combo-opt" role="option" data-i="' + i + '" aria-selected="' + (i === act) + '"><span>' + esc(o.label) + '</span>' + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</div>';
      });
      list.innerHTML = html;
      var a = list.querySelector('[aria-selected="true"]'); if (a) a.scrollIntoView({ block: 'nearest' });
    }
    function open() { list.hidden = false; input.setAttribute('aria-expanded', 'true'); draw(); }
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); act = -1; input.value = label(value); }
    function pick(o) { value = o; input.value = label(o); list.hidden = true; input.blur(); onPick(o.value); }
    input.addEventListener('focus', function () { input.select(); act = -1; open(); });
    input.addEventListener('input', function () { act = 0; open(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { act = Math.min(act + 1, shown.length - 1); open(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); open(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (shown[act] || shown.length === 1) pick(shown[act] || shown[0]); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); input.blur(); }
    });
    list.addEventListener('mousedown', function (e) {
      var el = e.target.closest('.combo-opt'); if (!el) return;
      e.preventDefault(); pick(shown[+el.dataset.i]);
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (!list.hidden) close(); }, 120); });
    self.set = function (list_, val) {
      opts = list_.map(function (o) { o._f = fold(o.label + ' ' + (o.hint || '') + ' ' + (o.keys || '')); return o; });
      self.value(val);
    };
    self.value = function (v) {
      value = opts.filter(function (o) { return o.value === v; })[0] || null;
      input.value = label(value);
      return value;
    };
    self.placeholder = function (t) { input.placeholder = t; };
  }

  window.TKB = { DAYS: DAYS, SHORT: SHORT, esc: esc, vnDate: vnDate, today: today, fold: fold, subj: subj,
                 clsName: clsName, timetable: timetable, Combo: Combo };
})();
