using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.DTOs.Users;
using SE347.Models;

namespace SE347.Services
{
    public class UserService : IUserService
    {
        private const string DefaultTimezone = "Asia/Ho_Chi_Minh";

        private readonly ApplicationDbContext _db;
        private readonly IUserProfileInitializer _initializer;
        private readonly TimeProvider _clock;

        public UserService(ApplicationDbContext db, IUserProfileInitializer initializer, TimeProvider? clock = null)
        {
            _db = db;
            _initializer = initializer;
            _clock = clock ?? TimeProvider.System;
        }

        /// <summary>
        /// Dùng hàm public.is_username_available trong DB để giữ đúng một bộ luật username
        /// (định dạng, tên đặt trước, trùng lặp) với file SQL migration.
        /// </summary>
        public async Task<bool> IsUsernameAvailableAsync(string username, CancellationToken cancellationToken = default)
        {
            return await _db.Database
                .SqlQuery<bool>($"select public.is_username_available({username}) as \"Value\"")
                .SingleAsync(cancellationToken);
        }

        /// <summary>
        /// Backend kết nối bằng role postgres nên RLS không chặn: phải tự lọc
        /// chỉ trả hồ sơ đang hoạt động và để chế độ công khai.
        /// </summary>
        public async Task<PublicProfileDto?> GetPublicProfileAsync(string username, CancellationToken cancellationToken = default)
        {
            var normalized = username.Trim().ToLowerInvariant();

            return await _db.Profiles
                .AsNoTracking()
                .Where(p => p.Username == normalized
                    && p.ProfileVisibility == "public"
                    && p.Status == "active")
                .Select(p => new PublicProfileDto(p.Username, p.DisplayName, p.AvatarPath, p.Bio))
                .SingleOrDefaultAsync(cancellationToken);
        }

        /// <summary>
        /// userId lấy từ claim "sub" của JWT đã xác thực. Hồ sơ đã xóa coi như không tồn tại.
        /// Trả đầy đủ thông tin từ profiles, user_settings, user_stats, user_learning_profiles,
        /// tóm tắt hoạt động, huy hiệu và email (auth.users trên PostgreSQL).
        /// </summary>
        public async Task<MyProfileDto?> GetMyProfileAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var profile = await QueryMyProfileRowAsync(userId, cancellationToken);

            if ((profile is null || profile.Setting is null || profile.Stat is null || profile.LearningProfile is null)
                && await _initializer.EnsureInitializedAsync(userId, cancellationToken))
            {
                profile = await QueryMyProfileRowAsync(userId, cancellationToken);
            }

            if (profile is null)
            {
                return null;
            }

            var today = Today(profile.Timezone);

            var stat = profile.Stat is null
                ? null
                : profile.Stat with
                {
                    CurrentStreak = profile.Stat.LastActivityDate is { } last && last >= today.AddDays(-1)
                        ? profile.Stat.CurrentStreak
                        : 0
                };

            string? email = null;
            if (_db.Database.IsNpgsql())
            {
                try
                {
                    var rawEmail = await _db.Database
                        .SqlQuery<string>($"""
                            select coalesce(u.email, '') as "Value"
                            from auth.users u
                            where u.id = {userId}
                            """)
                        .SingleOrDefaultAsync(cancellationToken);

                    if (!string.IsNullOrWhiteSpace(rawEmail))
                    {
                        email = rawEmail;
                    }
                }
                catch
                {
                    // auth.users chỉ tồn tại trên DB Supabase thật; bỏ qua nếu môi trường test không có schema auth.
                }
            }

            var lessonsCompleted = await _db.UserLessonProgresses
                .AsNoTracking()
                .CountAsync(l => l.UserId == userId && l.Status == UserLessonProgress.StatusCompleted, cancellationToken);

            var lessonsInProgress = await _db.UserLessonProgresses
                .AsNoTracking()
                .CountAsync(l => l.UserId == userId && l.Status == UserLessonProgress.StatusInProgress, cancellationToken);

            var totalWordsLearned = await _db.UserDailyActivities
                .AsNoTracking()
                .Where(a => a.UserId == userId)
                .SumAsync(a => (int?)a.WordsLearned, cancellationToken) ?? 0;

