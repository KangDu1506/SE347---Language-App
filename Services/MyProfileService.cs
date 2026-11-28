using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SE347.Data;
using SE347.DTOs.Users;
using SE347.Models;

namespace SE347.Services
{
    public partial class MyProfileService : IMyProfileService
    {
        // Giữ đúng các luật của hàm public.is_valid_username và constraint trong supabase/migrations
        private static readonly HashSet<string> ReservedUsernames =
        [
            "admin", "administrator", "support", "system", "root",
            "moderator", "api", "null", "undefined", "me", "help",
        ];

        private static readonly string[] UiLocales = ["vi", "en"];
        private static readonly string[] Visibilities = ["public", "private"];
        private static readonly string[] Themes = ["light", "dark", "system"];
        private static readonly int[] DailyGoals = [10, 20, 30, 50];
        private static readonly string[] LearningReasons = ["travel", "work", "school", "exam", "fun", "other"];
        private static readonly string[] ReminderTimeFormats = ["HH:mm", "HH:mm:ss"];

        private const int MaxDisplayNameLength = 80;
        private const int MaxBioLength = 160;
        private const int MaxTimezoneLength = 64;

        private readonly ApplicationDbContext _db;
        private readonly IUserProfileInitializer _initializer;
        private readonly IUserService _users;
        private readonly IAvatarStorage _storage;
        private readonly ILogger<MyProfileService> _logger;

        public MyProfileService(
            ApplicationDbContext db,
            IUserProfileInitializer initializer,
            IUserService users,
            IAvatarStorage storage,
            ILogger<MyProfileService> logger)
        {
            _db = db;
            _initializer = initializer;
            _users = users;
            _storage = storage;
            _logger = logger;
        }

