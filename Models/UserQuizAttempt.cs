using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{
    /// <summary>
    /// public.user_quiz_attempts: mỗi lượt làm quiz của bài học (lesson_quiz) hoặc đề thi thử (standalone_quiz).
    /// Cột bổ sung ở 20261111141500 và 20261124090000 (expires_at, question_order, submitted_at nullable).
    /// </summary>
    [Table("user_quiz_attempts")]
    public class UserQuizAttempt
    {
        public const string TypeLessonQuiz = "lesson_quiz";
        public const string TypeStandaloneQuiz = "standalone_quiz";

        public const string StatusInProgress = "in_progress";
        public const string StatusSubmitted = "submitted";
        public const string StatusAbandoned = "abandoned";

        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        /// <summary>Bắt buộc với lesson_quiz, null với standalone_quiz.</summary>
        [Column("lesson_id")]
        public string? LessonId { get; set; }

        /// <summary>Bắt buộc với standalone_quiz.</summary>
        [Column("quiz_id")]
        public Guid? QuizId { get; set; }

        [Column("attempt_type")]
        public string AttemptType { get; set; } = TypeLessonQuiz;

        [Column("status")]
        public string Status { get; set; } = StatusSubmitted;

        [Column("correct_count")]
        public short CorrectCount { get; set; }

        [Column("total_count")]
        public short TotalCount { get; set; }

        /// <summary>% câu đúng (0–100).</summary>
        [Column("score")]
        public short Score { get; set; }

        [Column("xp_awarded")]
        public int XpAwarded { get; set; }

        [Column("started_at")]
        public DateTimeOffset StartedAt { get; set; }

        /// <summary>started_at + time_limit_seconds của đề; null nếu đề không giới hạn thời gian.</summary>
        [Column("expires_at")]
        public DateTimeOffset? ExpiresAt { get; set; }

        /// <summary>Thời điểm nộp; null khi đang làm (in_progress), bắt buộc khi status = submitted.</summary>
        [Column("submitted_at")]
        public DateTimeOffset? SubmittedAt { get; set; }

        [Column("duration_seconds")]
        public int? DurationSeconds { get; set; }

        [Column("quiz_version")]
        public int QuizVersion { get; set; } = 1;

        /// <summary>jsonb: mảng thứ tự câu hỏi / lựa chọn chốt lúc tạo lượt (giữ nguyên khi F5).</summary>
        [Column("question_order")]
        public string? QuestionOrder { get; set; }

        public ICollection<UserQuizAttemptAnswer> Answers { get; set; } = new List<UserQuizAttemptAnswer>();
    }
}
