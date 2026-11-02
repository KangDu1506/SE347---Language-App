# SCRUM-75 — Completion UI/state và điều hướng

## Phạm vi kiểm tra

Contract: [FLASHCARD_COMPLETION.md](../frontend/FLASHCARD_COMPLETION.md).
Browser test `flashcard-browser.cjs` dùng JSON lesson thật làm fixture, mock auth/API,
và hiện cũng chạy producer production của SCRUM-77 cùng adapter SCRUM-76 với API mock.
Đây là kiểm tra UI contract; không chứng minh thuật toán học hoặc server progress thực.

## Kịch bản

- Thẻ cuối và local ratings không tự hoàn tất; empty/loading không thể nhận completion.
- Event sai lesson/session/revision/cặp trạng thái không làm thay đổi view.
- saving/pending không báo thành công, không có Tiếp tục; error/failed có thông báo lỗi.
- Retry chỉ xuất hiện khi adapter cho phép, nhấn nhanh chỉ phát một yêu cầu retry.
- Revision cũ sau retry không ghi đè trạng thái mới; completed trùng không giật focus.
- completed/saved chỉ hiển thị sau event xác nhận; not-required nói rõ không lưu server.
- Preview không chấp nhận claimed saved. Không có request progress do completion UI.
- Next step kiểu lesson giữ đúng ID vào `/Lesson/{lessonId}`; không nhận raw URL/path lạ
  hoặc quay vòng về cùng lesson. Không có next step thì Lesson hiện tại/Study.
- Native link điều hướng thực; click liên tiếp chỉ chấp nhận một activation, pageshow mở
  lại link; back không tạo redirect loop; reload/re-entry không dùng lại completion cũ.
- Ma trận responsive/theme/ngôn ngữ và regression SCRUM-73/74 tiếp tục được chạy.
- Panel saving/error/completed (saved và not-required) kiểm tra trên 1440×900, 1280×800,
  768×1024, 390×844, 320×720, 844×390, 568×320, light/dark và Việt/Anh; kiểm tra Tab
  vào CTA và focus outline, các link không tràn ngang.
- Chuyển tài khoản vô hiệu hóa session cũ. Thiếu lessonId không gọi API hoặc tạo completion.
  Tạo session hoạt động cả khi randomUUID không khả dụng (HTTP local trên thiết bị khác).

## Lệnh kiểm tra

```powershell
dotnet build SE347.csproj --no-restore
dotnet test tests/SE347.Tests/SE347.Tests.csproj --no-restore
node --check wwwroot/js/flashcard.js
node --check docs/test/flashcard-browser.cjs
$env:APP_URL = 'http://localhost:5347'
$env:CHROME_DEBUG_URL = 'http://localhost:9348'
node docs/test/flashcard-browser.cjs
```

Không có cấu hình lint/typecheck frontend riêng trong repository.

## Kết quả thực tế trong phiên triển khai

- Build thành công, 0 warning/error.
- xUnit: 51 passed, 0 failed, 0 skipped.
- Node syntax check của UI và browser test: đạt.
- Browser contract/regression script: đạt trên Chrome headless, không có JS exception
  hoặc console.error trong môi trường có mock auth/API.
- Retry chỉ phát event; completion không gửi POST progress. Native links đi đúng route
  đã xác minh, double activation bị chặn và back/re-entry không tạo vòng lặp.
- Chưa kiểm tra producer SCRUM-77 hoặc API/persistence SCRUM-76 thực vì chưa được tích
  hợp. Cũng chưa kiểm tra iOS/Android hoặc screen reader thật; không coi fixture test là
  nghiệm thu end-to-end hoặc tương thích đa trình duyệt đầy đủ.
