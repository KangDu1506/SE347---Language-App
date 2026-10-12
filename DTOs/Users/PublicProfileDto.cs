namespace SE347.DTOs.Users
{
    /// <summary>
    /// Hồ sơ công khai trả cho frontend. Không chứa role, status hay dữ liệu riêng tư.
    /// </summary>
    public record PublicProfileDto(
        string Username,
        string DisplayName,
        string? AvatarPath,
        string? Bio);
}
