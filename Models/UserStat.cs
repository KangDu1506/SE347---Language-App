using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_stats")]
    public class UserStat
    {
        [Key]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("total_xp")]
        public long TotalXp { get; set; }


        [Column("current_streak")]
        public int CurrentStreak { get; set; }


        [Column("longest_streak")]
        public int LongestStreak { get; set; }


        [Column("last_activity_date")]
        public DateOnly? LastActivityDate { get; set; }


        [Column("streak_freezes")]
        public short StreakFreezes { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }

        [ForeignKey(nameof(UserId))]
        public Profile Profile { get; set; } = null!;
    }
}
