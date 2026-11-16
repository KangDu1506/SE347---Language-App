using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SE347.Data;
using SE347.DTOs.Users;
using SE347.Models;

namespace SE347.Tests
{
    public class UserEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly LessonApiFactory _factory;

        public UserEndpointsTests(LessonApiFactory factory)
        {
            _factory = factory;
        }

        [Theory]
        [InlineData("/api/users/me")]
        [InlineData("/api/me")]
        public async Task GetMe_WithoutAuth_Returns401(string url)
        {
            var response = await _factory.CreateClientFor(null).GetAsync(url);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task GetMe_DeletedOrMissingProfile_Returns404()
        {
            var deletedUserId = await _factory.CreateUserAsync("deleted");

            var deletedResponse = await _factory.CreateClientFor(deletedUserId).GetAsync("/api/users/me");
            var missingResponse = await _factory.CreateClientFor(Guid.NewGuid()).GetAsync("/api/users/me");

            Assert.Equal(HttpStatusCode.NotFound, deletedResponse.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, missingResponse.StatusCode);
        }

        [Fact]
        public async Task GetMe_BindsAllDatabaseProfileSettingsStatsLearningProgressAndAchievements()
        {
            var userId = Guid.NewGuid();
            var hcmZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, hcmZone).DateTime);
            var joinedAt = new DateTimeOffset(2026, 9, 1, 8, 30, 0, TimeSpan.FromHours(7));
            var awardedAt = new DateTimeOffset(2026, 10, 12, 9, 15, 0, TimeSpan.FromHours(7));
            var achievementCode = $"ach_{userId:N}"[..24];

            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.Profiles.Add(new Profile
                {
                    Id = userId,
                    Username = $"learner_{userId:N}"[..20],
                    DisplayName = "Trần Minh Anh",
                    AvatarPath = $"{userId}/avatar.webp",
                    Bio = "Luyện IELTS 7.5 mỗi ngày",
                    UiLocale = "en",
                    Timezone = "Asia/Ho_Chi_Minh",
                    ProfileVisibility = "public",
                    Role = "admin",
                    Status = "active",
                    CreatedAt = joinedAt,
                    UpdatedAt = joinedAt,
                });
                db.UserSettings.Add(new UserSetting
                {
                    UserId = userId,
                    Theme = "dark",
                    DailyGoalXp = 30,
                    SoundEnabled = false,
                    ReminderEnabled = true,
                    ReminderTime = new TimeOnly(20, 15),
                });
                db.UserStats.Add(new UserStat
                {
                    UserId = userId,
                    TotalXp = 1250,
                    CurrentStreak = 6,
                    LongestStreak = 14,
                    LastActivityDate = today,
                    StreakFreezes = 2,
                });
                db.UserLearningProfiles.Add(new UserLearningProfile
                {
                    UserId = userId,
                    LearningReason = "exam",
                    CefrLevel = "B1",
                    PlacementCompletedAt = joinedAt.AddDays(1),
                });
                db.UserLessonProgresses.AddRange(
                    new UserLessonProgress { UserId = userId, LessonId = "greetings", Status = UserLessonProgress.StatusCompleted },
                    new UserLessonProgress { UserId = userId, LessonId = "family-members", Status = UserLessonProgress.StatusCompleted },
                    new UserLessonProgress { UserId = userId, LessonId = "present-simple-tense", Status = UserLessonProgress.StatusInProgress }
                );
                db.UserDailyActivities.AddRange(
                    new UserDailyActivity { UserId = userId, ActivityDate = today.AddDays(-2), XpEarned = 40, WordsLearned = 15, PracticeSeconds = 600 },
                    new UserDailyActivity { UserId = userId, ActivityDate = today, XpEarned = 25, WordsLearned = 9, PracticeSeconds = 420 }
                );
                db.Achievements.Add(new Achievement
                {
                    Code = achievementCode,
                    Category = "streak",
                    Threshold = 7,
                    NameVi = "Một tuần",
                    NameEn = "One Week",
                    DescriptionVi = "Học 7 ngày liên tiếp",
                    DescriptionEn = "Reach a 7-day streak",
                    XpReward = 20,
                    SortOrder = 3,
                });
                db.UserAchievements.Add(new UserAchievement
                {
                    UserId = userId,
                    AchievementCode = achievementCode,
                    AwardedAt = awardedAt,
                });
                await db.SaveChangesAsync();
            }

            var me = await _factory.CreateClientFor(userId).GetFromJsonAsync<MyProfileDto>("/api/users/me", Json);

            Assert.NotNull(me);
            Assert.Equal(userId, me.Id);
            Assert.Equal($"learner_{userId:N}"[..20], me.Username);
            Assert.Equal("Trần Minh Anh", me.DisplayName);
            Assert.Equal($"{userId}/avatar.webp", me.AvatarPath);
            Assert.Equal("Luyện IELTS 7.5 mỗi ngày", me.Bio);
            Assert.Equal("en", me.UiLocale);
            Assert.Equal("Asia/Ho_Chi_Minh", me.Timezone);
            Assert.Equal("public", me.ProfileVisibility);
            Assert.Equal("admin", me.Role);
            Assert.Equal("active", me.Status);
            Assert.Equal(joinedAt, me.CreatedAt);

            Assert.NotNull(me.Setting);
            Assert.Equal("dark", me.Setting.Theme);
            Assert.Equal((short)30, me.Setting.DailyGoalXp);
            Assert.False(me.Setting.SoundEnabled);
            Assert.True(me.Setting.ReminderEnabled);
            Assert.Equal(new TimeOnly(20, 15), me.Setting.ReminderTime);

            Assert.NotNull(me.Stat);
            Assert.Equal(1250, me.Stat.TotalXp);
            Assert.Equal(6, me.Stat.CurrentStreak);
            Assert.Equal(14, me.Stat.LongestStreak);
            Assert.Equal(today, me.Stat.LastActivityDate);
            Assert.Equal((short)2, me.Stat.StreakFreezes);

            Assert.NotNull(me.LearningProfile);
            Assert.Equal("exam", me.LearningProfile.LearningReason);
            Assert.Equal("B1", me.LearningProfile.CefrLevel);
            Assert.Equal(joinedAt.AddDays(1), me.LearningProfile.PlacementCompletedAt);

            Assert.NotNull(me.ActivitySummary);
            Assert.Equal(2, me.ActivitySummary.LessonsCompleted);
            Assert.Equal(1, me.ActivitySummary.LessonsInProgress);
            Assert.Equal(24, me.ActivitySummary.TotalWordsLearned);
            Assert.Equal(1020, me.ActivitySummary.TotalPracticeSeconds);
            Assert.Equal(25, me.ActivitySummary.TodayXp);
            Assert.Equal(9, me.ActivitySummary.TodayWordsLearned);

            Assert.NotNull(me.Achievements);
            var badge = Assert.Single(me.Achievements);
            Assert.Equal(achievementCode, badge.Code);
            Assert.Equal("Một tuần", badge.NameVi);
            Assert.Equal("One Week", badge.NameEn);
            Assert.Equal(20, badge.XpReward);
        }

        [Fact]
        public async Task GetMe_ResetsStaleCurrentStreakToZero_WhenLastActivityOlderThanYesterday()
        {
            var userId = Guid.NewGuid();
            var hcmZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, hcmZone).DateTime);

            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.Profiles.Add(new Profile
                {
                    Id = userId,
                    Username = $"stale_{userId:N}"[..20],
                    DisplayName = "Stale Streak User",
                    Timezone = "Asia/Ho_Chi_Minh",
                    Status = "active",
                });
                db.UserStats.Add(new UserStat
                {
                    UserId = userId,
                    TotalXp = 300,
                    CurrentStreak = 5,
                    LongestStreak = 9,
                    LastActivityDate = today.AddDays(-3),
                });
                await db.SaveChangesAsync();
            }

            var me = await _factory.CreateClientFor(userId).GetFromJsonAsync<MyProfileDto>("/api/me", Json);

            Assert.NotNull(me);
            Assert.NotNull(me.Stat);
            Assert.Equal(0, me.Stat.CurrentStreak);
            Assert.Equal(9, me.Stat.LongestStreak);
        }
    }
}
