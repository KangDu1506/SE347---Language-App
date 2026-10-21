# Component dùng chung (SCRUM-29)

| File | Nội dung |
|---|---|
| `wwwroot/css/Shared/Components.css` | Style cho button, input, card, tag, sticker, mascot, toast (phong cách sticker, xem `docs/ux/STYLE_GUIDE.md` mục 9) |
| `wwwroot/js/Shared/toast.js` | API `window.AppToast` |
| `docs/frontend/components-preview.html` | Trang preview, mở qua static server tại thư mục gốc repo |

Cả hai file được nạp sẵn trong `Pages/Shared/_Layout.cshtml`. Trang dùng `Layout = "_Layout"` không cần khai báo thêm. Toàn bộ màu, cỡ chữ, bo góc lấy từ token trong `assets/_colorpalettes/themes.css` (xem `docs/ux/STYLE_GUIDE.md`), nên dark mode hoạt động tự động.

## Button

```html
<button class="btn btn--primary" type="submit">Lưu</button>
<a class="btn btn--secondary" href="/Study">Xem lộ trình</a>
```

| Class | Mục đích |
|---|---|
| `btn--primary` | Hành động chính (nền `--surface-orange`). Tối đa 1 nút primary trên mỗi khu vực |
| `btn--ink` | CTA nổi bật nhất trang (nền mực, chữ kem), ví dụ "Vào học" |
| `btn--secondary` | Hành động phụ |
| `btn--ghost` | Hành động ít quan trọng, link dạng nút |
| `btn--danger` | Xóa, hủy không hoàn tác |
| `btn--sm`, `btn--lg` | Kích thước 36px / 56px (mặc định 44px) |
| `btn--block` | Rộng 100% |

Trạng thái:
- Vô hiệu: thuộc tính `disabled` (thẻ `<button>`) hoặc `aria-disabled="true"` (thẻ `<a>`).
- Đang xử lý: `aria-busy="true"` kèm `disabled`, hiển thị spinner trước nhãn.

```js
button.disabled = true;
button.setAttribute('aria-busy', 'true');
// ... gọi API
button.disabled = false;
button.removeAttribute('aria-busy');
```

## Input

```html
<div class="field">
    <label class="field__label" for="email">Email</label>
    <input class="input" id="email" type="email" aria-describedby="email-hint">
    <span class="field__hint" id="email-hint">Dùng email đã đăng ký</span>
</div>
```

- Class `input` áp dụng cho `<input>`, `<select>`, `<textarea>`.
- Lỗi: đặt `aria-invalid="true"` trên input, thay `field__hint` bằng `<span class="field__error" id="...">`, và trỏ `aria-describedby` tới id đó.
- Focus dùng `--focus-ring`; không xóa outline.

## Card

```html
<article class="card">
    <div class="card__header">
        <div>
            <p class="card__eyebrow">Cấp độ A1</p>
            <h3 class="card__title">Từ vựng chủ đề Gia đình</h3>
        </div>
    </div>
    <p class="card__body">12 bài học · 30 phút</p>
    <div class="card__footer">
        <a class="btn btn--primary btn--sm" href="/Study">Học tiếp</a>
    </div>
</article>
```

| Biến thể | Mục đích |
|---|---|
| `card--interactive` | Toàn bộ card là link/nút. Dùng trên `<a>` hoặc `<button>`, không lồng thêm nút bên trong |
| `card--soft` | Khối thông tin phụ, nền `--bg-surface`, không đổ bóng |

## Toast

```js
AppToast.success('Đã lưu tiến độ bài học.');
AppToast.error('Không kết nối được máy chủ.', { duration: 6000 });
AppToast.warning('Bạn sắp mất chuỗi 5 ngày học.');
const t = AppToast.info('Đang đồng bộ...', { duration: 0 }); // không tự đóng
t.dismiss();
```

| Tham số | Mặc định | Mô tả |
|---|---|---|
| `type` | `info` | `success`, `error`, `warning`, `info` |
| `duration` | `4000` | Thời gian hiển thị (ms). `0`: chỉ đóng bằng nút × |

Hành vi:
- Tối đa 3 toast cùng lúc; toast cũ nhất tự đóng khi vượt.
- Di chuột vào toast thì tạm dừng đếm giờ.
- Vị trí: góc dưới phải (desktop), giữa phía trên (≤ 760px).
- Accessibility: vùng chứa `aria-live="polite"`; toast `error` dùng `role="alert"`, các loại khác dùng `role="status"`.
- Nội dung gán bằng `textContent`, không render HTML.

Gọi từ Vue (SCRUM-30):

```js
methods: {
    async save() {
        try {
            await api.saveProgress(this.progress);
            AppToast.success('Đã lưu tiến độ.');
        } catch {
            AppToast.error('Lưu thất bại. Thử lại sau.');
        }
    }
}
```

Quy tắc sử dụng: toast chỉ dùng cho phản hồi sau thao tác (lưu, gửi, lỗi mạng). Lỗi validate form hiển thị tại `field__error` của từng ô, không dùng toast.

## Tiện ích sticker

| Class | Mục đích |
|---|---|
| `.sticker` | Khối viền đậm + bóng cứng, không có padding/grid như `.card` |
| `.press` | Hiệu ứng nhấc khi hover, ấn xuống khi bấm (dùng cùng `.sticker`) |
| `.tag` | Nhãn viên thuốc viết hoa (eyebrow, danh mục) |
| `.foxy` | Mascot, xem `docs/ux/MASCOT.md` |
| `.visually-hidden` | Ẩn khỏi màn hình, trình đọc màn hình vẫn đọc |
