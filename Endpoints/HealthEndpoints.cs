using Microsoft.EntityFrameworkCore;
using SE347.Data;

namespace SE347.Endpoints
{
    public static class HealthEndpoints
    {
        public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
        {
            // GET /health: chỉ báo server còn sống, không gọi DB (dùng cho health check của Render/Docker)
            app.MapGet("/health", () => Results.Ok(new
            {
                status = "Healthy",
                timestamp = DateTimeOffset.UtcNow
            }));

            // GET /api/health: kiểm tra thêm kết nối tới database Supabase.
            // 503 kèm "reason" để biết lỗi do thiếu cấu hình hay do không kết nối được (không trả chuỗi kết nối / mật khẩu).
            app.MapGet("/api/health", async (ApplicationDbContext db, IConfiguration config, ILoggerFactory loggers, CancellationToken ct) =>
            {
                var logger = loggers.CreateLogger("SE347.Health");

                if (db.Database.IsRelational() && string.IsNullOrWhiteSpace(config.GetConnectionString("Supabase")))
                {
                    logger.LogError("ConnectionStrings:Supabase chưa được cấu hình (trên Azure: App Service > Environment variables > ConnectionStrings__Supabase).");
                    return Unhealthy("missing_connection_string");
                }

                try
                {
                    if (await db.Database.CanConnectAsync(ct))
                    {
                        return Results.Ok(new
                        {
                            status = "Healthy",
                            database = "Connected",
                            timestamp = DateTimeOffset.UtcNow
                        });
                    }

                    logger.LogError("Không kết nối được database Supabase (CanConnect = false).");
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Không kết nối được database Supabase.");
                }

                return Unhealthy("connection_failed");
            });

            return app;
        }

        private static IResult Unhealthy(string reason) => Results.Json(new
        {
            status = "Unhealthy",
            database = "Unreachable",
            reason,
            timestamp = DateTimeOffset.UtcNow
        }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}
