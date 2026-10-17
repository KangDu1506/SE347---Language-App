# SCRUM-33 — rà soát UI của language/theme controls

Ngày: 17/10/2026. Nhánh: `feat/scrum-33-language-theme`.

## Vấn đề và cách tổ chức mới

Hai select trước đây nằm trong một hàng độc lập trên mỗi trang, có nhãn lớn, không cùng container với card đăng nhập và không thuộc header. Chức năng hoạt động nhưng hierarchy và alignment chưa phù hợp.

- Trang tài khoản: một header tối giản, dùng lại tên thương hiệu SE347 Language ở bên trái; language selector có globe/chevron và nút theme ở bên phải. Container 1040px khớp card auth; mobile khớp container 480px hiện có. Phần “Language” của tên thương hiệu thu gọn trên mobile, vẫn giữ SE347.
- Các trang có header chung: tùy chọn nằm trong disclosure có biểu tượng sliders ở cuối header. Mở ra để chọn ngôn ngữ và theme. Không còn một hàng settings riêng chiếm chiều cao nội dung.
- Trang thi thử: giữ `ShowHeader = false`; control nằm trong `trial-topbar` hiện có cùng bộ đếm và liên kết thoát, không bổ sung navbar cho lúc làm bài.
- Signup/Terms: chuyển thương hiệu phía trên nội dung vào header để tránh xuất hiện hai logo. Không sửa nội dung card hoặc form.

Theo yêu cầu cập nhật, language control là button chuyển trực tiếp Việt ↔ Anh vì chỉ có hai ngôn ngữ. Nút hiển thị tên và cờ của ngôn ngữ hiện tại, icon hai chiều gợi ý chuyển đổi; tooltip và accessible label mô tả ngôn ngữ sẽ chuyển sang. Cờ SVG cục bộ (Việt Nam và Vương quốc Anh cho English) tránh phụ thuộc cách hệ điều hành render emoji. Theme là button 44px với icon sun/moon, tooltip, accessible label và `aria-pressed` phản ánh dark mode. Dùng lại token màu hiện có.

Disclosure dùng native `details/summary`: Enter mở; Escape đóng và trả focus về trigger; click bên ngoài đóng. Đây là disclosure chứa form controls, không gán role menu hoặc trap focus như modal. Panel căn theo mép phải header và đã đo bounds ở các kích thước kiểm thử.

Header công khai dành phần chiều cao riêng; min-height của container ngoài được trừ tương ứng để tránh cộng thêm một màn hình trống. Không sửa width, padding, grid columns hoặc min-height của card auth và các field bên trong.

## Phạm vi thay đổi của lần sửa UI này

Danh sách dưới đây so với trạng thái working tree ngay trước yêu cầu chỉnh UI, không phải so với HEAD. Nhánh còn chứa các thay đổi i18n/theme chưa commit từ công việc trước; đã giữ lại các thay đổi đó.

| File | Lý do |
|---|---|
| `Pages/Shared/_Preferences.cshtml` | Hai nút gọn: chuyển ngôn ngữ kèm cờ/tên hiện tại và icon button theme |
| `Pages/Shared/_AccountHeader.cshtml` — mới | Header tối giản cho sáu trang tài khoản, tái sử dụng thương hiệu và partial preferences |
| `Pages/Shared/_PreferencesMenu.cshtml` — mới | Disclosure nhỏ cho header các trang chính |
| `Pages/Shared/_Header.cshtml` | Đặt disclosure vào header hiện có, cạnh đăng xuất |
| `Pages/Shared/_Layout.cshtml` | Bỏ preferences strip rời; giữ nguyên điều kiện hiển thị header/footer |
| `Pages/Account/Login.cshtml`, `Pages/Account/Signup.cshtml`, `Pages/Account/Authentication.cshtml`, `Pages/Account/ForgetPassword.cshtml`, `Pages/Account/ResetPassword.cshtml`, `Pages/Account/Terms.cshtml` | Đổi chỗ gọi partial thành public header; bỏ thương hiệu lặp trên Signup/Terms |
| `Pages/TrialTest.cshtml` | Gắn cùng control vào topbar hiện có vì trang này ẩn site header |
| `wwwroot/css/Shared/Preferences.css` | Style scoped của control/public header/disclosure; giữ các quy tắc responsive có từ công việc trước |
| `wwwroot/js/Shared/i18n.js` | Thay binding theme select bằng button/aria-pressed, thêm dismiss disclosure; giữ nguyên tải dictionary, dịch, fallback, storage và Vue adapter |
| `wwwroot/images/flags/vi.svg`, `wwwroot/images/flags/gb.svg` — mới | Cờ SVG cho hai ngôn ngữ, nạp sẵn để đổi ngay khi bấm |
| `wwwroot/assets/_lang/vi.json`, `wwwroot/assets/_lang/en.json` | Thêm hai key `settings.switch_to_en`/`settings.switch_to_vi` cho nhãn thao tác của language button; giữ nguyên các bản dịch khác |
| `docs/test/language-theme-browser.cjs` | Đổi thao tác sang theme button, đo panel/touch target/placement, thử bàn phím và bổ sung mốc breakpoint/ảnh chụp |
| `docs/frontend/PREFERENCES_UI_REVIEW.md` — mới | Báo cáo lần chỉnh UI này |
| `docs/frontend/LANGUAGE_THEME.md` | Cập nhật hướng dẫn tích hợp control và liên kết tới báo cáo UI, giữ lịch sử kiểm thử cũ |

Không sửa authentication script, Google Login, data profile, bài học, API, database, CSS card tài khoản, design tokens hoặc hình minh họa SE trong lần chỉnh này. Đã đối chiếu markup form của sáu trang tài khoản với snapshot trước sửa: giữ nguyên từng byte. Các selector mới đều thuộc `.app-preferences`, `.account-toolbar`, `.preferences-menu` hoặc phần header chứa chúng; không thêm quy tắc toàn cục cho button/select/input/body.

