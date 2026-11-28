using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SE347.Data;
using SE347.DTOs.Rankings;
using SE347.Models;

namespace SE347.Tests
{
    /// <summary>
    /// GET /api/rankings (SCRUM-94). Mỗi test dùng một factory riêng để bảng xếp hạng chỉ có dữ liệu của test đó,
    /// và cố định "bây giờ" qua <see cref="FixedClock"/>.
    /// </summary>
    public class RankingEndpointsTests
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private static readonly TimeSpan Vn = TimeSpan.FromHours(7);

        [Fact]
        public async Task GetRankings_WithoutAuth_Returns401()
        {
            using var factory = new RankingApiFactory();

            var response = await factory.CreateClientFor(null).GetAsync("/api/rankings?period=week");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Theory]
        [InlineData("period=year")]
        [InlineData("period=")]
        [InlineData("period=all&limit=0")]
        [InlineData("period=all&limit=101")]
        [InlineData("period=all&limit=-5")]
        [InlineData("period=all&limit=abc")]
        public async Task GetRankings_InvalidQuery_Returns400(string query)
        {
            using var factory = new RankingApiFactory();
            var me = await factory.AddUserAsync("me");

            var response = await factory.CreateClientFor(me).GetAsync($"/api/rankings?{query}");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.True(body.RootElement.TryGetProperty("error", out _));
        }

