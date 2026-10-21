using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_lesson_progress")]
    public class UserLessonProgress
    {
        public const string StatusInProgress = "in_progress";
        public const string StatusCompleted = "completed";

        [Column("user_id")]
        public Guid UserId { get; set; }

        /// <summary>Tên folder bài học trong Storage/LessonTemplate (slug).</summary>
        [Column("lesson_id")]
        public string LessonId { get; set; } = null!;

        [Column("status")]
        public string Status { get; set; } = StatusInProgress;

        [Column("first_opened_at")]
        public DateTimeOffset FirstOpenedAt { get; set; }

        [Column("last_studied_at")]
        public DateTimeOffset LastStudiedAt { get; set; }

        [Column("completed_at")]
        public DateTimeOffset? CompletedAt { get; set; }

        [Column("quiz_attempts")]
        public int QuizAttempts { get; set; }

        [Column("best_quiz_score")]
        public short? BestQuizScore { get; set; }

        [Column("last_quiz_score")]
        public short? LastQuizScore { get; set; }

        [Column("xp_earned")]
        public int XpEarned { get; set; }


        public ICollection<UserContentProgress> CompletedContents { get; set; } = new List<UserContentProgress>();
    }
}
