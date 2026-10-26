using System.Text.Json.Serialization;

namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// DTO cho một mục nội dung của bài học (một phần tử trong content.json):
    /// từ vựng (vocabulary), cấu trúc ngữ pháp (grammar) hoặc câu cần nghe (listening).
    /// Các trường phát âm, Oxford, từ đồng/trái nghĩa chỉ có ở bài vocabulary nên có thể null.
    /// Image / Audio: đường dẫn tương đối trong folder bài học, API đổi thành URL trước khi trả về.
    /// </summary>
    public class LessonContentItemDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = null!;

        [JsonPropertyName("content")]
        public string Content { get; set; } = null!;

        [JsonPropertyName("pronunciation-bre")]
        public string? PronunciationBre { get; set; }

        [JsonPropertyName("pronunciation-name")]
        public string? PronunciationName { get; set; }

        [JsonPropertyName("definition-en")]
        public string DefinitionEn { get; set; } = null!;

        [JsonPropertyName("definition-vi")]
        public string DefinitionVi { get; set; } = null!;

        [JsonPropertyName("oxford-link")]
        public string? OxfordLink { get; set; }

        [JsonPropertyName("external-source")]
        public List<string> ExternalSources { get; set; } = new();

        [JsonPropertyName("image")]
        public string? Image { get; set; }

        [JsonPropertyName("audio")]
        public string? Audio { get; set; }

        [JsonPropertyName("examples")]
        public List<LessonExampleDto> Examples { get; set; } = new();

        [JsonPropertyName("synonyms")]
        public List<string> Synonyms { get; set; } = new();

        [JsonPropertyName("antonyms")]
        public List<string> Antonyms { get; set; } = new();

        /// <summary>Bản sao với Image / Audio đã đổi thành URL, để trả xuống trình duyệt.</summary>
        public LessonContentItemDto WithAssetUrls(Func<string?, string?> assetUrl)
        {
            var copy = (LessonContentItemDto)MemberwiseClone();
            copy.Image = assetUrl(Image);
            copy.Audio = assetUrl(Audio);
            return copy;
        }
    }

    public class LessonExampleDto
    {
        [JsonPropertyName("term")]
        public string Term { get; set; } = null!;

        [JsonPropertyName("translation")]
        public string Translation { get; set; } = null!;
    }
}
