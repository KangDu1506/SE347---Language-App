using Microsoft.EntityFrameworkCore;
using SE347.Auth;
using SE347.Data;
using SE347.Endpoints;
using SE347.Services;

var builder = WebApplication.CreateBuilder(args);

// Kết nối Supabase 
var connectionString = builder.Configuration.GetConnectionString("Supabase");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// Xác thực JWT của Supabase cho /api/* (Auth/)
builder.Services.AddSupabaseJwtAuth(builder.Configuration);

// Services nghiệp vụ (Services/)
builder.Services.AddScoped<IUserService, UserService>();

// 1. Kích hoạt tính năng đọc và render file .cshtml (SSR)
builder.Services.AddRazorPages();

var app = builder.Build();

// 2. Cho phép Server truy cập và chạy các file tĩnh như CSS, JS, hình ảnh
app.UseStaticFiles();

app.UseRouting();

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
        var hasLoginData = context.Request.Query.ContainsKey("username") || context.Request.Query.ContainsKey("password");
        var hasSignupData = context.Request.Query.ContainsKey("fullName") || context.Request.Query.ContainsKey("email") || context.Request.Query.ContainsKey("password");
        var hasForgotPasswordData = context.Request.Query.ContainsKey("email");
        var hasAuthenticationData = context.Request.Query.ContainsKey("code");
        var hasFormData = context.Request.Method == "POST" && context.Request.HasFormContentType;

        if (isLoginPage && (hasLoginData || hasFormData))
        {
            context.Response.Redirect("/Account/Authentication?mode=login", permanent: false, preserveMethod: false);
            return;
        }

        if (isSignupPage && (hasSignupData || hasFormData))
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

            if (code == "123456" && mode == "login")
            {
                context.Response.Cookies.Append("userToken", "authenticated", new CookieOptions
                {
                    HttpOnly = false,
                    SameSite = SameSiteMode.Lax,
                    Path = "/"
                });
                context.Response.Redirect("/Index", permanent: false, preserveMethod: false);
                return;
            }

            context.Response.Redirect("/Account/Login", permanent: false, preserveMethod: false);
            return;
        }
    }

    var isDashboardEntry = string.Equals(path, string.Empty, StringComparison.OrdinalIgnoreCase)
        || string.Equals(path, "/index", StringComparison.OrdinalIgnoreCase)
        || string.Equals(path, "/index.cshtml", StringComparison.OrdinalIgnoreCase);

    if (isDashboardEntry)
    {
        if (!context.Request.Cookies.ContainsKey("userToken"))
        {
            context.Response.Redirect("/Account/Login");
            return;
        }

        if (path == string.Empty)
        {
            context.Response.Redirect("/Index");
            return;
        }
    }

    await next();
});

// 3. Tự động ánh xạ đường dẫn URL tới các file trong thư mục Pages
app.MapRazorPages();

// 4. Endpoint JSON /api/* cho frontend Vue 3 (Endpoints/)
app.MapUserEndpoints();
app.MapHealthEndpoints();

// Kích hoạt Server chạy
app.Run();
