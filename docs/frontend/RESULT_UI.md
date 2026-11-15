# Result UI — SCRUM-60 (S2-FE-06)

## Route

`/Result/{lessonId}`: điểm, số câu đúng/sai, thời gian, XP, đáp án đúng, giải thích và các câu cần ôn
của lượt mini-game vừa làm. Nút **Làm lại** mở `/MiniGame/{lessonId}`, **Về bài học** mở `/Lesson/{lessonId}`,
**Ôn từ bằng Flashcard** (chỉ hiện khi có câu sai) mở `/Flashcard/{lessonId}`.

Route mini-game nằm ở hằng `playUrl` trong `wwwroot/js/result.js`. Nếu SCRUM-59 dùng route khác thì sửa ở đó.

## Mini-game nối sang trang Kết quả

Server chấm điểm và cập nhật progress ở `POST /api/progress/lessons/{lessonId}/quiz` (SCRUM-62).
Mini-game nạp `js/Shared/quiz-result.js` (sau `api.js`) rồi làm như sau:

```js
const startedAt = performance.now();
// ... người học làm bài ...
const result = await AppApi.post(`/api/progress/lessons/${id}/quiz`, { answers });
await QuizResult.save(id, result, { durationMs: performance.now() - startedAt });
location.assign(QuizResult.resultUrl(id));
```

- `result` là nguyên response `QuizSubmissionResultDto` (`attempt` + `questions`). `save` trả `false` nếu sai shape.
- Lưu trong `sessionStorage`, key `se347.quiz-result.v1:<scope>:<lessonId>`, scope `user:<Supabase user id>`
  (hoặc `local` khi không có phiên). Reload trang Kết quả vẫn còn, đóng tab thì mất, tài khoản khác không đọc được.
- Thời gian do client đo. Không truyền thì ô Thời gian hiện `—`.

## Dữ liệu trang dùng

- Kết quả từng câu (đúng/sai, bài làm, đáp án đúng, giải thích, dịch) lấy từ response chấm điểm, không chấm lại ở client.
- Nội dung câu hỏi và các lựa chọn lấy từ `GET /api/lessons/{lessonId}` (`quiz`), ghép theo `questionId`.
  Câu không còn trong bài vẫn hiện kết quả, chỉ thay nội dung câu bằng thông báo.
- Sau khi render, trang gọi `GET /api/progress/lessons/{lessonId}` để cập nhật huy hiệu (hoàn thành bài,
  điểm cao nhất, số lần làm). Lỗi ở bước này không chặn trang, giữ `attempt.progress` trả về cùng lần nộp.

## Trạng thái

- **ready**: vòng điểm, lời nhận xét theo điểm (100 / ≥80 / ≥60 / <60), Foxy vẫy tay khi qua bài, buồn khi chưa qua.
  Bộ lọc **Cần ôn / Tất cả / Đã đúng**, mặc định **Cần ôn** khi có câu sai.
  Câu điền từ hiện đáp án đúng ngay trong chỗ trống; câu chọn đáp án tô xanh đáp án đúng, gạch hồng lựa chọn sai.
  Giải thích mở sẵn với câu sai, câu đúng thu gọn trong `<details>`.
- **empty**: chưa có kết quả trong phiên. Nếu đã từng làm thì hiện điểm gần nhất và cao nhất từ progress.
- **message**: bài không có quiz, không tìm thấy (400/404), bị khóa (403 `lesson_locked`), tài khoản không hoạt động,
  lỗi mạng/server (có nút Thử lại). 401 do `AppApi` chuyển sang đăng nhập.

## Xem UI local không cần đăng nhập

`dotnet run --launch-profile http`, mở `http://localhost:5347/Result/advanced-greetings-1?preview=1`.
Chỉ trong Development, Razor chấm quiz thật của bài bằng `LearningResultService.Grade` với bộ đáp án mẫu
(cứ 4 câu sai 1, câu cuối bỏ trống) và nhúng vào trang. Không gọi API, không lưu progress.
