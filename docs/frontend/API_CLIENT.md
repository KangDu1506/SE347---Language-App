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

## Tự sửa hồ sơ, cài đặt và avatar (SCRUM-92)

Cả bốn endpoint cần Bearer token. Server lấy user từ claim `sub` của token, body không có `userId`.

| Method | URL | Dùng khi |
|---|---|---|
| PATCH | `/api/users/me` | Sửa hồ sơ và cài đặt. Trả `MyProfileDto` mới, cùng shape với `GET /api/users/me` |
| POST | `/api/users/me/avatar` | Tải ảnh đại diện (multipart, field `file`). Trả `MyProfileDto` mới |
| DELETE | `/api/users/me/avatar` | Gỡ ảnh đại diện, `avatarPath` thành `null`. Gọi khi chưa có ảnh vẫn trả 200 |
| DELETE | `/api/users/me` | Tự vô hiệu hóa tài khoản: `status = "deactivated"`, hồ sơ chuyển `private`. Trả 204, gọi lại vẫn 204 |

`AppApi` hiện chỉ có `get` và `post`. Hàm `patch` và `delete` thuộc S3-02, nên trước khi có thì gọi `fetch` trực tiếp (xem ví dụ bên dưới). Upload avatar luôn phải dùng `fetch` với `FormData`, vì `AppApi.post` gửi body dạng JSON.

### PATCH /api/users/me

Chỉ gửi những trường muốn đổi. Trường không có trong body thì giữ nguyên. Gửi `null` khác với không gửi: `"bio": null` xóa giới thiệu.

```js
const token = (await window.sb.auth.getSession()).data.session?.access_token;
const response = await fetch('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
        displayName: 'Trần Minh Anh',
        bio: null,                 // xóa bio
        theme: 'dark',
        reminderEnabled: true,
        reminderTime: '20:15'
    })
});
const profile = await response.json(); // MyProfileDto, hoặc { error, field } khi lỗi
```

| Trường | Giá trị hợp lệ |
|---|---|
| `displayName` | Chuỗi, bỏ khoảng trắng hai đầu, dài 1–80 ký tự. Không nhận `null` |
| `username` | Server bỏ khoảng trắng và đổi sang chữ thường. Dài 3–30, chỉ gồm `a-z`, `0-9`, `.`, `_`, ký tự đầu và cuối là chữ hoặc số, không có hai dấu `.`/`_` liền nhau, không thuộc tên cấm (`admin`, `administrator`, `support`, `system`, `root`, `moderator`, `api`, `null`, `undefined`, `me`, `help`). Gửi lại đúng username hiện tại thì không bị coi là trùng |
| `bio` | Tối đa 160 ký tự. `null` hoặc chuỗi rỗng sẽ xóa bio |
| `uiLocale` | `vi` hoặc `en` |
| `timezone` | Tên múi giờ IANA, ví dụ `Asia/Ho_Chi_Minh`, tối đa 64 ký tự |
| `profileVisibility` | `public` hoặc `private` |
| `learningReason` | `travel`, `work`, `school`, `exam`, `fun`, `other`, hoặc `null` để xóa |
| `theme` | `light`, `dark` hoặc `system` |
| `dailyGoalXp` | `10`, `20`, `30` hoặc `50` |
| `soundEnabled`, `reminderEnabled` | `true` hoặc `false` |
| `reminderTime` | `"HH:mm"` hoặc `"HH:mm:ss"`, giờ địa phương theo `timezone`. `null` để xóa |

Khi `reminderEnabled` là `true` (gửi lên hoặc đang lưu) thì phải có `reminderTime` (gửi lên hoặc đang lưu). Ví dụ bật nhắc nhở cho tài khoản chưa từng đặt giờ mà không gửi `reminderTime` sẽ bị 400.

Trường không có trong bảng trên (`status`, `role`, `avatarPath`, ...) bị từ chối với 400. Request có một trường sai thì không trường nào được lưu.

Lỗi trả `{ error, field }`, `field` là tên trường sai theo đúng tên trong body:

```json
{ "error": "dailyGoalXp phải là 10, 20, 30 hoặc 50.", "field": "dailyGoalXp" }
```

| Status | Khi nào |
|---|---|
| 400 | Giá trị không hợp lệ, sai kiểu, trường lạ, body không phải JSON |
| 403 | `code: "profile_inactive"`: tài khoản không ở trạng thái active (bị khóa hoặc đã vô hiệu hóa) |
| 404 | Không tìm thấy hồ sơ |
| 409 | `code: "username_taken"` (kèm `field: "username"`): username đã có người dùng. `code: "concurrent_update"`: hồ sơ vừa được sửa ở request khác, tải lại rồi thử lại |

### Avatar

```js
const token = (await window.sb.auth.getSession()).data.session?.access_token;
const form = new FormData();
form.append('file', input.files[0]);
const response = await fetch('/api/users/me/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }, // không tự đặt Content-Type, trình duyệt sẽ thêm boundary
    body: form
});
const profile = await response.json();
AppUserBadge.resolveAvatarUrl(profile.avatarPath); // URL public trong bucket avatars
```

- Ảnh tối đa 2 MB (2097152 byte), chỉ nhận PNG, JPEG, WebP. Server kiểm tra nội dung file, không dựa vào đuôi hay `Content-Type`, nên file GIF đổi tên thành `.png` vẫn bị 400.
- `avatarPath` có dạng `{userId}/{tên ngẫu nhiên}.{png|jpg|webp}`, không có tiền tố `avatars/`. Mỗi lần upload sinh tên mới nên không cần chống cache. Server tự xóa ảnh cũ.
- Lỗi: 400 (`field: "file"`) khi thiếu file, file quá 2 MB hoặc sai định dạng. 403 như PATCH. 502 khi Supabase Storage không nhận file, `avatarPath` lúc đó giữ nguyên.

### Vô hiệu hóa tài khoản

`DELETE /api/users/me` trả 204, không có body. Sau đó `GET /api/users/me` vẫn đọc được hồ sơ (`status: "deactivated"`) nhưng PATCH và avatar trả 403. Tài khoản bị khóa (`suspended`) gọi endpoint này cũng nhận 403.
