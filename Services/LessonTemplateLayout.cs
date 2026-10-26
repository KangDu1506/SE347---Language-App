namespace SE347.Services
{
    /// <summary>
    /// Cách sắp folder trong Storage/LessonTemplate:
    /// <code>
    /// LessonTemplate/
    ///   schemas/                       schema JSON, không phải bài học
    ///   present-simple-tense/          bài lẻ: &lt;LessonId&gt;/config.json
    ///   ProgressiveLearning-A/         folder lộ trình: có LearningPath.json
    ///     LearningPath.json
    ///     simple-greetings-1/          bài trong lộ trình: &lt;PathFolder&gt;/&lt;LessonId&gt;/config.json
    /// </code>
    /// LessonId = tên folder bài học, duy nhất trong toàn LessonTemplate (tiến độ chỉ lưu lesson_id).
    /// </summary>
    public static class LessonTemplateLayout
    {
        public const string SchemasFolder = "schemas";
        public const string ConfigFile = "config.json";
        public const string LearningPathFile = "LearningPath.json";

        /// <summary>Folder cấp 1 có LearningPath.json, tương đối với root, sắp theo tên.</summary>
        public static IEnumerable<string> LearningPathFolders(string root) =>
            TopLevelFolders(root).Where(name => File.Exists(Path.Combine(root, name, LearningPathFile)));

        /// <summary>
        /// Folder bài học, tương đối với root ("present-simple-tense", "ProgressiveLearning-A/simple-greetings-1").
        /// Folder cấp 1 không phải lộ trình đều coi là bài lẻ (kể cả khi thiếu config.json, để validator báo lỗi).
        /// </summary>
        public static IEnumerable<string> LessonFolders(string root)
        {
            foreach (var name in TopLevelFolders(root))
            {
                if (!File.Exists(Path.Combine(root, name, LearningPathFile)))
                {
                    yield return name;
                    continue;
                }

                foreach (var lesson in Directory.EnumerateDirectories(Path.Combine(root, name))
                             .Select(Path.GetFileName)
                             .OfType<string>()
                             .Order(StringComparer.Ordinal))
                {
                    yield return $"{name}/{lesson}";
                }
            }
        }

        /// <summary>Đường dẫn đầy đủ tới folder có config.json của bài, null nếu không có bài này.</summary>
        public static string? FindLessonFolder(string root, string lessonId)
        {
            var standalone = Path.Combine(root, lessonId);
            if (lessonId != SchemasFolder && File.Exists(Path.Combine(standalone, ConfigFile)))
            {
                return standalone;
            }

            return LearningPathFolders(root)
                .Select(path => Path.Combine(root, path, lessonId))
                .FirstOrDefault(folder => File.Exists(Path.Combine(folder, ConfigFile)));
        }

        private static IEnumerable<string> TopLevelFolders(string root) =>
            Directory.EnumerateDirectories(root)
                .Select(Path.GetFileName)
                .OfType<string>()
                .Where(name => name != SchemasFolder)
                .Order(StringComparer.Ordinal);
    }
}
