namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// Một bài trong GET /api/lessons: các trường của <see cref="LessonSummaryDto"/> + trạng thái theo user đang đăng nhập.
    /// * Giải thích:
    ///    - IsLocked: true nếu mở /api/lessons/{lessonId} sẽ bị 403 lesson_locked (cùng quy tắc khóa),
    ///      frontend không cần gọi thêm từng bài để lọc bài khóa.
    ///    - ProgressStatus: "not_started" / "in_progress" / "completed".
    /// </summary>
    public record LessonListItemDto(
        string LessonId,
        string Name,
        string Description,
        string Category,
        string Topic,
        string Level,
        int Order,
        int EstimatedMinutes,
        string? Image,
        int ContentCount,
        int QuestionCount,
        bool IsLocked,
        string ProgressStatus)
    {
        public static LessonListItemDto From(LessonSummaryDto lesson, bool isLocked, string progressStatus) => new(
            lesson.LessonId, lesson.Name, lesson.Description, lesson.Category, lesson.Topic, lesson.Level,
            lesson.Order, lesson.EstimatedMinutes, lesson.Image, lesson.ContentCount, lesson.QuestionCount,
            isLocked, progressStatus);
    }
}
