# Style Guide sơ bộ (SCRUM-46)

Bộ token chung cho màu, font, bo góc, khoảng cách và đổ bóng. Mục tiêu là để mọi trang dùng chung một bảng màu thay vì ghi cứng mã hex trong từng file CSS.

- Token: [`wwwroot/assets/_colorpalettes/themes.css`](../../wwwroot/assets/_colorpalettes/themes.css)
- Xem trực quan: mở [`docs/ux/style-guide.html`](./style-guide.html) bằng trình duyệt. Trang có nút đổi Light/Dark và tự tính tỉ lệ tương phản.

## 1. Cách dùng

Thêm vào `<head>` của trang, **trước** file CSS riêng của trang:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="~/assets/_colorpalettes/themes.css" />
```

Trong CSS của trang, dùng biến thay cho mã hex:

```css
body { color: var(--text-primary); background: var(--bg-main); font-family: var(--font-sans); }
.login-card button { color: var(--text-on-primary); background: var(--color-primary); border-radius: var(--radius-sm); }
.login-card button:hover { background: var(--color-primary-hover); }
```

Dark mode: đặt `data-theme="dark"` lên thẻ `<html>`.

## 2. Màu sắc

Hướng màu đã chốt: **cam ấm là màu chính, xanh là màu phụ**. Đây là tông mà phần lớn các trang đang dùng.

### Màu chính · cam

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--color-primary` | `#a65f12` | `#f0a440` | Nút chính, link, tab đang chọn |
| `--color-primary-hover` | `#8f5410` | `#f5b660` | Hover của nút chính |
| `--color-brand` | `#d88920` | `#d88920` | **Chỉ** dùng cho icon, hình minh họa, mascot, gradient |
| `--color-brand-dark` | `#69451f` | `#3a2610` | Đầu tối của gradient hero |
| `--gradient-hero` | brand-dark → brand | | Banner hero trên dashboard |

> **Quy tắc quan trọng:** không đặt chữ lên nền `#d88920`. Chữ kem trên nền này chỉ đạt **2.69:1**, không qua chuẩn WCAG AA (cần 4.5:1). Nút "Đăng nhập" ở `Login.css` hiện đang mắc lỗi này. Với nút, hãy dùng `--color-primary`, đạt 4.74:1.

### Màu phụ · xanh

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--color-secondary` | `#2563eb` | `#7aa7ff` | Link phụ, icon bài nghe, focus ring |
| `--color-secondary-dark` | `#17345f` | `#bcd4ff` | Tiêu đề trên nền sáng (nếu cần nhấn) |
| `--color-secondary-soft` | `#dbe5f5` | `#1e2b45` | Nền nhấn xanh |

### Nền, viền, chữ

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--bg-main` | `#fffaf2` | `#1a140d` | Nền trang |
| `--bg-surface` | `#fffdf9` | `#241b12` | Khung, panel |
| `--bg-card` | `#ffffff` | `#2e2318` | Thẻ, ô nhập |
| `--bg-soft` | `#fff1d9` | `#3a2b1b` | Badge, ô được chọn |
| `--border-color` | `#eadfcf` | `#4a3a28` | Viền thẻ |
| `--border-strong` | `#d9c5a7` | `#6b5539` | Viền ô nhập, nút phụ |
| `--text-primary` | `#513b22` | `#fbf3e6` | Chữ chính (10.1:1) |
| `--text-secondary` | `#806b50` | `#d9c5a7` | Chữ phụ, mô tả (4.9:1) |
| `--text-on-primary` | `#fffaf2` | `#1a140d` | Chữ trên nút chính |
| `--text-on-brand` | `#fffaf2` | `#fffaf2` | Chữ trên hero, đặt ở nửa tối của gradient |

### Trạng thái

Dùng theo cặp: chữ màu `--status-*` trên nền `--status-*-soft`.

| Trạng thái | Chữ | Nền | Tương phản (light) |
|---|---|---|---|
| Thành công / trả lời đúng | `#16805b` | `#f0faf5` | 4.61:1 |
| Lỗi / trả lời sai | `#b42318` | `#fdecea` | 5.75:1 |
| Cảnh báo / sắp mất chuỗi | `#b45309` | `#fff1d9` | 4.50:1 |

## 3. Typography

- Font: **Be Vietnam Pro**, được thiết kế cho tiếng Việt nên dấu hiển thị chuẩn. Dự phòng là `Segoe UI` và `system-ui`.
- Độ đậm: 400 cho nội dung, 600 cho điều hướng, 700 cho nhãn, 800 cho tiêu đề và nút.

