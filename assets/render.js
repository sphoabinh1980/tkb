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
   * Bảng kiểu truyền thống: cột Buổi (chữ dọc) – Tiết – Thứ 2..7.
   * Ô: môn (chữ đậm) + tên GV viết tắt / lớp (chữ đỏ). Buổi chiều nền xám.
   */
  function schoolPeriods(data, b) {
    var g = data.grid[b] || {}, mx = 0;
    Object.keys(g).forEach(function (c) { Object.keys(g[c]).forEach(function (d) { Object.keys(g[c][d]).forEach(function (p) { if (+p > mx) mx = +p; }); }); });
    return mx;
  }
  function cell(data, T, mode, who, b, d, p) {
    if (mode === 'gv') {
      var t = T[who], x = t && t[b][d] && t[b][d][p];
      if (!x) return '';
      return '<div class="sub" title="' + esc(subj(x[0][0])) + '">' + esc(x[0][0]) + '</div><div class="who">' + esc(x.map(function (z) { return z[1]; }).join(', ')) + '</div>';
    }
    var g = data.grid[b][who], v = g && g[d] && g[d][p];
    if (!v) return '';
    return '<div class="sub" title="' + esc(subj(v[0]) + (v[2] ? ' – ' + v[2] : '')) + '">' + esc(v[0]) + '</div>' + (v[1] ? '<div class="who">' + esc(v[1]) + '</div>' : '');
  }
  function timetable(data, T, mode, who) {
    var total = 0, rows = '';
    [['S', 'SÁNG', Math.max(data.nper.S || 5, 1)], ['C', 'CHIỀU', Math.max(schoolPeriods(data, 'C'), 2)]].forEach(function (bb) {
      for (var p = 1; p <= bb[2]; p++) {
        rows += '<tr class="' + (bb[0] === 'C' ? 'pm' : 'am') + '">' +
          (p === 1 ? '<td class="buoi" rowspan="' + bb[2] + '"><span>' + bb[1] + '</span></td>' : '') + '<td class="tiet">' + p + '</td>';
        DAYS.forEach(function (d) { var h = cell(data, T, mode, who, bb[0], d, p); if (h) total++; rows += '<td>' + h + '</td>'; });
        rows += '</tr>';
      }
    });
    var html = '<div class="tablewrap"><table class="tkb"><colgroup><col class="c-buoi"><col class="c-tiet">' +
      DAYS.map(function () { return '<col>'; }).join('') + '</colgroup><thead><tr><th>BUỔI</th><th>TIẾT</th>' +
      DAYS.map(function (d) { return '<th>THỨ ' + d + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    return { html: html, legend: '', total: total };
  }

  /* Hộp chọn: bấm vào hiện toàn bộ danh sách, gõ để lọc (gõ không dấu vẫn tìm được) */
  function Combo(input, list, onPick) {
    var opts = [], shown = [], act = -1, self = this, value = null, typed = false;
    var wrap = input.parentNode;
    var tog = document.createElement('button');
    tog.type = 'button'; tog.className = 'combo-tog'; tog.tabIndex = -1; tog.setAttribute('aria-label', 'Mở danh sách');
    tog.innerHTML = '<svg viewBox="0 0 12 8" width="12" height="8" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 1.5l5 5 5-5"/></svg>';
    wrap.appendChild(tog);
    function label(o) { return o ? o.label + (o.hint ? ' – ' + o.hint : '') : ''; }
    function draw(scrollToAct) {
      var q = typed ? fold(input.value.trim()) : '', html = '', g = null;
      shown = opts.filter(function (o) { return !q || o._f.indexOf(q) >= 0; });
      if (!shown.length) html = '<div class="combo-empty">Không tìm thấy “' + esc(input.value) + '”</div>';
      shown.forEach(function (o, i) {
        if (o.group !== g) { g = o.group; html += '<div class="combo-group">' + esc(g) + '</div>'; }
        html += '<div class="combo-opt' + (value && o.value === value.value ? ' cur' : '') + '" role="option" data-i="' + i + '" aria-selected="' + (i === act) + '"><span>' + esc(o.label) + '</span>' + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</div>';
      });
      list.innerHTML = html;
      if (scrollToAct !== false) { var a = list.querySelector('[aria-selected="true"]') || list.querySelector('.cur'); if (a) a.scrollIntoView({ block: 'nearest' }); }
    }
    function open() {
      if (list.hidden) { typed = false; act = value ? opts.indexOf(value) : -1; }
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); wrap.classList.add('open'); draw();
    }
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); wrap.classList.remove('open'); act = -1; typed = false; input.value = label(value); }
    function pick(o) { value = o; input.value = label(o); list.hidden = true; wrap.classList.remove('open'); typed = false; input.blur(); onPick(o.value); }
    input.addEventListener('focus', function () { input.select(); open(); });
    input.addEventListener('click', function () { if (list.hidden) open(); });
    input.addEventListener('input', function () { typed = true; act = 0; open(); });
    tog.addEventListener('mousedown', function (e) { e.preventDefault(); if (list.hidden) { input.focus(); open(); } else close(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { if (list.hidden) open(); act = Math.min(act + 1, shown.length - 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { var o = shown[act] || (shown.length === 1 && shown[0]); if (o) pick(o); e.preventDefault(); }
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
