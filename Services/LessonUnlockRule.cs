namespace SE347.Services
{
    /// <summary>
    /// Quy tắc mở khóa bài học dùng chung cho API bài học (<see cref="LessonAccessService"/>)
    /// và bàn cờ lộ trình (<see cref="LearningPathService"/>):
    ///   - Mọi prerequisite đã hoàn thành, hoặc
    ///   - User đã mở bài này trước đó (có dòng user_lesson_progress): không khóa lại bài đang học dở,
    ///     kể cả khi quy tắc khóa thay đổi sau khi user đã học (vd mạch chính chuyển sang khóa tuần tự).
    /// </summary>
    public static class LessonUnlockRule
    {
        /// <param name="prerequisites">Bài phải học xong trước (ILessonService.GetPrerequisites).</param>
        /// <param name="completedLessonIds">Bài user đã hoàn thành.</param>
        /// <param name="alreadyOpened">User đã có tiến độ (đang học hoặc đã xong) với chính bài này.</param>
        public static bool IsUnlocked(IReadOnlyCollection<string> prerequisites, IReadOnlySet<string> completedLessonIds, bool alreadyOpened) =>
            alreadyOpened || prerequisites.All(completedLessonIds.Contains);
    }
}