            var totalPracticeSeconds = await _db.UserDailyActivities
                .AsNoTracking()
                .Where(a => a.UserId == userId)
                .SumAsync(a => (int?)a.PracticeSeconds, cancellationToken) ?? 0;

            var todayActivity = await _db.UserDailyActivities
                .AsNoTracking()
                .Where(a => a.UserId == userId && a.ActivityDate == today)
                .Select(a => new { a.XpEarned, a.WordsLearned })
                .SingleOrDefaultAsync(cancellationToken);

            var achievements = await _db.UserAchievements
                .AsNoTracking()
                .Where(ua => ua.UserId == userId)
                .OrderByDescending(ua => ua.AwardedAt)
                .Select(ua => new UserAchievementDto(
                    ua.Achievement.Code,
                    ua.Achievement.Category,
                    ua.Achievement.NameVi,
                    ua.Achievement.NameEn,
                    ua.Achievement.DescriptionVi,
                    ua.Achievement.DescriptionEn,
                    ua.Achievement.IconPath,
                    ua.Achievement.XpReward,
                    ua.AwardedAt))
                .ToListAsync(cancellationToken);

            return new MyProfileDto(
                profile.Id,
                profile.Username,
                profile.DisplayName,
                profile.AvatarPath,
                profile.Bio,
                profile.UiLocale,
                profile.Timezone,
                profile.ProfileVisibility,
                profile.Role,
                profile.OnboardingCompletedAt,
                profile.Setting,
                stat,
                profile.LearningProfile,
                email,
                profile.Status,
                profile.CreatedAt,
                new UserActivitySummaryDto(
                    lessonsCompleted,
                    lessonsInProgress,
                    totalWordsLearned,
                    totalPracticeSeconds,
                    todayActivity?.XpEarned ?? 0,
                    todayActivity?.WordsLearned ?? 0),
                achievements);
        }

        private Task<ProfileProjection?> QueryMyProfileRowAsync(Guid userId, CancellationToken cancellationToken) =>
            _db.Profiles
                .AsNoTracking()
                .Where(p => p.Id == userId && p.Status != "deleted")
                .Select(p => new ProfileProjection(
                    p.Id,
                    p.Username,
                    p.DisplayName,
                    p.AvatarPath,
                    p.Bio,
                    p.UiLocale,
                    p.Timezone,
                    p.ProfileVisibility,
                    p.Role,
                    p.Status,
                    p.OnboardingCompletedAt,
                    p.CreatedAt,
                    p.Setting == null ? null : new UserSettingDto(
                        p.Setting.Theme,
                        p.Setting.DailyGoalXp,
                        p.Setting.SoundEnabled,
                        p.Setting.ReminderEnabled,
                        p.Setting.ReminderTime
                    ),
                    p.Stat == null ? null : new UserStatDto(
                        p.Stat.TotalXp,
                        p.Stat.CurrentStreak,
                        p.Stat.LongestStreak,
                        p.Stat.LastActivityDate,
                        p.Stat.StreakFreezes
                    ),
                    p.LearningProfile == null ? null : new UserLearningProfileDto(
                        p.LearningProfile.LearningReason,
                        p.LearningProfile.CefrLevel,
                        p.LearningProfile.PlacementCompletedAt
                    )
                ))
                .SingleOrDefaultAsync(cancellationToken);

        private DateOnly Today(string timezone)
        {
            if (!TimeZoneInfo.TryFindSystemTimeZoneById(timezone, out var zone)
                && !TimeZoneInfo.TryFindSystemTimeZoneById(DefaultTimezone, out zone))
            {
                zone = TimeZoneInfo.CreateCustomTimeZone(DefaultTimezone, TimeSpan.FromHours(7), DefaultTimezone, DefaultTimezone);
            }

            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(_clock.GetUtcNow(), zone).DateTime);
        }

        private sealed record ProfileProjection(
            Guid Id,
            string Username,
            string DisplayName,
            string? AvatarPath,
            string? Bio,
            string UiLocale,
            string Timezone,
            string ProfileVisibility,
            string Role,
            string Status,
            DateTimeOffset? OnboardingCompletedAt,
            DateTimeOffset CreatedAt,
            UserSettingDto? Setting,
            UserStatDto? Stat,
            UserLearningProfileDto? LearningProfile);
    }
}
