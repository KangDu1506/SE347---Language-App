namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// Câu hỏi quiz gửi xuống trình duyệt: KHÔNG có answer, explanation, translation
    /// (chấm điểm ở backend, giải thích trả về sau khi nộp bài).
    /// Audio là đường dẫn tương đối trong folder bài học, API đổi thành URL trước khi trả về.
    /// </summary>
    public record QuizQuestionResponseDto(
        string Id,
        LessonQuizQuestionType Type,
        string Question,
        string? Audio,
        IReadOnlyList<string> Options)
    {
        public static QuizQuestionResponseDto From(LessonQuizQuestionDto question) => new(
            question.Id,
            question.Type,
            question.Question,
            question.Audio,
            question.Options);
    }
}
