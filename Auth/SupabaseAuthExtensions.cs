using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace SE347.Auth
{
    /// <summary>
    /// Xác thực access token (JWT) do Supabase Auth phát hành.
    /// Frontend gửi header "Authorization: Bearer &lt;access_token&gt;" lấy từ supabase-js.
    /// </summary>
    public static class SupabaseAuthExtensions
    {
        /// <summary>Supabase đặt aud = "authenticated" cho user đã đăng nhập.</summary>
        public const string Audience = "authenticated";

        public static IServiceCollection AddSupabaseJwtAuth(this IServiceCollection services, IConfiguration configuration)
        {
            var supabaseUrl = configuration["Supabase:Url"]?.TrimEnd('/');
            var issuer = $"{supabaseUrl}/auth/v1";

            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    // Giữ nguyên tên claim gốc ("sub", "email", "role"...), không đổi sang URI của .NET.
                    options.MapInboundClaims = false;

                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = issuer,
                        ValidateAudience = true,
                        ValidAudience = Audience,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                    };

                    // Chưa cấu hình Supabase:Url thì không có khóa nào, mọi token đều bị từ chối (401).
                    if (!string.IsNullOrWhiteSpace(supabaseUrl))
                    {
                        // Khóa công khai (ES256/RS256) lấy từ JWKS, tự làm mới khi Supabase xoay khóa.
                        options.ConfigurationManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                            $"{issuer}/.well-known/jwks.json",
                            new JwksRetriever(issuer),
                            new HttpDocumentRetriever
                            {
                                RequireHttps = supabaseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase),
                            });
                    }
                });

            services.AddAuthorization();

            return services;
        }

        /// <summary>
        /// Id của user đăng nhập (claim "sub" = auth.users.id = profiles.id), null nếu không hợp lệ.
        /// </summary>
        public static Guid? GetUserId(this ClaimsPrincipal user)
        {
            return Guid.TryParse(user.FindFirstValue("sub"), out var id) ? id : null;
        }

        /// <summary>
        /// Supabase chỉ công bố JWKS, không có tài liệu OpenID discovery,
        /// nên đọc trực tiếp file jwks.json thành cấu hình chứa khóa ký.
        /// </summary>
        private sealed class JwksRetriever : IConfigurationRetriever<OpenIdConnectConfiguration>
        {
            private readonly string _issuer;

            public JwksRetriever(string issuer)
            {
                _issuer = issuer;
            }

            public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(
                string address, IDocumentRetriever retriever, CancellationToken cancel)
            {
                var json = await retriever.GetDocumentAsync(address, cancel);

                var config = new OpenIdConnectConfiguration { Issuer = _issuer, JwksUri = address };
                foreach (var key in new JsonWebKeySet(json).GetSigningKeys())
                {
                    config.SigningKeys.Add(key);
                }

                return config;
            }
        }
    }
}
