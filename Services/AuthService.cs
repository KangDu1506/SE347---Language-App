using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.DTOs.Users;

namespace SE347.Services
{
    public class AuthService : IAuthService
    {
        private const string InvalidCredentials = "invalid_credentials";

        private readonly ApplicationDbContext _db;
        private readonly HttpClient _http;
        private readonly string _publishableKey;

        public AuthService(ApplicationDbContext db, HttpClient http, IConfiguration configuration)
        {
            _db = db;
            _http = http;
            _http.BaseAddress = new Uri($"{configuration["Supabase:Url"]?.TrimEnd('/')}/auth/v1/");
            _publishableKey = configuration["Supabase:PublishableKey"] ?? string.Empty;
        }

        /// <summary>
        /// Tra email theo username ngay trên server rồi gọi Supabase Auth (grant_type=password),
        /// để email không bao giờ lộ ra trình duyệt. Username không tồn tại trả cùng lỗi với sai mật khẩu
        /// để không dò được username nào đã đăng ký.
        /// </summary>
        public async Task<LoginResult> SignInWithUsernameAsync(string username, string password, CancellationToken cancellationToken = default)
        {
            var normalized = username.Trim().ToLowerInvariant();

            var email = await _db.Database
                .SqlQuery<string>($"""
                    select u.email as "Value"
                    from auth.users u
                    join public.profiles p on p.id = u.id
                    where p.username = {normalized} and p.status <> 'deleted'
                    """)
                .SingleOrDefaultAsync(cancellationToken);

            if (string.IsNullOrEmpty(email))
            {
                return new LoginResult(null, InvalidCredentials, StatusCodes.Status400BadRequest);
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, "token?grant_type=password")
            {
                Content = JsonContent.Create(new { email, password }),
            };
            request.Headers.Add("apikey", _publishableKey);

            using var response = await _http.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var tokens = await response.Content.ReadFromJsonAsync<SupabaseTokenResponse>(cancellationToken);
                return tokens is null
                    ? new LoginResult(null, "unexpected_failure", StatusCodes.Status502BadGateway)
                    : new LoginResult(new SessionTokensDto(tokens.AccessToken, tokens.RefreshToken), null, StatusCodes.Status200OK);
            }

            string? errorCode = null;
            try
            {
                var error = await response.Content.ReadFromJsonAsync<SupabaseErrorResponse>(cancellationToken);
                errorCode = error?.ErrorCode;
            }
            catch (JsonException)
            {
                // Supabase trả body không phải JSON (lỗi gateway): dùng mã mặc định bên dưới.
            }

            return new LoginResult(null, errorCode ?? InvalidCredentials, (int)response.StatusCode);
        }

        private record SupabaseTokenResponse(
            [property: JsonPropertyName("access_token")] string AccessToken,
            [property: JsonPropertyName("refresh_token")] string RefreshToken);

        private record SupabaseErrorResponse(
            [property: JsonPropertyName("error_code")] string? ErrorCode);
    }
}
