# Flashcard UI — SCRUM-73

## Route và thiết kế

`/Lesson/{lessonId}` → nút **Bắt đầu ôn tập** → `/Flashcard/{lessonId}`.
Route giữ pattern SCRUM-57 trong `lesson.js`. Link quay lại giữ cùng lesson ID.
Không thêm toggle vào trang Lesson. Chưa có wireframe Flashcard chi tiết trong repo;
UI tái sử dụng Lesson, component chung và `docs/ux/STYLE_GUIDE.md` mục 9:
sticker, mặt trước cam, mặt sau tím, nút Nhớ xanh chanh/Chưa nhớ hồng.

### Xem UI local không cần đăng nhập

Chạy `dotnet run --launch-profile http`, rồi mở:

`http://localhost:5347/Flashcard/at-the-coffee-shop?preview=1`

Chỉ trong Development, Razor nhúng `LessonService.GetDetail(lessonId)` từ JSON lesson
thật vào trang bằng JSON encoder mặc định. UI dùng dữ liệu này, không nạp Supabase hay
gọi API. Banner phân biệt preview với luồng học thật. Các link quay về Lesson vẫn là
luồng bình thường và cần auth khi tải nội dung. Production bỏ qua query preview,
không nhúng dữ liệu; API giữ nguyên yêu cầu đăng nhập.

## Dữ liệu

`AppApi.get('/api/lessons/{lessonId}')` sử dụng API hiện có, không thêm DTO/endpoint.
`lessonId` response phải khớp route; `name`, `contents` phải hợp lệ.
Mỗi mục cần `id` duy nhất, `content`, `definition-vi`, `definition-en` không rỗng.
Mặt trước hiển thị `content`; mặt sau giữ từ/cụm từ làm ngữ cảnh và hiển thị hai định nghĩa.
Phiên âm `pronunciation-bre`/`pronunciation-name` và `examples` chỉ hiển thị khi có dữ liệu.
Không thêm media khi chưa có thiết kế yêu cầu. Không sinh nội dung thay thế cho trường thiếu.

`contents: []` là empty; payload thiếu/sai trường là error, không lọc bỏ thẻ lỗi âm thầm.
Loading ẩn thao tác; tải lại xóa bộ thẻ cũ. Chỉ request mới nhất được render.
401 do AppApi chuyển đăng nhập; 400/404, 403 locked/inactive có thông báo riêng;
lỗi mạng/server/dữ liệu có retry theo pattern Lesson.

## State và điểm tích hợp

State chỉ gồm view, danh sách mục, index (zero-based), flipped và rating đang hiển thị.
Previous/Next giới hạn trong bộ thẻ và đưa thẻ về mặt trước; không bắt đánh dấu trước.
Nhớ/Chưa nhớ phản hồi bằng `aria-pressed` và style chọn, không tự chuyển thẻ.
Rating lưu riêng cho mỗi content ID trong localStorage, giữ khi đổi thẻ và reload.
Key: `se347.flashcard.rating.v1:<scope>:<lessonId>:<contentId>` (các phần được URL encode).
Scope `user:<Supabase session user ID>`; preview dùng scope `preview` riêng.
Không xác định được tài khoản thì chỉ lưu trong bộ nhớ trang, không dùng chung vùng anonymous.
Đổi tài khoản/đăng xuất xóa state hiển thị và tải lại trong scope mới.
Giá trị chỉ nhận `know`/`again`; dữ liệu local không hợp lệ được bỏ qua.
Nếu localStorage bị chặn/đầy, lựa chọn vẫn giữ trong bộ nhớ khi chuyển thẻ.
Mỗi thẻ có key riêng để các tab đánh dấu thẻ khác nhau không ghi đè cả bộ.
Các tab cùng origin/scope/lesson đồng bộ qua `storage`; cùng thẻ dùng giá trị ghi sau cùng.
Xóa key/clear storage cũng cập nhật UI. Đồng bộ không đổi index/mặt thẻ và không phát
event rate, tránh consumer gọi API lặp. Không lưu server, không tính XP/hoàn thành.

Bấm card hoặc Enter/Space khi focus card để lật (không còn nút lật riêng); giữ phím
không lật liên tục, chọn văn bản không lật. Khung cao `clamp(330px, 52vh, 480px)`
thống nhất giữa các thẻ/hai mặt. Nội dung dài cuộn bên trong, thanh cuộn được ẩn;
vị trí nút ngoài thẻ ổn định. Hover trên thiết bị có chuột nhấc thẻ nhẹ và tăng bóng
sticker; nhấn thẻ có phản hồi ấn xuống. Reduced motion tắt chuyển động, giữ phản hồi bóng.

