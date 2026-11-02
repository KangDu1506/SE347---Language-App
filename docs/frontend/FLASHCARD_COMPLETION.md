# SCRUM-75 — Completion UI và điều hướng

## Quyết định và ranh giới

- SCRUM-77 quyết định **phiên Flashcard** đã kết thúc theo quy tắc học. UI không tự
  suy luận từ thẻ cuối, số rating, localStorage, quiz hay tất cả thẻ chọn Nhớ.
- SCRUM-76 sở hữu request/persistence, kết quả lưu, retry và phục hồi dữ liệu thật.
- SCRUM-75 tiêu thụ một luồng trạng thái đã xác nhận, hiển thị và điều hướng bằng link
  Razor Pages như pattern Lesson hiện tại. Không thêm API, DTO hoặc thuật toán học.
- Hoàn tất phiên Flashcard không có nghĩa toàn bộ lesson completed. API lesson có quiz
  yêu cầu nộp quiz; endpoint `/complete` không dùng chung cho mọi lesson.
- Repository chưa có route kết quả/mini-game theo lesson. `/TrialTest` là thi thử,
  `/CreateQuiz` là biên soạn, không được dùng làm bước tiếp theo chỉ vì tên gần giống.
- Không tự lấy phần tử sau trong danh sách lesson phẳng làm next step: thứ tự đó chưa
  chứng minh cùng nhánh học hoặc đã mở khóa. Provider 76/77 phải xác định bước hợp lệ.

## 1. Khởi tạo phiên

Khi lesson hợp lệ, có ít nhất một thẻ và UI sẵn sàng, `.flashcard-page` phát event bubbling:

```js
document.addEventListener('flashcard:session-ready', event => {
    const { lessonId, sessionId, contentIds, preview } = event.detail;
    // Khởi tạo adapter 76/77 ở đây, không tính completion trong UI.
});
```

Context gồm lessonId, sessionId (opaque ID mới cho mỗi lần tải phiên), contentIds và preview.
ID dùng randomUUID khi có, fallback getRandomValues khi mở HTTP local trên thiết bị khác.
Snapshot được freeze; adapter tải muộn có thể đọc `page.flashcardSession` (getter read-only).
Getter trả null trong loading/error/empty hoặc lúc context đã bị vô hiệu hóa.
`page.dataset.sessionId` cũng chứa ID hiện tại. Đổi tài khoản/đăng xuất/tải lại sẽ vô hiệu
hóa context cũ trước khi có thể nhận completion. Event rate/flip/change cũng mang sessionId.

## 2. Nguồn trạng thái duy nhất

Adapter phối hợp SCRUM-77 và SCRUM-76 phát `flashcard:completion-state` trên page
(hoặc phần tử con có bubbles: true). Đây là contract frontend, không phải DTO backend:

```js
page.dispatchEvent(new CustomEvent('flashcard:completion-state', {
    bubbles: true,
    detail: {
        lessonId: session.lessonId,
        sessionId: session.sessionId,
        revision: 1,
        phase: 'saving',
        persistence: 'pending'
    }
}));
```

Các cặp hợp lệ:

| phase | persistence | Ý nghĩa UI |
|---|---|---|
| saving | pending | Đang chờ server xác nhận, chưa báo thành công; ẩn Tiếp tục |
| error | failed | Chưa xác nhận lưu; lỗi rõ ràng, retry khi adapter cho phép |
| completed | saved | Adapter xác nhận server đã lưu tiến độ phiên |
| completed | not-required | Kết thúc phiên không có persistence; nói rõ không lưu server |

`revision` là số nguyên dương tăng dần trong phiên, do adapter quản lý. Gộp luồng client
và persistence thành một stream; các callback phải giữ sessionId/revision lúc request bắt
đầu. Không gắn lại ID phiên mới vào callback cũ. Event trùng hoặc revision cũ bị bỏ qua.
`completed` là trạng thái cuối; các event tới sau không mở lại/quay ngược phiên hoặc giật focus.
Preview không chấp nhận `saved`; adapter preview chỉ được dùng `not-required`.

