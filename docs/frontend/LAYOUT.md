# Layout dùng chung: header/footer (SCRUM-32)

| File | Nội dung |
|---|---|
| `Pages/Shared/_Layout.cshtml` | Khung HTML chung: font, `themes.css`, `Components.css`, `Layout.css`, `toast.js`, header, footer |
| `Pages/Shared/_Header.cshtml` | Logo, điều hướng chính, đăng xuất |
| `Pages/Shared/_Footer.cshtml` | Bản quyền, link Điều khoản |
| `wwwroot/css/Shared/Layout.css` | Style header/footer, khung trang, thanh tab mobile |

## Dùng layout trong một trang

```cshtml
@page
@{
    Layout = "_Layout";
    ViewData["Title"] = "Học tập";          // <title>: "Học tập · SE347 Language App"
    // ViewData["ShowHeader"] = false;       // ẩn header
    // ViewData["ShowFooter"] = false;       // ẩn footer
}

@section Styles {
    <link rel="stylesheet" href="~/css/Study.css" />
}

@section Scripts {
    <script src="~/js/auth-guard.js" defer></script>
    <script src="~/js/study.js" defer></script>
}

<main class="study-page">
    ...
</main>
```

- Không viết lại `<html>`, `<head>`, `<body>` trong trang.
- Không nhúng lại `themes.css`, font, `Components.css`; layout đã nạp.
- Nội dung trang đặt trong một thẻ `<main>` ở cấp ngoài cùng. Layout dùng flex column để đẩy footer xuống đáy khi trang ngắn.

## Điều hướng

| Mục | URL | Ghi chú |
|---|---|---|
| Trang chủ | `/Index` | |
| Học tập | `/Study` | |
| Thi thử | `/TrialTest` | Trang làm bài ẩn header/footer |
| Xếp hạng | `/Ranking` | |
| Hồ sơ | `/Account/Profile` | Desktop: nằm bên phải cạnh Đăng xuất |

- Thêm/bớt mục: sửa mảng `links` trong `_Header.cshtml` (href, nhãn, path SVG 24×24).
- Mục đang mở được đánh dấu bằng class `is-active` và `aria-current="page"`, so sánh với `ViewContext.RouteData.Values["page"]`.
- ≤ 760px: điều hướng chuyển thành thanh tab cố định ở đáy; `body.has-site-header` có `padding-bottom` để nội dung không bị che.

## Trạng thái chuyển đổi

| Trang | Layout | Ghi chú |
|---|---|---|
| `Index`, `Study`, `Ranking`, `CreateQuiz`, `Account/Profile` | `_Layout` | Đã bỏ thanh điều hướng riêng của `Index` và `Profile` |
| `TrialTest` | `_Layout` | `ShowHeader = false`, `ShowFooter = false` |
| `Account/Login`, `Signup`, `Authentication`, `ForgetPassword`, `ResetPassword`, `Terms` | `null` | Giữ giao diện auth riêng |

Việc còn lại cho trang (UI):
- `Study.cshtml`: link "Hồ sơ" trong `study-header` trùng với header chung.
- `Ranking.cshtml`: link thương hiệu `ranking-brand` trùng với logo header.
- Khi mọi trang đã dùng `_Layout`, đặt `Layout = "_Layout"` trong `Pages/_ViewStart.cshtml` và bỏ khai báo ở từng trang.
