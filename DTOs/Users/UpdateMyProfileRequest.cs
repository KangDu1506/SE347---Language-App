using System.Text.Json.Serialization;

namespace SE347.DTOs.Users
{
    /// <summary>
    /// Body của PATCH /api/users/me. Trường nào không gửi thì giữ nguyên.
    /// Gửi null chỉ hợp lệ với bio, learningReason (xóa giá trị) và reminderTime (khi tắt nhắc nhở).
    /// Trường lạ (status, role, avatarPath, ...) bị từ chối với 400 thay vì bị bỏ qua.
    /// </summary>
    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public sealed record UpdateMyProfileRequest
    {
        public Optional<string?> DisplayName { get; init; }

        public Optional<string?> Username { get; init; }

        public Optional<string?> Bio { get; init; }

        public Optional<string?> UiLocale { get; init; }

        public Optional<string?> Timezone { get; init; }

        public Optional<string?> ProfileVisibility { get; init; }

        public Optional<string?> LearningReason { get; init; }

        public Optional<string?> Theme { get; init; }

        public Optional<int?> DailyGoalXp { get; init; }

        public Optional<bool?> SoundEnabled { get; init; }

        public Optional<bool?> ReminderEnabled { get; init; }

        /// <summary>Giờ địa phương theo timezone của hồ sơ, dạng "HH:mm" hoặc "HH:mm:ss".</summary>
        public Optional<string?> ReminderTime { get; init; }
    }
}
