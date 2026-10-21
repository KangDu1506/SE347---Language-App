namespace SE347.DTOs.Users
{
    /// <summary>
    /// Body của POST /api/auth/login-username.
    /// </summary>
    public record UsernameLoginRequestDto(string? Username, string? Password);

    /// <summary>
    /// Phiên Supabase trả cho frontend để gọi sb.auth.setSession(). Không trả email hay thông tin user.
    /// </summary>
    public record SessionTokensDto(string AccessToken, string RefreshToken);
}
