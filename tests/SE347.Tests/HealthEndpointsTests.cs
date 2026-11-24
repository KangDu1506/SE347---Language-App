using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SE347.Tests
{
    /// <summary>
    /// /api/health: 200 khi DB kết nối được, 503 kèm "reason" khi thiếu cấu hình hoặc không kết nối được
    /// (S3-27: trên Azure /api/health trả 503 rỗng nên không biết nguyên nhân).
    /// </summary>
    public class HealthEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private readonly LessonApiFactory _factory;

        public HealthEndpointsTests(LessonApiFactory factory)
        {
            _factory = factory;
        }

        [Fact]
        public async Task ApiHealth_DatabaseReachable_Returns200()
        {
            var response = await _factory.CreateClient().GetAsync("/api/health");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<HealthBody>();
            Assert.Equal("Connected", body!.Database);
        }

        [Theory]
        [InlineData("", "missing_connection_string")]
        // Cổng 1 trên localhost: bị từ chối ngay, không phải chờ timeout
        [InlineData("Host=127.0.0.1;Port=1;Database=x;Username=x;Password=x;Timeout=3", "connection_failed")]
        public async Task ApiHealth_DatabaseUnavailable_Returns503WithReason(string connectionString, string reason)
        {
            using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.UseSetting("ConnectionStrings:Supabase", connectionString);
            });

            var response = await factory.CreateClient().GetAsync("/api/health");

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<HealthBody>();
            Assert.Equal("Unreachable", body!.Database);
            Assert.Equal(reason, body.Reason);
        }

        private sealed record HealthBody(string Status, string Database, string? Reason);
    }
}
