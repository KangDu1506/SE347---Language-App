using System.Security.Claims;
using SE347.Auth;
using SE347.DTOs.Users;
using SE347.Services;

namespace SE347.Endpoints
{
    /// <summary>
    /// Minimal API JSON cho frontend (Vue 3) gọi qua /api/users/*.
    /// Quy ước: mỗi nhóm endpoint một file Endpoints/&lt;Tên&gt;Endpoints.cs,
    /// logic nằm trong Services/, chỉ trả DTO, không trả entity.
    /// </summary>
    public static class UserEndpoints
    {
        public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/users");

            // GET /api/users/username-available?username=abc
            group.MapGet("/username-available", async (string? username, IUserService users, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(username))
                {
                    return Results.BadRequest(new { error = "Thiếu tham số username." });
                }

                var available = await users.IsUsernameAvailableAsync(username, ct);
                return Results.Ok(new UsernameAvailabilityDto(username, available));
            });

            // GET /api/users/me: hồ sơ của user đang đăng nhập (cần Bearer token của Supabase)
            group.MapGet("/me", async (ClaimsPrincipal user, IUserService users, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                var profile = await users.GetMyProfileAsync(userId, ct);
                return profile is null ? Results.NotFound() : Results.Ok(profile);
            })
            .RequireAuthorization();

            // GET /api/users/{username}: hồ sơ công khai, 404 nếu không tồn tại hoặc đang để riêng tư
            group.MapGet("/{username}", async (string username, IUserService users, CancellationToken ct) =>
            {
                var profile = await users.GetPublicProfileAsync(username, ct);
                return profile is null ? Results.NotFound() : Results.Ok(profile);
            });

            return app;
        }
    }
}
