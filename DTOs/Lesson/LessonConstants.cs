namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// Giá trị hợp lệ của config.json → "category". Giữ khớp enum trong LessonConfig.schema.json.
    /// </summary>
    public static class LessonCategories
    {
        public const string Vocabulary = "vocabulary";
        public const string Grammar = "grammar";
        public const string Listening = "listening";

        public static readonly IReadOnlyList<string> All = [Vocabulary, Grammar, Listening];
    }

    /// <summary>
    /// Trình độ CEFR dùng cho config.json → "level" và user_learning_profiles.cefr_level.
    /// Thứ tự trong danh sách là thứ tự từ dễ đến khó.
    /// </summary>
    public static class CefrLevels
    {
        public static readonly IReadOnlyList<string> All = ["A1", "A2", "B1", "B2", "C1"];
    }

    /// <summary>
    /// Quy ước folder bài học: slug kebab-case, chỉ a-z, 0-9 và "-"; tên folder chính là LessonId.
    /// </summary>
    public static class LessonIds
    {
        public const string Pattern = "^[a-z0-9]+(-[a-z0-9]+)*$";

        public static bool IsValid(string? lessonId) =>
            !string.IsNullOrEmpty(lessonId)
            && lessonId.Length <= 100
            && System.Text.RegularExpressions.Regex.IsMatch(lessonId, Pattern);
    }
}
