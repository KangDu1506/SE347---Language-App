using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_content_progress")]
    public class UserContentProgress
    {
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("lesson_id")]
        public string LessonId { get; set; } = null!;

        /// <summary>id của mục trong content.json.</summary>
        [Column("content_id")]
        public string ContentId { get; set; } = null!;

        [Column("completed_at")]
        public DateTimeOffset CompletedAt { get; set; }
    }
}
