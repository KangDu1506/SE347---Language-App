namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// Câu hỏi quiz gửi xuống trình duyệt: KHÔNG có answer, explanation, translation
    /// (chấm điểm ở backend, giải thích trả về sau khi nộp bài).
    /// Audio / Image / Text là URL file của bài học (xem GET /api/lessons/{lessonId}/assets/...).
    /// </summary>
    public record QuizQuestionResponseDto(
        string Id,
        LessonQuizQuestionType Type,
        string Question,
        string? Audio,
        string? Image,
        string? Text,
        IReadOnlyList<string> Options)
    {
        /// <param name="assetUrl">Đổi đường dẫn tương đối trong folder bài học thành URL.</param>
        public static QuizQuestionResponseDto From(LessonQuizQuestionDto question, Func<string?, string?> assetUrl) => new(
            question.Id,
            question.Type,
            question.Question,
            assetUrl(question.Audio),
            assetUrl(question.Image),
            assetUrl(question.Text),
            question.Options);
    }
}
