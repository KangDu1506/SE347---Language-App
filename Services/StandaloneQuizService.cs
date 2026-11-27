using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.DTOs.Lesson;
using SE347.DTOs.Quiz;
using SE347.Models;

namespace SE347.Services
{
    public class StandaloneQuizService : IStandaloneQuizService
    {
        private const string ProfileActive = "active";
        private const string ProfilePublic = "public";

        private readonly ApplicationDbContext _db;
        private readonly TimeProvider _time;

        public StandaloneQuizService(ApplicationDbContext db, TimeProvider time)
        {
            _db = db;
            _time = time;
        }

        // ── GET /api/quizzes ────────────────────────────────────────

        public async Task<PagedResultDto<QuizListItemDto>> ListAsync(Guid userId, QuizListQuery query,
            CancellationToken cancellationToken = default)
        {
            var quizzes = _db.Quizzes.AsNoTracking().Where(x => x.QuizScope == Quiz.ScopeStandalone);

            // Danh sách chỉ gồm đề public đã publish của người khác + mọi đề của mình (unlisted chỉ mở bằng link)
            quizzes = query.Scope switch
            {
                QuizListScopes.System => quizzes.Where(x => x.CreatorId == null
                    && x.IsPublished && x.Visibility == Quiz.VisibilityPublic),
                QuizListScopes.Public => quizzes.Where(x => x.CreatorId != null && x.CreatorId != userId
                    && x.IsPublished && x.Visibility == Quiz.VisibilityPublic),
                QuizListScopes.Mine => quizzes.Where(x => x.CreatorId == userId),
                _ => quizzes.Where(x => x.CreatorId == userId
                    || (x.IsPublished && x.Visibility == Quiz.VisibilityPublic)),
            };

            if (!string.IsNullOrWhiteSpace(query.Q))
            {
                var term = query.Q.Trim().ToLowerInvariant();
                quizzes = quizzes.Where(x => x.Title.ToLower().Contains(term)
                    || x.Description.ToLower().Contains(term)
                    || (x.Topic != null && x.Topic.ToLower().Contains(term)));
            }

            if (!string.IsNullOrWhiteSpace(query.Category))
            {
                quizzes = quizzes.Where(x => x.Category == query.Category);
            }

            if (!string.IsNullOrWhiteSpace(query.Level))
            {
                quizzes = quizzes.Where(x => x.CefrLevel == query.Level);
            }

            var attempts = _db.UserQuizAttempts.Where(a => a.UserId == userId && a.QuizId != null);
            var profiles = _db.Profiles;

            var rows = quizzes.Select(x => new ListRow
            {
                Quiz = x,
                QuestionCount = x.Questions.Count(),
                CreatorDisplayName = profiles.Where(p => p.Id == x.CreatorId).Select(p => p.DisplayName).FirstOrDefault(),
                HasInProgress = attempts.Any(a => a.QuizId == x.Id && a.Status == UserQuizAttempt.StatusInProgress),
                BestScore = attempts
                    .Where(a => a.QuizId == x.Id && a.Status == UserQuizAttempt.StatusSubmitted)
                    .Max(a => (short?)a.Score),
            });

            // Mỗi user tối đa 1 lượt in_progress / đề và đó luôn là lượt mới nhất
            rows = query.Status switch
            {
                QuizAttemptStates.InProgress => rows.Where(r => r.HasInProgress),
                QuizAttemptStates.Submitted => rows.Where(r => !r.HasInProgress && r.BestScore != null),
                QuizAttemptStates.None => rows.Where(r => !r.HasInProgress && r.BestScore == null),
                _ => rows,
            };

            var total = await rows.CountAsync(cancellationToken);
            var page = await rows
                .OrderByDescending(r => r.Quiz.CreatedAt)
                .ThenBy(r => r.Quiz.Id)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize)
                .ToListAsync(cancellationToken);

            var items = page.Select(r => new QuizListItemDto(
                    r.Quiz.Id,
                    r.Quiz.Slug,
                    r.Quiz.Title,
                    r.Quiz.Description,
                    r.Quiz.Category,
                    r.Quiz.Topic,
                    r.Quiz.CefrLevel,
                    r.Quiz.Visibility,
                    SourceOf(r.Quiz, userId),
                    r.CreatorDisplayName,
                    r.QuestionCount,
                    r.Quiz.TimeLimitSeconds,
                    r.Quiz.PassScore,
                    r.Quiz.XpReward,
                    r.Quiz.AllowRetake,
                    r.Quiz.IsPublished,
                    r.HasInProgress ? QuizAttemptStates.InProgress
                        : r.BestScore is not null ? QuizAttemptStates.Submitted
                        : QuizAttemptStates.None,
                    r.BestScore,
                    r.Quiz.CreatedAt))
                .ToList();

