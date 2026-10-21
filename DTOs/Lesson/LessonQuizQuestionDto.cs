using System.Text.Json.Serialization;

namespace SE347.DTOs.Lesson
{
    /// <summary>
    /// DTO DUY NHẤT cho câu hỏi quiz khi đọc từ quiz.json (thay cho DTOs/Question/BaseQuestionDto cũ).
    /// Chứa đáp án nên CHỈ dùng trong backend để chấm điểm; gửi xuống trình duyệt thì dùng
    /// <see cref="QuizQuestionResponseDto"/>.
    /// Với fill-in-the-blank: mỗi chỗ trống trong Question đánh dấu <see cref="BlankMarker"/>,
    /// Answers có đúng một đáp án cho mỗi chỗ trống, theo thứ tự.
    /// </summary>
    public class LessonQuizQuestionDto
    {
        public const string BlankMarker = "<blank>";

        [JsonPropertyName("id")]
        public string Id { get; set; } = null!;

        [JsonPropertyName("type")]
        public LessonQuizQuestionType Type { get; set; }

        [JsonPropertyName("question")]
        public string Question { get; set; } = null!;

        [JsonPropertyName("audio")]
        public string? Audio { get; set; }

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
