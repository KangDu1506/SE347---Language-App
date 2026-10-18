# Supabase

Schema database (bảng, trigger, RLS, storage) của dự án. Mỗi thay đổi schema là một file mới trong `migrations/`, đặt tên `YYYYMMDDHHMMSS_mo_ta.sql`, **không sửa file đã chạy**.

## Chạy migration

**Cách 1 — SQL Editor:** Supabase Dashboard → SQL Editor → New query → dán nội dung file → Run. Chạy các file theo thứ tự tên.

**Cách 2 — Supabase CLI:**

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## Lưu ý cho backend C# (EF Core)

- Bảng trong `migrations/` do SQL quản lý. Entity trong `Models/` chỉ map vào bảng có sẵn, **không** tạo EF migration cho các bảng này.
- Backend kết nối bằng role `postgres` qua **Session pooler** nên **không bị RLS chặn** → mọi query phải tự lọc theo `user_id` lấy từ JWT và kiểm tra `profiles.status = 'active'`.
- Connection string và key để trong biến môi trường / user-secrets, không commit.

## Cấu hình key (SCRUM-12)

Danh sách biến nằm trong [`.env.example`](../.env.example). Lấy giá trị ở Supabase Dashboard:

| Biến | Lấy ở đâu | Ai được dùng |
|---|---|---|
| `Supabase:Url` | Project Settings → Data API → Project URL | Backend + frontend |
| `Supabase:PublishableKey` | Project Settings → API Keys → Publishable key (`sb_publishable_...`, bản cũ là `anon`) | Backend + frontend |
| `Supabase:SecretKey` | Project Settings → API Keys → Secret key (`sb_secret_...`, bản cũ là `service_role`) | **Chỉ backend** |
| `ConnectionStrings:Supabase` | Nút **Connect** → **Session pooler** → .NET, thay `[YOUR-PASSWORD]` | **Chỉ backend** |

Key và mật khẩu database xin lead backend gửi riêng (tin nhắn riêng), không dán lên Jira, group chat chung hay GitHub.

### Local: dotnet user-secrets

Secret được lưu ngoài thư mục repo (`~/.microsoft/usersecrets/`), không thể lỡ commit. Chạy ở thư mục gốc repo:

```bash
dotnet user-secrets set "Supabase:Url" "https://<project-ref>.supabase.co"
dotnet user-secrets set "Supabase:PublishableKey" "sb_publishable_..."
dotnet user-secrets set "Supabase:SecretKey" "sb_secret_..."
dotnet user-secrets set "ConnectionStrings:Supabase" "Host=...;Password=...;SSL Mode=Require;Trust Server Certificate=true"
dotnet user-secrets list
```

Trong code đọc bằng `builder.Configuration["Supabase:Url"]` và `builder.Configuration.GetConnectionString("Supabase")`. User-secrets chỉ được nạp khi chạy môi trường Development (`dotnet run` / `dotnet watch` mặc định là Development).

### Render / Docker

Khai báo biến môi trường theo tên trong `.env.example` (dùng `__` thay cho `:`), ví dụ `Supabase__Url`, `ConnectionStrings__Supabase`.

### Lỡ commit key thì sao?

Xóa khỏi code chưa đủ vì key vẫn nằm trong lịch sử git. Báo lead ngay để **rotate**: tạo Secret key mới và xóa key cũ ở API Keys; đổi Database password ở Project Settings → Database.

## Xác thực email khi đăng ký

Luồng: `/Account/Signup` gọi `auth.signUp` với email, mật khẩu và metadata hồ sơ → Supabase gửi mã OTP cho user chưa xác thực → `/Account/Authentication?mode=signup` gọi `verifyOtp({ type: 'signup' })` → sau khi xác thực, người dùng có thể đăng nhập bằng email và mật khẩu. Trigger `on_auth_user_created` quản lý tạo hồ sơ; mật khẩu không được lưu trong trình duyệt.

Cấu hình trên Supabase Dashboard:

1. **Authentication → Sign In / Providers → Email**: bật **Confirm email** và đặt **Email OTP Length** = **6**.
2. **Authentication → Emails → Templates → Confirm signup**: email cần hiển thị `{{ .Token }}` để người dùng nhập mã trên trang xác thực, thay vì chỉ dùng `{{ .ConfirmationURL }}`. Ví dụ:

   ```html
   <h2>Xác thực tài khoản</h2>
   <p>Mã xác thực của bạn là: <strong>{{ .Token }}</strong></p>
   <p>Nếu bạn không yêu cầu tạo tài khoản, hãy bỏ qua email này.</p>
   ```

3. **Authentication → Emails → SMTP Settings**: SMTP mặc định của Supabase chỉ gửi tới email thành viên trong org và bị giới hạn. Muốn gửi cho người dùng thật, hãy bật custom SMTP (Gmail App Password, Resend, Brevo...).

## Quên mật khẩu qua email

Luồng: `/Account/ForgetPassword` gọi `resetPasswordForEmail` → Supabase gửi **mã 6 số** → `/Account/Authentication?mode=forgot` gọi `verifyOtp({ type: 'recovery' })` → `/Account/ResetPassword` gọi `updateUser({ password })` rồi đăng xuất. Frontend dùng supabase-js qua partial `Pages/Shared/_SupabaseClient.cshtml` (chỉ cần `Supabase:Url` và `Supabase:PublishableKey`).

Cấu hình một lần trên Dashboard:

1. **Authentication → Emails → Templates → Reset Password**: email phải chứa mã `{{ .Token }}` (mặc định chỉ có link `{{ .ConfirmationURL }}`, không dùng được với trang nhập mã). Ví dụ:

   ```html
   <h2>Đặt lại mật khẩu</h2>
   <p>Mã xác thực của bạn là: <strong>{{ .Token }}</strong></p>
   <p>Mã có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
   ```

2. **Authentication → Sign In / Providers → Email**: `Email OTP Length` = **6** (giao diện chỉ có 6 ô).
3. **Authentication → Emails → SMTP Settings**: SMTP mặc định của Supabase chỉ gửi tới email của thành viên trong org và bị giới hạn vài email/giờ. Muốn gửi cho người dùng thật phải bật custom SMTP (Gmail App Password, Resend, Brevo...).
4. **Authentication → Rate Limits**: chỉnh giới hạn gửi email nếu cần test nhiều.

## Migration hiện có

| File | Nội dung |
|---|---|
| `20261005090000_user_schema.sql` | `profiles` (1-1 với `auth.users`), `user_settings`, `user_learning_profiles`, `user_stats`, `user_daily_activity`, `achievements`, `user_achievements`, trigger tạo hồ sơ khi đăng ký, RLS, bucket `avatars` |