Các DOM event bubbling từ `.flashcard-page`:

```js
document.addEventListener('flashcard:rate', ({ detail }) => {
    // SCRUM-76/77: quyết định lưu tiến độ và xử lý kết quả/lỗi tại đây.
    // detail: { lessonId, contentId, index, total, side, rating }
});
```

- `flashcard:rate`: sau khi chọn; `rating` là `know` hoặc `again`.
- `flashcard:flip`: sau khi lật; `side` là `front` hoặc `back`.
- `flashcard:change`: sau Previous/Next; mô tả thẻ mới, `rating` khôi phục từ lựa chọn đã lưu hoặc null.

Events là thông báo tương tác, không phải xác nhận đã lưu thành công. Không phát event
change khi khởi tạo; không phát event do đổi ngôn ngữ/theme.
Consumer xử lý tiến độ server độc lập với lựa chọn local, theo SCRUM-76/77.

Chỉ báo **vị trí trong bộ thẻ** = `(index + 1) / contents.length`.
100% nghĩa là đang xem thẻ cuối, không có nghĩa đã học/hoàn thành bộ thẻ.

## Kiểm thử

```powershell
dotnet build SE347.csproj --no-restore
dotnet test tests/SE347.Tests/SE347.Tests.csproj --no-restore
node --check wwwroot/js/flashcard.js
```

Chạy app tại `http://localhost:5347`, Chrome với remote debugging port 9347, rồi:

```powershell
node docs/test/flashcard-browser.cjs
```

Script browser dùng nội dung JSON thật từ repository làm fixture, mock response HTTP và phiên
Supabase chỉ trong browser test. Có case rỗng, payload lỗi, tải chậm, HTTP errors,
retry, đổi lesson, tương tác, event, biên chỉ số, i18n/theme, nội dung dài và regression Lesson.
Đây là kiểm tra UI contract, không chứng minh auth/API/progress production hoạt động.

SCRUM-74 nghiệm thu responsive/accessibility đầy đủ; SCRUM-75 xử lý hoàn thành/điều hướng
kết quả; SCRUM-76 tích hợp progress; SCRUM-77 quyết định lưu/đổi lựa chọn và quy tắc học.

### Kết quả kiểm tra trong phiên triển khai

- `dotnet build SE347.csproj --no-restore`: thành công, 0 warning/error.
- `dotnet test tests/SE347.Tests/SE347.Tests.csproj --no-restore`: 51 passed, 0 failed/skipped.
- `node --check wwwroot/js/flashcard.js`: thành công.
- `node --check docs/test/flashcard-browser.cjs`: thành công.
- Browser contract script: thành công trên Chrome headless, app Development tại port 5348,
  remote debugging port 9348 (override `APP_URL`, `CHROME_DEBUG_URL`).
- Kiểm tra loading trì hoãn, empty, payload sai/lesson không khớp/ID trùng,
  HTTP 400/403/404/500, mất kết nối, retry, lật/đánh giá/event, đầu-cuối bộ thẻ,
  một thẻ, đổi lesson, ngôn ngữ/theme và luồng Lesson → Flashcard đều đạt.
- Nội dung dài không gây document overflow tại 375px/1280px; đây chỉ là kiểm tra sơ bộ.
- Không có JavaScript exception/console.error trong môi trường browser đã mock auth/API.
- Chưa kiểm tra phiên Supabase thật, progress server, màn kết quả hay đối chiếu wireframe
  Flashcard chính thức. Không coi browser fixture test là nghiệm thu các phần này.

### Cập nhật theo yêu cầu tương tác và ghi nhớ lựa chọn

- Build lại thành công: 0 warning/error; kiểm tra cú pháp JavaScript thành công.
- Browser test mở hai tab thật (CDP), xác nhận sync `storage`, không phát rate event lặp,
  ghi hai thẻ khác nhau không mất lựa chọn, xóa key cập nhật tab còn lại.
- Đã kiểm tra click nội dung card, Enter/Space, khung và vị trí điều khiển không đổi khi lật,
  khôi phục rating khi Previous/Next và tải lại trang.
- Đã kiểm tra đổi tài khoản qua auth callback mock, tách preview/lesson/tài khoản,
  fallback khi localStorage bị chặn, nội dung dài cuộn ở 375px/1280px.
- Bộ browser regression hiện có tiếp tục đạt, không có JS exception/console error.
- Đây là lưu local trên cùng browser/origin, không đồng bộ thiết bị hay xác nhận progress server.
- Sau khi bỏ nút flip: build thành công 0 warning/error; browser regression đạt,
  gồm kiểm tra hover/reduced motion, không còn nút flip, scrollbar ẩn và nội dung vẫn cuộn được.
