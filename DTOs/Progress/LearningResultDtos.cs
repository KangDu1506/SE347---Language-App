using SE347.DTOs.Lesson;

namespace SE347.DTOs.Progress
{
    /// <summary>
    /// POST /api/progress/lessons/{lessonId}/quiz: bài làm quiz / mini-game gửi lên để chấm ở server.
    /// Câu không gửi đáp án tính là sai; điểm luôn tính trên toàn bộ câu hỏi của bài.
    /// </summary>
    public record SubmitQuizRequestDto(IReadOnlyList<QuizAnswerDto>? Answers);

    /// <summary>
    /// Answer: đáp án user chọn / điền. single-choice, true-false: 1 phần tử ("true" / "false" với true-false).
    /// multiple-choice: các lựa chọn, không cần đúng thứ tự. fill-in-the-blank: 1 phần tử cho mỗi chỗ trống, theo thứ tự.
    /// </summary>
    public record QuizAnswerDto(string? QuestionId, IReadOnlyList<string?>? Answer);

    /// <summary>Kết quả chấm 1 câu, kèm đáp án đúng và giải thích cho trang kết quả / ôn lại.</summary>
    public record QuizQuestionResultDto(
        string QuestionId,
        LessonQuizQuestionType Type,
        bool IsCorrect,
        IReadOnlyList<string> UserAnswer,
        IReadOnlyList<string> CorrectAnswer,
        string Explanation,
        string Translation);

    /// <summary>Kết quả nộp quiz: lần nộp đã lưu (điểm, XP, tiến độ bài) và kết quả từng câu theo thứ tự trong quiz.json.</summary>
    public record QuizSubmissionResultDto(
        QuizAttemptResultDto Attempt,
        IReadOnlyList<QuizQuestionResultDto> Questions);
}