| Token | Cỡ | Dùng cho |
|---|---|---|
| `--fs-hero` | 32–48px (clamp) | Tiêu đề hero |
| `--fs-2xl` | 32px | h1 |
| `--fs-xl` | 24px | h2, tiêu đề mục |
| `--fs-lg` | 18px | Tiêu đề thẻ |
| `--fs-md` | 16px | Nội dung |
| `--fs-sm` | 14px | Chữ phụ, nav |
| `--fs-xs` | 12px | Nhãn, badge (viết hoa, giãn chữ .06em) |

Line-height: `--lh-body` 1.6 cho đoạn văn, `--lh-tight` 1.15 cho tiêu đề.

## 4. Bo góc

Hiện tại CSS đang dùng 12 giá trị bo góc khác nhau. Gom lại còn 4:

| Token | Giá trị | Dùng cho | Thay cho |
|---|---|---|---|
| `--radius-sm` | 8px | Nút, input, chip, alert | 7px, 8px, 10px, 11px |
| `--radius-md` | 14px | Thẻ, modal | 12px, 14px, 16px, 18px |
| `--radius-lg` | 24px | Hero, khối lớn | 24px |
| `--radius-pill` | 999px | Badge, thanh tiến độ | 99px |

Hình tròn (avatar, vòng tiến độ) vẫn dùng `50%`.

## 5. Khoảng cách & đổ bóng

- Khoảng cách theo bội số 4px: `--space-1` (4px) … `--space-8` (64px). Padding thẻ dùng `--space-5` (24px), khoảng cách giữa các section dùng `--space-7` (48px).
- Đổ bóng có ánh nâu cho hợp tông ấm: `--shadow-sm` (input), `--shadow-md` (thẻ), `--shadow-lg` (hero, modal).

## 6. Accessibility tối thiểu

- Chữ thường phải đạt tương phản ≥ 4.5:1. Mọi cặp chữ/nền trong bảng trên đều đạt, trừ `--color-brand`.
- Nút và ô nhập cao tối thiểu **44px** để dễ bấm trên điện thoại.
- Focus: dùng `box-shadow: var(--focus-ring)` trong `:focus-visible`, không được xóa outline mà không có thay thế.
- Lỗi form: viền `--status-error`, thêm dòng chữ lỗi gắn với ô qua `aria-describedby`, đặt `aria-invalid="true"`.

## 7. Bảng đổi mã màu cũ → token

Dùng cho nhóm UI khi chuyển CSS của từng trang sang token:

| Mã cũ | Token mới | Ghi chú |
|---|---|---|
| `#fffaf2` | `--bg-main` hoặc `--text-on-primary` | Tùy là nền hay chữ |
| `#fffdf9` | `--bg-surface` | |
| `#fff`, `#ffffff` | `--bg-card` | |
| `#fff1d9` | `--bg-soft` | |
| `#eadfcf`, `#f0e6d2` | `--border-color` | |
| `#d9c5a7` | `--border-strong` | |
| `#513b22` | `--text-primary` | |
| `#806b50`, `#64748b`, `#8291a5`, `#526581` | `--text-secondary` | |
| `#d88920` (nền nút) | `--color-primary` | Sửa lỗi tương phản |
| `#d88920` (icon, gradient) | `--color-brand` | |
| `#b56a16`, `#a66a25` | `--color-primary` hoặc `--color-primary-hover` | `#b56a16` chỉ đạt 4.0:1 |
| `#69451f` | `--color-brand-dark` | |
| `#2563eb` | `--color-secondary` | |
| `#17345f`, `#304766` | `--color-secondary-dark` hoặc `--text-primary` | |
| `#dbe5f5`, `#dbeafe` | `--color-secondary-soft` | |
| `#16805b` / `#e7f7f0` | `--status-success` / `--status-success-soft` | |
| `#b42318` | `--status-error` | |

## 8. Hiện trạng cần xử lý (ngoài phạm vi SCRUM-46)

1. Chưa trang nào nhúng `themes.css`, và cả 10 file CSS đều ghi cứng mã màu.
2. Nhiều file CSS có hai lớp style: một lớp tông xanh ban đầu, rồi một khối `html body ...` tông cam ghi đè lên. Khi chuyển sang token nên xóa lớp xanh cũ để file gọn hơn.
3. Nút chính ở `Login.css` (và các nút nền `#d88920` khác) không đạt tương phản. Cần đổi sang `--color-primary`.
4. Thư mục `Pages/Shared` chưa có layout dùng chung, nên mỗi trang phải tự nhúng font và `themes.css`. Có `_Layout.cshtml` thì chỉ cần nhúng một lần.