Completion từ client chưa đủ khi sản phẩm cần persistence: phát saving/pending rồi error/failed
hoặc completed/saved sau response API thật. Không phát completed trước rồi cố sửa lại error.
Không có summary XP/score/streak hoặc phần trăm tự tính trên panel này.

### Next step

Chỉ ở trạng thái completed, adapter có thể truyền:

```js
nextStep: { type: 'lesson', lessonId: 'present-simple-tense' }
```

UI chỉ dựng route đã tồn tại `/Lesson/{lessonId}`. Adapter chịu trách nhiệm chứng minh
lesson đích tồn tại, thuộc đúng flow/context và có thể truy cập. UI kiểm tra slug hợp lệ,
khác lesson hiện tại; không nhận URL tùy ý, course/activity params chưa có trong contract,
hoặc loại Result/Quiz chưa có route. Next step thiếu/không hỗ trợ → ẩn Tiếp tục, fallback:

- `/Lesson/{lessonId}` hiện tại (CTA chính khi hoàn tất không có next step).
- `/Study` (hành động phụ).

Pending/error vẫn có đường quay về để tránh khóa người học nếu server không phản hồi;
chúng không phải hành động xác nhận đã lưu. UI không tự chuyển trang khi nhận completion.

## 3. Retry

Ở error/failed, adapter có thể thêm `canRetry: true`. UI mới hiển thị nút Thử lưu lại.
Nhấn nút phát `flashcard:completion-retry` với `{ lessonId, sessionId, revision }` của lỗi.
Nút khóa ngay, chỉ phát một lần đến khi adapter cập nhật revision mới. UI không gửi request.

```js
document.addEventListener('flashcard:completion-retry', event => {
    // SCRUM-76: kiểm tra phiên còn hiệu lực, phát revision mới saving/pending,
    // retry request rồi phát error hoặc completed với revision mới hơn.
});
```

Nếu adapter không có khả năng retry thì không gửi canRetry. Không bịa server error text:
panel dùng thông báo i18n chung; 76 có thể log/hiển thị lỗi chi tiết theo API contract của nó.

## 4. Lifecycle, điều hướng và accessibility

- Học và panel kết thúc là các view loại trừ nhau; saving/error không mang thông báo
  hoàn thành hay lưu thành công. Chuyển lần đầu đưa focus tới panel; cập nhật trùng không
  refocus. Nếu button Retry đang focus bị ẩn/disabled, đưa focus về panel.
- Status aria-live thông báo pending/completed; lỗi có role alert. Màu/font/button/mascot
  và responsive tiếp tục dùng design system và tiêu chuẩn SCRUM-74; scrollbar vẫn ẩn.
- Native links giữ history/back và Ctrl/Cmd-click. Lần kích hoạt cùng-tab đầu khóa các
  link completion; nhấn tiếp bị chặn. pageshow (kể cả BFCache) mở lại các link khi quay về.
- Reload hoặc re-entry tạo sessionId mới, không suy luận completion từ local ratings.
  Muốn khôi phục hoàn tất, 76/77 phải đọc trạng thái thật và phát event cho phiên mới.
  Back qua BFCache có thể giữ panel của cùng phiên; các link được mở lại, không auto redirect.
- Không có event thì tiếp tục UI học, không xuất hiện kết quả giả. Bộ thẻ rỗng không có
  session và không thể nhận completion. Không lưu completion vào localStorage.

## Tình trạng tích hợp

SCRUM-75 đã có phần tiêu thụ contract/UI/navigation. Producer học thực tế (77), adapter
API/progress/retry/hydration và xác định nextStep (76/77) sẽ được nối ở các task tiếp theo.
Không thể nghiệm thu end-to-end hoàn tất thẻ cuối → server → bước tiếp theo trước phần đó.
Test contract chủ động phát event chỉ trong test; code production không phát completion giả.