        public async Task<ProfileUpdateResult<MyProfileDto>> UpdateAsync(Guid userId, UpdateMyProfileRequest request, CancellationToken cancellationToken = default)
        {
            var (profile, loadError) = await LoadActiveProfileAsync(userId, cancellationToken);
            if (profile is null)
            {
                return ProfileUpdateResult<MyProfileDto>.Fail(loadError);
            }

            var setting = profile.Setting!;
            var learning = profile.LearningProfile!;

            if (request.DisplayName.HasValue)
            {
                var value = request.DisplayName.Value?.Trim();
                if (string.IsNullOrEmpty(value) || TextLength(value) > MaxDisplayNameLength)
                {
                    return Invalid("displayName", $"Tên hiển thị phải dài 1–{MaxDisplayNameLength} ký tự.");
                }

                profile.DisplayName = value;
            }

            if (request.Username.HasValue)
            {
                var value = request.Username.Value?.Trim().ToLowerInvariant();
                if (value is null || !IsValidUsername(value))
                {
                    return Invalid("username", "Username dài 3–30 ký tự, chỉ gồm a-z, 0-9, dấu chấm và gạch dưới, bắt đầu và kết thúc bằng chữ hoặc số, không có hai dấu . _ liền nhau và không thuộc danh sách tên cấm.");
                }

                if (value != profile.Username)
                {
                    var taken = await _db.Profiles
                        .AsNoTracking()
                        .AnyAsync(p => p.Username == value && p.Id != userId, cancellationToken);
                    if (taken)
                    {
                        return UsernameTaken();
                    }

                    profile.Username = value;
                }
            }

            if (request.Bio.HasValue)
            {
                var value = request.Bio.Value?.Trim();
                if (string.IsNullOrEmpty(value))
                {
                    profile.Bio = null;
                }
                else if (TextLength(value) > MaxBioLength)
                {
                    return Invalid("bio", $"Giới thiệu tối đa {MaxBioLength} ký tự.");
                }
                else
                {
                    profile.Bio = value;
                }
            }

            if (request.UiLocale.HasValue)
            {
                if (!TryPick(request.UiLocale.Value, UiLocales, out var value))
                {
                    return Invalid("uiLocale", "uiLocale phải là vi hoặc en.");
                }

                profile.UiLocale = value;
            }

            if (request.Timezone.HasValue)
            {
                var value = request.Timezone.Value?.Trim();
                if (!IsValidTimezone(value))
                {
                    return Invalid("timezone", "timezone phải là tên múi giờ IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.");
                }

                profile.Timezone = value!;
            }

            if (request.ProfileVisibility.HasValue)
            {
                if (!TryPick(request.ProfileVisibility.Value, Visibilities, out var value))
                {
                    return Invalid("profileVisibility", "profileVisibility phải là public hoặc private.");
                }

                profile.ProfileVisibility = value;
            }

            if (request.LearningReason.HasValue)
            {
                var raw = request.LearningReason.Value?.Trim();
                if (string.IsNullOrEmpty(raw))
                {
                    learning.LearningReason = null;
                }
                else if (TryPick(raw, LearningReasons, out var value))
                {
                    learning.LearningReason = value;
                }
                else
                {
                    return Invalid("learningReason", "learningReason phải là null hoặc một trong: travel, work, school, exam, fun, other.");
                }
            }

            if (request.Theme.HasValue)
            {
                if (!TryPick(request.Theme.Value, Themes, out var value))
                {
                    return Invalid("theme", "theme phải là light, dark hoặc system.");
                }

                setting.Theme = value;
            }

            if (request.DailyGoalXp.HasValue)
            {
                if (request.DailyGoalXp.Value is not int goal || !DailyGoals.Contains(goal))
                {
                    return Invalid("dailyGoalXp", "dailyGoalXp phải là 10, 20, 30 hoặc 50.");
                }

                setting.DailyGoalXp = (short)goal;
            }

            if (request.SoundEnabled.HasValue)
            {
                if (request.SoundEnabled.Value is not bool sound)
                {
                    return Invalid("soundEnabled", "soundEnabled phải là true hoặc false.");
                }

                setting.SoundEnabled = sound;
            }

            if (request.ReminderEnabled.HasValue)
            {
                if (request.ReminderEnabled.Value is not bool reminder)
                {
                    return Invalid("reminderEnabled", "reminderEnabled phải là true hoặc false.");
                }

                setting.ReminderEnabled = reminder;
            }

            if (request.ReminderTime.HasValue)
            {
                var raw = request.ReminderTime.Value?.Trim();
                if (string.IsNullOrEmpty(raw))
                {
                    setting.ReminderTime = null;
                }
                else if (TimeOnly.TryParseExact(raw, ReminderTimeFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
                {
                    setting.ReminderTime = time;
                }
                else
                {
                    return Invalid("reminderTime", "reminderTime phải có dạng HH:mm hoặc HH:mm:ss.");
                }
            }

            // ck_settings_reminder: xét cả giá trị đang lưu, không chỉ những gì request gửi lên
            if (setting.ReminderEnabled && setting.ReminderTime is null)
            {
                return Invalid("reminderTime", "Bật nhắc nhở thì phải có reminderTime.");
            }

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return ProfileUpdateResult<MyProfileDto>.Fail(ProfileUpdateError.ConcurrentUpdate);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg)
            {
                // Kiểm tra trước bằng LINQ vẫn có thể thua race với request khác: dựa vào constraint của DB
                if (pg.SqlState == PostgresErrorCodes.UniqueViolation && pg.ConstraintName == "uq_profiles_username")
                {
                    return UsernameTaken();
                }

                if (pg.SqlState == PostgresErrorCodes.CheckViolation && pg.ConstraintName == "ck_profiles_username_reserved")
                {
                    return Invalid("username", "Username nằm trong danh sách tên cấm.");
                }

                throw;
            }

            return await MyProfileAsync(userId, cancellationToken);
        }

        public async Task<ProfileUpdateResult<MyProfileDto>> UploadAvatarAsync(Guid userId, Stream content, long length, CancellationToken cancellationToken = default)
        {
            var (profile, loadError) = await LoadActiveProfileAsync(userId, cancellationToken);
            if (profile is null)
            {
                return ProfileUpdateResult<MyProfileDto>.Fail(loadError);
            }

            if (length <= 0)
            {
                return Invalid("file", "File ảnh rỗng.");
            }

            if (length > IMyProfileService.MaxAvatarBytes)
            {
                return Invalid("file", "Ảnh đại diện tối đa 2MB.");
            }

            var bytes = new byte[length];
            await content.ReadExactlyAsync(bytes, cancellationToken);

            if (DetectImage(bytes) is not var (extension, contentType))
            {
                return Invalid("file", "Chỉ nhận ảnh PNG, JPEG hoặc WebP.");
            }

            var oldPath = profile.AvatarPath;
            var newPath = $"{userId}/{Guid.NewGuid():N}.{extension}";

            try
            {
                await _storage.UploadAsync(newPath, bytes, contentType, cancellationToken);
            }
            catch (AvatarStorageException ex)
            {
                _logger.LogWarning(ex, "Upload avatar cho user {UserId} thất bại", userId);
                return ProfileUpdateResult<MyProfileDto>.Fail(ProfileUpdateError.StorageFailed);
            }

            profile.AvatarPath = newPath;
            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex)
            {
                // Không lưu được path thì file mới thành rác: dọn đi rồi báo lỗi như bình thường
                await TryDeleteAsync(userId, newPath);
                if (ex is DbUpdateConcurrencyException)
                {
                    return ProfileUpdateResult<MyProfileDto>.Fail(ProfileUpdateError.ConcurrentUpdate);
                }

                throw;
            }

            await TryDeleteAsync(userId, oldPath);
            return await MyProfileAsync(userId, cancellationToken);
        }

