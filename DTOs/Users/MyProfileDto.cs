namespace SE347.DTOs.Users
{
    /// <summary>
    /// Hồ sơ của chính user đang đăng nhập (GET /api/users/me).
    /// Bổ sung thêm Setting, Stat, LearningProfile, tóm tắt tiến độ và huy hiệu từ DB.
    /// </summary>
    public record MyProfileDto(
        Guid Id,
        string Username,
        string DisplayName,
        string? AvatarPath,
        string? Bio,
        string UiLocale,
        string Timezone,
        string ProfileVisibility,
        string Role,
        DateTimeOffset? OnboardingCompletedAt,
        UserSettingDto? Setting,
        UserStatDto? Stat,
        UserLearningProfileDto? LearningProfile,
        string? Email = null,
        string Status = "active",
        DateTimeOffset? CreatedAt = null,
        UserActivitySummaryDto? ActivitySummary = null,
        IReadOnlyList<UserAchievementDto>? Achievements = null);

    public record UserSettingDto(
        string Theme,
        short DailyGoalXp,
        bool SoundEnabled,
        bool ReminderEnabled,
        TimeOnly? ReminderTime);

    public record UserStatDto(
        long TotalXp,
        int CurrentStreak,
        int LongestStreak,
        DateOnly? LastActivityDate,
        short StreakFreezes);

    public record UserLearningProfileDto(
        string? LearningReason,
        string? CefrLevel,
        DateTimeOffset? PlacementCompletedAt);

    public record UserActivitySummaryDto(
        int LessonsCompleted,
        int LessonsInProgress,
        int TotalWordsLearned,
        int TotalPracticeSeconds,
        int TodayXp,
        int TodayWordsLearned);

    public record UserAchievementDto(
        string Code,
        string Category,
        string NameVi,
        string NameEn,
        string DescriptionVi,
        string DescriptionEn,
        string? IconPath,
        int XpReward,
        DateTimeOffset AwardedAt);
}
