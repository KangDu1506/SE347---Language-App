using SE347.DTOs.Users;

namespace SE347.Services
{
    /// <summary>
    /// Kết quả đăng nhập: có Session khi thành công, ngược lại có ErrorCode (mã lỗi của Supabase Auth) và StatusCode.
    /// </summary>
    public record LoginResult(SessionTokensDto? Session, string? ErrorCode, int StatusCode);

    public interface IAuthService
    {
        Task<LoginResult> SignInWithUsernameAsync(string username, string password, CancellationToken cancellationToken = default);
    }
}
