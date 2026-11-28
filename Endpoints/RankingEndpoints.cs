using System.Globalization;
using System.Security.Claims;
using SE347.Auth;
using SE347.Services;

namespace SE347.Endpoints
{
    /// <summary>
    /// /api/rankings: bảng xếp hạng tổng theo kỳ (S3-05), cần Bearer token của Supabase.
    /// Luật xếp hạng nằm ở <see cref="RankingService"/>.
    /// </summary>
    public static class RankingEndpoints
    {
        public static IEndpointRouteBuilder MapRankingEndpoints(this IEndpointRouteBuilder app)
        {
            // GET /api/rankings?period=week|month|all&limit=50
            // period bỏ trống = week. limit bỏ trống = 50, ngoài 1–100 hoặc không phải số nguyên thì trả 400 (không tự kẹp).
            app.MapGet("/api/rankings", async (string? period, string? limit, ClaimsPrincipal user, IRankingService rankings, CancellationToken ct) =>
            {
                if (user.GetUserId() is not Guid userId)
                {
                    return Results.Unauthorized();
                }

                var selectedPeriod = RankingPeriod.Week;
                if (period is not null && !RankingService.TryParsePeriod(period, out selectedPeriod))
                {
                    return Results.BadRequest(new { error = "period phải là week, month hoặc all.", code = "invalid_period" });
                }

                var take = IRankingService.DefaultLimit;
                if (limit is not null
                    && (!int.TryParse(limit, NumberStyles.None, CultureInfo.InvariantCulture, out take)
                        || take < 1 || take > IRankingService.MaxLimit))
                {
                    return Results.BadRequest(new { error = $"limit phải là số nguyên từ 1 đến {IRankingService.MaxLimit}.", code = "invalid_limit" });
                }

                var result = await rankings.GetRankingAsync(userId, selectedPeriod, take, ct);
                return result is null
                    ? Results.NotFound(new { error = "Không tìm thấy hồ sơ người dùng." })
                    : Results.Ok(result);
            }).RequireAuthorization();

            return app;
        }
    }
}
