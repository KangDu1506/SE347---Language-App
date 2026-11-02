# Dashboard — SCRUM-55

## Audit và phạm vi

`Pages/Index.cshtml` thuộc ứng dụng Razor Pages `SE347.csproj`, không có PageModel/controller riêng.
Trước thay đổi, Dashboard chỉ gọi Supabase để lấy tên; số liệu và nội dung học đều là mẫu.
Các thay đổi chưa commit có sẵn trên branch SCRUM-55 được giữ lại và hoàn thiện, không xây lại backend.
Không có AGENTS.md hay hướng dẫn contribution riêng trong repository.

Đã bỏ khỏi luồng chính: streak 12 ngày, Unit 3/bài nghề nghiệp/câu 6/10 và tiến độ 60%,
1.247 từ đã thuộc, thẻ achieve, mục tiêu 18/30 XP và rương thưởng, 15 từ cần ôn,
bảng hạng/tên/XP mẫu và huy hiệu mẫu. Giữ layout, sticker tokens, mascot, i18n và responsive.

## Hợp đồng API đã xác minh

- `GET /api/progress`: `ProgressOverviewDto { stats: ProgressStatsDto, lessons: LessonProgressDto[] }`.
  XP/streak/todayXp lấy nguyên giá trị backend, kể cả 0. User mới có stats 0 và lessons rỗng.
  `ProgressService.GetOverviewAsync` lọc theo JWT user ID, sắp `lastStudiedAt` giảm dần;
  bài `in_progress` đầu tiên là bài cần tiếp tục. Không đoán theo thứ tự catalog.
- `GET /api/lessons`: `LessonSummaryDto[]`, toàn bộ catalog, **không phân trang**, không lọc level/category.
  `LessonService.GetAll` sắp level CEFR → order → lessonId. Không chỉ chứa bài được mở khóa.
- `GET /api/lessons/{lessonId}`: `LessonDetailResponseDto`; dùng để xác nhận quyền truy cập
  bài hiện tại và tối đa 3 ứng viên gợi ý. 403 `lesson_locked` hoặc 404 loại liên kết tương ứng;
  lỗi mạng/500/400/403 khác vẫn là lỗi, không giả thành empty state.

Tất cả dùng `AppApi` hiện có, Bearer token từ phiên Supabase hiện tại, cùng origin như trang Lesson.
401 do client chung chuyển về Login. Không có POST `/open` khi xem Dashboard.
Repo hiện không cấu hình Swagger/OpenAPI; endpoint/DTO/service là nguồn hợp đồng.

## Quy tắc ánh xạ

`wwwroot/js/dashboard-data.js` là mapper/view model có kiểm tra kiểu payload, không phải DTO backend mới.
`wwwroot/js/index.js` quản lý vòng đời request và render bằng textContent (không chèn HTML từ API).

- Completion = số lesson ID **trong catalog hiện tại** có status completed / toàn bộ catalog × 100,
  làm tròn, 0 khi catalog rỗng. Không dùng tổng số hoàn thành lịch sử làm tử số vì bài có thể đã bị gỡ.
  Stats nguyên bản vẫn được giữ trong view model để chẩn đoán; không thay đổi dữ liệu backend.
  Số %, aria-valuenow và chiều rộng bar dùng cùng một giá trị.
- Không có recommendation engine. Chọn tối đa 3 bài chưa hoàn thành, trừ bài hiện tại,
  theo đúng thứ tự catalog, rồi bỏ ứng viên khóa/đã mất qua API chi tiết. Không tự chấm điểm,
  đảo thứ tự, dò toàn catalog bằng hàng loạt request hay tự đoán prerequisites.
- Đây là gợi ý bài học, không dựng mô hình khóa học giả. Link theo quy ước đã có `/Lesson/{lessonId}`;
  fallback điều hướng là `/Study`.
- Loading: skeleton, ẩn số liệu cũ. First-use: XP/streak/tiến độ 0, lời mời bắt đầu bằng bài thật.
  Catalog rỗng: thông báo riêng. Không có gợi ý khả dụng không đồng nghĩa đã học xong mọi bài.
  Lỗi: thông báo an toàn + retry (trừ profile inactive). Bài hiện tại bị gỡ/khóa: không tạo link hỏng.
- Mỗi lần tải chỉ gọi một lần mỗi URL. Request-version bỏ kết quả cũ khi retry/đổi user.
  Không cache Dashboard vào storage. Sign-out xóa view model, bỏ nội dung học, ẩn trang và về Login.
  Đổi ngôn ngữ chỉ render lại, không gọi lại API.

## Giới hạn API

List chưa trả metadata quyền mở khóa và không có recommendation endpoint. Vì vậy gợi ý có thể ít hơn 3,
hoặc rỗng nếu cả 3 ứng viên đầu bị khóa, dù có bài khác ngoài nhóm này. Khi đó UI mời xem Study,
không tuyên bố đã hoàn thành. Cải tiến backend nhỏ nhất cho tương lai: bổ sung metadata quyền truy cập
vào list hoặc endpoint gợi ý được lọc quyền. Task này không thay đổi hợp đồng/schema backend.
Không thể bảo đảm bài còn tồn tại sau thời điểm xác nhận; trang Lesson vẫn xử lý 403/404 theo luồng sẵn có.

## Kiểm thử

```powershell
dotnet build
dotnet test tests/SE347.Tests/SE347.Tests.csproj
node docs/test/dashboard-data.cjs
node docs/test/dashboard-loading.cjs
node --check wwwroot/js/dashboard-data.js
node --check wwwroot/js/index.js
git diff --check
```

Browser test dùng Chrome DevTools Protocol, không cần cài npm package. Chạy app bằng Development,
cấu hình Supabase public URL/key cho meta tags, rồi mở Chrome với `--remote-debugging-port=9347`
và user-data-dir riêng. Nếu không có cấu hình thật, chỉ cho test process dùng URL/key giả:

```powershell
$env:ASPNETCORE_ENVIRONMENT='Development'
$env:Supabase__Url='https://dashboard-test.supabase.co'
$env:Supabase__PublishableKey='dashboard-browser-test-public-key'
dotnet run --no-build --no-launch-profile --urls http://localhost:5349
# Terminal khác, sau khi Chrome debug chạy:
$env:APP_URL='http://localhost:5349'
$env:SCREENSHOT_DIR="$env:LOCALAPPDATA\Temp\opencode\scrum55-screenshots"
node docs/test/dashboard-browser.cjs
```

Test intercept Supabase và API với fixture theo DTO thực: không gọi database/tài khoản thật.
Kiểm tra header Bearer/GET, loading, loaded, vi/en, mobile, first-use, catalog rỗng, bài mất/khóa,
hoàn thành tất cả, network/500/403/401, retry, đổi user khi request cũ chưa xong và sign-out.
Ảnh loading/loaded/mobile/first-use/error lưu tại SCREENSHOT_DIR, là UI với **test fixtures**,
không phải bằng chứng dữ liệu production. Smoke test tài khoản thật cần cấu hình Supabase/database.
Repo không có lệnh lint frontend riêng; dùng Node syntax check và diff whitespace check.

Ảnh review với test fixtures: [Desktop](../test/screenshots/scrum55/dashboard-loaded.png),
[Mobile](../test/screenshots/scrum55/dashboard-mobile.png).
