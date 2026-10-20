# Thời khóa biểu – trang web cho giáo viên và học sinh

Trang tĩnh chạy trên **GitHub Pages**, miễn phí và không cần máy chủ riêng.

| Trang | Ai dùng | Chức năng |
|---|---|---|
| `index.html` | Giáo viên, học sinh | Chọn **ngày áp dụng** và **giáo viên** hoặc **lớp** để xem TKB tuần. Có nút In và nút Sao chép link. |
| Tab **Quản trị** (`?xem=quantri`) | **Chỉ quản trị viên** | Tải **file Excel TKB** lên, chọn **ngày áp dụng**, xem thử rồi bấm **Đăng**. Từ đây cũng xóa được các bản cũ. Người khác chỉ thấy ô đăng nhập. |

Mỗi lần đăng sẽ thêm một bản TKB mới, các bản cũ vẫn giữ. Ô "Ngày áp dụng" tự chọn bản đang có hiệu lực hôm nay. Bản có ngày áp dụng sau hôm nay được ghi "(sắp áp dụng)".

---

## 1. Đưa lên GitHub (làm một lần)

1. Vào <https://github.com> và đăng nhập. Bấm **New repository**, đặt tên kho (ví dụ `tkb`) và chọn **Public**.
   GitHub Pages miễn phí chỉ chạy với kho Public.
2. Trong kho mới, bấm **Add file → Upload files**. Kéo toàn bộ nội dung thư mục này vào, gồm các mục `index.html`, `admin.html`, `assets/`, `data/`, `tools/`, `.nojekyll` và `README.md`.
   Sau đó bấm **Commit changes**.
3. Vào **Settings → Pages**. Ở mục *Build and deployment*, chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`, rồi bấm **Save**.
4. Đợi khoảng 1–2 phút. Địa chỉ trang có dạng:
   `https://sphoabinh1980.github.io/tkb/` (trang này)
   - Gửi địa chỉ này cho giáo viên và học sinh.
   - Tab **Quản trị** vẫn hiện trên menu cho mọi người, nhưng phải đăng nhập bằng tài khoản quản trị mới xem được nội dung bên trong.

Muốn đổi tên trường hiển thị trên đầu trang thì sửa file `assets/config.js`.

## 2. Tạo mã truy cập (token) cho trang quản trị (làm một lần)

Trang quản trị bị khóa. Chỉ ai nhập được token GitHub của **tài khoản có quyền quản trị (admin) kho** mới vào được để xem, đăng và xóa thời khóa biểu. Trang gửi token cho GitHub kiểm tra; token sai, hết hạn hoặc thuộc tài khoản không phải quản trị kho đều bị từ chối, và giao diện quản trị không được tạo ra. Vì kho để Public, đừng thêm giáo viên khác làm cộng tác viên có quyền Admin.

1. Vào GitHub, chọn **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Điền các mục sau:
   - *Expiration*: tùy chọn, ví dụ 1 năm.
   - *Repository access*: **Only select repositories**, chọn kho `tkb`.
   - *Permissions → Repository permissions → Contents*: **Read and write**.
3. Bấm **Generate token** và sao chép token (bắt đầu bằng `github_pat_…`).
4. Mở `…/tkb/?xem=quantri`, dán token vào ô **Mã truy cập** rồi bấm **Đăng nhập**.

Token chỉ được lưu trong trình duyệt của máy đang dùng, không đưa lên trang. Nếu dùng máy chung, bấm **Đăng xuất trên máy này** sau khi làm xong. Lỡ để lộ token thì vào GitHub xóa (Revoke) token đó và tạo token mới.

## 3. Đăng thời khóa biểu mới (mỗi lần thay TKB)

1. Mở tab **Quản trị**, kéo **file Excel** TKB vào ô tải lên.
2. Trang đọc file và hiện các thông tin sau để kiểm tra:
   - số lớp, số giáo viên, số tiết;
   - giáo viên trùng tiết, nếu có;
   - phần xem thử TKB từng lớp.
