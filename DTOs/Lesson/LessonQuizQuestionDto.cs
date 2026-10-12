using System.Text.Json.Serialization;

namespace DTOs.Lesson
{
    public class LessonQuizQuestionDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = null!;

        [JsonPropertyName("type")]
        public LessonQuizQuestionType Type { get; set; }

        [JsonPropertyName("question")]
        public string Question { get; set; } = null!;

        [JsonPropertyName("options")]
        public List<string> Options { get; set; } = new();

        [JsonPropertyName("answer")]
        public List<string> Answers { get; set; } = new();

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = null!;

        [JsonPropertyName("translation")]
        public string Translation { get; set; } = null!;
    }

    [JsonConverter(typeof(JsonStringEnumConverter<LessonQuizQuestionType>))]
    public enum LessonQuizQuestionType
    {
        [JsonStringEnumMemberName("fill-in-the-blank")]
        FillInTheBlank,

        [JsonStringEnumMemberName("multiple-choice")]
        MultipleChoice,

        [JsonStringEnumMemberName("single-choice")]
        SingleChoice,

        [JsonStringEnumMemberName("true-false")]
        TrueFalse
    }
}
