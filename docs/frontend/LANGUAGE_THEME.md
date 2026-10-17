# SCRUM-33: ngôn ngữ và giao diện

> Bố trí control đã được cập nhật trong lần chỉnh UI tiếp theo. Xem [báo cáo UI](PREFERENCES_UI_REVIEW.md) để biết public header, preferences disclosure và kết quả kiểm thử mới nhất. Các kết quả 288 trường hợp bên dưới là của lần triển khai ban đầu.

Ngày kiểm tra: 17/10/2026. Nhánh: `feat/scrum-33-language-theme`.

## Khảo sát ban đầu

Ứng dụng thực tế là ASP.NET Core Razor Pages, .NET 10, JavaScript ES6+ và CSS thuần. README đề cập Vue 3 CDN nhưng không có Vue runtime hoặc `createApp` trong các trang đang chạy. Không bổ sung framework hoặc npm build system.

Luồng hiện có: đăng nhập/đăng ký → xác thực → trang chủ → học tập/thi thử/xếp hạng/hồ sơ. Có trang tạo đề và luồng quên/đặt lại mật khẩu. Trang chủ, học tập, xếp hạng, hồ sơ, tạo đề và thi thử dùng `_Layout`; thi thử ẩn header/footer. Sáu trang tài khoản còn lại sở hữu HTML document riêng. Script chủ yếu dùng DOMContentLoaded và sessionStorage cho luồng tài khoản; chưa có state/event bus cho preferences.

Các thành phần tái sử dụng: `_Layout`, `_Header`, `_Footer`, `Components.css`, `toast.js`, bảng token `wwwroot/assets/_colorpalettes/themes.css`, CSS tài khoản `Account.css`. Màu chính cam ấm, màu phụ xanh, font Be Vietnam Pro/Segoe UI; giữ lại các token spacing, typography, radius và breakpoint hiện có.

`wwwroot/assets/_lang/vi.json`, `en.json` đã tồn tại, mỗi file 21 key phẳng. Không có `_lang/shared.json`, không có consumer hoặc ngữ nghĩa của shared.json cần bảo toàn; không tạo file trùng. Login/Signup đã có vài `data-i18n` nhưng key không khớp JSON và chưa có service thực thi. Không thấy control chuyển ngôn ngữ/theme trong app. Bảng light/dark đã có nhưng thiếu state, persistence và control; CSS các trang chính ghi cứng màu nên trạng thái Jira Done chưa tương ứng một luồng hoạt động hoàn chỉnh.

Working tree ban đầu sạch. Đã tạo nhánh riêng trước khi sửa. Có `UiLocale` ở profile và `Theme` ở user_settings, nhưng API hồ sơ chỉ có GET và frontend hiện chưa dùng JWT/profile thật. Chọn localStorage cho cả hai preference; không có cơ chế ghi profile song song, không sửa API/schema/migration/authentication.

## Đánh giá task

| Task | Ban đầu | Đã xử lý | Sau triển khai |
|---|---|---|---|
| SCRUM-34 | Một phần; JSON có sẵn, marker chưa thực thi | Mở rộng JSON, service tập trung, fallback, text/placeholder/title/aria-label/meta, nội dung động và validation | Hoạt động trong 12 trang được kiểm thử; có adapter cho Vue tương lai |
| SCRUM-35 | Chưa có luồng chuyển và lưu UI language | Control dùng chung, đổi ngay, lưu localStorage, cập nhật html lang, đồng bộ tab | Kiểm thử chuyển hai chiều, chuyển trang và refresh đạt |
| SCRUM-36 | Có token light/dark; chưa có control/persistence và CSS còn hardcode | Khởi tạo sớm, control dùng chung, chuyển màu trang chính sang token, sửa responsive và tương phản hero | Kiểm thử cả hai theme, persistence và geometry đạt |

## Danh sách file

Tạo mới:

