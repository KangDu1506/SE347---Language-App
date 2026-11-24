using System.Security.Claims;
using SE347.Auth;
using SE347.Services;

namespace SE347.Endpoints
{
    /// <summary>
    /// /api/learning-paths/*: lộ trình học và bàn cờ theo tiến độ của user đang đăng nhập (S3-25).
    /// 403 profile_inactive nếu hồ sơ không active, giống /api/lessons.
    /// </summary>
    public static class LearningPathEndpoints
    {
        public static IEndpointRouteBuilder MapLearningPathEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/learning-paths").RequireAuthorization();

            // GET /api/learning-paths: danh sách lộ trình kèm số bài đã hoàn thành và bài nên học tiếp
            group.MapGet("/", async (ClaimsPrincipal user, ILessonAccessService access, ILearningPathService paths, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                if (await access.CheckProfileAsync(userId, ct) is not LessonAccess.Allowed and var denied)
                {
                    return LessonEndpoints.Forbidden(denied);
                }

                return Results.Ok(await paths.GetPathsAsync(userId, ct));
            });

            // GET /api/learning-paths/{pathId}/board: từng bài (mạch chính + nhánh) với vị trí và trạng thái done/current/locked
            group.MapGet("/{pathId}/board", async (string pathId, ClaimsPrincipal user, ILessonAccessService access,
                ILearningPathService paths, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                if (await access.CheckProfileAsync(userId, ct) is not LessonAccess.Allowed and var denied)
                {
                    return LessonEndpoints.Forbidden(denied);
                }

                var board = await paths.GetBoardAsync(userId, pathId, ct);
                return board is null
                    ? Results.NotFound(new { error = $"Không tìm thấy lộ trình '{pathId}'." })
                    : Results.Ok(board);
            });

            return app;
        }
    }
}