3. Kiểm tra **Ngày áp dụng**. Ngày này được điền sẵn từ dòng "Áp dụng: Từ ngày …" trong file, có thể sửa. Thêm ghi chú nếu cần.
4. Bấm **Đăng lên trang**. Khoảng 1–2 phút sau, giáo viên và học sinh tải lại trang là thấy bản mới.
   - Đăng lại cùng một ngày áp dụng thì bản cũ của ngày đó bị ghi đè; trang sẽ hỏi trước khi ghi đè.
   - Có thể tích ô *Lưu kèm file Excel gốc* để lưu trữ file trên kho.

**Cách khác không cần token:** bấm **Tải dữ liệu về máy** để nhận 2 file.
- Đưa file `<ngày>.json` vào thư mục `data/tkb/` trên GitHub.
- Thay file `data/index.json` bằng file `index.json` vừa tải về.

## 4. Quy ước file Excel

Trang đọc đúng mẫu file TKB hiện tại của trường:

- Mỗi sheet TKB có:
  - một hàng tiêu đề chứa **"Thứ"**, **"Tiết"** và các mã lớp (`10T1`, `11L`, `12A1`…);
  - phía trên có chữ **SÁNG** hoặc **CHIỀU**;
  - hàng ngay trên hàng tiêu đề ghi tên giáo viên chủ nhiệm.
- Ô dữ liệu viết dạng `Môn - Tên GV viết tắt`, ví dụ `T - N.N.Xuân`. Ô không có tên GV, như `GDTC` hay `Nâng cao`, vẫn được hiển thị.
- Đọc được cả 6 sheet theo khối và 2 sheet gộp `TKB_SANG` / `TKB_CHIEU`. Mỗi lớp chỉ lấy một lần.
- Nếu file có các sheet sau thì trang đổi tên viết tắt sang **họ tên đầy đủ**:
  - sheet phân công (`Lớp | Môn | Giáo viên`, ví dụ `KIEM_TRA_PHAN_CONG`);
  - sheet HĐTN (cột "GV theo nguồn chốt");
  - sheet GDĐP (cột "GV áp dụng hiện tại").

  Nhờ vậy các thầy cô trùng tên viết tắt (P.T.Nga, N.P.Nga, V.T.P.Thảo…) được tách đúng người. Hai cô Nguyễn Thị Hạnh dạy Văn và Tiếng Trung cũng được tách theo môn.
- Các sheet kiểm tra khác được bỏ qua.
- Tiết **Ôn TN buổi chiều** không đưa lên trang (khối 12 có thời khóa biểu ôn thi riêng). Muốn đổi, sửa biến `SKIP` trong `assets/parser.js`.

## 5. Chuyển đổi bằng máy tính (tùy chọn)

```bash
npm i xlsx
node tools/build-data.js "TKB2026_2027_BanChot_V30_Tuan7.xlsx"            # lấy ngày áp dụng trong file
node tools/build-data.js "file.xlsx" 2026-10-26 "Điều chỉnh tuần 8"        # chỉ định ngày, ghi chú
```

Sau đó commit thư mục `data/` lên GitHub.

## Cấu trúc thư mục

```
index.html            trang xem (Giáo viên / Học sinh – Lớp)
admin.html            chuyển sang tab Quản trị (giữ link cũ)
assets/parser.js      bộ đọc Excel (dùng chung cho trình duyệt và tools/)
assets/render.js      vẽ bảng TKB, ô tìm kiếm (dùng chung)
assets/app.js         trang xem
assets/admin.js       tab Quản trị (đăng lên GitHub qua API)
assets/config.js      tên trường, năm học
assets/vendor/        thư viện SheetJS đọc Excel (bản 0.18.5, giấy phép Apache-2.0)
data/index.json       danh sách các bản TKB (ngày áp dụng)
data/tkb/*.json       dữ liệu từng bản
data/xlsx/*.xlsx      file Excel gốc (nếu chọn lưu kèm)
tools/build-data.js   chuyển Excel → dữ liệu bằng Node.js
```

Đường link có thể gửi thẳng cho từng người:
- `…/tkb/?xem=gv&gv=Nguyễn Ngọc Xuân` mở TKB của thầy Xuân.
- `…/tkb/?xem=lop&lop=10L` mở TKB lớp 10 Lý.

Link không ghi ngày thì luôn mở bản đang áp dụng.
