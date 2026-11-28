using SE347.DTOs.Rankings;

namespace SE347.Services
{
    /// <summary>Kỳ của bảng xếp hạng tổng.</summary>
    public enum RankingPeriod
    {
        Week,
        Month,
        All,
    }

    /// <summary>
    /// Bảng xếp hạng tổng (S3-05): chỉ liệt kê hồ sơ active + public có XP trong kỳ,
    /// kèm vị trí của người đang gọi.
    /// </summary>
    public interface IRankingService
    {
        public const int DefaultLimit = 50;
        public const int MaxLimit = 100;

        /// <summary>Trả null nếu người gọi chưa có hồ sơ.</summary>
        Task<RankingResponseDto?> GetRankingAsync(Guid userId, RankingPeriod period, int limit, CancellationToken cancellationToken = default);
    }
}
