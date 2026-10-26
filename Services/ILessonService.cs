using SE347.DTOs.Lesson;

namespace SE347.Services
{
    /// <summary>
    /// Service đọc và quản lý dữ liệu bài học từ Storage/LessonTemplate/*.
    /// </summary>
    public interface ILessonService
    {
        /// <summary>
        /// Lấy danh sách tóm tắt tất cả bài học (hỗ trợ lọc theo category và/hoặc level).
        /// </summary>
        IReadOnlyList<LessonSummaryDto> GetAll(string? category = null, string? level = null);

        /// <summary>
        /// Lấy chi tiết một bài học (nội dung học và câu hỏi quiz đã ẩn đáp án).
        /// Trả về null nếu không tìm thấy bài học hoặc lessonId không hợp lệ.
        /// </summary>
        LessonDetailResponseDto? GetDetail(string lessonId);

        /// <summary>
        /// Kiểm tra bài học có tồn tại hay không.
        /// </summary>
        bool LessonExists(string lessonId);

        /// <summary>
        /// Kiểm tra mục nội dung (contentId) có tồn tại trong bài học hay không.
        /// </summary>
        bool ContentExists(string lessonId, string contentId);

        /// <summary>
        /// Lấy danh sách câu hỏi quiz gốc (chứa đáp án) phục vụ chấm điểm ở backend.
        /// Trả về null nếu bài học không tồn tại.
        /// </summary>
        IReadOnlyList<LessonQuizQuestionDto>? GetQuizQuestions(string lessonId);

        /// <summary>
        /// Đường dẫn đầy đủ tới file audio/ảnh/txt của bài học (assetPath tương đối với folder bài học).
        /// Trả về null nếu bài không tồn tại, đuôi file không được phép, đường dẫn ra ngoài folder bài hoặc file không có.
        /// </summary>
        string? GetAssetPath(string lessonId, string assetPath);
    }
}