            return new PagedResultDto<QuizListItemDto>(items, query.Page, query.PageSize, total);
        }

        // ── GET /api/quizzes/{idOrSlug} ─────────────────────────────

        public async Task<QuizDetailDto?> GetDetailAsync(Guid userId, string idOrSlug, CancellationToken cancellationToken = default)
        {
            var quiz = await FindViewableAsync(userId, idOrSlug, cancellationToken);
            if (quiz is null)
            {
                return null;
            }

            var questionCount = await _db.QuizQuestions.CountAsync(q => q.QuizId == quiz.Id, cancellationToken);

            QuizCreatorDto? creator = null;
            if (quiz.CreatorId is Guid creatorId)
            {
                creator = await _db.Profiles
                    .AsNoTracking()
                    .Where(p => p.Id == creatorId)
                    .Select(p => new QuizCreatorDto(p.Id, p.Username, p.DisplayName, p.AvatarPath))
                    .FirstOrDefaultAsync(cancellationToken);
            }

            var myAttempts = await _db.UserQuizAttempts
                .AsNoTracking()
                .Where(a => a.UserId == userId && a.QuizId == quiz.Id
                    && (a.Status == UserQuizAttempt.StatusInProgress || a.Status == UserQuizAttempt.StatusSubmitted))
                .ToListAsync(cancellationToken);

            var inProgress = myAttempts
                .Where(a => a.Status == UserQuizAttempt.StatusInProgress)
                .OrderByDescending(a => a.StartedAt)
                .Select(a => new QuizInProgressAttemptDto(a.Id, a.StartedAt, a.ExpiresAt, RemainingSeconds(a.ExpiresAt)))
                .FirstOrDefault();

            var attemptsMe = myAttempts
                .Where(a => a.Status == UserQuizAttempt.StatusSubmitted)
                .OrderByDescending(a => a.SubmittedAt)
                .ThenByDescending(a => a.Id)
                .Select(a => new QuizAttemptSummaryDto(
                    a.Id, a.Score, a.CorrectCount, a.TotalCount, a.DurationSeconds, a.XpAwarded,
                    a.Score >= quiz.PassScore, a.SubmittedAt))
                .ToList();

            var ranking = await BuildRankingAsync(quiz.Id, userId, IStandaloneQuizService.DetailRankingLimit, cancellationToken);

            return new QuizDetailDto(
                quiz.Id,
                quiz.Slug,
                quiz.Title,
                quiz.Description,
                quiz.Category,
                quiz.Topic,
                quiz.CefrLevel,
                quiz.Visibility,
                SourceOf(quiz, userId),
                creator,
                quiz.CreatorId == userId,
                quiz.IsPublished,
                questionCount,
                quiz.TimeLimitSeconds,
                quiz.PassScore,
                quiz.XpReward,
                quiz.AllowRetake,
                quiz.ShuffleQuestions,
                quiz.ShowResultsImmediately,
                quiz.ShowExplanations,
                quiz.Version,
                quiz.CreatedAt,
                quiz.UpdatedAt,
                inProgress,
                attemptsMe,
                ranking);
        }

        // ── GET /api/quizzes/{idOrSlug}/ranking ─────────────────────

        public async Task<QuizRankingDto?> GetRankingAsync(Guid userId, string idOrSlug, int limit,
            CancellationToken cancellationToken = default)
        {
            var quiz = await FindViewableAsync(userId, idOrSlug, cancellationToken);
            return quiz is null ? null : await BuildRankingAsync(quiz.Id, userId, limit, cancellationToken);
        }

        private async Task<QuizRankingDto> BuildRankingAsync(Guid quizId, Guid userId, int limit, CancellationToken cancellationToken)
        {
            var publicUserIds = _db.Profiles
                .Where(p => p.Status == ProfileActive && p.ProfileVisibility == ProfilePublic)
                .Select(p => p.Id);

            // Lượt tốt nhất của mỗi thí sinh active + public (score desc, duration asc, submitted_at asc)
            var best = await SubmittedAttempts(quizId)
                .Where(a => publicUserIds.Contains(a.UserId))
                .GroupBy(a => a.UserId)
                .Select(g => g
                    .OrderByDescending(a => a.Score)
                    .ThenBy(a => a.DurationSeconds ?? int.MaxValue)
                    .ThenBy(a => a.SubmittedAt)
                    .ThenBy(a => a.Id)
                    .Select(a => new BestAttempt(a.UserId, a.Score, a.DurationSeconds, a.SubmittedAt, a.Id))
                    .First())
                .ToListAsync(cancellationToken);

            var ranked = Rank(best);
            var top = ranked.Take(limit).ToList();

            var topUserIds = top.Select(r => r.UserId).ToList();
            var topProfiles = await _db.Profiles
                .AsNoTracking()
                .Where(p => topUserIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Username, p.DisplayName, p.AvatarPath })
                .ToDictionaryAsync(p => p.Id, cancellationToken);

