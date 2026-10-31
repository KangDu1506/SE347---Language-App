using System.Security.Claims;
using SE347.Auth;
using SE347.DTOs.Progress;
using SE347.Services;

namespace SE347.Endpoints
{
    /// <summary>
    /// /api/progress/*: tiến độ học của user đang đăng nhập (cần Bearer token của Supabase).
    /// Ghi nhận kết quả flashcard/mini-game/quiz (SCRUM-62) chấm điểm ở server qua ILearningResultService.
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

            // POST /api/progress/lessons/{lessonId}/open: ghi nhận user mở bài học (403 nếu bài đang khóa)
            group.MapPost("/lessons/{lessonId}/open", async (string lessonId, ClaimsPrincipal user, IProgressService progress, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                return ToResult(await progress.MarkLessonOpenedAsync(userId, lessonId, ct));
            }).AddEndpointFilter(RequireUnlockedLesson);

            // POST /api/progress/lessons/{lessonId}/contents/{contentId}/complete: flashcard "Nhớ", mục đã học (+XP lần đầu)
            group.MapPost("/lessons/{lessonId}/contents/{contentId}/complete", async (string lessonId, string contentId, ClaimsPrincipal user, ILearningResultService results, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                return ToResult(await results.CompleteContentAsync(userId, lessonId, contentId, ct));
            }).AddEndpointFilter(RequireUnlockedLesson);

            // POST /api/progress/lessons/{lessonId}/quiz: nộp quiz / mini-game, body { answers: [{ questionId, answer: [...] }] }.
            // Trả điểm, XP, tiến độ bài và kết quả từng câu (kèm đáp án đúng, giải thích).
            group.MapPost("/lessons/{lessonId}/quiz", async (string lessonId, SubmitQuizRequestDto request, ClaimsPrincipal user, ILearningResultService results, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                return ToResult(await results.SubmitQuizAsync(userId, lessonId, request.Answers, ct));
            }).AddEndpointFilter(RequireUnlockedLesson);

            // POST /api/progress/lessons/{lessonId}/complete: hoàn thành bài không có quiz (đã học hết các mục nội dung)
            group.MapPost("/lessons/{lessonId}/complete", async (string lessonId, ClaimsPrincipal user, ILearningResultService results, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                return ToResult(await results.CompleteLessonAsync(userId, lessonId, ct));
            }).AddEndpointFilter(RequireUnlockedLesson);

            return app;
        }

        /// <summary>
        /// Chặn ghi tiến độ cho bài đang khóa theo prerequisites (403 lesson_locked).
        /// Bài không tồn tại / hồ sơ không active để endpoint tự trả 404 / 403.
        /// </summary>
        private static async ValueTask<object?> RequireUnlockedLesson(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
        {
            var http = context.HttpContext;
            if (http.Request.RouteValues["lessonId"] is string lessonId
                && http.User.GetUserId() is Guid userId
                && http.RequestServices.GetRequiredService<ILessonService>().LessonExists(lessonId)
                && await http.RequestServices.GetRequiredService<ILessonAccessService>()
                    .CheckLessonAsync(userId, lessonId, http.RequestAborted) is LessonAccess.Locked)
            {
                return LessonEndpoints.Forbidden(LessonAccess.Locked);
            }

            return await next(context);
        }

        private static IResult ToResult<T>(ProgressResult<T> result) => result.Error switch
        {
            ProgressError.None => Results.Ok(result.Value),
            ProgressError.LessonNotFound => Results.NotFound(new { error = "Không tìm thấy bài học." }),
            ProgressError.ContentNotFound => Results.NotFound(new { error = "Không tìm thấy nội dung trong bài học." }),
            ProgressError.ProfileNotActive => LessonEndpoints.Forbidden(LessonAccess.ProfileNotActive),
            ProgressError.QuizNotFound => Results.NotFound(new { error = "Bài học không có quiz." }),
            ProgressError.QuizRequired => Results.Conflict(new { error = "Bài học có quiz, hãy nộp quiz để hoàn thành bài." }),
            ProgressError.ContentsIncomplete => Results.Conflict(new { error = "Chưa học hết các mục nội dung của bài." }),
            _ => Results.BadRequest(new { error = result.Detail ?? "Dữ liệu không hợp lệ." }),
        };
    }
}
