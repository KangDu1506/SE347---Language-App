using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_achievements")]
    public class UserAchievement
    {
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("achievement_code")]
        public string AchievementCode { get; set; } = null!;

        [Column("awarded_at")]
        public DateTimeOffset AwardedAt { get; set; }


        [ForeignKey(nameof(UserId))]
        public Profile Profile { get; set; } = null!;

        [ForeignKey(nameof(AchievementCode))]
        public Achievement Achievement { get; set; } = null!;
    }
}
