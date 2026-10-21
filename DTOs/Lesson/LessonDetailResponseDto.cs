namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// DTO cho chi tiết bài học trả xuống trình duyệt.
    /// * Giải thích:
    ///    - LessonId: mã định danh duy nhất của bài học (tên folder, slug kebab-case).
    ///    - Name, Description, Category, Topic, Level, Order, EstimatedMinutes, Image: như <see cref="LessonSummaryDto"/>.
    ///    - Contents: danh sách các mục nội dung của bài học, ánh xạ từ content.json.
    ///    - Quiz: câu hỏi đã bỏ đáp án (<see cref="QuizQuestionResponseDto"/>), rỗng nếu bài không có quiz.
    ///    - QuizSettings: cách frontend trộn câu hỏi / đáp án.
    /// Không chứa đường dẫn tới config.json / content.json / quiz.json.
    /// </summary>
    public record LessonDetailResponseDto(
        string LessonId,
        string Name,
        string Description,
        string Category,
        string Topic,
        string Level,
        int Order,
        int EstimatedMinutes,
        string? Image,
        IReadOnlyList<LessonContentItemDto> Contents,
        IReadOnlyList<QuizQuestionResponseDto> Quiz,
        LessonQuizSettingsDto QuizSettings);
}
