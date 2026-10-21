namespace SE347.DTOs.Progress
{
    /// <summary>
    /// GET /api/progress: tổng quan tiến độ của user đang đăng nhập.
    /// User chưa học gì: Stats toàn 0, Lessons rỗng (không phải 404).
    /// </summary>
    public record ProgressOverviewDto(
        ProgressStatsDto Stats,
        IReadOnlyList<LessonProgressDto> Lessons);

    /// <summary>
    /// CurrentStreak đã tính theo ngày hôm nay (timezone của user): quá 1 ngày không học thì về 0,
    /// dù user_stats.current_streak chưa được cập nhật.
    /// </summary>
    public record ProgressStatsDto(
        long TotalXp,
        int CurrentStreak,
        int LongestStreak,
        DateOnly? LastActivityDate,
        int TodayXp,
        int LessonsCompleted,
        int LessonsInProgress);

    /// <summary>
    /// Tiến độ một bài học. Status: "not_started" | "in_progress" | "completed".
    /// Bài chưa mở trả <see cref="NotStarted"/> (các mốc thời gian null, danh sách rỗng).
    /// Điểm quiz là % câu đúng (0–100).
    /// </summary>
    public record LessonProgressDto(
        string LessonId,
        string Status,
        DateTimeOffset? FirstOpenedAt,
        DateTimeOffset? LastStudiedAt,
        DateTimeOffset? CompletedAt,
        IReadOnlyList<string> CompletedContentIds,
        int QuizAttempts,
        short? BestQuizScore,
        short? LastQuizScore,
        int XpEarned)
    {
        public const string StatusNotStarted = "not_started";

        public static LessonProgressDto NotStarted(string lessonId) =>
            new(lessonId, StatusNotStarted, null, null, null, [], 0, null, null, 0);
    }

    /// <summary>Kết quả lưu một lần nộp quiz (do API chấm điểm S2-BE-05 gọi).</summary>
    public record QuizAttemptResultDto(
        long AttemptId,
        short CorrectCount,
        short TotalCount,
        short Score,
        int XpAwarded,
        bool LessonCompletedNow,
        LessonProgressDto Progress);
}
