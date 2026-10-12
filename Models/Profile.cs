using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("profiles")]
    public class Profile
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(30)]
        [Column("username")]
        public string Username { get; set; } = null!;


        [Required]
        [MaxLength(80)]
        [Column("display_name")]
        public string DisplayName { get; set; } = null!;


        [MaxLength(512)]
        [Column("avatar_path")]
        public string? AvatarPath { get; set; }

        [MaxLength(160)]
        [Column("bio")]
        public string? Bio { get; set; }


        [Required]
        [MaxLength(10)]
        [Column("ui_locale")]
        public string UiLocale { get; set; } = "vi";


        [Required]
        [MaxLength(64)]
        [Column("timezone")]
        public string Timezone { get; set; } = "Asia/Ho_Chi_Minh";


        [Required]
        [MaxLength(10)]
        [Column("profile_visibility")]
        public string ProfileVisibility { get; set; } = "private";


        [Required]
        [MaxLength(16)]
        [Column("role")]
        public string Role { get; set; } = "learner";


        [Required]
        [MaxLength(16)]
        [Column("status")]
        public string Status { get; set; } = "active";

        [Column("onboarding_completed_at")]
        public DateTimeOffset? OnboardingCompletedAt { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }

        [Column("deleted_at")]
        public DateTimeOffset? DeletedAt { get; set; }


        [ConcurrencyCheck]
        [Column("row_version")]
        public long RowVersion { get; set; } = 1;


        public UserSetting? Setting { get; set; }

        public UserLearningProfile? LearningProfile { get; set; }

        public UserStat? Stat { get; set; }

        public ICollection<UserDailyActivity> DailyActivities { get; set; } = new List<UserDailyActivity>();

        public ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();
    }
}
