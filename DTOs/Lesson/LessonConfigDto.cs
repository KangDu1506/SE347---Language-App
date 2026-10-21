using System.Text.Json.Serialization;

namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// DTO ánh xạ file config.json của một bài học (Storage/LessonTemplate/&lt;LessonId&gt;/config.json).
    /// Schema: Storage/LessonTemplate/schemas/LessonConfig.schema.json.
    /// * Giải thích:
    ///    - LessonId KHÔNG nằm trong file: chính là tên folder (slug kebab-case, vd "present-simple-tense").
    ///    - Name: tên hiển thị của bài học.
    ///    - Category: loại bài, một trong <see cref="LessonCategories.All"/> (khớp bộ lọc trang Study).
    ///    - Topic: chủ đề, ví dụ: "Adjectives", "Tenses", "Daily life".
    ///    - Level: trình độ CEFR, một trong <see cref="CefrLevels.All"/> (khớp cefr_level trong DB).
    ///    - Order: thứ tự trong lộ trình (sắp theo Level rồi Order).
    ///    - EstimatedMinutes: thời gian học dự kiến (phút).
    ///    - Image: ảnh bìa, đường dẫn tương đối trong folder bài học, có thể null.
    ///    - Content / Quiz: đường dẫn tương đối tới content.json / quiz.json; Quiz null nếu bài không có câu hỏi.
    ///      Chỉ dùng nội bộ backend, không trả xuống trình duyệt.
    /// </summary>
    public class LessonConfigDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = null!;

        [JsonPropertyName("category")]
        public string Category { get; set; } = null!;

        [JsonPropertyName("topic")]
        public string Topic { get; set; } = null!;

        [JsonPropertyName("description")]
        public string Description { get; set; } = null!;

        [JsonPropertyName("level")]
        public string Level { get; set; } = null!;

        [JsonPropertyName("order")]
        public int Order { get; set; }

        [JsonPropertyName("estimated-minutes")]
        public int EstimatedMinutes { get; set; }

        [JsonPropertyName("image")]
        public string? Image { get; set; }

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
