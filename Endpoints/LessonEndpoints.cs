using System.Security.Claims;
using Microsoft.AspNetCore.StaticFiles;
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
        private static readonly FileExtensionContentTypeProvider ContentTypes = new();

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

                if (!string.IsNullOrWhiteSpace(category)
                    && !LessonCategories.All.Contains(category.Trim(), StringComparer.OrdinalIgnoreCase))
                {
                    return Results.BadRequest(new { error = $"category phải là một trong: {string.Join(", ", LessonCategories.All)}." });
                }

                if (!string.IsNullOrWhiteSpace(level)
                    && !CefrLevels.All.Contains(level.Trim(), StringComparer.OrdinalIgnoreCase))
                {
                    return Results.BadRequest(new { error = $"level phải là một trong: {string.Join(", ", CefrLevels.All)}." });
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

            // GET /api/lessons/{lessonId}/assets/{path}: file audio/ảnh/txt của bài học (URL có sẵn trong response chi tiết).
            // Không yêu cầu đăng nhập vì <audio>/<img> không gửi được Bearer token; chỉ trả đuôi file media/txt,
            // không bao giờ trả config.json/quiz.json (quiz.json có đáp án).
            app.MapGet("/api/lessons/{lessonId}/assets/{**path}", (string lessonId, string path, ILessonService lessonService) =>
            {
                var file = LessonIds.IsValid(lessonId) ? lessonService.GetAssetPath(lessonId, path) : null;
                if (file is null)
                {
                    return Results.NotFound();
                }

                var contentType = ContentTypes.TryGetContentType(file, out var type) ? type : "application/octet-stream";
                return Results.File(file, contentType, enableRangeProcessing: true);
            }).AllowAnonymous();

            return app;
        }
    }
}
