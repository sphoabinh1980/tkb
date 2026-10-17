/*
 * Bộ đọc file Excel thời khóa biểu -> JSON.
 * Dùng chung cho trình duyệt (window.TKBParser) và Node (require).
 *
 * Quy ước file Excel (giống file TKB của trường):
 *  - Mỗi sheet TKB có một hàng tiêu đề chứa ô "Thứ" và ô "Tiết";
 *    các ô còn lại của hàng đó là mã lớp (10T1, 11L, 12A1 ...).
 *  - Vài hàng phía trên có chữ "SÁNG" hoặc "CHIỀU" để biết buổi.
 *  - Hàng ngay trên hàng tiêu đề là giáo viên chủ nhiệm.
 *  - Ô dữ liệu dạng "Môn - Tên GV" (ví dụ "T - N.N.Xuân"); ô không có
 *    dấu " - " (GDTC, Nâng cao, ...) được hiểu là chỉ có môn.
 *  - Cột "Thứ" có thể bị gộp ô: giá trị được kéo xuống các hàng dưới.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TKBParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUBJECTS = {
    'T': 'Toán', 'L': 'Vật lí', 'H': 'Hóa học', 'S': 'Sinh học', 'V': 'Ngữ văn',
    'A': 'Tiếng Anh', 'N': 'Tiếng Nga', 'P': 'Tiếng Pháp', 'TQ': 'Tiếng Trung',
    'SU': 'Lịch sử', 'Đ': 'Địa lí', 'KTPL': 'GD Kinh tế & Pháp luật', 'Tin': 'Tin học',
    'CN': 'Công nghệ', 'QPAN': 'GD Quốc phòng – An ninh', 'GDQP': 'GD Quốc phòng – An ninh',
    'GDTC': 'Giáo dục thể chất', 'GDĐP': 'GD địa phương', 'TrN': 'HĐ trải nghiệm',
    'TrNg': 'HĐ trải nghiệm', 'Ôn TN': 'Ôn thi tốt nghiệp', 'Nâng cao': 'Nâng cao',
    'Ôn HSG Tỉnh': 'Ôn HSG tỉnh'
  };

  function nfc(s) { return s == null ? '' : String(s).normalize('NFC').trim(); }
  function up(s) { return nfc(s).toUpperCase(); }

  function dayNum(v) {
    var m = up(v).match(/TH[ỨU]\s*([2-7])/);
    if (m) return +m[1];
    if (/^[2-7]$/.test(up(v))) return +up(v);
    return null;
  }

  function isClassCode(v) { return /^1[0-2]\s*[A-ZÀ-Ỹa-zà-ỹ0-9]/.test(nfc(v)); }

  function parseCell(v) {
    var s = nfc(v);
    if (!s) return null;
    var i = s.indexOf(' - ');
    if (i < 0) return [s, ''];
    return [s.slice(0, i).trim(), s.slice(i + 3).trim()];
  }

  function findDate(text) {
    var m = nfc(text).match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})/);
    if (!m) return null;
    return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }

  /* ---------- Tra họ tên đầy đủ của giáo viên (không bắt buộc) ----------
   * Nếu file có sheet phân công dạng: Lớp | Môn | Giáo viên  (vd KIEM_TRA_PHAN_CONG),
   * sheet HĐTN có cột "GV theo nguồn chốt", sheet GĐĐP có cột "GV áp dụng hiện tại",
   * thì tên viết tắt trong ô TKB (N.N.Xuân) được đổi sang họ tên đầy đủ.
   * Nhờ vậy 2 thầy cô trùng tên viết tắt (vd P.T.Nga) được tách đúng người.
   */
  var SUBJ_FULL = { 'Toán': 'T', 'Vật lí': 'L', 'Vật lý': 'L', 'Hóa học': 'H', 'Sinh học': 'S', 'Tin học': 'Tin',
    'Ngữ văn': 'V', 'Lịch sử': 'SU', 'Địa lí': 'Đ', 'Địa lý': 'Đ', 'Tiếng Anh': 'A', 'Tiếng Nga': 'N',
    'Tiếng Pháp': 'P', 'Tiếng Trung': 'TQ', 'Công nghệ': 'CN', 'GDKT&PL': 'KTPL', 'GDĐP': 'GDĐP',
    'GDQP-AN': 'QPAN', 'HĐTN': 'TrN', 'GDTC': 'GDTC' };
  var CLS_WORD = { 'Anh1': 'A1', 'Anh2': 'A2', 'Toán1': 'T1', 'Toán2': 'T2', 'Toán': 'T', 'Lý': 'L', 'Hóa': 'H',
    'Sinh': 'S', 'Tin': 'TIN', 'Văn1': 'V1', 'Văn2': 'V2', 'Văn': 'V', 'Sử': 'SỬ', 'Địa': 'Đ', 'Pháp': 'P',
    'Nga': 'N', 'Trung': 'TQ' };
  var KEYMAP = [['òa', 'oà'], ['óa', 'oá'], ['ỏa', 'oả'], ['õa', 'oã'], ['ọa', 'oạ'],
                ['úy', 'uý'], ['ùy', 'uỳ'], ['ủy', 'uỷ'], ['ũy', 'uỹ'], ['ụy', 'uỵ']];
  function nkey(s) { s = nfc(s).replace(/\s+/g, ' '); KEYMAP.forEach(function (m) { s = s.split(m[0]).join(m[1]); }); return s; }
  function abbrOf(full) { var w = nkey(full).split(' '); return w.slice(0, -1).map(function (x) { return x[0]; }).join('.') + '.' + w[w.length - 1]; }
  function clsCode(v) {
    var s = nfc(v), m = s.match(/^(1[0-2])\s+(\S+)$/);
    if (m && CLS_WORD[m[2]]) return m[1] + CLS_WORD[m[2]];
    return s.replace(/\s+/g, '');
  }
  function stripNote(n) { return nfc(n).replace(/\s*\(.*\)\s*$/, ''); }

  function buildDirectory(sheets) {
    var dir = { pc: {}, subjOf: {}, used: [] };
    function add(cls, subj, name) {
      name = stripNote(name);
      if (!cls || !subj || !name || /\d/.test(name)) return;
      var k = cls + '|' + subj;
      (dir.pc[k] = dir.pc[k] || []).indexOf(name) < 0 && dir.pc[k].push(name);
      if (subj !== 'TrN' && subj !== 'GDĐP') (dir.subjOf[name] = dir.subjOf[name] || {})[subj] = 1;
    }
    sheets.forEach(function (sh) {
      var hdr = (sh.rows[0] || []).map(nfc), iL = hdr.indexOf('Lớp');
      if (iL < 0) return;
      var iM = hdr.indexOf('Môn'), iG = hdr.indexOf('Giáo viên'),
          iH = hdr.indexOf('GV theo nguồn chốt'), iD = hdr.indexOf('GV áp dụng hiện tại');
      var kind = (iM >= 0 && iG >= 0) ? 'pc' : iH >= 0 ? 'TrN' : iD >= 0 ? 'GDĐP' : null;
      if (!kind) return;
      dir.used.push(sh.name);
      sh.rows.slice(1).forEach(function (r) {
        if (!r || !r[iL]) return;
        var cls = clsCode(r[iL]);
        if (kind === 'pc') add(cls, SUBJ_FULL[nfc(r[iM])], r[iG]);
        else add(cls, kind, r[kind === 'TrN' ? iH : iD]);
      });
    });
    dir.byAbbr = {};
    Object.keys(dir.pc).forEach(function (k) { dir.pc[k].forEach(function (n) {
      var a = abbrOf(n); (dir.byAbbr[a] = dir.byAbbr[a] || []).indexOf(n) < 0 && dir.byAbbr[a].push(n);
    }); });
    return dir.used.length ? dir : null;
  }

  // Trả về mã người (họ tên đầy đủ; người trùng họ tên dạy 2 môn được tách theo môn) hoặc null
  function resolveTeacher(dir, cls, subj, abbr) {
    var ak = nkey(abbr), m = (dir.pc[cls + '|' + subj] || []).filter(function (n) { return abbrOf(n) === ak; });
    if (m.length !== 1) {
      m = dir.byAbbr[ak] || [];
      if (m.length > 1) {          // nhiều người cùng tên viết tắt: chọn người có dạy lớp này
        m = m.filter(function (n) { return Object.keys(dir.pc).some(function (k) { return k.indexOf(cls + '|') === 0 && dir.pc[k].indexOf(n) >= 0; }); });
      }
    }
    if (m.length !== 1) return null;
    var name = m[0], subs = Object.keys(dir.subjOf[name] || {});
    if (subs.length > 1) {         // 2 người trùng họ tên (dạy môn khác nhau) -> tách theo môn
      var own = subs.indexOf(subj) >= 0 ? subj : subs.filter(function (s) { return (dir.pc[cls + '|' + s] || []).indexOf(name) >= 0; })[0];
      if (own) name += ' (' + (SUBJECTS[own] || own) + ')';
    }
    return name;
  }

  /**
   * sheets: [{name, rows}] với rows là mảng 2 chiều (đã chuẩn hóa ô gộp:
   * chỉ ô đầu có giá trị, như SheetJS trả về).
   */
  function parseRows(sheets) {
    var out = { classes: {}, grid: { S: {}, C: {} }, nper: { S: 0, C: 0 },
                applyDate: null, label: '', warnings: [], sheetsUsed: [] };
    sheets.forEach(function (sh) {
      var rows = sh.rows, h = -1, dc = -1, pc = -1;
      for (var r = 0; r < Math.min(rows.length, 15) && h < 0; r++) {
        var row = rows[r] || [];
        for (var c = 0; c < row.length; c++) {
          if (up(row[c]) === 'THỨ') dc = c;
          if (up(row[c]) === 'TIẾT') pc = c;
        }
        if (dc >= 0 && pc >= 0) h = r; else { dc = -1; pc = -1; }
      }
      if (h < 0) return;
      var hdr = rows[h], gvcnRow = rows[h - 1] || [], cols = [];
      for (c = 0; c < hdr.length; c++) if (c !== dc && c !== pc && isClassCode(hdr[c])) cols.push(c);
      if (cols.length < 2) return;            // không phải sheet TKB (sheet kiểm tra, nhật ký...)
      var head = '';
      for (r = 0; r < h; r++) head += ' ' + (rows[r] || []).map(nfc).join(' ');
      head = up(head);
      var buoi = head.indexOf('SÁNG') >= 0 ? 'S' : head.indexOf('CHIỀU') >= 0 ? 'C' : null;
      if (!buoi) { out.warnings.push('Sheet "' + sh.name + '": không xác định được buổi (SÁNG/CHIỀU) – bỏ qua.'); return; }
      var d = findDate(head);
      if (d && (!out.applyDate || d > out.applyDate)) out.applyDate = d;
      var lm = head.match(/LẦN\s*\d+/);
      if (lm && !out.label) out.label = lm[0].replace(/\s+/, ' ');

      var fresh = cols.filter(function (c) { return !out.grid[buoi][nfc(hdr[c])]; });
      if (!fresh.length) return;              // các lớp đã có từ sheet trước (ví dụ sheet gộp)
      out.sheetsUsed.push(sh.name);
      fresh.forEach(function (c) {
        var code = nfc(hdr[c]);
        out.grid[buoi][code] = {};
        if (!out.classes[code]) out.classes[code] = { code: code, khoi: code.slice(0, 2), gvcn: '' };
        var g = nfc(gvcnRow[c]);
        if (g && !/CHỦ NHIỆM|^TT$/i.test(g)) out.classes[code].gvcn = out.classes[code].gvcn || g;
      });
      var curDay = null;
      for (r = h + 1; r < rows.length; r++) {
        row = rows[r] || [];
        var dv = dayNum(row[dc]);
        if (dv) curDay = dv;
        var p = parseInt(nfc(row[pc]), 10);
        if (!curDay || !(p >= 1 && p <= 10)) continue;
        if (p > out.nper[buoi]) out.nper[buoi] = p;
        fresh.forEach(function (c) {
          var v = parseCell(row[c]);
          if (!v) return;
          var g = out.grid[buoi][nfc(hdr[c])];
          (g[curDay] = g[curDay] || {})[p] = v;
        });
      }
    });
    var dir = buildDirectory(sheets), unres = {};
    if (dir) {
      out.dirSheets = dir.used;
      ['S', 'C'].forEach(function (b) { Object.keys(out.grid[b]).forEach(function (cls) {
        var g = out.grid[b][cls];
        Object.keys(g).forEach(function (d) { Object.keys(g[d]).forEach(function (p) {
          var v = g[d][p];
          if (!v[1]) return;
          var who = resolveTeacher(dir, cls, v[0], v[1]);
          if (who) v.push(who); else unres[v[1]] = 1;
        }); });
      }); });
      var u = Object.keys(unres);
      if (u.length) out.warnings.push('Chưa tra được họ tên đầy đủ (giữ tên viết tắt): ' + u.join(', '));
    }
    var n = Object.keys(out.classes).length;
    if (!n) out.warnings.push('Không tìm thấy sheet TKB nào (cần hàng tiêu đề có "Thứ", "Tiết" và mã lớp).');
    return out;
  }

  function sortClasses(a, b) {
    var ka = a.slice(0, 2), kb = b.slice(0, 2);
    return ka === kb ? 0 : ka < kb ? -1 : 1;
  }

  // Loại tiết KHÔNG đưa lên trang (theo buổi). Ôn TN buổi chiều của khối 12 có thời khóa biểu riêng.
  var SKIP = { C: { 'Ôn TN': 1 } };
  function dropSkipped(grid) {
    var removed = 0;
    Object.keys(SKIP).forEach(function (b) {
      Object.keys(grid[b] || {}).forEach(function (cls) {
        var g = grid[b][cls];
        Object.keys(g).forEach(function (d) {
          Object.keys(g[d]).forEach(function (p) { if (SKIP[b][g[d][p][0]]) { delete g[d][p]; removed++; } });
          if (!Object.keys(g[d]).length) delete g[d];
        });
      });
    });
    return removed;
  }
  /** Chuyển kết quả parseRows -> JSON gọn để lưu */
  function toData(p, meta) {
    p.skipped = dropSkipped(p.grid);
    var order = Object.keys(p.classes);
    order.sort(sortClasses);                 // giữ thứ tự cột trong file, chỉ xếp theo khối
    return {
      version: 1,
      meta: meta || {},
      nper: p.nper,
      classes: order.map(function (k) { return p.classes[k]; }),
      grid: p.grid
    };
  }

  /** Đọc workbook SheetJS */
  function parseWorkbook(XLSX, wb) {
    var sheets = wb.SheetNames.map(function (name) {
      return { name: name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: true }) };
    });
    return parseRows(sheets);
  }

  /** Dựng chỉ mục giáo viên (theo họ tên đầy đủ nếu có, không thì tên viết tắt): gv -> {subjects:{môn:số tiết}, S/C: {day:{per:[[môn, lớp]...]}}, total} */
  function teacherIndex(data) {
    var T = {};
    ['S', 'C'].forEach(function (b) {
      var g = data.grid[b] || {};
      Object.keys(g).forEach(function (cls) {
        Object.keys(g[cls]).forEach(function (d) {
          Object.keys(g[cls][d]).forEach(function (p) {
            var v = g[cls][d][p];
            if (!v || !v[1]) return;
            (v[2] ? [v[2]] : v[1].split(/\s*[,;+]\s*/)).forEach(function (gv) {
              if (!gv) return;
              var t = T[gv] = T[gv] || { name: gv, abbr: v[1], subjects: {}, S: {}, C: {}, total: 0 };
              t.subjects[v[0]] = (t.subjects[v[0]] || 0) + 1;
              ((t[b][d] = t[b][d] || {})[p] = t[b][d][p] || []).push([v[0], cls]);
              t.total++;
            });
          });
        });
      });
    });
    Object.keys(T).forEach(function (k) {
      var t = T[k], best = null;
      var SEC = { 'TrN': 1, 'TrNg': 1, 'GDĐP': 1, 'Ôn TN': 1, 'Nâng cao': 1, 'Ôn HSG Tỉnh': 1 };
      var subs = Object.keys(t.subjects), main = subs.filter(function (s) { return !SEC[s]; });
      (main.length ? main : subs).forEach(function (s) { if (!best || t.subjects[s] > t.subjects[best]) best = s; });
      t.main = best;
    });
    return T;
  }

  return { SUBJECTS: SUBJECTS, parseRows: parseRows, parseWorkbook: parseWorkbook,
           toData: toData, teacherIndex: teacherIndex, findDate: findDate, dropSkipped: dropSkipped, SKIP: SKIP };
});
