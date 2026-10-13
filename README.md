# SE347 Web Application

## Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Luồng xử lý và giải pháp kỹ thuật](#luồng-xử-lý-và-giải-pháp-kỹ-thuật)
- [DevTools](#devtools)
- [Chạy dự án](#chạy-dự-án)

## Công nghệ sử dụng

- **Backend:** ASP.NET Core Razor Pages trên .NET 10.
- **Database và ORM:** Supabase (PostgreSQL) + Entity Framework Core (Npgsql). Schema do `supabase/migrations` quản lý, entity chỉ map vào bảng có sẵn: **không** chạy `dotnet ef migrations` cho các bảng này.
- **Frontend:** HTML5, CSS3 và JavaScript ES6+.
  + *Framework:* Vue 3 CDN
- **Quản lý mã nguồn:** Git.

## Cấu trúc thư mục

```text
SE347/
├── Auth/                         # Xác thực JWT của Supabase (issuer, audience, JWKS)
├── Data/                         # DbContext và cấu hình dữ liệu
├── DTOs/                         # Data Transfer Objects
├── Endpoints/                    # Minimal API JSON /api/* cho frontend Vue 3
├── Models/                       # Các entity của hệ thống
├── Pages/                        # Razor Pages và giao diện người dùng
│   ├── Account/                  # Đăng nhập, đăng ký, hồ sơ và xác thực
│   └── Shared/                   # Thành phần giao diện dùng chung
├── Properties/                   # launchSettings.json: profile chạy dev (cổng 5347)
├── Services/                     # Xử lý nghiệp vụ chính
├── Storage/                      # Tệp lưu trữ riêng tư
├── supabase/migrations/          # SQL schema Supabase (bảng, trigger, RLS)
├── wwwroot/                      # Tài nguyên tĩnh công khai
│   ├── css/                      # Stylesheet theo từng màn hình
│   ├── images/                   # Hình ảnh giao diện
│   └── js/                       # JavaScript theo từng màn hình
├── Program.cs                    # Điểm khởi động và cấu hình ứng dụng
└── SE347.csproj                  # Tệp cấu hình dự án
```

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