| File | Mục đích |
|---|---|
| `Pages/Shared/_Preferences.cshtml` | Một partial chứa nút chuyển Việt/Anh kèm cờ và theme icon button có accessible label; dùng lại trong header/topbar |
| `Pages/Shared/_PreferencesHead.cshtml` | Nạp bootstrap đồng bộ trước stylesheet và service defer trước page scripts |
| `wwwroot/js/Shared/preferences-init.js` | Đọc preference an toàn, đặt theme/lang trên html trước lần vẽ đầu |
| `wwwroot/js/Shared/i18n.js` | Một nguồn state, tải hai dictionary, dịch DOM có đánh dấu, cập nhật nội dung động, persistence, storage events, Vue adapter |
| `wwwroot/css/Shared/Preferences.css` | Style control theo token; sửa tablet auth, header, card/form và màn hình hẹp |
| `docs/test/language-theme-browser.cjs` | Kiểm thử Chrome qua CDP bằng Node, không cài dependency |
| `docs/frontend/LANGUAGE_THEME.md` | Báo cáo và hướng dẫn này |

Chỉnh sửa:

| File | Mục đích |
|---|---|
| `Pages/Shared/_Layout.cshtml`, `Pages/Shared/_Header.cshtml`, `Pages/Shared/_Footer.cshtml` | Nạp service/control, dịch title/navigation/footer và nhãn truy cập |
| `Pages/Index.cshtml`, `Pages/Study.cshtml`, `Pages/Ranking.cshtml`, `Pages/CreateQuiz.cshtml`, `Pages/TrialTest.cshtml` | Đánh dấu các đoạn UI và thuộc tính; tách text khỏi control; giữ nguyên giá trị option/chọn đáp án |
| `Pages/Account/Profile.cshtml`, `Pages/Account/Login.cshtml`, `Pages/Account/Signup.cshtml`, `Pages/Account/Authentication.cshtml`, `Pages/Account/ForgetPassword.cshtml`, `Pages/Account/ResetPassword.cshtml`, `Pages/Account/Terms.cshtml` | Dịch UI; nạp cùng partial cho các document riêng; giữ input, icon và liên kết |
| `wwwroot/assets/_lang/vi.json`, `wwwroot/assets/_lang/en.json` | Giữ key cũ, bổ sung key dùng chung và nhóm settings/auth/quiz/validation/footer |
| `wwwroot/assets/_colorpalettes/themes.css` | Làm tối điểm cuối gradient bằng cách trộn token brand hiện có để chữ sáng dễ đọc ở cả hai theme |
| `wwwroot/css/index.css`, `wwwroot/css/Study.css`, `wwwroot/css/Ranking.css`, `wwwroot/css/CreateQuiz.css`, `wwwroot/css/TrialTest.css`, `wwwroot/css/Account/Profile.css` | Thay màu hardcode bằng token tương ứng; giữ cấu trúc CSS, layout và breakpoint; sửa active filter |
| `wwwroot/js/login.js`, `wwwroot/js/signup.js`, `wwwroot/js/authentication.js`, `wwwroot/js/forget-password.js`, `wwwroot/js/reset-password.js` | Thông báo/strength/password-toggle dùng key reactive; validation signup gồm cả checkbox điều khoản; giữ logic nghiệp vụ hiện có |
| `wwwroot/js/Shared/toast.js` | Nhãn đóng thông báo nhận ngôn ngữ hiện tại |

Giữ lại kiến trúc Razor, các partial và component cũ, bảng màu cam–xanh, CSS tài khoản dùng token, dữ liệu/tên người dùng, câu hỏi tiếng Anh, đáp án, tiến độ và API/backend. Không tạo shared.json, hệ i18n thứ hai, database migration hoặc thư viện mới.

## Cơ chế và cách mở rộng

Mặc định `vi` + `light`. `se347.language` và `se347.theme` trong localStorage là nguồn preference trên trình duyệt, dùng chung origin và độc lập với tài khoản/session. Logout không xóa hai khóa này. Dữ liệu sai/không có được chuẩn hóa về mặc định. Khi localStorage bị chặn, đổi trong trang vẫn hoạt động nhưng không bảo đảm giữ qua refresh. `storage` event cập nhật tab khác mà không ghi lặp lại.

