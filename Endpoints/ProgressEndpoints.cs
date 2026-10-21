using System.Security.Claims;
using SE347.Auth;
using SE347.DTOs.Progress;
using SE347.Services;

namespace SE347.Endpoints
{
    /// <summary>
    /// /api/progress/*: tiến độ học của user đang đăng nhập (cần Bearer token của Supabase).
    /// Ghi nhận kết quả flashcard/mini-game/quiz là API của S2-BE-05, gọi IProgressService.
    /// </summary>
    public static class ProgressEndpoints
    {
        public static IEndpointRouteBuilder MapProgressEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/progress").RequireAuthorization();

            // GET /api/progress: XP, streak và tiến độ các bài đã mở (rỗng nếu chưa học)
            group.MapGet("/", async (ClaimsPrincipal user, IProgressService progress, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                var overview = await progress.GetOverviewAsync(userId, ct);
                return overview is null ? Results.NotFound() : Results.Ok(overview);
            });

            // GET /api/progress/lessons/{lessonId}: tiến độ 1 bài ("not_started" nếu chưa mở)
            group.MapGet("/lessons/{lessonId}", async (string lessonId, ClaimsPrincipal user, IProgressService progress, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                return ToResult(await progress.GetLessonProgressAsync(userId, lessonId, ct));
            });

            // POST /api/progress/lessons/{lessonId}/open: ghi nhận user mở bài học
            group.MapPost("/lessons/{lessonId}/open", async (string lessonId, ClaimsPrincipal user, IProgressService progress, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                return ToResult(await progress.MarkLessonOpenedAsync(userId, lessonId, ct));
            });

            return app;
        }

        private static IResult ToResult(ProgressResult<LessonProgressDto> result) => result.Error switch
        {
            ProgressError.None => Results.Ok(result.Value),
            ProgressError.LessonNotFound => Results.NotFound(new { error = "Không tìm thấy bài học." }),
            ProgressError.ContentNotFound => Results.NotFound(new { error = "Không tìm thấy nội dung trong bài học." }),
            ProgressError.ProfileNotActive => Results.Json(new { error = "Tài khoản không hoạt động." }, statusCode: StatusCodes.Status403Forbidden),
            _ => Results.BadRequest(new { error = "Dữ liệu không hợp lệ." }),
        };
    }
}
