using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;
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

            // GET /api/users/me và GET /api/me: hồ sơ của user đang đăng nhập (cần Bearer token của Supabase)
            group.MapGet("/me", GetMyProfileAsync).RequireAuthorization();
            app.MapGet("/api/me", GetMyProfileAsync).RequireAuthorization();

            // PATCH /api/users/me (SCRUM-92): tự sửa hồ sơ và cài đặt, chỉ trường nào gửi lên mới đổi
            group.MapPatch("/me", UpdateMyProfileAsync).RequireAuthorization();

            // DELETE /api/users/me: tự vô hiệu hóa tài khoản (status = deactivated, hồ sơ chuyển private)
            group.MapDelete("/me", async (ClaimsPrincipal user, IMyProfileService profiles, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                var result = await profiles.DeactivateAsync(userId, ct);
                return result.Error == ProfileUpdateError.None ? Results.NoContent() : ToError(result);
            }).RequireAuthorization();

            // POST /api/users/me/avatar: multipart/form-data, field "file" (png/jpeg/webp, tối đa 2MB).
            // API xác thực bằng Bearer token, không dùng cookie, nên tắt kiểm tra antiforgery của form.
            group.MapPost("/me/avatar", UploadAvatarAsync)
                .RequireAuthorization()
                .DisableAntiforgery();

            // DELETE /api/users/me/avatar: xóa ảnh, avatarPath = null (gọi khi chưa có ảnh vẫn trả 200)
            group.MapDelete("/me/avatar", async (ClaimsPrincipal user, IMyProfileService profiles, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                return ToResult(await profiles.RemoveAvatarAsync(userId, ct));
            }).RequireAuthorization();

            // GET /api/users/{username}: hồ sơ công khai, 404 nếu không tồn tại hoặc đang để riêng tư
            group.MapGet("/{username}", async (string username, IUserService users, CancellationToken ct) =>
            {
                var profile = await users.GetPublicProfileAsync(username, ct);
                return profile is null ? Results.NotFound() : Results.Ok(profile);
            });

            return app;
        }

        private static async Task<IResult> GetMyProfileAsync(ClaimsPrincipal user, IUserService users, CancellationToken ct)
        {
            if (user.GetUserId() is not Guid userId)
            {
                return Results.Unauthorized();
            }

            var profile = await users.GetMyProfileAsync(userId, ct);
            return profile is null ? Results.NotFound() : Results.Ok(profile);
        }

        /// <summary>
        /// Tự đọc body thay vì để minimal API bind: lỗi JSON (sai kiểu, trường lạ) vẫn trả { error, field }
        /// như các lỗi validate khác, thay vì 400 rỗng.
        /// </summary>
        private static async Task<IResult> UpdateMyProfileAsync(
            HttpRequest request,
            ClaimsPrincipal user,
            IMyProfileService profiles,
            IOptions<Microsoft.AspNetCore.Http.Json.JsonOptions> jsonOptions,
            CancellationToken ct)
        {
            if (user.GetUserId() is not Guid userId)
            {
                return Results.Unauthorized();
            }

            if (!request.HasJsonContentType())
            {
                return BadRequest("Body phải là JSON (Content-Type: application/json).", null);
            }

            UpdateMyProfileRequest? body;
            try
            {
                body = await JsonSerializer.DeserializeAsync<UpdateMyProfileRequest>(request.Body, jsonOptions.Value.SerializerOptions, ct);
            }
            catch (JsonException ex)
            {
                var field = ex.Path is { Length: > 2 } path && path.StartsWith("$.") ? path[2..] : null;
                return BadRequest(field is null ? "Body JSON không hợp lệ." : $"Trường {field} không hợp lệ hoặc không được phép sửa.", field);
            }

            if (body is null)
            {
                return BadRequest("Body JSON không hợp lệ.", null);
            }

            return ToResult(await profiles.UpdateAsync(userId, body, ct));
        }

        private static async Task<IResult> UploadAvatarAsync(HttpRequest request, ClaimsPrincipal user, IMyProfileService profiles, CancellationToken ct)
        {
            if (user.GetUserId() is not Guid userId)
            {
                return Results.Unauthorized();
            }

            if (!request.HasFormContentType)
            {
                return BadRequest("Gửi ảnh bằng multipart/form-data, field \"file\".", "file");
            }

            IFormCollection form;
            try
            {
                // Giới hạn mỗi phần của multipart ngay khi đọc: file lớn hơn bị dừng sớm, không đọc hết vào server
                form = await request.ReadFormAsync(
                    new FormOptions { MultipartBodyLengthLimit = IMyProfileService.MaxAvatarBytes + 1 }, ct);
            }
            catch (InvalidDataException)
            {
                return BadRequest("Ảnh đại diện tối đa 2MB.", "file");
            }

            if (form.Files.GetFile("file") is not { } file)
            {
                return BadRequest("Thiếu file ảnh (field \"file\").", "file");
            }

            await using var stream = file.OpenReadStream();
            return ToResult(await profiles.UploadAvatarAsync(userId, stream, file.Length, ct));
        }

        private static IResult ToResult(ProfileUpdateResult<MyProfileDto> result) =>
            result.Error == ProfileUpdateError.None ? Results.Ok(result.Value) : ToError(result);

        private static IResult ToError<T>(ProfileUpdateResult<T> result) => result.Error switch
        {
            ProfileUpdateError.ProfileNotFound => Results.NotFound(new { error = "Không tìm thấy hồ sơ người dùng." }),
            ProfileUpdateError.ProfileNotActive => LessonEndpoints.Forbidden(LessonAccess.ProfileNotActive),
            ProfileUpdateError.UsernameTaken => Results.Conflict(new { error = result.Detail, field = result.Field, code = "username_taken" }),
            ProfileUpdateError.ConcurrentUpdate => Results.Conflict(new { error = "Hồ sơ vừa được cập nhật ở nơi khác, hãy tải lại rồi thử lại.", code = "concurrent_update" }),
            ProfileUpdateError.StorageFailed => Results.Json(new { error = "Không lưu được ảnh đại diện, hãy thử lại sau." }, statusCode: StatusCodes.Status502BadGateway),
            _ => BadRequest(result.Detail ?? "Dữ liệu không hợp lệ.", result.Field),
        };

        private static IResult BadRequest(string error, string? field) =>
            Results.BadRequest(new { error, field });
    }
}
