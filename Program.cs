using Microsoft.EntityFrameworkCore;
using SE347.Auth;
using SE347.Data;
using SE347.Endpoints;
using SE347.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Kết nối Supabase 
var connectionString = builder.Configuration.GetConnectionString("Supabase");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// Xác thực JWT của Supabase cho /api/* (Auth/)
builder.Services.AddSupabaseJwtAuth(builder.Configuration);

// Services nghiệp vụ (Services/)
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddHttpClient<IAuthService, AuthService>();

// CORS chỉ dùng khi dev: frontend chạy ở origin khác (Live Server, Vite) gọi /api/*.
// Production phục vụ trang và API cùng origin nên không bật. Danh sách origin: Cors:DevOrigins.
const string DevCorsPolicy = "DevFrontend";
var devOrigins = builder.Configuration.GetSection("Cors:DevOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy(DevCorsPolicy, policy =>
    policy.WithOrigins(devOrigins).AllowAnyHeader().AllowAnyMethod()));

// 1. Kích hoạt tính năng đọc và render file .cshtml (SSR)
builder.Services.AddRazorPages();

var app = builder.Build();

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    if (!app.Environment.IsDevelopment())
    {
        headers["Strict-Transport-Security"] = "max-age=31536000";
    }

    await next();
});

app.UseRouting();

// Đặt sau UseRouting, trước UseAuthentication: preflight OPTIONS được trả lời trước khi xác thực JWT
if (app.Environment.IsDevelopment())
{
    app.UseCors(DevCorsPolicy);
}

app.UseAuthentication();
app.UseAuthorization();

app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value?.TrimEnd('/');
    var isLoginPage = string.Equals(path, "/account/login", StringComparison.OrdinalIgnoreCase);
    var isSignupPage = string.Equals(path, "/account/signup", StringComparison.OrdinalIgnoreCase);
    var isForgotPasswordPage = string.Equals(path, "/account/forgetpassword", StringComparison.OrdinalIgnoreCase);
    var isAuthenticationPage = string.Equals(path, "/account/authentication", StringComparison.OrdinalIgnoreCase);

    if (context.Request.Method is "POST" or "GET")
    {
        var hasForgotPasswordData = context.Request.Query.ContainsKey("email");
        var hasAuthenticationData = context.Request.Query.ContainsKey("code");
        var hasFormData = context.Request.Method == "POST" && context.Request.HasFormContentType;

        // Đăng nhập/đăng ký chỉ nhận dữ liệu qua POST (body), không đọc mật khẩu từ query string để tránh lộ trên URL.
        if (isLoginPage && hasFormData)
        {
            context.Response.Redirect("/Account/Authentication?mode=login", permanent: false, preserveMethod: false);
            return;
        }

        if (isSignupPage && hasFormData)
        {
            context.Response.Redirect("/Account/Authentication?mode=signup", permanent: false, preserveMethod: false);
            return;
        }

        if (isForgotPasswordPage && (hasForgotPasswordData || hasFormData))
        {
            context.Response.Redirect("/Account/Authentication?mode=forgot", permanent: false, preserveMethod: false);
            return;
        }

        if (isAuthenticationPage && (hasAuthenticationData || hasFormData))
        {
            var mode = context.Request.Query["mode"].ToString();
            var code = context.Request.Query["code"].ToString();

            context.Response.Redirect("/Account/Login", permanent: false, preserveMethod: false);
            return;
        }
    }

    var isDashboardEntry = string.Equals(path, string.Empty, StringComparison.OrdinalIgnoreCase)
        || string.Equals(path, "/index", StringComparison.OrdinalIgnoreCase)
        || string.Equals(path, "/index.cshtml", StringComparison.OrdinalIgnoreCase);

    if (isDashboardEntry && path == string.Empty)
    {
        context.Response.Redirect("/Index");
        return;
    }

    await next();
});

// 2. Phục vụ file tĩnh trong wwwroot (CSS, JS, hình ảnh), được nén gzip/brotli và gắn ETag lúc build
app.MapStaticAssets();

// 3. Tự động ánh xạ đường dẫn URL tới các file trong thư mục Pages
app.MapRazorPages()
    .WithStaticAssets();

// 4. Endpoint JSON /api/* cho frontend Vue 3 (Endpoints/)
app.MapUserEndpoints();
app.MapAuthEndpoints();
app.MapHealthEndpoints();

// Kích hoạt Server chạy
app.Run();
