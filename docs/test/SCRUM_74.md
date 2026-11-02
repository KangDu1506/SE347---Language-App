# SCRUM-74 — Responsive và tương tác trợ năng Flashcard

## Phạm vi

Nhánh `feat/scrum-74-responsive-a11y`, phát triển tiếp UI SCRUM-73. Dùng CSS/HTML/JS
hiện có, không thêm dependency. Giữ next/previous, lựa chọn local, progress và API contract.
Thẻ từ của ngày ở dashboard là component riêng, không nằm trong thay đổi này.

## Quyết định giao diện

- Giữ breakpoint Flashcard 620px, palette/font/sticker và khung cao
  `clamp(330px, 52vh, 480px)`. Nội dung cuộn riêng, không cắt ngắn bằng ellipsis.
- Theo xác nhận người dùng: **ẩn scrollbar**, vẫn cho wheel/touch/bàn phím đọc toàn bộ nội dung.
- Nhãn Mặt trước/Mặt sau hiện có trở thành button native trong card, không có nút Flip
  riêng bên dưới. Bấm card vẫn lật; Tab tới nhãn và Enter/Space sử dụng click native.
- Article, heading, định nghĩa/ví dụ giữ ngữ nghĩa riêng, không bị gom vào role button.
  Vùng nội dung có thể focus để cuộn; Arrow/PageUp/PageDown/Home/End hoạt động trong vùng đó.
- Button có aria-expanded/aria-controls; status thông báo số thẻ/mặt hiện tại. Focus giữ
  khi lật. Nội dung mặt sau được kiểm tra trong Chrome accessibility tree.
- Focus ring tách biệt trạng thái chọn; lựa chọn có dấu check và aria-pressed.
- Scroll margin dùng spacing token để focus không bị sticky header/mobile navigation che;
  browser test kiểm tra hit-test tại phần tử đang focus, không chỉ computed outline.
- Pointer move/cancel phân biệt thao tác vuốt/drag với click; không preventDefault touch,
  giữ native scroll/pinch zoom. Không đăng ký touch handler riêng gây double activation.
- Nhãn nút có thể xuống dòng, target tối thiểu 44px, spacing theo component/token hiện có.

## Môi trường và lệnh

Ứng dụng Development trên localhost:5347, Chrome headless debug port 9348, Node 24.

```powershell
dotnet build SE347.csproj --no-restore
dotnet test tests/SE347.Tests/SE347.Tests.csproj --no-restore
node --check wwwroot/js/flashcard.js
node --check docs/test/flashcard-browser.cjs
$env:APP_URL = 'http://localhost:5347'
$env:CHROME_DEBUG_URL = 'http://localhost:9348'
node docs/test/flashcard-browser.cjs
```

Repository không có cấu hình ESLint/TypeScript typecheck hoặc npm scripts; kiểm tra
cú pháp Node không được coi là lint/typecheck. Backend tests dùng xUnit, browser dùng CDP.

## Ma trận kiểm tra

- Viewport: 1440×900, 1280×800, 768×1024, 390×844, 320×720, 844×390, 568×320.
- Resize cùng trang không reload; mobile portrait/landscape, light/dark và Việt/Anh.
- Nội dung tiếng Việt dài, nhiều dòng/đoạn, chuỗi không có dấu cách; cả hai mặt dài,
  mặt trước ngắn/mặt sau dài, ngược lại và nội dung ngắn.
- Kiểm tra scrollWidth vùng nội dung và bounding box control riêng, không chỉ document
  scrollWidth vì layout chung có overflow-x: clip.
- Khung thẻ/điều khiển ổn định khi lật; đầy đủ nội dung và scrollbar ẩn nhưng vẫn cuộn được.
- Tab/Shift+Tab thật, native Enter/Space, focus ở vùng cuộn/nút đánh giá/Next; disabled
  Previous được bỏ qua. Selected state không chỉ dựa màu.
- Input mouse và touch qua CDP; một click/tap chỉ đánh giá/lật một lần; swipe cuộn nội
  dung không lật; gesture cancel không lật; hover và reduced motion.
- Loading/empty/error tại 320/768/1440px, retry và regression SCRUM-73 (lưu lựa chọn,
  đồng bộ tab, tách account/lesson/preview, điều hướng về lesson, lỗi dữ liệu/HTTP/mạng).

## Giới hạn

API/Supabase session được mock trong browser test; JSON lesson thật làm fixture.
Không chứng minh progress server hay đăng nhập thật. Chrome accessibility tree không
thay thế kiểm thử NVDA/VoiceOver/TalkBack. Cần kiểm tra bổ sung trên iOS Safari/Android
thật và screen reader thật trước khi khẳng định tương thích đa thiết bị đầy đủ.

## Kết quả phiên triển khai

- Build: thành công, 0 warning/error.
- xUnit: 51 passed, 0 failed, 0 skipped.
- Node syntax check: đạt cho script UI và script browser test.
- Browser contract/regression: đạt trên ma trận nêu trên; không phát sinh JS exception
  hoặc console.error trong môi trường test có mock auth/API.
- Chrome AX tree giữ heading mặt trước và nội dung định nghĩa mặt sau; button native
  giữ focus khi lật, Tab bỏ qua Previous disabled và tới Next đang hoạt động.
- Mouse/touch input, cuộn bằng bàn phím, vuốt không lật và pointercancel đều đạt.
- Không có lint/typecheck riêng để chạy; chưa kiểm tra thiết bị/screen reader thật.
