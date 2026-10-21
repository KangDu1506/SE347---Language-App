using System.Text.Json.Serialization;

namespace SE347.DTOs.Lesson
{
    public class LessonQuizSettingsDto
    {
        [JsonPropertyName("mix-with-lesson")]
        public bool MixWithLesson { get; set; }

        [JsonPropertyName("randomize-questions")]
        public bool RandomizeQuestions { get; set; }

        [JsonPropertyName("shuffle-questions")]
        public bool ShuffleQuestions { get; set; }

        [JsonPropertyName("shuffle-answers")]
        public bool ShuffleAnswers { get; set; }
    }
}
