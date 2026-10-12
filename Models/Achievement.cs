using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{

    [Table("achievements")]
    public class Achievement
    {

        [Key]
        [MaxLength(50)]
        [Column("code")]
        public string Code { get; set; } = null!;


        [Required]
        [MaxLength(20)]
        [Column("category")]
        public string Category { get; set; } = null!;


        [Column("threshold")]
        public int Threshold { get; set; }

        [Required]
        [MaxLength(80)]
        [Column("name_vi")]
        public string NameVi { get; set; } = null!;

        [Required]
        [MaxLength(80)]
        [Column("name_en")]
        public string NameEn { get; set; } = null!;

        [Required]
        [MaxLength(200)]
        [Column("description_vi")]
        public string DescriptionVi { get; set; } = null!;

        [Required]
        [MaxLength(200)]
        [Column("description_en")]
        public string DescriptionEn { get; set; } = null!;

        [MaxLength(255)]
        [Column("icon_path")]
        public string? IconPath { get; set; }


        [Column("xp_reward")]
        public int XpReward { get; set; }

        [Column("sort_order")]
        public short SortOrder { get; set; }


        public ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();
    }
}
