using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_quiz_attempts")]
    public class UserQuizAttempt
    {
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("lesson_id")]
        public string LessonId { get; set; } = null!;

        [Column("correct_count")]
        public short CorrectCount { get; set; }

        [Column("total_count")]
        public short TotalCount { get; set; }

        /// <summary>% câu đúng (0–100).</summary>
        [Column("score")]
        public short Score { get; set; }

        [Column("xp_awarded")]
        public int XpAwarded { get; set; }

        [Column("submitted_at")]
        public DateTimeOffset SubmittedAt { get; set; }
    }
}
