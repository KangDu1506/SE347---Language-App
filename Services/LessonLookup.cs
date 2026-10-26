namespace SE347.Services
{
    /// <summary>
    /// Kiểm tra bài học / mục nội dung có tồn tại trong Storage/LessonTemplate (bài lẻ hoặc trong lộ trình) trước khi ghi tiến độ
    /// (bảng tiến độ không có FK tới bài học vì bài học nằm ở file JSON).
    /// Delegate sang ILessonService đã cache toàn bộ bài học trong memory.
    /// </summary>
    public interface ILessonLookup
    {
        bool LessonExists(string lessonId);

        bool ContentExists(string lessonId, string contentId);
    }

    public class FileLessonLookup : ILessonLookup
    {
        private readonly ILessonService _lessonService;

        public FileLessonLookup(ILessonService lessonService)
        {
            _lessonService = lessonService;
        }

        public bool LessonExists(string lessonId) => _lessonService.LessonExists(lessonId);

        public bool ContentExists(string lessonId, string contentId) => _lessonService.ContentExists(lessonId, contentId);
    }
}

