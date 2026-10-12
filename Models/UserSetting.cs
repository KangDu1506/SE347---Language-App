using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_settings")]
    public class UserSetting
    {
        [Key]
        [Column("user_id")]
        public Guid UserId { get; set; }


        [Required]
        [MaxLength(16)]
        [Column("theme")]
        public string Theme { get; set; } = "system";


        [Column("daily_goal_xp")]
        public short DailyGoalXp { get; set; } = 20;

        [Column("sound_enabled")]
        public bool SoundEnabled { get; set; } = true;

        [Column("reminder_enabled")]
        public bool ReminderEnabled { get; set; }


        [Column("reminder_time")]
        public TimeOnly? ReminderTime { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }


        [ForeignKey(nameof(UserId))]
        public Profile Profile { get; set; } = null!;
    }
}
