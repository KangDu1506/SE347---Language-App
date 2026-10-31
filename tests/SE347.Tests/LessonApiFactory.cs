using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SE347.Data;
using SE347.Models;

namespace SE347.Tests
{
    /// <summary>
    /// Chạy app thật (Program.cs, LessonService đọc Storage/LessonTemplate) nhưng:
    /// - DB Supabase thay bằng EF InMemory (mỗi factory một database riêng),
    /// - JWT Supabase thay bằng <see cref="TestAuthHandler"/> (user id lấy từ header).
    /// </summary>
    public class LessonApiFactory : WebApplicationFactory<Program>
    {
        private readonly string _databaseName = $"lesson-tests-{Guid.NewGuid()}";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            // Không đọc appsettings.Development.json (chứa key thật ở máy dev)
            builder.UseEnvironment("Testing");

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
                services.RemoveAll<IDbContextOptionsConfiguration<ApplicationDbContext>>();
                services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(_databaseName));

                services.AddAuthentication(TestAuthHandler.SchemeName)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            });
        }

        /// <summary>Client gửi kèm user id; null = chưa đăng nhập.</summary>
        public HttpClient CreateClientFor(Guid? userId)
        {
            var client = CreateClient();
            if (userId is Guid id)
            {
                client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeader, id.ToString());
            }

            return client;
        }

        /// <summary>Tạo hồ sơ với status cho trước, trả về user id.</summary>
        public async Task<Guid> CreateUserAsync(string status = "active")
        {
            var userId = Guid.NewGuid();
            await WithDbAsync(db =>
            {
                db.Profiles.Add(new Profile
                {
                    Id = userId,
                    Username = $"u{userId:N}"[..20],
                    DisplayName = "Test user",
                    Status = status,
                });
            });
            return userId;
        }

        public Task SetLessonStatusAsync(Guid userId, string lessonId, string status) => WithDbAsync(db =>
        {
            db.UserLessonProgresses.Add(new UserLessonProgress
            {
                UserId = userId,
                LessonId = lessonId,
                Status = status,
                CompletedAt = status == UserLessonProgress.StatusCompleted ? DateTimeOffset.UtcNow : null,
            });
        });

        private async Task WithDbAsync(Action<ApplicationDbContext> change)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            change(db);
            await db.SaveChangesAsync();
        }
    }

    /// <summary>Đăng nhập khi request có header <see cref="UserIdHeader"/> (claim "sub" như token Supabase).</summary>
    public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = "Test";
        public const string UserIdHeader = "X-Test-User-Id";

        public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(UserIdHeader, out var userId))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var identity = new ClaimsIdentity([new Claim("sub", userId.ToString())], SchemeName);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
        }
    }
}
