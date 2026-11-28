using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.DTOs.Rankings;

namespace SE347.Services
{
    /// <summary>
    /// Bảng xếp hạng tổng (S3-05). Mọi truy vấn chạy trong DB (GroupBy + Sum, join profiles),
    /// không kéo cả bảng về bộ nhớ: danh sách chỉ lấy tối đa <c>limit</c> dòng,
    /// hạng của người gọi tính bằng một truy vấn đếm số người đứng trước.
    ///
    /// Luật xếp hạng:
    /// - all: user_stats.total_xp desc, user_stats.updated_at asc (ai đạt mức XP đó trước thì đứng trên), profiles.id asc.
    /// - week / month: tổng user_daily_activity.xp_earned trong kỳ desc, user_stats.total_xp desc, profiles.id asc.
    /// Chỉ liệt kê hồ sơ status = active và profile_visibility = public có XP trong kỳ lớn hơn 0.
    /// </summary>
    public class RankingService : IRankingService
    {
        // Bảng xếp hạng dùng chung một mốc ngày cho mọi người, không theo timezone riêng của từng hồ sơ.
        private const string RankingTimezone = "Asia/Ho_Chi_Minh";
        private const string StatusActive = "active";
        private const string VisibilityPublic = "public";

        private readonly ApplicationDbContext _db;
        private readonly TimeProvider _clock;

        public RankingService(ApplicationDbContext db, TimeProvider clock)
        {
            _db = db;
            _clock = clock;
        }

        public async Task<RankingResponseDto?> GetRankingAsync(Guid userId, RankingPeriod period, int limit, CancellationToken cancellationToken = default)
        {
            var me = await _db.Profiles
                .AsNoTracking()
                .Where(p => p.Id == userId)
                .Select(p => new
                {
                    p.Username,
                    p.DisplayName,
                    p.AvatarPath,
                    p.ProfileVisibility,
                    p.Status,
                    TotalXp = p.Stat == null ? 0L : p.Stat.TotalXp,
                    StatUpdatedAt = p.Stat == null ? (DateTimeOffset?)null : p.Stat.UpdatedAt,
                })
                .SingleOrDefaultAsync(cancellationToken);

            if (me is null)
            {
                return null;
            }

            var today = Today();
            var periodStart = period switch
            {
                RankingPeriod.Week => today.AddDays(-(((int)today.DayOfWeek + 6) % 7)),
                RankingPeriod.Month => new DateOnly(today.Year, today.Month, 1),
                _ => (DateOnly?)null,
            };

            List<RankedRow> rows;
            long myXp;
            int? myRank = null;

            if (periodStart is not DateOnly start)
            {
                var ranked =
                    from s in _db.UserStats
                    join p in _db.Profiles on s.UserId equals p.Id
                    where s.TotalXp > 0 && p.Status == StatusActive && p.ProfileVisibility == VisibilityPublic
                    select new
                    {
                        s.UserId,
                        p.Username,
                        p.DisplayName,
                        p.AvatarPath,
                        Xp = s.TotalXp,
                        s.UpdatedAt,
                    };

                rows = await ranked
                    .AsNoTracking()
                    .OrderByDescending(r => r.Xp)
                    .ThenBy(r => r.UpdatedAt)
                    .ThenBy(r => r.UserId)
                    .Take(limit)
                    .Select(r => new RankedRow(r.UserId, r.Username, r.DisplayName, r.AvatarPath, r.Xp))
                    .ToListAsync(cancellationToken);

                myXp = me.TotalXp;
                if (me.Status == StatusActive && myXp > 0 && me.StatUpdatedAt is DateTimeOffset myUpdatedAt)
                {
                    var ahead = await ranked.CountAsync(r =>
                        r.Xp > myXp
                        || (r.Xp == myXp && r.UpdatedAt < myUpdatedAt)
                        || (r.Xp == myXp && r.UpdatedAt == myUpdatedAt && r.UserId.CompareTo(userId) < 0),
                        cancellationToken);
                    myRank = ahead + 1;
                }
            }
            else
            {
                var periodXp = _db.UserDailyActivities
                    .Where(a => a.ActivityDate >= start && a.ActivityDate <= today)
                    .GroupBy(a => a.UserId)
                    .Select(g => new { UserId = g.Key, Xp = g.Sum(a => (long)a.XpEarned) });

                var ranked =
                    from x in periodXp
                    join p in _db.Profiles on x.UserId equals p.Id
                    where x.Xp > 0 && p.Status == StatusActive && p.ProfileVisibility == VisibilityPublic
                    select new
                    {
                        x.UserId,
                        p.Username,
                        p.DisplayName,
                        p.AvatarPath,
                        x.Xp,
                        TotalXp = p.Stat == null ? 0L : p.Stat.TotalXp,
                    };

                rows = await ranked
                    .AsNoTracking()
                    .OrderByDescending(r => r.Xp)
                    .ThenByDescending(r => r.TotalXp)
                    .ThenBy(r => r.UserId)
                    .Take(limit)
                    .Select(r => new RankedRow(r.UserId, r.Username, r.DisplayName, r.AvatarPath, r.Xp))
                    .ToListAsync(cancellationToken);

                myXp = await _db.UserDailyActivities
                    .Where(a => a.UserId == userId && a.ActivityDate >= start && a.ActivityDate <= today)
                    .SumAsync(a => (long)a.XpEarned, cancellationToken);

                if (me.Status == StatusActive && myXp > 0)
                {
                    var myTotalXp = me.TotalXp;
                    var ahead = await ranked.CountAsync(r =>
                        r.Xp > myXp
                        || (r.Xp == myXp && r.TotalXp > myTotalXp)
                        || (r.Xp == myXp && r.TotalXp == myTotalXp && r.UserId.CompareTo(userId) < 0),
                        cancellationToken);
                    myRank = ahead + 1;
                }
            }

            var entries = rows
                .Select((r, index) => new RankingEntryDto(index + 1, r.Username, r.DisplayName, r.AvatarPath, r.Xp, r.UserId == userId))
                .ToList();

            return new RankingResponseDto(
                ToQueryValue(period),
                periodStart,
                entries,
                new RankingCurrentUserDto(myRank, myXp, me.ProfileVisibility, me.Username, me.DisplayName, me.AvatarPath));
        }

        /// <summary>Giá trị query <c>period</c> tương ứng ("week" | "month" | "all").</summary>
        public static string ToQueryValue(RankingPeriod period) => period switch
        {
            RankingPeriod.Week => "week",
            RankingPeriod.Month => "month",
            _ => "all",
        };

        /// <summary>Đọc query <c>period</c>, không phân biệt hoa thường.</summary>
        public static bool TryParsePeriod(string? value, out RankingPeriod period)
        {
            switch (value?.Trim().ToLowerInvariant())
            {
                case "week":
                    period = RankingPeriod.Week;
                    return true;
                case "month":
                    period = RankingPeriod.Month;
                    return true;
                case "all":
                    period = RankingPeriod.All;
                    return true;
                default:
                    period = default;
                    return false;
            }
        }

        private DateOnly Today()
        {
            if (!TimeZoneInfo.TryFindSystemTimeZoneById(RankingTimezone, out var zone))
            {
                zone = TimeZoneInfo.CreateCustomTimeZone(RankingTimezone, TimeSpan.FromHours(7), RankingTimezone, RankingTimezone);
            }

            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(_clock.GetUtcNow(), zone).DateTime);
        }

        private sealed record RankedRow(Guid UserId, string Username, string DisplayName, string? AvatarPath, long Xp);
    }
}
