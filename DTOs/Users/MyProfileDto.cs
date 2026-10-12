namespace SE347.DTOs.Users
{
    /// <summary>
    /// Hồ sơ của chính user đang đăng nhập (GET /api/users/me).
    /// Bổ sung thêm Setting, Stat và LearningProfile.
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
        UserLearningProfileDto? LearningProfile);

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
}
