using System.Text.Json.Serialization;

namespace DTOs.Lesson
{
    /// <summary>
    /// DTO cho việc cấu hình bài học.
    /// * Giải thích:
    ///    - Name: tên bài học, phải duy nhất trong hệ thống.
    ///    - Category: chủ đề của bài học, ví dụ: "Ngành nghề", "Con vật", v.v.
    ///    - Description: mô tả ngắn gọn về bài học.
    ///    - Level: mức độ khó của bài học, ví dụ: "Dễ", "Trung bình", "Khó".
    ///    - Content: nội dung chi tiết của bài học, đây là đường dẫn đến tệp tin nội dung.
    ///    - Quiz: đường dẫn đến tệp tin câu hỏi trắc nghiệm của bài học, có thể là null nếu bài học không có câu hỏi.
    /// </summary>
    public class LessonConfigDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = null!;

        [JsonPropertyName("category")]
        public string Category { get; set; } = null!;

        [JsonPropertyName("description")]
        public string Description { get; set; } = null!;

        [JsonPropertyName("level")]
        public string Level { get; set; } = null!;

        [JsonPropertyName("content")]
        public string Content { get; set; } = null!;

        [JsonPropertyName("quiz")]
        public string? Quiz { get; set; } = null;

        [JsonPropertyName("content-settings")]
        public Dictionary<string, object?> ContentSettings { get; set; } = new();

        [JsonPropertyName("quiz-settings")]
        public LessonQuizSettingsDto QuizSettings { get; set; } = new();
    }
}