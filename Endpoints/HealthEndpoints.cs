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

            // GET /api/health: kiểm tra thêm kết nối tới database Supabase
            app.MapGet("/api/health", async (ApplicationDbContext db, CancellationToken ct) =>
            {
                bool isDbConnected = await db.Database.CanConnectAsync(ct);
                
                if (isDbConnected)
                {
                    return Results.Ok(new 
                    { 
                        status = "Healthy", 
                        database = "Connected",
                        timestamp = DateTimeOffset.UtcNow 
                    });
                }
                else
                {
                    return Results.StatusCode(503);
                }
            });

            return app;
        }
    }
}
