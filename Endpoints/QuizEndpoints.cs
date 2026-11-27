using System.Security.Claims;
using SE347.Auth;
using SE347.DTOs.Lesson;
using SE347.DTOs.Quiz;
using SE347.Services;

namespace SE347.Endpoints
{
    /// <summary>
    /// /api/quizzes/*: danh mục, tìm kiếm, chi tiết và BXH riêng của đề thi thử độc lập (S3-07).
    /// 403 profile_inactive nếu hồ sơ không active, giống /api/lessons.
    /// Đề không tồn tại hoặc không có quyền xem (private của người khác, chưa publish) đều trả 404.
    /// Không endpoint nào ở đây trả câu hỏi / đáp án.
    /// </summary>
    public static class QuizEndpoints
    {
        public static IEndpointRouteBuilder MapQuizEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/quizzes").RequireAuthorization();

            // GET /api/quizzes?q=&category=&level=&scope=all|system|public|mine&status=none|in_progress|submitted&page=&pageSize=
            group.MapGet("/", async (ClaimsPrincipal user, string? q, string? category, string? level, string? scope,
                string? status, int? page, int? pageSize, ILessonAccessService access, IStandaloneQuizService quizzes,
                CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                var (query, error) = ParseListQuery(q, category, level, scope, status, page, pageSize);
                if (error is not null)
                {
                    return Results.BadRequest(new { error });
                }

                if (await access.CheckProfileAsync(userId, ct) is not LessonAccess.Allowed and var denied)
                {
                    return LessonEndpoints.Forbidden(denied);
                }

                return Results.Ok(await quizzes.ListAsync(userId, query!, ct));
            });

            // GET /api/quizzes/{idOrSlug}: metadata, lượt đang làm dở, lịch sử nộp của mình, top 3 BXH
            group.MapGet("/{idOrSlug}", async (string idOrSlug, ClaimsPrincipal user, ILessonAccessService access,
                IStandaloneQuizService quizzes, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                if (await access.CheckProfileAsync(userId, ct) is not LessonAccess.Allowed and var denied)
                {
                    return LessonEndpoints.Forbidden(denied);
                }

                var detail = await quizzes.GetDetailAsync(userId, idOrSlug, ct);
                return detail is null ? NotFound(idOrSlug) : Results.Ok(detail);
            });

            // GET /api/quizzes/{idOrSlug}/ranking?limit=50: thành tích tốt nhất mỗi thí sinh active + public, kèm hạng của mình
            group.MapGet("/{idOrSlug}/ranking", async (string idOrSlug, int? limit, ClaimsPrincipal user,
                ILessonAccessService access, IStandaloneQuizService quizzes, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                var take = limit ?? IStandaloneQuizService.DefaultRankingLimit;
                if (take is < 1 or > IStandaloneQuizService.MaxRankingLimit)
                {
                    return Results.BadRequest(new { error = $"limit phải từ 1 đến {IStandaloneQuizService.MaxRankingLimit}." });
                }

                if (await access.CheckProfileAsync(userId, ct) is not LessonAccess.Allowed and var denied)
                {
                    return LessonEndpoints.Forbidden(denied);
                }

                var ranking = await quizzes.GetRankingAsync(userId, idOrSlug, take, ct);
                return ranking is null ? NotFound(idOrSlug) : Results.Ok(ranking);
            });

            return app;
        }

        private static IResult NotFound(string idOrSlug) =>
            Results.NotFound(new { error = $"Không tìm thấy đề thi '{idOrSlug}'." });

        /// <summary>Chuẩn hóa tham số GET /api/quizzes; trả lỗi tiếng Việt nếu giá trị không hợp lệ.</summary>
        internal static (QuizListQuery? Query, string? Error) ParseListQuery(string? q, string? category, string? level,
            string? scope, string? status, int? page, int? pageSize)
        {
            string? normalizedCategory = null;
            if (!string.IsNullOrWhiteSpace(category))
            {
                normalizedCategory = category.Trim().ToLowerInvariant();
                if (!LessonCategories.All.Contains(normalizedCategory))
                {
                    return (null, $"category phải là một trong: {string.Join(", ", LessonCategories.All)}.");
                }
            }

            string? normalizedLevel = null;
            if (!string.IsNullOrWhiteSpace(level))
            {
                normalizedLevel = level.Trim().ToUpperInvariant();
                if (!CefrLevels.All.Contains(normalizedLevel))
                {
                    return (null, $"level phải là một trong: {string.Join(", ", CefrLevels.All)}.");
                }
            }

            var normalizedScope = string.IsNullOrWhiteSpace(scope) ? QuizListScopes.All : scope.Trim().ToLowerInvariant();
            if (!QuizListScopes.Values.Contains(normalizedScope))
            {
                return (null, $"scope phải là một trong: {string.Join(", ", QuizListScopes.Values)}.");
            }

            string? normalizedStatus = null;
            if (!string.IsNullOrWhiteSpace(status))
            {
                normalizedStatus = status.Trim().ToLowerInvariant();
                if (!QuizAttemptStates.Values.Contains(normalizedStatus))
                {
                    return (null, $"status phải là một trong: {string.Join(", ", QuizAttemptStates.Values)}.");
                }
            }

            var pageNumber = page ?? 1;
            if (pageNumber < 1)
            {
                return (null, "page phải từ 1 trở lên.");
            }

            var size = pageSize ?? IStandaloneQuizService.DefaultPageSize;
            if (size is < 1 or > IStandaloneQuizService.MaxPageSize)
            {
                return (null, $"pageSize phải từ 1 đến {IStandaloneQuizService.MaxPageSize}.");
            }

            var keyword = string.IsNullOrWhiteSpace(q) ? null : q.Trim();
            if (keyword is { Length: > 100 })
            {
                return (null, "q tối đa 100 ký tự.");
            }

            return (new QuizListQuery(keyword, normalizedCategory, normalizedLevel, normalizedScope, normalizedStatus, pageNumber, size), null);
        }
    }
}