## Kiểm thử thực tế

Ứng dụng được build vào output riêng `bin/UIReview` và chạy tại `http://localhost:5348` để tránh xung đột với instance ở cổng 5347. Không sửa launchSettings hoặc cấu hình môi trường của dự án.

```powershell
dotnet build --no-restore --output bin/UIReview
dotnet bin/UIReview/SE347.dll --urls http://localhost:5348 --environment Development
$env:APP_URL = 'http://localhost:5348'
$env:SCREENSHOT_DIR = Join-Path $env:TEMP 'scrum33-ui-after'
node docs/test/language-theme-browser.cjs
```

Build đạt 0 warning, 0 error. Ma trận browser đạt **576 trường hợp**: 12 trang × 12 chiều rộng × Việt/Anh × Light/Dark. Chiều rộng: 320, 375, 390, 430, 520, 521, 760, 761, 768, 1000, 1001, 1280px; viewport cao 900px.

Trang kiểm tra: Index, Study, Ranking, Account/Profile, CreateQuiz, TrialTest, Account/Login, Account/Signup, Account/Authentication, Account/ForgetPassword, Account/ResetPassword, Account/Terms.

Kiểm tra đã chạy:

- Mỗi trang có đúng một bộ control và nằm trong header/topbar, không còn strip rời.
- Hai button có kích thước tối thiểu 44px; panel nằm trong chiều rộng viewport khi mở, không có horizontal overflow toàn trang. Cờ được kiểm tra đã tải thành công và đúng với ngôn ngữ hiện tại.
- Đổi theme không đổi geometry của main/form/control; không có key thiếu hoặc exception JavaScript trong ma trận.
- Chuyển ngôn ngữ hai chiều, toggle theme hai chiều, độc lập state; F5, chuyển trang và đồng bộ tab giữ lựa chọn.
- Enter mở disclosure, kích hoạt theme button và chuyển ngôn ngữ qua lại; Escape đóng/trả focus; click bên ngoài đóng.
- Giữ dữ liệu/focus/selection của form khi cập nhật bằng service, giữ giá trị topic/đáp án/bài tập, giữ validation/password toggle.
- Fallback, node mới và trường hợp chặn localStorage hoặc tải JSON thất bại tiếp tục hoạt động.

Ảnh trước sửa lưu ở `%TEMP%\scrum33-ui-before`; ảnh sau sửa ở `%TEMP%\scrum33-ui-after`. Ảnh sau bao gồm Login, Signup và Index ở 320/768/1280px với bốn tổ hợp ngôn ngữ/theme; đã xem các ảnh desktop/mobile đại diện để đối chiếu alignment, hierarchy và card. Không thêm các ảnh kiểm thử vào source assets của ứng dụng.

## Giới hạn

- Cần kiểm tra trực tiếp trên Safari/iOS và Android thật. Browser automation hiện dùng Chrome trên Windows; language button dùng hành vi button native, không còn dropdown.
- Không kiểm chứng lại Supabase/JWT/OTP hoặc lưu profile thật trong task UI. Cảnh báo DataProtection/Event Log của môi trường đã có từ trước và không được chỉnh trong phạm vi này.
- Khi xem ảnh trang chủ, phát hiện một số chuỗi tiếng Việt còn hiện ký tự HTML entity như `&#183;` từ dictionary có trước lần chỉnh UI. Không sửa dictionary trong yêu cầu chỉ bố trí control này.
- Nếu đang chạy app bằng `dotnet run` trước lần sửa, dừng rồi chạy lại để Razor markup và static assets cùng phiên bản. Native select/dropdown có thể cần hard refresh nếu trình duyệt đang giữ CSS cũ.

Chưa commit, push hoặc merge; không thay trạng thái Jira.

## Điều chỉnh phần mật khẩu theo yêu cầu tiếp theo

Đã rà soát các control ẩn/hiện trong mã nguồn: có ba control trên Login, Signup và ResetPassword. Cả ba dùng partial mới `Pages/Shared/_PasswordVisibilityIcon.cshtml`, hiển thị mắt khi có thể xem và mắt gạch khi có thể ẩn. `aria-label`/tooltip vẫn dịch theo Việt/Anh; không đặt binding thay toàn bộ text lên button chứa SVG để tránh mất icon khi đổi ngôn ngữ.

`Pages/Account/Login.cshtml`, `Signup.cshtml`, `ResetPassword.cshtml` chỉ đổi nội dung/nút visibility liên quan. `wwwroot/js/login.js`, `signup.js`, `reset-password.js` cập nhật trạng thái icon, nhãn và cho phép Enter kích hoạt button bằng bàn phím; luồng submit/xác thực giữ nguyên. `wwwroot/css/Account/Account.css` đặt vùng bấm icon 44px và bỏ giới hạn 260px của riêng mô tả trong `.auth-layout--login`; bỏ min-width cũ dành cho nhãn chữ trong `Preferences.css`.

Dòng “Tiếp tục hành trình học tiếng Anh của bạn.” đã kiểm tra nằm một hàng ở desktop 1280px, cả Việt và Anh; màn hình hẹp được xuống dòng tự nhiên để không tràn hoặc thu nhỏ chữ. Không thay kích thước hình SE hay card. Kiểm tra bổ sung cho cả ba control: giữ giá trị khi chuyển ẩn/hiện hai chiều, icon không bị mất, nhãn theo ngôn ngữ, Enter không submit nhầm form; ResetPassword giữ hành vi chuyển đồng thời mật khẩu mới và xác nhận. Ma trận 576 trường hợp vẫn đạt sau các thay đổi này.
