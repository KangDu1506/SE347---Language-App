using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("user_daily_activity")]
    public class UserDailyActivity
    {
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("activity_date")]
        public DateOnly ActivityDate { get; set; }


        [Column("xp_earned")]
        public int XpEarned { get; set; }


        [Column("lessons_completed")]
        public int LessonsCompleted { get; set; }


        [Column("words_learned")]
        public int WordsLearned { get; set; }


        [Column("practice_seconds")]
        public int PracticeSeconds { get; set; }

        [Column("streak_freeze_used")]
        public bool StreakFreezeUsed { get; set; }


        [ForeignKey(nameof(UserId))]
        public Profile Profile { get; set; } = null!;
    }
}
