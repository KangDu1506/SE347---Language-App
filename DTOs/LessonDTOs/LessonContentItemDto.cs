using System.Text.Json.Serialization;

namespace DTOs.Lesson
{
    public class LessonContentItemDto
    {
        /// <summary>
        /// DTO cho một mục từ vựng và các ví dụ của bài học.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; } = null!;

        [JsonPropertyName("content")]
        public string Content { get; set; } = null!;

        [JsonPropertyName("pronunciation-bre")]
        public string PronunciationBre { get; set; } = null!;

        [JsonPropertyName("pronunciation-name")]
        public string PronunciationName { get; set; } = null!;

        [JsonPropertyName("definition-en")]
        public string DefinitionEn { get; set; } = null!;

        [JsonPropertyName("definition-vi")]
        public string DefinitionVi { get; set; } = null!;

        [JsonPropertyName("oxford-link")]
        public string OxfordLink { get; set; } = null!;

        [JsonPropertyName("external-source")]
        public List<string> ExternalSources { get; set; } = new();

        [JsonPropertyName("examples")]
        public List<LessonExampleDto> Examples { get; set; } = new();

        [JsonPropertyName("synonyms")]
        public List<string> Synonyms { get; set; } = new();

        [JsonPropertyName("antonyms")]
        public List<string> Antonyms { get; set; } = new();

    }

    public class LessonExampleDto
    {
        [JsonPropertyName("term")]
        public string Term { get; set; } = null!;

        [JsonPropertyName("translation")]
        public string Translation { get; set; } = null!;
    }
}