using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_learning_profiles")]
    public class UserLearningProfile
    {
        [Key]
        [Column("user_id")]
        public Guid UserId { get; set; }


        [MaxLength(20)]
        [Column("learning_reason")]
        public string? LearningReason { get; set; }


        [MaxLength(2)]
        [Column("cefr_level")]
        public string? CefrLevel { get; set; }


        [Column("placement_completed_at")]
        public DateTimeOffset? PlacementCompletedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }

        [ForeignKey(nameof(UserId))]
        public Profile Profile { get; set; } = null!;
    }
}
