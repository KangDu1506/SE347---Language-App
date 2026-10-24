# Mascot Foxy (SCRUM-45)

Foxy là chú cáo cam quàng khăn tím, theo bảng màu "Kẹo ngọt" của style guide. Chọn sau vòng 3 concept vì hợp tông cam và dễ vẽ thêm trạng thái.

- File: [`wwwroot/images/mascot/foxy.svg`](../../wwwroot/images/mascot/foxy.svg), sprite SVG, khung `240×240`.
- Style: [`Components.css`](../../wwwroot/css/Shared/Components.css) class `.foxy` (viền sticker bằng `filter: drop-shadow`).

## Trạng thái

| Id | Trạng thái | Dùng ở |
|---|---|---|
| `#foxy` | Vui (mặc định) | Thẻ "Tiếp tục học" trên Dashboard, quân cờ trên bàn cờ lộ trình (Học tập), Xếp hạng, Đăng ký, Xác thực, Đặt lại mật khẩu |
| `#foxy-wave` | Chào: giơ tay vẫy, nháy mắt | Đăng nhập, lần đầu vào app |
| `#foxy-sad` | Buồn: tai cụp, mày chau, giọt nước mắt | Quên mật khẩu, lỗi, mất chuỗi ngày học |
| `#foxy-head` | Chỉ phần đầu (khung 64×64) | Logo `Pages/Shared/_Brand.cshtml`; favicon riêng ở `images/mascot/favicon.svg` |

## Cách dùng

```html
<svg class="foxy" aria-hidden="true"><use href="/images/mascot/foxy.svg#foxy-wave" /></svg>
```

- Mascot là hình trang trí nên luôn có `aria-hidden="true"`; thông tin phải nằm ở chữ bên cạnh.
- Kích thước mặc định của `.foxy` là `160px`; đổi bằng `width`/`height` trong CSS của trang.
- Trang không nạp `Components.css` (các trang `Account/*` trừ Hồ sơ) dùng class `.auth-mascot` trong `Account.css`.
- Màu lấy từ biến CSS, mặc định khai báo trong `themes.css`: `--fox-fur` (lông), `--fox-ear` (tai trong), `--fox-accent` (chân), `--fox-cheek` (má), `--fox-scarf` / `--fox-scarf-dark` (khăn). Đổi biến trên một phần tử cha để đổi màu Foxy trong phạm vi đó (ví dụ khăn theo màu sự kiện).
- Viền Foxy theo `--ink`: kem trên nền tối, đen bên trong mảng màu.

## Thêm trạng thái mới

Các phần thân dùng chung nằm trong `<defs>` của sprite (`fx-tail`, `fx-body`, `fx-ear-l`, `fx-ear-r`, `fx-head`, `fx-eye-l`, `fx-eye-r`). Trạng thái mới là một `<symbol id="foxy-...">` ghép lại các phần này và chỉ vẽ thêm phần khác biệt (mắt, miệng, tay).
