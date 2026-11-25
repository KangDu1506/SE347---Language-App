using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{
    /// <summary>
    /// public.questions: ngân hàng câu hỏi, dùng chung giữa nhiều quiz qua <see cref="QuizQuestion"/>.
    /// Options / CorrectAnswers là JSON (mảng chuỗi) giữ nguyên dạng jsonb của DB.
    /// KHÔNG trả CorrectAnswers / Explanation / Translation ra client trước khi nộp bài.
    /// </summary>
    [Table("questions")]
    public class Question
    {
        public const string TypeSingleChoice = "single-choice";
        public const string TypeMultipleChoice = "multiple-choice";
        public const string TypeTrueFalse = "true-false";
        public const string TypeFillInTheBlank = "fill-in-the-blank";

        [Column("id")]
        public Guid Id { get; set; }

        [Column("creator_id")]
        public Guid? CreatorId { get; set; }

        [Column("question_type")]
        public string QuestionType { get; set; } = null!;

        [Column("prompt")]
        public string Prompt { get; set; } = null!;

        /// <summary>jsonb: mảng lựa chọn; null với true-false (và có thể null với fill-in-the-blank).</summary>
        [Column("options")]
        public string? Options { get; set; }

        /// <summary>jsonb: mảng đáp án đúng, tối thiểu 1 phần tử.</summary>
        [Column("correct_answers")]
        public string CorrectAnswers { get; set; } = null!;

        [Column("explanation")]
        public string Explanation { get; set; } = string.Empty;

        [Column("translation")]
        public string Translation { get; set; } = string.Empty;

        [Column("audio_path")]
        public string? AudioPath { get; set; }

        [Column("image_path")]
        public string? ImagePath { get; set; }

        [Column("text_path")]
        public string? TextPath { get; set; }

        [Column("cefr_level")]
        public string? CefrLevel { get; set; }

        [Column("topic")]
        public string? Topic { get; set; }

        [Column("is_public")]
        public bool IsPublic { get; set; }

        [Column("version")]
        public int Version { get; set; } = 1;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
