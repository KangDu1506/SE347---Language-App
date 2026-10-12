using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.DTOs.Users;

namespace SE347.Services
{
    public class UserService : IUserService
    {
        private readonly ApplicationDbContext _db;

        public UserService(ApplicationDbContext db)
        {
            _db = db;
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
        /// </summary>
        public async Task<MyProfileDto?> GetMyProfileAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            return await _db.Profiles
                .AsNoTracking()
                .Where(p => p.Id == userId && p.Status != "deleted")
                .Select(p => new MyProfileDto(
                    p.Id,
                    p.Username,
                    p.DisplayName,
                    p.AvatarPath,
                    p.Bio,
                    p.UiLocale,
                    p.Timezone,
                    p.ProfileVisibility,
                    p.Role,
                    p.OnboardingCompletedAt,
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
        }
    }
}
