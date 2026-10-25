using System.Security.Claims;
using SE347.Auth;
using SE347.DTOs.Lesson;
using SE347.Services;

namespace SE347.Endpoints
{
    /// <summary>
    /// Minimal API cho dữ liệu bài học (/api/lessons/*).
    /// Yêu cầu người dùng đã đăng nhập (Bearer token của Supabase).
    /// Trả về DTO LessonSummaryDto / LessonDetailResponseDto, không trả đường dẫn nội bộ.
    /// </summary>
    public static class LessonEndpoints
    {
        public static IEndpointRouteBuilder MapLessonEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/api/lessons").RequireAuthorization();

            // GET /api/lessons?category=grammar&level=A1: Lấy danh sách bài học có thể lọc theo category và level
            group.MapGet("/", (ClaimsPrincipal user, string? category, string? level, ILessonService lessonService) =>
            {
                if (user.GetUserId() is not Guid)
                {
                    return Results.Unauthorized();
                }

                var lessons = lessonService.GetAll(category, level);
                return Results.Ok(lessons);
            });

            // GET /api/lessons/{lessonId}: Lấy chi tiết bài học (nội dung và quiz không có đáp án)
            group.MapGet("/{lessonId}", (string lessonId, ClaimsPrincipal user, ILessonService lessonService) =>
            {
                if (user.GetUserId() is not Guid)
                {
                    return Results.Unauthorized();
                }

                if (!LessonIds.IsValid(lessonId))
                {
                    return Results.BadRequest(new { error = "Mã bài học không đúng định dạng." });
                }

                var detail = lessonService.GetDetail(lessonId);
                return detail is null
                    ? Results.NotFound(new { error = $"Không tìm thấy bài học '{lessonId}'." })
                    : Results.Ok(detail);
            });

            return app;
        }
    }
}
