namespace SE347.DTOs.Quiz
{
    /// <summary>Tham số scope của GET /api/quizzes: nguồn đề muốn xem.</summary>
    public static class QuizListScopes
    {
        /// <summary>Đề hệ thống công khai + đề cộng đồng công khai + mọi đề của mình.</summary>
        public const string All = "all";
        /// <summary>Đề hệ thống (creator_id null) đang công khai.</summary>
        public const string System = "system";
        /// <summary>Đề cộng đồng công khai của người khác.</summary>
        public const string Public = "public";
        /// <summary>Mọi đề do mình tạo (kể cả private / unlisted / chưa publish).</summary>
        public const string Mine = "mine";

        public static readonly IReadOnlyList<string> Values = [All, System, Public, Mine];
    }

    /// <summary>Nguồn của một đề, để frontend gắn nhãn Hệ thống / Cộng đồng / Của tôi.</summary>
    public static class QuizSources
    {
        public const string System = "system";
        public const string Community = "community";
        public const string Mine = "mine";
    }

    /// <summary>Trạng thái lượt làm gần nhất của user với một đề (tham số status của GET /api/quizzes).</summary>
    public static class QuizAttemptStates
    {
        public const string None = "none";
        public const string InProgress = "in_progress";
        public const string Submitted = "submitted";

        public static readonly IReadOnlyList<string> Values = [None, InProgress, Submitted];
    }

    /// <summary>Tham số đã chuẩn hóa của GET /api/quizzes.</summary>
    public record QuizListQuery(
        string? Q,
        string? Category,
        string? Level,
        string Scope,
        string? Status,
        int Page,
        int PageSize);

    public record PagedResultDto<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

    /// <summary>GET /api/quizzes: một thẻ đề trong danh sách.</summary>
    public record QuizListItemDto(
        Guid Id,
        string? Slug,
        string Title,
        string Description,
        string? Category,
        string? Topic,
        string? CefrLevel,
        string Visibility,
        /// <summary>system / community / mine.</summary>
        string Source,
        string? CreatorDisplayName,
        int QuestionCount,
        /// <summary>null = không giới hạn thời gian.</summary>
        int? TimeLimitSeconds,
        int PassScore,
        int XpReward,
        bool AllowRetake,
        bool IsPublished,
        /// <summary>none / in_progress / submitted.</summary>
        string MyStatus,
        /// <summary>Điểm cao nhất trong các lượt đã nộp; null nếu chưa nộp lần nào.</summary>
        int? MyBestScore,
        DateTimeOffset CreatedAt);

    public record QuizCreatorDto(Guid Id, string Username, string DisplayName, string? AvatarPath);

    /// <summary>Lượt đang làm dở của user (để hiện nút Tiếp tục làm bài).</summary>
    public record QuizInProgressAttemptDto(
        long AttemptId,
        DateTimeOffset StartedAt,
        DateTimeOffset? ExpiresAt,
        /// <summary>null nếu đề không giới hạn thời gian; 0 nếu đã quá giờ (chờ nộp/chốt).</summary>
        int? RemainingSeconds);

    /// <summary>Một lần nộp bài trước đây của user.</summary>
    public record QuizAttemptSummaryDto(
        long AttemptId,
        int Score,
        int CorrectCount,
        int TotalCount,
        int? DurationSeconds,
        int XpAwarded,
        bool Passed,
        DateTimeOffset? SubmittedAt);

    /// <summary>
    /// GET /api/quizzes/{idOrSlug}: metadata + lịch sử của mình + top BXH.
    /// KHÔNG chứa câu hỏi / đáp án.
    /// </summary>
    public record QuizDetailDto(
        Guid Id,
        string? Slug,
        string Title,
        string Description,
        string? Category,
        string? Topic,
        string? CefrLevel,
        string Visibility,
        string Source,
        QuizCreatorDto? Creator,
        bool IsCreator,
        bool IsPublished,
        int QuestionCount,
        int? TimeLimitSeconds,
        int PassScore,
        int XpReward,
        bool AllowRetake,
        bool ShuffleQuestions,
        bool ShowResultsImmediately,
        bool ShowExplanations,
        int Version,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        QuizInProgressAttemptDto? InProgress,
        /// <summary>Các lần đã nộp, mới nhất trước.</summary>
        IReadOnlyList<QuizAttemptSummaryDto> AttemptsMe,
        /// <summary>Top 3 BXH của đề kèm hạng của mình.</summary>
        QuizRankingDto Ranking);

    /// <summary>Một dòng BXH: thành tích tốt nhất của một thí sinh.</summary>
    public record QuizRankingEntryDto(
        int Rank,
        Guid UserId,
        string Username,
        string DisplayName,
        string? AvatarPath,
        int BestScore,
        int? DurationSeconds,
        DateTimeOffset? SubmittedAt);

    /// <summary>Hạng của user đang đăng nhập; Rank null nếu chưa nộp hoặc hồ sơ không public.</summary>
    public record QuizRankingCurrentUserDto(
        int? Rank,
        int? BestScore,
        int? DurationSeconds,
        DateTimeOffset? SubmittedAt,
        bool IsPublic);

    /// <summary>GET /api/quizzes/{idOrSlug}/ranking.</summary>
    public record QuizRankingDto(
        Guid QuizId,
        /// <summary>Tổng số thí sinh active + public đã nộp bài.</summary>
        int TotalParticipants,
        IReadOnlyList<QuizRankingEntryDto> Items,
        QuizRankingCurrentUserDto CurrentUser);
}
