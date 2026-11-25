using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{
    /// <summary>public.quiz_questions: câu hỏi thuộc quiz nào, thứ tự (question_no) và key hiển thị.</summary>
    [Table("quiz_questions")]
    public class QuizQuestion
    {
        [Column("quiz_id")]
        public Guid QuizId { get; set; }

        [Column("question_id")]
        public Guid QuestionId { get; set; }

        /// <summary>Thứ tự trong đề, bắt đầu từ 1.</summary>
        [Column("question_no")]
        public int QuestionNo { get; set; }

        /// <summary>Id câu trong QuizContent JSON (vd "q1"), duy nhất trong 1 quiz.</summary>
        [Column("question_key")]
        public string QuestionKey { get; set; } = null!;

        [Column("points")]
        public short Points { get; set; } = 1;

        public Quiz Quiz { get; set; } = null!;

        public Question Question { get; set; } = null!;
    }
}
