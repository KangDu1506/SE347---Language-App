# SE347 Web Application

## Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Bắt buộc xem: Phân tích tĩnh](#bắt-buộc-xem-phân-tích-tĩnh)
- [Luồng xử lý và giải pháp kỹ thuật](#luồng-xử-lý-và-giải-pháp-kỹ-thuật)
- [DevTools](#devtools)
- [Chạy dự án](#chạy-dự-án)

## Công nghệ sử dụng

- **Backend:** ASP.NET Core Razor Pages trên .NET 10.
- **Database và ORM:** Supabase (PostgreSQL) + Entity Framework Core (Npgsql). Schema do `supabase/migrations` quản lý, entity chỉ map vào bảng có sẵn: **không** chạy `dotnet ef migrations` cho các bảng này.
- **Frontend:** HTML5, CSS3 và JavaScript ES6+.
  + *Framework:* Vue 3 CDN
- **Quản lý mã nguồn:** Git.

## Bắt buộc xem: Phân tích tĩnh

> **BẮT BUỘC XEM:** Các vấn đề dưới đây được ghi nhận qua rà soát tĩnh repo. Cần xử lý hoặc xác nhận trước khi dựa vào các luồng liên quan trong môi trường thật. Đây chưa phải kết quả kiểm thử runtime.

| Mức độ | Phát hiện | Bằng chứng | Ảnh hưởng |
|---|---|---|---|
| Thấp | Một số trang chỉ ẩn giao diện bằng JavaScript kiểm tra cookie `userToken=authenticated`. Cookie này do trình duyệt tự đặt sau khi đăng nhập, không phải thông tin xác thực được ký và có thể bị giả mạo; các trang Razor tương ứng không được bảo vệ phía server. | [`wwwroot/js/login.js`](wwwroot/js/login.js), [`wwwroot/js/auth-guard.js`](wwwroot/js/auth-guard.js), [`Program.cs`](Program.cs) | Người chưa đăng nhập có thể bỏ qua lớp ẩn giao diện và xem nội dung tĩnh của các trang. Đây không phải quyền truy cập vào API được bảo vệ: các endpoint có `RequireAuthorization` vẫn yêu cầu JWT Supabase. Không dùng cookie này để bảo vệ dữ liệu hoặc thao tác nhạy cảm. |
| Trung bình | Frontend hiện chưa thấy gọi các API nghiệp vụ `/api/users/*`; trang hồ sơ cũng chưa tải dữ liệu hồ sơ. | [`Endpoints/UserEndpoints.cs`](Endpoints/UserEndpoints.cs), [`wwwroot/js/profile.js`](wwwroot/js/profile.js) | Dữ liệu hồ sơ và kiểm tra username chưa được nối vào giao diện; chức năng hồ sơ chưa nhận hoặc hiển thị dữ liệu từ API. |
| Trung bình | Quy tắc tên cấm trong `is_valid_username` không nằm trong constraint bảng, trong khi quyền cập nhật trực tiếp cột `username` được cấp cho `authenticated`. | [`supabase/migrations/20261005090000_user_schema.sql`](supabase/migrations/20261005090000_user_schema.sql) | Cập nhật trực tiếp qua Supabase có thể đặt username dành riêng nếu không gọi hàm kiểm tra khả dụng. |
| Thấp | Form đăng ký dùng `novalidate`; khi checkbox đồng ý điều khoản chưa chọn, submit bị chặn nhưng vòng hiển thị lỗi bỏ qua checkbox. | [`Pages/Account/Signup.cshtml`](Pages/Account/Signup.cshtml), [`wwwroot/js/signup.js`](wwwroot/js/signup.js) | Người dùng có thể không được thông báo vì sao không thể gửi form. |

### Chẩn đoán runtime API (17/10/2026)

Đã chạy ứng dụng bằng profile `http` trong môi trường Development và gửi request HTTP tới các route dưới đây.

| Endpoint | Kết quả | Nhận xét |
|---|---|---|
| `GET /health` | `200 OK` | Ứng dụng khởi động và phục vụ request. |
| `GET /api/health` | `503 Service Unavailable` | Chưa có connection string Supabase trong môi trường đang chạy. |
| `GET /api/users/username-available` | `400 Bad Request` | Hành vi đúng khi thiếu tham số `username`. |
| `GET /api/users/username-available?username=abc` | `500 Internal Server Error` | Truy vấn DB thất bại do connection string chưa được khởi tạo. |
| `GET /api/users/me` và `GET /api/me` (không có token) | `401 Unauthorized` | Hai route được bảo vệ từ chối request chưa xác thực như dự kiến. |
| `GET /api/users/nonexistent-runtime-check` | `500 Internal Server Error` | Truy vấn hồ sơ cần DB nhưng connection string chưa được khởi tạo. |

**Giới hạn:** Chưa thể xác nhận phản hồi thành công của các API truy vấn DB hoặc thử xác thực với JWT hợp lệ cho tới khi cấu hình Supabase/database trong môi trường chạy. Các lỗi `500` ở trên phản ánh cấu hình runtime hiện tại, chưa đủ để kết luận truy vấn sẽ lỗi khi kết nối DB hợp lệ.

### Rà soát bảo mật luồng xác thực (18/10/2026)

Rà soát mã tĩnh luồng đăng ký, đăng nhập, xác minh email và khôi phục mật khẩu. Đăng ký/đăng nhập hiện gọi Supabase Auth (`signUp`, `signInWithPassword`); mã OTP được xác minh qua `verifyOtp`, và đổi mật khẩu yêu cầu phiên khôi phục do Supabase tạo. Không còn bằng chứng cho nhận định cũ rằng mật khẩu đăng ký được lưu trong `sessionStorage` hoặc mã OTP chỉ được kiểm tra ở trình duyệt.

Không ghi nhận lỗ hổng khai thác được trong các thao tác xác thực với Supabase trong phạm vi rà soát này. Cookie `userToken` chỉ điều khiển việc ẩn/hiện giao diện phía trình duyệt, có thể giả mạo nhưng không được các API bảo vệ dùng làm thông tin xác thực. Đây là giới hạn kiểm soát giao diện được ghi nhận ở mức thấp trong bảng trên, không phải bằng chứng vượt qua xác thực JWT của API. Chưa thực hiện kiểm thử động với tài khoản hoặc cấu hình Supabase thực.

## Luồng xử lý và giải pháp kỹ thuật

### Xác thực và giao diện

Các trang đăng nhập, đăng ký, quên mật khẩu và hồ sơ được tổ chức trong `Pages/Account`. Các thành phần dùng chung được đặt trong `Pages/Shared` để giữ giao diện nhất quán giữa các trang.

### Tạo bài kiểm tra và chấm điểm

- Dữ liệu được tổ chức theo quan hệ phân cấp giữa bộ đề, câu hỏi và các lựa chọn.
- Trình duyệt chỉ nhận nội dung câu hỏi và các lựa chọn, không nhận thông tin đáp án đúng.
- Logic chấm điểm và tính kết quả được xử lý tập trung ở backend.
- Các thao tác tạo hoặc cập nhật dữ liệu phức tạp nên được thực hiện trong database transaction để bảo đảm tính toàn vẹn.

### Quản lý tệp và truy cập bảo mật

- **Tài nguyên công khai:** Đặt trong `wwwroot` và có thể được phục vụ trực tiếp bởi ứng dụng.
- **Tài nguyên riêng tư:** Đặt trong `Storage`, nằm ngoài phạm vi tài nguyên tĩnh công khai.
- Tệp riêng tư chỉ nên được phân phối qua endpoint trung gian sau khi hệ thống xác thực và kiểm tra quyền truy cập.
- Tệp tải lên cần được kiểm tra định dạng, giới hạn dung lượng và đặt tên lưu trữ an toàn để tránh ghi đè hoặc khai thác đường dẫn.
- Trên production, Azure App Service chuyển hướng HTTP sang HTTPS; ứng dụng gửi HSTS (1 năm), `X-Content-Type-Options`, `X-Frame-Options` và `Referrer-Policy`. Không bật HSTS trong Development để tránh ghim HTTPS cho localhost.

## DevTools

Ứng dụng có thành phần DevTools dành cho môi trường phát triển cục bộ:

- Truy cập nhanh giữa các trang.
- Theo dõi nhật ký thao tác và request HTTP.
- Lưu trạng thái nhật ký bằng `localStorage` khi điều hướng giữa các trang.
- Chỉ hiển thị khi thành phần tương ứng tồn tại và ứng dụng đang chạy trong môi trường phát triển.

## Chạy dự án

### Yêu cầu

- .NET SDK 10.0.
- Một hệ quản trị cơ sở dữ liệu được cấu hình trong ứng dụng.

### Khởi động

```bash
dotnet restore
dotnet build
dotnet run (hoặc dotnet watch)
```

`dotnet run` / `dotnet watch` dùng profile `http` trong `Properties/launchSettings.json`: môi trường **Development** (có nạp user-secrets) tại `http://localhost:5347`. Profile `https` (`dotnet run --launch-profile https`) chạy thêm `https://localhost:7347`.

### CORS khi dev

Production phục vụ trang (`wwwroot`, Razor Pages) và API cùng một origin nên không bật CORS. Chỉ trong môi trường Development, các origin trong `Cors:DevOrigins` (`appsettings.json`) được phép gọi `/api/*` và lấy file tĩnh:

- `http://localhost:5500`, `http://127.0.0.1:5500`: Live Server (VS Code).
- `http://localhost:5173`, `http://127.0.0.1:5173`: Vite.

Frontend chạy ở các origin này gọi API theo địa chỉ `http://localhost:5347/api/...`, gửi token bằng header `Authorization: Bearer <access_token>` (không dùng cookie). Muốn thêm origin riêng trên máy mình thì ghi vào user-secrets hoặc `appsettings.Development.json`, lưu ý mảng được ghi đè theo vị trí:

```bash
dotnet user-secrets set "Cors:DevOrigins:4" "http://localhost:3000"
```