        [Fact]
        public async Task GetRankings_MissingProfile_Returns404()
        {
            using var factory = new RankingApiFactory();

            var response = await factory.CreateClientFor(Guid.NewGuid()).GetAsync("/api/rankings?period=all");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task GetRankings_NoPeriod_DefaultsToWeek()
        {
            using var factory = new RankingApiFactory();
            factory.Clock.Now = new DateTimeOffset(2026, 11, 26, 10, 0, 0, Vn); // thứ Năm
            var me = await factory.AddUserAsync("me");

            var ranking = await GetAsync(factory, me, "/api/rankings");

            Assert.Equal("week", ranking.Period);
            Assert.Equal(new DateOnly(2026, 11, 23), ranking.PeriodStart);
        }

        [Fact]
        public async Task GetRankings_All_OrdersByTotalXpThenUpdatedAtThenProfileId()
        {
            using var factory = new RankingApiFactory();
            var lowId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var highId = Guid.Parse("ffffffff-0000-0000-0000-000000000001");

            // ApplicationDbContext tự gán user_stats.updated_at = lúc SaveChanges:
            // "early" lưu trước "late" nên updated_at nhỏ hơn, còn hai user idhigh/idlow lưu chung một lần nên trùng updated_at.
            var earlyUpdate = await factory.AddUserAsync("early", totalXp: 300);
            await Task.Delay(5);
            var lateUpdate = await factory.AddUserAsync("late", totalXp: 300);
            await factory.AddUsersAsync(
                new RankingUser("idhigh", TotalXp: 200, Id: highId),
                new RankingUser("idlow", TotalXp: 200, Id: lowId));
            var top = await factory.AddUserAsync("top", totalXp: 500);

            var ranking = await GetAsync(factory, highId, "/api/rankings?period=all");

            Assert.Equal("all", ranking.Period);
            Assert.Null(ranking.PeriodStart);
            Assert.Equal(["top", "early", "late", "idlow", "idhigh"], ranking.Entries.Select(e => e.Username));
            Assert.Equal([1, 2, 3, 4, 5], ranking.Entries.Select(e => e.Rank));
            Assert.Equal([500L, 300, 300, 200, 200], ranking.Entries.Select(e => e.Xp));
            Assert.Equal(["idhigh"], ranking.Entries.Where(e => e.IsCurrentUser).Select(e => e.Username));

            // Truy vấn đếm cho currentUser phải ra cùng hạng với danh sách ở cả 3 cấp tie-break
            Assert.Equal(5, ranking.CurrentUser.Rank);
            Assert.Equal(1, (await GetAsync(factory, top, "/api/rankings?period=all")).CurrentUser.Rank);
            Assert.Equal(2, (await GetAsync(factory, earlyUpdate, "/api/rankings?period=all")).CurrentUser.Rank);
            Assert.Equal(3, (await GetAsync(factory, lateUpdate, "/api/rankings?period=all")).CurrentUser.Rank);
            Assert.Equal(4, (await GetAsync(factory, lowId, "/api/rankings?period=all")).CurrentUser.Rank);
        }

        [Fact]
        public async Task GetRankings_Week_TieBreaksByTotalXpThenProfileId()
        {
            using var factory = new RankingApiFactory();
            factory.Clock.Now = new DateTimeOffset(2026, 11, 26, 10, 0, 0, Vn);
            var lowId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var highId = Guid.Parse("ffffffff-0000-0000-0000-000000000001");
            var day = new DateOnly(2026, 11, 24);

            var veteran = await factory.AddUserAsync("veteran", totalXp: 900);
            var newbie = await factory.AddUserAsync("newbie", totalXp: 100);
            await factory.AddUserAsync("idhigh", totalXp: 100, id: highId);
            await factory.AddUserAsync("idlow", totalXp: 100, id: lowId);
            foreach (var user in new[] { veteran, newbie, highId, lowId })
            {
                await factory.AddActivityAsync(user, day, 40);
            }

            var ranking = await GetAsync(factory, highId, "/api/rankings?period=week");

            Assert.Equal(["veteran", "idlow", "newbie", "idhigh"], ranking.Entries.Select(e => e.Username));
            Assert.All(ranking.Entries, e => Assert.Equal(40, e.Xp));
            Assert.Equal(4, ranking.CurrentUser.Rank);
            Assert.Equal(2, (await GetAsync(factory, lowId, "/api/rankings?period=week")).CurrentUser.Rank);
        }

        [Fact]
        public async Task GetRankings_ListsOnlyActivePublicProfilesWithXp()
        {
            using var factory = new RankingApiFactory();
            var me = await factory.AddUserAsync("shown", totalXp: 100);
            await factory.AddUserAsync("hidden", totalXp: 200, visibility: "private");
            await factory.AddUserAsync("banned", totalXp: 300, status: "suspended");
            await factory.AddUserAsync("gone", totalXp: 400, status: "deleted");
            await factory.AddUserAsync("zero", totalXp: 0);
            await factory.AddUserAsync("nostats");

            var ranking = await GetAsync(factory, me, "/api/rankings?period=all");

            var entry = Assert.Single(ranking.Entries);
            Assert.Equal("shown", entry.Username);
            Assert.Equal(1, entry.Rank);
            Assert.True(entry.IsCurrentUser);
            Assert.Equal(1, ranking.CurrentUser.Rank);
        }

        [Fact]
        public async Task GetRankings_PrivateCurrentUser_StillGetsCurrentUserBlock()
        {
            using var factory = new RankingApiFactory();
            await factory.AddUserAsync("leader", totalXp: 500);
            await factory.AddUserAsync("third", totalXp: 100);
            var me = await factory.AddUserAsync("me", totalXp: 200, visibility: "private");

            var ranking = await GetAsync(factory, me, "/api/rankings?period=all");

            Assert.Equal(["leader", "third"], ranking.Entries.Select(e => e.Username));
            Assert.DoesNotContain(ranking.Entries, e => e.IsCurrentUser);
            Assert.Equal(2, ranking.CurrentUser.Rank);
            Assert.Equal(200, ranking.CurrentUser.Xp);
            Assert.Equal("private", ranking.CurrentUser.ProfileVisibility);
            Assert.Equal("me", ranking.CurrentUser.Username);
            Assert.Equal("Người dùng me", ranking.CurrentUser.DisplayName);
            Assert.Equal("me/avatar.webp", ranking.CurrentUser.AvatarPath);
        }

        [Fact]
        public async Task GetRankings_CurrentUserWithoutXpOrInactive_HasNullRank()
        {
            using var factory = new RankingApiFactory();
            await factory.AddUserAsync("leader", totalXp: 500);
            var noStats = await factory.AddUserAsync("nostats");
            var suspended = await factory.AddUserAsync("suspended", totalXp: 300, status: "suspended");

            var noStatsRanking = await GetAsync(factory, noStats, "/api/rankings?period=all");
            var suspendedRanking = await GetAsync(factory, suspended, "/api/rankings?period=all");

            Assert.Null(noStatsRanking.CurrentUser.Rank);
            Assert.Equal(0, noStatsRanking.CurrentUser.Xp);
            Assert.Null(suspendedRanking.CurrentUser.Rank);
            Assert.Equal(300, suspendedRanking.CurrentUser.Xp);
            Assert.Equal("public", suspendedRanking.CurrentUser.ProfileVisibility);
        }

        [Fact]
        public async Task GetRankings_Week_StartsMondayInVietnamTime()
        {
            using var factory = new RankingApiFactory();
            var sunday = new DateOnly(2026, 11, 22);
            var monday = new DateOnly(2026, 11, 23);
            var sundayLearner = await factory.AddUserAsync("sunday", totalXp: 50);
            var mondayLearner = await factory.AddUserAsync("monday", totalXp: 30);
            await factory.AddActivityAsync(sundayLearner, sunday, 50);
            await factory.AddActivityAsync(mondayLearner, monday, 30);

            // Chủ nhật 23:30 giờ VN (16:30 UTC): vẫn là tuần bắt đầu từ thứ Hai 16/11
            factory.Clock.Now = new DateTimeOffset(2026, 11, 22, 23, 30, 0, Vn);
            var lateSunday = await GetAsync(factory, sundayLearner, "/api/rankings?period=week");

            Assert.Equal(new DateOnly(2026, 11, 16), lateSunday.PeriodStart);
            Assert.Equal(["sunday"], lateSunday.Entries.Select(e => e.Username));
            Assert.Equal(1, lateSunday.CurrentUser.Rank);

            // Thứ Hai 00:30 giờ VN (vẫn là Chủ nhật 17:30 UTC): tuần mới, XP của Chủ nhật không còn tính
            factory.Clock.Now = new DateTimeOffset(2026, 11, 23, 0, 30, 0, Vn);
            var earlyMonday = await GetAsync(factory, sundayLearner, "/api/rankings?period=week");

            Assert.Equal(monday, earlyMonday.PeriodStart);
            Assert.Equal(["monday"], earlyMonday.Entries.Select(e => e.Username));
            Assert.Null(earlyMonday.CurrentUser.Rank);
            Assert.Equal(0, earlyMonday.CurrentUser.Xp);
        }

        [Fact]
        public async Task GetRankings_Month_StartsOnFirstDayInVietnamTime()
        {
            using var factory = new RankingApiFactory();
            var lastMonth = await factory.AddUserAsync("october", totalXp: 70);
            var endOfMonth = await factory.AddUserAsync("november", totalXp: 60);
            var newMonth = await factory.AddUserAsync("december", totalXp: 10);
            await factory.AddActivityAsync(lastMonth, new DateOnly(2026, 10, 31), 70);
            await factory.AddActivityAsync(endOfMonth, new DateOnly(2026, 11, 1), 20);
            await factory.AddActivityAsync(endOfMonth, new DateOnly(2026, 11, 30), 40);
            await factory.AddActivityAsync(newMonth, new DateOnly(2026, 12, 1), 10);

            factory.Clock.Now = new DateTimeOffset(2026, 11, 30, 23, 30, 0, Vn);
            var november = await GetAsync(factory, endOfMonth, "/api/rankings?period=month");

            Assert.Equal("month", november.Period);
            Assert.Equal(new DateOnly(2026, 11, 1), november.PeriodStart);
            var entry = Assert.Single(november.Entries);
            Assert.Equal(("november", 60L), (entry.Username, entry.Xp));
            Assert.Equal(60, november.CurrentUser.Xp);

            factory.Clock.Now = new DateTimeOffset(2026, 12, 1, 0, 30, 0, Vn);
            var december = await GetAsync(factory, endOfMonth, "/api/rankings?period=month");

            Assert.Equal(new DateOnly(2026, 12, 1), december.PeriodStart);
            Assert.Equal(["december"], december.Entries.Select(e => e.Username));
            Assert.Null(december.CurrentUser.Rank);
        }

        [Fact]
        public async Task GetRankings_Limit_CapsEntriesButNotCurrentUserRank()
        {
            using var factory = new RankingApiFactory();
            await factory.AddUserAsync("first", totalXp: 300);
            await factory.AddUserAsync("second", totalXp: 200);
            var me = await factory.AddUserAsync("third", totalXp: 100);

            var limited = await GetAsync(factory, me, "/api/rankings?period=all&limit=2");
            var max = await factory.CreateClientFor(me).GetAsync("/api/rankings?period=all&limit=100");

            Assert.Equal(["first", "second"], limited.Entries.Select(e => e.Username));
            Assert.Equal(3, limited.CurrentUser.Rank);
            Assert.Equal(HttpStatusCode.OK, max.StatusCode);
        }

        [Fact]
        public async Task GetRankings_DefaultLimitIs50()
        {
            using var factory = new RankingApiFactory();
            var me = await factory.AddUserAsync("me", totalXp: 1);
            for (var i = 0; i < 55; i++)
            {
                await factory.AddUserAsync($"user{i}", totalXp: 100 + i);
            }

            var ranking = await GetAsync(factory, me, "/api/rankings?period=all");

            Assert.Equal(50, ranking.Entries.Count);
            Assert.Equal(56, ranking.CurrentUser.Rank);
        }

        private static async Task<RankingResponseDto> GetAsync(RankingApiFactory factory, Guid userId, string url)
        {
            var response = await factory.CreateClientFor(userId).GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<RankingResponseDto>(Json))!;
        }
    }

    public record RankingUser(string Username, long? TotalXp = null, string Visibility = "public", string Status = "active", Guid? Id = null);

    /// <summary>TimeProvider cố định giờ cho test, đổi được giữa các request.</summary>
    public class FixedClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 11, 26, 10, 0, 0, TimeSpan.FromHours(7));

        public override DateTimeOffset GetUtcNow() => Now.ToUniversalTime();
    }

    /// <summary><see cref="LessonApiFactory"/> có thêm đồng hồ cố định và helper tạo dữ liệu xếp hạng.</summary>
    public class RankingApiFactory : LessonApiFactory
    {
        public FixedClock Clock { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(Clock);
            });
        }

        /// <summary>Tạo hồ sơ (mặc định active + public). totalXp null = không có dòng user_stats.</summary>
        public async Task<Guid> AddUserAsync(string username, long? totalXp = null,
            string visibility = "public", string status = "active", Guid? id = null)
        {
            var user = new RankingUser(username, totalXp, visibility, status, id ?? Guid.NewGuid());
            await AddUsersAsync(user);
            return user.Id!.Value;
        }

        /// <summary>Lưu nhiều hồ sơ trong cùng một SaveChanges, nên user_stats.updated_at của chúng bằng nhau.</summary>
        public Task AddUsersAsync(params RankingUser[] users) => WithDbAsync(db =>
        {
            foreach (var user in users)
            {
                var userId = user.Id ?? throw new ArgumentException("Cần Id.", nameof(users));
                db.Profiles.Add(new Profile
                {
                    Id = userId,
                    Username = user.Username,
                    DisplayName = $"Người dùng {user.Username}",
                    AvatarPath = $"{user.Username}/avatar.webp",
                    ProfileVisibility = user.Visibility,
                    Status = user.Status,
                });
                if (user.TotalXp is long xp)
                {
                    db.UserStats.Add(new UserStat { UserId = userId, TotalXp = xp });
                }
            }
        });

        public Task AddActivityAsync(Guid userId, DateOnly date, int xp) => WithDbAsync(db =>
            db.UserDailyActivities.Add(new UserDailyActivity { UserId = userId, ActivityDate = date, XpEarned = xp }));
    }
}
