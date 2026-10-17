#!/usr/bin/env node
/*
 * Chuyển file Excel TKB thành dữ liệu cho trang web (không cần trang quản trị).
 * Cách dùng:  node tools/build-data.js <file.xlsx> [YYYY-MM-DD] ["ghi chú"]
 *   - Nếu không nhập ngày, lấy ngày ở dòng "Áp dụng: Từ ngày ..." trong file.
 *   - Ghi data/tkb/<ngày>.json và cập nhật data/index.json.
 * Cần: npm i xlsx
 */
const fs = require('fs'), path = require('path');
const XLSX = require('xlsx');
const P = require('../assets/parser.js');

const [file, dateArg, note] = process.argv.slice(2);
if (!file) { console.error('Cách dùng: node tools/build-data.js <file.xlsx> [YYYY-MM-DD] ["ghi chú"]'); process.exit(1); }
const wb = XLSX.readFile(file);
const p = P.parseWorkbook(XLSX, wb);
p.warnings.forEach(w => console.warn('! ' + w));
const date = dateArg || p.applyDate;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) { console.error('Thiếu ngày áp dụng (YYYY-MM-DD).'); process.exit(1); }
const meta = { date, label: p.label, note: note || '', source: path.basename(file), uploaded: new Date().toISOString() };
const data = P.toData(p, meta);
const root = path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(root, 'tkb'), { recursive: true });
fs.writeFileSync(path.join(root, 'tkb', date + '.json'), JSON.stringify(data));
const idxFile = path.join(root, 'index.json');
const idx = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : { versions: [] };
idx.versions = idx.versions.filter(v => v.date !== date);
idx.versions.push({ date, file: 'tkb/' + date + '.json', label: p.label, note: meta.note, source: meta.source, uploaded: meta.uploaded });
idx.versions.sort((a, b) => b.date.localeCompare(a.date));
fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2));
console.log(`Đã ghi ${date}: ${data.classes.length} lớp, sheet dùng: ${p.sheetsUsed.join(', ')}, số tiết S/C: ${p.nper.S}/${p.nper.C}`);
