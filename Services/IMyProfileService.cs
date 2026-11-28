using SE347.DTOs.Users;

namespace SE347.Services
{
    public enum ProfileUpdateError
    {
        None,
        ProfileNotFound,
        ProfileNotActive,
        Invalid,
        UsernameTaken,
        ConcurrentUpdate,
        StorageFailed,
    }

    /// <summary>Kết quả thao tác tự sửa hồ sơ. <see cref="Field"/> là tên trường (camelCase) bị lỗi khi Invalid.</summary>
    public sealed record ProfileUpdateResult<T>(T? Value, ProfileUpdateError Error, string? Field = null, string? Detail = null)
    {
        public static ProfileUpdateResult<T> Ok(T value) => new(value, ProfileUpdateError.None);

        public static ProfileUpdateResult<T> Fail(ProfileUpdateError error, string? field = null, string? detail = null) =>
            new(default, error, field, detail);
    }

    /// <summary>
    /// User tự sửa hồ sơ, cài đặt, avatar và tự vô hiệu hóa tài khoản (SCRUM-92).
    /// userId luôn lấy từ token. Chỉ hồ sơ status = active được sửa.
    /// </summary>
    public interface IMyProfileService
    {
        public const long MaxAvatarBytes = 2_097_152;

        Task<ProfileUpdateResult<MyProfileDto>> UpdateAsync(Guid userId, UpdateMyProfileRequest request, CancellationToken cancellationToken = default);

        /// <summary>Kiểm tra kích thước và magic bytes (png/jpeg/webp), lưu vào avatars/{userId}/..., xóa file cũ kiểu best-effort.</summary>
        Task<ProfileUpdateResult<MyProfileDto>> UploadAvatarAsync(Guid userId, Stream content, long length, CancellationToken cancellationToken = default);

        Task<ProfileUpdateResult<MyProfileDto>> RemoveAvatarAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>status = deactivated, profile_visibility = private. Gọi lại khi đã deactivated vẫn thành công.</summary>
        Task<ProfileUpdateResult<bool>> DeactivateAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}
