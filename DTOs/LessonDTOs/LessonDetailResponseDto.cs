namespace DTOs.Lesson
{
    public class LessonDetailResponseDto
    {
        /// <summary>
        /// DTO cho chi tiết bài học.
        /// * Giải thích:
        ///    - LessonId: mã định danh duy nhất của bài học.
        ///    - Name: tên bài học.
        ///    - Category: chủ đề của bài học.
        ///    - Description: mô tả ngắn gọn về bài học.
        ///    - Level: mức độ khó của bài học.
        ///    - Contents: danh sách các mục nội dung của bài học, được ánh xạ từ JSON.
        /// </summary>
        public string LessonId { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Category { get; set; } = null!;
        public string Description { get; set; } = null!;
        public string Level { get; set; } = null!;

        public List<LessonContentItemDto> Contents { get; set; } = new();

        public List<LessonQuizQuestionDto> Quiz { get; set; } = new();
    }
}