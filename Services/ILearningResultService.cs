using SE347.DTOs.Progress;

namespace SE347.Services
{
    /// <summary>
    /// Ghi nhận kết quả học (SCRUM-62, S2-BE-05): flashcard, quiz / mini-game và hoàn thành bài không có quiz.
    /// Điểm và XP luôn tính ở server từ dữ liệu bài học, client chỉ gửi đáp án; lưu qua <see cref="IProgressService"/>.
    /// </summary>
    public interface ILearningResultService
    {
        /// <summary>XP cho mỗi mục nội dung học lần đầu (flashcard "Nhớ").</summary>
        const int XpPerContent = 5;

        /// <summary>XP cho mỗi câu đúng, chỉ cộng ở lần nộp quiz đầu tiên đạt <see cref="IProgressService.QuizPassScore"/>.</summary>
        const int XpPerCorrectAnswer = 10;

        /// <summary>XP khi hoàn thành bài không có quiz.</summary>
        const int XpLessonCompleted = 20;

        /// <summary>Đánh dấu một mục nội dung đã học; bài vocabulary tính thêm 1 từ đã học trong ngày.</summary>
        Task<ProgressResult<LessonProgressDto>> CompleteContentAsync(Guid userId, string lessonId, string contentId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Chấm bài quiz theo quiz.json rồi lưu lần nộp. Câu không trả lời tính là sai.
        /// Lỗi InvalidInput kèm Detail khi bài làm không hợp lệ (câu không có trong bài, trả lời trùng...).
        /// </summary>
        Task<ProgressResult<QuizSubmissionResultDto>> SubmitQuizAsync(Guid userId, string lessonId, IReadOnlyList<QuizAnswerDto>? answers, CancellationToken cancellationToken = default);

        /// <summary>Hoàn thành bài không có quiz; cần học hết các mục nội dung trước.</summary>
        Task<ProgressResult<LessonProgressDto>> CompleteLessonAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default);
    }
}
