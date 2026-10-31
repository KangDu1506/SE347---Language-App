# Gọi API từ frontend (SCRUM-72)

`wwwroot/js/Shared/api.js` cung cấp `window.AppApi`: gọi `/api/*` kèm `Authorization: Bearer <access_token>` lấy từ phiên Supabase (`window.sb`).

## Nạp script

Đặt sau `_SupabaseClient` và trước script của trang (cùng `defer` để giữ thứ tự):

```html
@section Scripts {
    <partial name="_SupabaseClient" />
    <script src="~/js/Shared/api.js" asp-append-version="true" defer></script>
    <script src="~/js/lesson.js" asp-append-version="true" defer></script>
}
```

## Dùng

```js
const lessons = await AppApi.get('/api/lessons?category=vocabulary');
const lesson = await AppApi.get(`/api/lessons/${encodeURIComponent(id)}`);
await AppApi.post(`/api/progress/lessons/${encodeURIComponent(id)}/open`);
```

| Trường hợp | Kết quả |
|---|---|
| 2xx | Trả về JSON đã parse (`null` nếu body rỗng) |
| 401 | Chuyển sang `/Account/Login`, ném `ApiError(401)` |
| 4xx/5xx khác | Ném `ApiError(status, message)`; `message` lấy từ `{ error }` của backend nếu có |
| Mất mạng | Ném `ApiError(0)` |

```js
try {
    render(await AppApi.get(url));
} catch (error) {
    if (error.status === 401) return;          // đã chuyển trang đăng nhập
    if (error.status === 404) showNotFound();
    else showError(error.status === 0 ? 'network' : 'server');
}
```

## Endpoint đang dùng

| Method | URL | Trang |
|---|---|---|
| GET | `/api/lessons` | Lesson (bài trước/tiếp theo, thứ tự level → order) |
| GET | `/api/lessons/{lessonId}` | Lesson |
| POST | `/api/progress/lessons/{lessonId}/open` | Lesson (ghi nhận đã mở bài) |
| GET | `/api/lessons/{lessonId}/assets/{path}` | `<audio>`/`<img>` dùng thẳng URL trong response, không qua `AppApi` |

## Trang chi tiết bài học

- Route: `/Lesson/{lessonId}` (`Pages/Lesson.cshtml`, `wwwroot/js/lesson.js`, `wwwroot/css/Lesson.css`).
- Trang khác dẫn tới bài học bằng `/Lesson/<lessonId>` (vd. thẻ lesson ở Study - SCRUM-56).
- Nút "Bắt đầu ôn tập" trỏ tới `/Flashcard/{lessonId}` (route dự kiến của SCRUM-58).

## Ghi nhận kết quả học (SCRUM-62)

Server chấm điểm và tính XP từ dữ liệu bài học. Frontend chỉ gửi đáp án, không gửi điểm hay XP.

| Method | URL | Dùng khi |
|---|---|---|
| POST | `/api/progress/lessons/{lessonId}/contents/{contentId}/complete` | Flashcard bấm "Nhớ". Mỗi mục được +5 XP ở lần đầu, gọi lại không cộng thêm. Bài vocabulary tính thêm 1 từ đã học trong ngày |
| POST | `/api/progress/lessons/{lessonId}/quiz` | Nộp quiz hoặc mini-game |
| POST | `/api/progress/lessons/{lessonId}/complete` | Hoàn thành bài không có quiz, sau khi đã học hết các mục nội dung. +20 XP một lần |

Hai endpoint đầu và cuối trả tiến độ bài (`LessonProgressDto`), giống `/open`.

Body khi nộp quiz:

```js
const result = await AppApi.post(`/api/progress/lessons/${encodeURIComponent(id)}/quiz`, {
    answers: [
        { questionId: '1', answer: ['close'] },            // fill-in-the-blank: mỗi chỗ trống một phần tử, đúng thứ tự
        { questionId: '2', answer: ['at night'] },         // single-choice: 1 lựa chọn
        { questionId: '3', answer: ['true'] },             // true-false: 'true' hoặc 'false'
        { questionId: '4', answer: ['option a', 'option b'] } // multiple-choice: các lựa chọn, thứ tự tùy ý
    ]
});
```

- Câu không gửi đáp án bị tính là sai. Điểm (`score`, 0–100) luôn tính trên toàn bộ câu hỏi của bài, nên mini-game cũng phải gửi đủ bộ câu của quiz.
- Khi so đáp án, server không phân biệt hoa thường, bỏ khoảng trắng thừa và coi `’` như `'`.
- Đạt từ 60 điểm thì bài chuyển sang completed. XP bằng 10 nhân số câu đúng và chỉ được cộng ở lần đầu đạt. Làm lại bài đã hoàn thành vẫn lưu điểm nhưng XP bằng 0.
- Response gồm `attempt` (điểm, `xpAwarded`, `lessonCompletedNow`, tiến độ bài) và `questions`. Mỗi phần tử của `questions` có `isCorrect`, `userAnswer`, `correctAnswer`, `explanation`, `translation`, theo đúng thứ tự trong quiz, đủ dữ liệu cho trang kết quả và ôn lại (S2-FE-06).

Lỗi trả về `{ error }`:

| Status | Khi nào |
|---|---|
| 400 | Bài làm không hợp lệ: thiếu `answers`, `questionId` không có trong bài, một câu trả lời hai lần, đáp án quá dài (quá 20 phần tử hoặc quá 200 ký tự) |
| 403 | `code: "lesson_locked"`: bài đang khóa (chưa hoàn thành bài prerequisite). `code: "profile_inactive"`: tài khoản bị khóa hoặc đã xóa |
| 404 | Không có bài học hoặc mục nội dung, hay nộp quiz cho bài không có quiz |
| 409 | Gọi `/complete` cho bài có quiz, hoặc khi chưa học hết các mục nội dung |
