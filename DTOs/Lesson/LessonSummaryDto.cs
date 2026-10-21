namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// Một bài học trong danh sách (trang Study, bộ lọc category/level). Không có nội dung, câu hỏi
    /// hay đường dẫn file nội bộ.
    /// * Giải thích:
    ///    - LessonId: tên folder (slug), dùng làm khóa trong URL và bảng tiến độ.
    ///    - Image: ảnh bìa (có thể null), API đổi thành URL trước khi trả về.
    ///    - ContentCount / QuestionCount: số mục nội dung / số câu hỏi quiz.
    /// </summary>
    public record LessonSummaryDto(
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
        int QuestionCount);
}
