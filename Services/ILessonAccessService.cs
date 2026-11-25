namespace SE347.Services
{
    public enum LessonAccess
    {
        Allowed,
        /// <summary>Không có hồ sơ, hoặc hồ sơ bị khóa / đã xóa (cùng điều kiện ghi tiến độ của <see cref="ProgressService"/>).</summary>
        ProfileNotActive,
        /// <summary>
        /// Còn bài prerequisite (bài mạch chính liền trước / prerequisites của nhánh) chưa completed,
        /// và user chưa từng mở bài này (xem <see cref="LessonUnlockRule"/>).
        /// </summary>
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

        /// <summary>
        /// Tiến độ của user với mọi bài đã mở (lessonId -> "in_progress" / "completed") và tập bài đang khóa,
        /// cùng quy tắc với <see cref="CheckLessonAsync"/> (dùng cho cờ isLocked ở GET /api/lessons, 1 truy vấn DB).
        /// Gọi sau khi đã kiểm tra hồ sơ active.
        /// </summary>
        Task<LessonLockState> GetLockStateAsync(Guid userId, CancellationToken cancellationToken = default);
    }

    public sealed record LessonLockState(IReadOnlyDictionary<string, string> StatusByLesson, IReadOnlySet<string> LockedLessonIds);
}
