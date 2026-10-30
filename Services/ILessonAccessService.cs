namespace SE347.Services
{
    public enum LessonAccess
    {
        Allowed,
        /// <summary>Không có hồ sơ, hoặc hồ sơ bị khóa / đã xóa (cùng điều kiện ghi tiến độ của <see cref="ProgressService"/>).</summary>
        ProfileNotActive,
        /// <summary>Còn bài prerequisite (LearningPath.json) chưa ở trạng thái completed trong user_lesson_progress.</summary>
        Locked,
    }

    /// <summary>
    /// Quyền đọc bài học / quiz của user đang đăng nhập:
    /// hồ sơ phải active, và mọi bài prerequisite của bài (nếu có) phải đã hoàn thành.
    /// </summary>
    public interface ILessonAccessService
    {
        /// <summary>Allowed hoặc ProfileNotActive (dùng cho danh sách bài, không xét prerequisite).</summary>
        Task<LessonAccess> CheckProfileAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>Gọi sau khi đã biết bài tồn tại.</summary>
        Task<LessonAccess> CheckLessonAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default);
    }
}