        public async Task<ProfileUpdateResult<MyProfileDto>> RemoveAvatarAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var (profile, loadError) = await LoadActiveProfileAsync(userId, cancellationToken);
            if (profile is null)
            {
                return ProfileUpdateResult<MyProfileDto>.Fail(loadError);
            }

            var oldPath = profile.AvatarPath;
            if (oldPath is not null)
            {
                profile.AvatarPath = null;
                try
                {
                    await _db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateConcurrencyException)
                {
                    return ProfileUpdateResult<MyProfileDto>.Fail(ProfileUpdateError.ConcurrentUpdate);
                }

                await TryDeleteAsync(userId, oldPath);
            }

            return await MyProfileAsync(userId, cancellationToken);
        }

        public async Task<ProfileUpdateResult<bool>> DeactivateAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var profile = await _db.Profiles.SingleOrDefaultAsync(p => p.Id == userId, cancellationToken);
            if (profile is null)
            {
                return ProfileUpdateResult<bool>.Fail(ProfileUpdateError.ProfileNotFound);
            }

            if (profile.Status == "deactivated")
            {
                return ProfileUpdateResult<bool>.Ok(true);
            }

            // Tài khoản bị khóa (suspended) hoặc đã xóa không được tự đổi trạng thái
            if (profile.Status != "active")
            {
                return ProfileUpdateResult<bool>.Fail(ProfileUpdateError.ProfileNotActive);
            }

            // Không đụng deleted_at: ck_profiles_deletion yêu cầu deleted_at null khi status khác deleted
            profile.Status = "deactivated";
            profile.ProfileVisibility = "private";

            try
            {
                await _db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return ProfileUpdateResult<bool>.Fail(ProfileUpdateError.ConcurrentUpdate);
            }

