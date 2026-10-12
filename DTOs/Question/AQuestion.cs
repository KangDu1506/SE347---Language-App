using System.Text.Json.Serialization;

namespace DTOs.QuestionDTOs
{
    public class BaseQuestionDTO
    {
        public static readonly IReadOnlyList<string> QuestionTypes = new List<string>
        {
            "fill-in-the-blank",
            "multiple-choice",
            "single-choice",
            "true-false"
        };
        
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("question")]
        public string QuestionText { get; set; } = string.Empty;

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = string.Empty;

        [JsonPropertyName("translation")]
        public string Translation { get; set; } = string.Empty;

        [JsonPropertyName("options")]
        public ICollection<string> Options { get; set; } = new List<string>();

        [JsonPropertyName("answer")]
        public ICollection<string> Answer { get; set; } = new List<string>();
    }
}
