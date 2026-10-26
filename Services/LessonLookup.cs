using System.Text.Json;
using SE347.DTOs.Lesson;

namespace SE347.Services
{
    /// <summary>
    /// Kiểm tra bài học / mục nội dung có tồn tại trong Storage/LessonTemplate (bài lẻ hoặc trong lộ trình) trước khi ghi tiến độ
    /// (bảng tiến độ không có FK tới bài học vì bài học nằm ở file JSON).
    /// Bản tối giản đọc thẳng file; service đọc lesson của S2-BE-02 có thể thay thế bằng implementation khác.
    /// </summary>
    public interface ILessonLookup
    {
        bool LessonExists(string lessonId);

        bool ContentExists(string lessonId, string contentId);
    }

    public class FileLessonLookup : ILessonLookup
    {
        private readonly string _root;

        public FileLessonLookup(IWebHostEnvironment environment)
        {
            _root = Path.Combine(environment.ContentRootPath, "Storage", "LessonTemplate");
        }

        public bool LessonExists(string lessonId) => FindFolder(lessonId) is not null;

        public bool ContentExists(string lessonId, string contentId)
        {
            var folder = FindFolder(lessonId);
            if (folder is null)
            {
                return false;
            }

            var config = JsonSerializer.Deserialize<LessonConfigDto>(
                File.ReadAllText(Path.Combine(folder, LessonTemplateValidator.ConfigFile)));
            if (config is null)
            {
                return false;
            }

            var contentPath = Path.GetFullPath(Path.Combine(folder, config.Content));
            if (!contentPath.StartsWith(folder + Path.DirectorySeparatorChar, StringComparison.Ordinal) || !File.Exists(contentPath))
            {
                return false;
            }

            var content = JsonSerializer.Deserialize<LessonContentDto>(File.ReadAllText(contentPath));
            return content?.Any(item => item.Id == contentId) == true;
        }

        /// <summary>Bài lẻ hoặc bài trong folder lộ trình, xem <see cref="LessonTemplateLayout"/>.</summary>
        private string? FindFolder(string lessonId) =>
            LessonIds.IsValid(lessonId) ? LessonTemplateLayout.FindLessonFolder(_root, lessonId) : null;
    }
}
