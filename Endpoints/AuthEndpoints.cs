using SE347.DTOs.Users;
using SE347.Services;

namespace SE347.Endpoints
{
    public static class AuthEndpoints
    {
        public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/auth");

            // POST /api/auth/login-username { username, password }: đăng nhập bằng username.
            // Đăng nhập bằng email vẫn gọi thẳng supabase-js ở trình duyệt, không qua endpoint này.
            group.MapPost("/login-username", async (UsernameLoginRequestDto body, IAuthService auth, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrEmpty(body.Password))
                {
                    return Results.BadRequest(new { error = "Thiếu username hoặc mật khẩu." });
                }

                var result = await auth.SignInWithUsernameAsync(body.Username, body.Password, ct);
                return result.Session is not null
                    ? Results.Ok(result.Session)
                    : Results.Json(new { error = result.ErrorCode }, statusCode: result.StatusCode);
            });

            return app;
        }
    }
}
