using SE347.DTOs.Lesson;

namespace SE347.Services
{
    /// <summary>
    /// Lộ trình học và gợi ý bài học theo tiến độ của user (S3-25).
    /// Trạng thái mở khóa dùng đúng <see cref="LessonUnlockRule"/> như API bài học,
    /// nên bài hiện "current" trên bàn cờ luôn mở được qua /api/lessons/{id}.
    /// Gọi sau khi đã kiểm tra hồ sơ active (ILessonAccessService.CheckProfileAsync).
    /// </summary>
    public interface ILearningPathService
    {
        /// <summary>Giá trị hợp lệ của tham số scope ở GET /api/lessons/recommendations.</summary>
        public static readonly IReadOnlyList<string> RecommendationScopes = ["all", "outside_path"];

        Task<IReadOnlyList<LearningPathSummaryDto>> GetPathsAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>null nếu không có lộ trình pathId.</summary>
        Task<LearningPathBoardDto?> GetBoardAsync(Guid userId, string pathId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Bài nên học tiếp, không gồm bài khóa và bài đã hoàn thành, theo thứ tự:
        /// bài đang học dở (học gần nhất trước) → bài kế tiếp đã mở trong lộ trình → bài lẻ ngoài lộ trình.
        /// scope = "outside_path" chỉ lấy bài lẻ ngoài lộ trình (khối "Gợi ý bài học ngoài lộ trình" của trang Study).
        /// </summary>
        Task<IReadOnlyList<LessonRecommendationDto>> GetRecommendationsAsync(Guid userId, int limit, string scope,
            CancellationToken cancellationToken = default);
    }
}