Theme bootstrap là external script đồng bộ trước CSS. Đổi theme chỉ sửa `html[data-theme]`; không mount lại trang. Service tải sẵn hai dictionary, dùng fallback `vi`, sau đó giữ text Razor hiện có khi thiếu key. `t(key, fallback)` trả chuỗi fallback hoặc chuỗi rỗng khi không có key; không trả tên key/undefined/null. JSON lỗi/mất mạng giữ UI Razor; thông báo động chưa có text dùng lời nhắc thử lại, không gây exception. Khi khởi tạo ngôn ngữ lưu là English, text Razor có thể xuất hiện bằng tiếng Việt trong lúc JSON đang tải; đây là giới hạn riêng của i18n client, theme đã được đặt trước stylesheet.

Thêm key vào **cả** `wwwroot/assets/_lang/vi.json` và `en.json`, giữ cấu trúc phẳng hiện có. Ưu tiên dùng lại key phù hợp; các nhóm `ui.*`, `settings.*`, `auth.*`, `quiz.*`, `validation.*`, `footer.*` thể hiện phạm vi sử dụng. Không đổi ý nghĩa key đang có. Các chuỗi trong JSON là plain text, không chứa HTML.

```html
<button type="button" data-i18n="ui.sign_in">Đăng nhập</button>
<label>
    <span data-i18n="ui.password">Mật khẩu</span>
    <input type="password" data-i18n-placeholder="ui.password">
</label>
<button aria-label="Hiện mật khẩu" data-i18n-aria-label="ui.show_password">…</button>
```

Chỉ đặt `data-i18n` trên phần text có thể thay thế toàn bộ. Không đặt lên label chứa input, button chứa icon cần giữ lại hoặc container chứa dữ liệu động. Dùng span cho text riêng. `data-i18n-text` chỉ cập nhật text node trực tiếp đầu tiên, dành cho liên kết chứa avatar. `data-i18n-title`, `data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-content` hỗ trợ thuộc tính tương ứng.

```js
// Chờ dictionary cho logic cần chuỗi ngay.
await AppI18n.ready;
const text = AppI18n.t('ui.password', 'Mật khẩu');
// Binding giữ thông báo đang hiển thị cập nhật khi đổi ngôn ngữ.
AppI18n.setText(messageElement, 'validation.required');
```

MutationObserver xử lý node mới có marker và thay đổi key; không tự quét/dịch văn bản nghiệp vụ. Khi muốn chủ động: `AppI18n.translate(container)`. Không sao chép service hoặc listener vào từng page. Trang dùng `_Layout` nhận preferences qua `_Header`; trang ẩn header tự tích hợp partial vào topbar của mình. Trang tài khoản sở hữu HTML document riêng nạp `_PreferencesHead` sau charset/trước stylesheet, `Preferences.css` sau CSS riêng và `_AccountHeader` đầu body. Không render thêm `_Preferences` thành hàng độc lập ngoài header.

Vue tương lai: đặt `data-i18n-vue` ở mount root; service DOM bỏ qua cây đó. Trong `setup()`, gọi `const { locale, t } = AppI18n.useVue(Vue)` và dùng `{{ t('ui.password', 'Mật khẩu') }}`/`:placeholder="t(...)"` trong template. Adapter dùng ref để render lại khi ngôn ngữ/dictionary đổi, gỡ listener khi unmount. Không thao tác DOM do Vue quản lý. Adapter chưa kiểm chứng với Vue runtime thực vì repo chưa có Vue mount.

Thêm locale mới: thêm dictionary cùng key, bổ sung mã locale vào bootstrap/service (danh sách tải, kiểm tra hợp lệ và storage handler). Nút chuyển hiện tại dành cho đúng hai ngôn ngữ Việt/Anh; khi hỗ trợ thêm locale cần đổi control sang menu phù hợp thay vì mở rộng phép chuyển hai trạng thái. Dịch chỉ UI; không thay ngôn ngữ khóa học, text bài tập, đáp án hay giá trị form.

Component mới dùng `var(--bg-card)`, `var(--text-primary)`, `var(--border-color)`, `var(--color-primary)`/`var(--text-on-primary)`, token trạng thái và `--focus-ring`. Không viết màu light/dark riêng từng component; không sửa kích thước/spacing/font trong selector theme. `Preferences.css` đặt `color-scheme` để control native phù hợp theme.