            var items = top
                .Select((r, index) => new QuizRankingEntryDto(
                    index + 1,
                    r.UserId,
                    topProfiles[r.UserId].Username,
                    topProfiles[r.UserId].DisplayName,
                    topProfiles[r.UserId].AvatarPath,
                    r.Score,
                    r.DurationSeconds,
                    r.SubmittedAt))
                .ToList();

            return new QuizRankingDto(quizId, ranked.Count, items, await CurrentUserRankAsync(quizId, userId, ranked, cancellationToken));
        }

        /// <summary>Hạng của user hiện tại; vẫn trả điểm tốt nhất khi hồ sơ private (Rank = null).</summary>
        private async Task<QuizRankingCurrentUserDto> CurrentUserRankAsync(Guid quizId, Guid userId,
            List<BestAttempt> ranked, CancellationToken cancellationToken)
        {
            var isPublic = await _db.Profiles.AnyAsync(
                p => p.Id == userId && p.Status == ProfileActive && p.ProfileVisibility == ProfilePublic, cancellationToken);

            var index = ranked.FindIndex(r => r.UserId == userId);
            if (index >= 0)
            {
                var mine = ranked[index];
                return new QuizRankingCurrentUserDto(index + 1, mine.Score, mine.DurationSeconds, mine.SubmittedAt, isPublic);
            }

            var myAttempts = await SubmittedAttempts(quizId)
                .Where(a => a.UserId == userId)
                .Select(a => new BestAttempt(a.UserId, a.Score, a.DurationSeconds, a.SubmittedAt, a.Id))
                .ToListAsync(cancellationToken);
            var myBest = Rank(myAttempts).FirstOrDefault();

            return new QuizRankingCurrentUserDto(null, myBest?.Score, myBest?.DurationSeconds, myBest?.SubmittedAt, isPublic);
        }

        private IQueryable<UserQuizAttempt> SubmittedAttempts(Guid quizId) => _db.UserQuizAttempts
            .AsNoTracking()
            .Where(a => a.QuizId == quizId && a.Status == UserQuizAttempt.StatusSubmitted);

        /// <summary>Thứ tự BXH: điểm cao → làm nhanh → nộp sớm (id tăng dần để thứ hạng ổn định).</summary>
        private static List<BestAttempt> Rank(IEnumerable<BestAttempt> attempts) => attempts
            .OrderByDescending(a => a.Score)
            .ThenBy(a => a.DurationSeconds ?? int.MaxValue)
            .ThenBy(a => a.SubmittedAt ?? DateTimeOffset.MaxValue)
            .ThenBy(a => a.AttemptId)
            .ToList();

        // ── Quyền xem đề ────────────────────────────────────────────

        /// <summary>Đề standalone theo id (GUID) hoặc slug mà user được xem; null nếu không có / không có quyền.</summary>
        private async Task<Quiz?> FindViewableAsync(Guid userId, string idOrSlug, CancellationToken cancellationToken)
        {
            var quizzes = _db.Quizzes.AsNoTracking().Where(x => x.QuizScope == Quiz.ScopeStandalone);

            var key = idOrSlug.Trim();
            if (Guid.TryParse(key, out var id))
            {
                quizzes = quizzes.Where(x => x.Id == id);
            }
            else
            {
                var slug = key.ToLowerInvariant();
                if (!LessonIds.IsValid(slug))
                {
                    return null;
                }

                quizzes = quizzes.Where(x => x.Slug == slug);
            }

            return await quizzes
                .Where(x => x.CreatorId == userId
                    || (x.IsPublished && (x.Visibility == Quiz.VisibilityPublic || x.Visibility == Quiz.VisibilityUnlisted)))
                .FirstOrDefaultAsync(cancellationToken);
        }

        private static string SourceOf(Quiz quiz, Guid userId) =>
            quiz.CreatorId is null ? QuizSources.System
            : quiz.CreatorId == userId ? QuizSources.Mine
            : QuizSources.Community;

        private int? RemainingSeconds(DateTimeOffset? expiresAt)
        {
            if (expiresAt is not DateTimeOffset expires)
            {
                return null;
            }

            var remaining = (expires - _time.GetUtcNow()).TotalSeconds;
            return remaining <= 0 ? 0 : (int)Math.Ceiling(remaining);
        }

        private sealed class ListRow
        {
            public Quiz Quiz { get; init; } = null!;
            public int QuestionCount { get; init; }
            public string? CreatorDisplayName { get; init; }
            public bool HasInProgress { get; init; }
            public short? BestScore { get; init; }
        }

        private sealed record BestAttempt(Guid UserId, short Score, int? DurationSeconds, DateTimeOffset? SubmittedAt, long AttemptId);
    }
}