            return ProfileUpdateResult<bool>.Ok(true);
        }

        /// <summary>
        /// Hồ sơ (tracked, kèm user_settings và user_learning_profiles) của user active.
        /// Thiếu dòng nào thì gọi initializer tạo mặc định rồi đọc lại.
        /// </summary>
        private async Task<(Profile? Profile, ProfileUpdateError Error)> LoadActiveProfileAsync(Guid userId, CancellationToken cancellationToken)
        {
            var profile = await QueryProfileAsync(userId, cancellationToken);

            if (profile is not null && profile.Status != "active")
            {
                return (null, ProfileUpdateError.ProfileNotActive);
            }

            if (profile is null || profile.Setting is null || profile.LearningProfile is null)
            {
                await _initializer.EnsureInitializedAsync(userId, cancellationToken);
                profile = await QueryProfileAsync(userId, cancellationToken);
            }

            if (profile is null || profile.Setting is null || profile.LearningProfile is null)
            {
                return (null, ProfileUpdateError.ProfileNotFound);
            }

            return profile.Status == "active"
                ? (profile, ProfileUpdateError.None)
                : (null, ProfileUpdateError.ProfileNotActive);
        }

        private Task<Profile?> QueryProfileAsync(Guid userId, CancellationToken cancellationToken) =>
            _db.Profiles
                .Include(p => p.Setting)
                .Include(p => p.LearningProfile)
                .SingleOrDefaultAsync(p => p.Id == userId, cancellationToken);

        private async Task<ProfileUpdateResult<MyProfileDto>> MyProfileAsync(Guid userId, CancellationToken cancellationToken)
        {
            var dto = await _users.GetMyProfileAsync(userId, cancellationToken);
            return dto is null
                ? ProfileUpdateResult<MyProfileDto>.Fail(ProfileUpdateError.ProfileNotFound)
                : ProfileUpdateResult<MyProfileDto>.Ok(dto);
        }

        /// <summary>Xóa file avatar cũ kiểu best-effort: lỗi chỉ ghi log, không làm hỏng request.</summary>
        private async Task TryDeleteAsync(Guid userId, string? path)
        {
            // Chỉ xóa file trong thư mục của chính user, phòng avatar_path cũ trỏ ra ngoài (URL, file mặc định)
            if (string.IsNullOrEmpty(path) || !path.StartsWith($"{userId}/", StringComparison.Ordinal))
            {
                return;
            }

            try
            {
                await _storage.DeleteAsync(path, CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không xóa được avatar cũ {Path}", path);
            }
        }

        internal static bool IsValidUsername(string username) =>
            UsernamePattern().IsMatch(username)
            && !username.Contains("..") && !username.Contains("__")
            && !username.Contains("._") && !username.Contains("_.")
            && !ReservedUsernames.Contains(username);

        private static bool IsValidTimezone(string? timezone) =>
            !string.IsNullOrEmpty(timezone)
            && timezone.Length <= MaxTimezoneLength
            && TimeZoneInfo.TryFindSystemTimeZoneById(timezone, out var zone)
            && zone.HasIanaId;

        /// <summary>Số ký tự theo char_length của PostgreSQL (đếm code point, không đếm UTF-16).</summary>
        private static int TextLength(string value) => value.EnumerateRunes().Count();

        private static bool TryPick(string? raw, string[] allowed, out string value)
        {
            value = raw?.Trim() ?? string.Empty;
            return allowed.Contains(value, StringComparer.Ordinal);
        }

        private static (string Extension, string ContentType)? DetectImage(ReadOnlySpan<byte> bytes)
        {
            ReadOnlySpan<byte> png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            if (bytes.StartsWith(png))
            {
                return ("png", "image/png");
            }

            if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            {
                return ("jpg", "image/jpeg");
            }

            if (bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes[8..12].SequenceEqual("WEBP"u8))
            {
                return ("webp", "image/webp");
            }

            return null;
        }

        private static ProfileUpdateResult<MyProfileDto> Invalid(string field, string detail) =>
            ProfileUpdateResult<MyProfileDto>.Fail(ProfileUpdateError.Invalid, field, detail);

        private static ProfileUpdateResult<MyProfileDto> UsernameTaken() =>
            ProfileUpdateResult<MyProfileDto>.Fail(ProfileUpdateError.UsernameTaken, "username", "Username đã có người dùng.");

        // \z thay cho $: $ của .NET khớp cả trước dấu xuống dòng cuối chuỗi, khác PostgreSQL
        [GeneratedRegex(@"^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]\z")]
        private static partial Regex UsernamePattern();
    }
}
