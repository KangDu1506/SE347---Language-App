using SE347.DTOs.Quiz;

namespace SE347.Services
{
    /// <summary>
    /// Danh mục, tìm kiếm, chi tiết và BXH riêng của đề thi thử độc lập (quiz_scope = "standalone", S3-07).
    /// Quyền xem đề:
    /// - tác giả luôn xem được đề của mình (kể cả private / chưa publish);
    /// - người khác chỉ xem được đề đã publish với visibility public, hoặc unlisted khi mở bằng link
    ///   (unlisted không hiện trong danh sách).
    /// Gọi sau khi đã kiểm tra hồ sơ active (ILessonAccessService.CheckProfileAsync).
    /// </summary>
    public interface IStandaloneQuizService
    {
        public const int DefaultPageSize = 20;
        public const int MaxPageSize = 50;
        public const int DefaultRankingLimit = 50;
        public const int MaxRankingLimit = 100;
        public const int DetailRankingLimit = 3;

        Task<PagedResultDto<QuizListItemDto>> ListAsync(Guid userId, QuizListQuery query, CancellationToken cancellationToken = default);

        /// <summary>null nếu không có đề hoặc user không có quyền xem (endpoint trả 404, không lộ đề private).</summary>
        Task<QuizDetailDto?> GetDetailAsync(Guid userId, string idOrSlug, CancellationToken cancellationToken = default);

        /// <summary>
        /// Thành tích tốt nhất của mỗi thí sinh active + public (score desc, duration asc, submitted_at asc),
        /// kèm hạng của user hiện tại. null nếu không có đề hoặc không có quyền xem.
        /// </summary>
        Task<QuizRankingDto?> GetRankingAsync(Guid userId, string idOrSlug, int limit, CancellationToken cancellationToken = default);
    }
}
