using System.Text.Json.Serialization;

namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// DTO ánh xạ file LearningPath.json của một folder lộ trình
    /// (Storage/LessonTemplate/&lt;PathFolder&gt;/LearningPath.json, vd "ProgressiveLearning-A").
    /// Schema: Storage/LessonTemplate/schemas/LearningPath.schema.json.
    /// * Giải thích:
    ///    - Id: mã lộ trình (slug), lưu ở learning_path_records.learning_path_id. Tên folder lộ trình chỉ để sắp xếp file.
    ///    - Version: tăng khi đổi bài/nhánh làm ảnh hưởng tới user đang học.
    ///    - Lessons: bài chính theo thứ tự; Branches: nhánh phụ, mỗi nhánh có danh sách bài riêng.
    ///    - Mỗi bài là folder con của folder lộ trình, tên folder = LessonId (duy nhất trong toàn LessonTemplate).
    /// </summary>
    public class LearningPathDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = null!;

        [JsonPropertyName("title")]
        public string Title { get; set; } = null!;

        [JsonPropertyName("description")]
        public string Description { get; set; } = null!;

        [JsonPropertyName("version")]
        public int Version { get; set; }

        [JsonPropertyName("lessons")]
        public List<LearningPathLessonDto> Lessons { get; set; } = [];

        [JsonPropertyName("branches")]
        public List<LearningPathBranchDto> Branches { get; set; } = [];

        /// <summary>Bài chính và bài trong các nhánh.</summary>
        public IEnumerable<LearningPathLessonDto> AllLessons() =>
            Lessons.Concat(Branches.SelectMany(b => b.Lessons));
    }

    public class LearningPathLessonDto
    {
        /// <summary>Mã mục trong lộ trình ("lesson-&lt;slug&gt;"), lưu ở learning_path_progress.path_item_id.</summary>
        [JsonPropertyName("itemId")]
        public string ItemId { get; set; } = null!;

        [JsonPropertyName("order")]
        public int Order { get; set; }

        [JsonPropertyName("lessonId")]
        public string LessonId { get; set; } = null!;

        [JsonPropertyName("folder")]
        public string Folder { get; set; } = null!;

        /// <summary>LessonId (trong cùng lộ trình) phải học xong trước.</summary>
        [JsonPropertyName("prerequisites")]
        public List<string> Prerequisites { get; set; } = [];
    }

    public class LearningPathBranchDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = null!;

        /// <summary>Mã mục trong lộ trình ("branch-&lt;slug&gt;").</summary>
        [JsonPropertyName("itemId")]
        public string ItemId { get; set; } = null!;

        [JsonPropertyName("title")]
        public string Title { get; set; } = null!;

        [JsonPropertyName("required")]
        public bool Required { get; set; }

        /// <summary>Bài chính mà nhánh hiện ra sau đó; null = không gắn vị trí.</summary>
        [JsonPropertyName("afterLessonId")]
        public string? AfterLessonId { get; set; }

        [JsonPropertyName("lessons")]
        public List<LearningPathLessonDto> Lessons { get; set; } = [];
    }
}
