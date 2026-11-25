namespace SE347.DTOs.Lesson
{
    /// <summary>Trạng thái 1 bài trên bàn cờ lộ trình (khớp class CSS study-node--done/current/locked).</summary>
    public static class BoardNodeStates
    {
        public const string Done = "done";
        /// <summary>Đã mở khóa, chưa hoàn thành (có thể đang học dở).</summary>
        public const string Current = "current";
        public const string Locked = "locked";
    }

    /// <summary>Tiến độ của user với 1 bài: chưa mở / đang học / đã xong.</summary>
    public static class LessonProgressStatuses
    {
        public const string NotStarted = "not_started";
        public const string InProgress = "in_progress";
        public const string Completed = "completed";
    }

    /// <summary>Lý do gợi ý 1 bài học (GET /api/lessons/recommendations).</summary>
    public static class RecommendationReasons
    {
        /// <summary>Bài đang học dở.</summary>
        public const string Continue = "continue";
        /// <summary>Bài kế tiếp đã mở khóa trong lộ trình.</summary>
        public const string NextInPath = "next_in_path";
        /// <summary>Bài lẻ không thuộc lộ trình nào.</summary>
        public const string OutsidePath = "outside_path";
    }

    /// <summary>GET /api/learning-paths: một lộ trình kèm tiến độ của user.</summary>
    public record LearningPathSummaryDto(
        string Id,
        string Title,
        string Description,
        int Version,
        int LessonCount,
        int CompletedCount,
        /// <summary>Bài nên học tiếp trong lộ trình; null nếu đã học xong hết.</summary>
        string? CurrentLessonId);

    /// <summary>GET /api/learning-paths/{id}/board: bàn cờ lộ trình theo tiến độ của user.</summary>
    public record LearningPathBoardDto(
        string Id,
        string Title,
        string Description,
        int Version,
        int LessonCount,
        int CompletedCount,
        string? CurrentLessonId,
        IReadOnlyList<LearningPathBoardNodeDto> Nodes);

    /// <summary>
    /// Một bài trên bàn cờ.
    /// * Giải thích:
    ///    - Column / Row: vị trí lưới. Mạch chính ở Row 1, Column = order; nhánh xen kẽ Row 0 / Row 2,
    ///      Column = cột của bài mạch chính mà nhánh gắn vào + thứ tự bài trong nhánh.
    ///    - Prerequisites: bài phải hoàn thành trước (mạch chính: bài liền trước; nhánh: khai báo trong LearningPath.json).
    ///    - State: done / current / locked theo đúng quy tắc khóa của API bài học.
    ///    - MaxXp: XP tối đa nhận được khi học hết bài (5 XP/mục + 10 XP/câu quiz đúng, hoặc +20 XP nếu bài không có quiz).
    /// </summary>
    public record LearningPathBoardNodeDto(
        string ItemId,
        string LessonId,
        string Name,
        string Description,
        string Category,
        string Topic,
        string Level,
        int EstimatedMinutes,
        string? Image,
        int ContentCount,
        int QuestionCount,
        int MaxXp,
        bool IsBranch,
        string? BranchId,
        string? BranchTitle,
        bool BranchRequired,
        int Column,
        int Row,
        IReadOnlyList<string> Prerequisites,
        string State,
        string ProgressStatus);

    /// <summary>GET /api/lessons/recommendations: 1 bài được gợi ý (đã bỏ bài khóa và bài đã hoàn thành).</summary>
    public record LessonRecommendationDto(
        LessonSummaryDto Lesson,
        string Reason,
        string ProgressStatus,
        int MaxXp,
        /// <summary>Id lộ trình chứa bài; null với bài ngoài lộ trình.</summary>
        string? LearningPathId);
}
