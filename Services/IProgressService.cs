using SE347.DTOs.Progress;

namespace SE347.Services
{
    public enum ProgressError
    {
        None,
        /// <summary>Không có hồ sơ, hoặc hồ sơ bị khóa / đã xóa (chỉ user active mới được ghi).</summary>
        ProfileNotActive,
        LessonNotFound,
        ContentNotFound,
        InvalidInput,
    }

    /// <summary>Kết quả ghi tiến độ: Value có khi Error = None.</summary>
    public record ProgressResult<T>(T? Value, ProgressError Error)
    {
        public static ProgressResult<T> Ok(T value) => new(value, ProgressError.None);

        public static ProgressResult<T> Fail(ProgressError error) => new(default, error);
    }

    /// <summary>
    /// Lưu / truy vấn tiến độ học theo user (SCRUM-54). XP cộng vào user_stats + user_daily_activity,
    /// streak tính theo ngày trong timezone của user (profiles.timezone).
    /// Lượng XP do nơi gọi quyết định (API chấm điểm S2-BE-05); service chỉ đảm bảo
    /// mỗi mục nội dung chỉ được cộng XP một lần.
    /// </summary>
    public interface IProgressService
    {
        /// <summary>% câu đúng tối thiểu để một lần nộp quiz đánh dấu bài là hoàn thành.</summary>
        const short QuizPassScore = 60;

        /// <summary>null nếu user không có hồ sơ hoặc hồ sơ đã xóa.</summary>
        Task<ProgressOverviewDto?> GetOverviewAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>Bài chưa mở trả <see cref="LessonProgressDto.NotStarted"/>.</summary>
        Task<ProgressResult<LessonProgressDto>> GetLessonProgressAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default);

        /// <summary>Ghi nhận user mở bài: tạo dòng tiến độ lần đầu, các lần sau cập nhật last_studied_at.</summary>
        Task<ProgressResult<LessonProgressDto>> MarkLessonOpenedAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Đánh dấu một mục nội dung đã học. Lần đầu: cộng xp và tính streak; gọi lại không cộng thêm.
        /// countsAsWord = true với bài vocabulary (tăng words_learned trong ngày).
        /// </summary>
        Task<ProgressResult<LessonProgressDto>> MarkContentCompletedAsync(Guid userId, string lessonId, string contentId, int xp, bool countsAsWord, CancellationToken cancellationToken = default);

        /// <summary>
        /// Lưu một lần nộp quiz đã chấm ở server. Score = % đúng; Score ≥ <see cref="QuizPassScore"/>
        /// lần đầu thì bài chuyển sang completed.
        /// </summary>
        Task<ProgressResult<QuizAttemptResultDto>> RecordQuizAttemptAsync(Guid userId, string lessonId, int correctCount, int totalCount, int xp, CancellationToken cancellationToken = default);

        /// <summary>Đánh dấu hoàn thành bài không có quiz. Bài đã completed thì không cộng xp lần nữa.</summary>
        Task<ProgressResult<LessonProgressDto>> MarkLessonCompletedAsync(Guid userId, string lessonId, int xp, CancellationToken cancellationToken = default);
    }
}