## Kiểm thử và giới hạn

Lệnh đã chạy:

```powershell
dotnet build --no-restore
dotnet run --no-build --launch-profile http
node docs/test/language-theme-browser.cjs
git -c core.whitespace=cr-at-eol diff --check
```

Build cuối đạt **0 warning, 0 error** với dependency sẵn trong môi trường. Hai dictionary có **247 key khớp nhau**; kiểm tra cú pháp JavaScript và diff whitespace đạt. Giữ kiểu xuống dòng gốc từng file; tùy chọn `cr-at-eol` chỉ áp dụng cho lệnh kiểm tra, không sửa cấu hình Git. Có một lần build giữa chừng thất bại vì executable đang chạy bị khóa; đã dừng instance thử nghiệm và build lại thành công. Lần chạy sandbox phát cảnh báo giải mã DataProtection/Event Log nhưng vẫn phục vụ trang; không sửa cấu hình bảo mật hoặc secrets. Lần thử khởi động thêm instance ngoài sandbox gặp cổng 5347 đang được instance thử nghiệm sử dụng; kiểm thử tiếp tục trên instance đã chạy.

Script browser cần Chrome chạy với `--headless=new --remote-debugging-port=9347` và profile thử nghiệm riêng, Node 22+ có WebSocket. `APP_URL` và `CHROME_DEBUG_URL` đổi địa chỉ mặc định. `SCREENSHOT_DIR` tùy chọn ghi ảnh PNG cho Index/Study/Profile/Login ở 320 và 1280px; ảnh lần kiểm tra lưu ngoài repo trong thư mục temp thử nghiệm. Không có npm dependency hoặc cấu hình hệ thống mới.

Ma trận: **288 trường hợp = 12 trang × 6 chiều rộng × 2 ngôn ngữ × 2 theme**. Chiều rộng: 320, 375, 390, 430, 768, 1280px; chiều cao viewport 900px. Trang: `/Index`, `/Study`, `/Ranking`, `/Account/Profile`, `/CreateQuiz`, `/TrialTest`, `/Account/Login`, `/Account/Signup`, `/Account/Authentication`, `/Account/ForgetPassword`, `/Account/ResetPassword`, `/Account/Terms`.

Các kiểm tra đạt: không horizontal document overflow, không thiếu key trên marker text, không exception JavaScript; geometry của main/control không đổi khi chuyển theme. Kiểm tra riêng: giữ node/input value/focus/selection và giá trị topic khi đổi lựa chọn; giữ đáp án/câu hỏi; chuyển hai chiều bằng control không reload; chuyển trang và reload giữ preference; đồng bộ hai tab; fallback key thiếu; validation và password toggle đổi theo ngôn ngữ; node/placeholder mới; localStorage bị chặn và fetch dictionary thất bại không làm hỏng UI.

Quét text tiếng Việt khi UI English chỉ còn tên người dùng mẫu trên Ranking/Profile, được giữ nguyên có chủ đích. Đã xem ảnh chụp desktop và mobile của các trang đại diện để rà layout và màu. Thanh lọc bài học có scroll ngang nội bộ trên màn hình nhỏ; đây là hành vi sẵn có, không phải tràn ngang toàn trang.

Chưa kiểm chứng: đăng nhập Supabase/JWT thật, gửi email/OTP và ghi preference vào profile/database; trình duyệt Safari/Firefox, thiết bị thật, mọi trạng thái API/modal tương lai, Vue runtime thực, đo CLS toàn phiên bằng công cụ chuyên dụng. Test sử dụng cookie/session giả lập phù hợp với cơ chế auth hiện có trong repo; không thể xem đây là bằng chứng authentication backend an toàn/hoạt động thật. Native browser validation còn phụ thuộc ngôn ngữ trình duyệt; validation do ứng dụng render đã được dịch. Không khẳng định mọi cặp màu trong toàn bộ app đã qua một cuộc audit WCAG; gradient hero đã được làm tối và các component chuyển sang token chung.

Chưa push, merge hoặc sửa trạng thái Jira.
