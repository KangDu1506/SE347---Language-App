using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{
    /// <summary>
    /// public.user_quiz_attempt_answers: câu trả lời từng câu trong 1 lượt làm bài
    /// (nháp khi in_progress, kết quả chấm khi đã nộp). Mỗi (attempt_id, question_key) một dòng.
    /// </summary>
    [Table("user_quiz_attempt_answers")]
    public class UserQuizAttemptAnswer
    {
        [Column("id")]
        public long Id { get; set; }

        [Column("attempt_id")]
        public long AttemptId { get; set; }

        /// <summary>null nếu câu hỏi gốc đã bị xóa (on delete set null); dùng QuestionSnapshot để xem lại.</summary>
        [Column("question_id")]
        public Guid? QuestionId { get; set; }

        [Column("question_key")]
        public string QuestionKey { get; set; } = null!;

        /// <summary>jsonb: mảng đáp án user chọn / nhập; "[]" nếu bỏ trống.</summary>
        [Column("user_answer")]
        public string UserAnswer { get; set; } = "[]";

        [Column("is_correct")]
        public bool IsCorrect { get; set; }

        [Column("time_spent_ms")]
        public int? TimeSpentMs { get; set; }

        /// <summary>jsonb object: bản chụp câu hỏi lúc làm (prompt, options, đáp án đúng, giải thích).</summary>
        [Column("question_snapshot")]
        public string? QuestionSnapshot { get; set; }

        [Column("answered_at")]
        public DateTimeOffset AnsweredAt { get; set; }

        public UserQuizAttempt Attempt { get; set; } = null!;
    }
}
