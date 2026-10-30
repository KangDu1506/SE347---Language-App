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
