using System.ComponentModel.DataAnnotations.Schema;

namespace SE347.Models
{
    /// <summary>
    /// public.quizzes: bài kiểm tra của bài học (scope "lesson") hoặc đề thi thử độc lập (scope "standalone").
    /// Schema: supabase/migrations/20261111141500_learning_catalog_and_quizzes.sql.
    /// </summary>
    [Table("quizzes")]
    public class Quiz
    {
        public const string ScopeLesson = "lesson";
        public const string ScopeStandalone = "standalone";

        public const string VisibilityPrivate = "private";
        public const string VisibilityUnlisted = "unlisted";
        public const string VisibilityPublic = "public";

        [Column("id")]
        public Guid Id { get; set; }

        /// <summary>Đường dẫn thân thiện /TrialTest/{slug}; null nếu chưa đặt.</summary>
        [Column("slug")]
        public string? Slug { get; set; }

        [Column("quiz_scope")]
        public string QuizScope { get; set; } = ScopeStandalone;

        /// <summary>Bắt buộc khi scope = lesson, null khi scope = standalone.</summary>
        [Column("lesson_id")]
        public string? LessonId { get; set; }

        /// <summary>Tác giả đề standalone; null với đề hệ thống / quiz bài học.</summary>
        [Column("creator_id")]
        public Guid? CreatorId { get; set; }

        [Column("title")]
        public string Title { get; set; } = null!;

        [Column("description")]
        public string Description { get; set; } = string.Empty;

        [Column("category")]
        public string? Category { get; set; }

        [Column("topic")]
        public string? Topic { get; set; }

        [Column("cefr_level")]
        public string? CefrLevel { get; set; }

        [Column("visibility")]
        public string Visibility { get; set; } = VisibilityPublic;

        /// <summary>null = không giới hạn thời gian.</summary>
        [Column("time_limit_seconds")]
        public int? TimeLimitSeconds { get; set; }

        /// <summary>% điểm tối thiểu để đạt (0–100).</summary>
        [Column("pass_score")]
        public short PassScore { get; set; } = 60;

        [Column("xp_reward")]
        public int XpReward { get; set; }

        [Column("shuffle_questions")]
        public bool ShuffleQuestions { get; set; }

        [Column("shuffle_answers")]
        public bool ShuffleAnswers { get; set; } = true;

        [Column("mix_with_lesson")]
        public bool MixWithLesson { get; set; }

        [Column("show_results_immediately")]
        public bool ShowResultsImmediately { get; set; } = true;

        [Column("allow_retake")]
        public bool AllowRetake { get; set; } = true;

        [Column("show_explanations")]
        public bool ShowExplanations { get; set; } = true;

        [Column("is_published")]
        public bool IsPublished { get; set; } = true;

        [Column("version")]
        public int Version { get; set; } = 1;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }

        public ICollection<QuizQuestion> Questions { get; set; } = new List<QuizQuestion>();
    }
}
