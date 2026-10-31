using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.DTOs.Progress;
using SE347.Models;

namespace SE347.Services
{
    /// <summary>
    /// Backend kết nối bằng role postgres nên RLS không chặn: mọi query đều lọc theo userId lấy từ JWT,
    /// chỉ user có profiles.status = 'active' mới được ghi.
    /// Các thao tác ghi chạy trong 1 transaction và dùng upsert (on conflict) để 2 request song song
    /// không tạo trùng dòng hay cộng XP hai lần.
    /// </summary>
    public class ProgressService : IProgressService
    {
        private const string DefaultTimezone = "Asia/Ho_Chi_Minh";

        private readonly ApplicationDbContext _db;
        private readonly ILessonLookup _lessons;
        private readonly TimeProvider _clock;

        public ProgressService(ApplicationDbContext db, ILessonLookup lessons, TimeProvider clock)
        {
            _db = db;
            _lessons = lessons;
            _clock = clock;
        }

        // ── Đọc ──────────────────────────────────────────────────────

        public async Task<ProgressOverviewDto?> GetOverviewAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var profile = await _db.Profiles
                .AsNoTracking()
                .Where(p => p.Id == userId && p.Status != "deleted")
                .Select(p => new { p.Timezone })
                .SingleOrDefaultAsync(cancellationToken);

            if (profile is null)
            {
                return null;
            }

            var today = Today(profile.Timezone);

            var stat = await _db.UserStats
                .AsNoTracking()
                .SingleOrDefaultAsync(s => s.UserId == userId, cancellationToken);

            var todayXp = await _db.UserDailyActivities
                .AsNoTracking()
                .Where(a => a.UserId == userId && a.ActivityDate == today)
                .Select(a => (int?)a.XpEarned)
                .SingleOrDefaultAsync(cancellationToken) ?? 0;

            var lessons = await _db.UserLessonProgresses
                .AsNoTracking()
                .Include(l => l.CompletedContents)
                .Where(l => l.UserId == userId)
                .OrderByDescending(l => l.LastStudiedAt)
                .ToListAsync(cancellationToken);

            // Quá 1 ngày không học thì streak hiển thị 0, dù user_stats chưa được ghi lại.
            var currentStreak = stat?.LastActivityDate is { } last && last >= today.AddDays(-1)
                ? stat.CurrentStreak
                : 0;

            var stats = new ProgressStatsDto(
                stat?.TotalXp ?? 0,
                currentStreak,
                stat?.LongestStreak ?? 0,
                stat?.LastActivityDate,
                todayXp,
                lessons.Count(l => l.Status == UserLessonProgress.StatusCompleted),
                lessons.Count(l => l.Status == UserLessonProgress.StatusInProgress));

            return new ProgressOverviewDto(stats, lessons.Select(ToDto).ToList());
        }

        public async Task<ProgressResult<LessonProgressDto>> GetLessonProgressAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default)
        {
            if (!_lessons.LessonExists(lessonId))
            {
                return ProgressResult<LessonProgressDto>.Fail(ProgressError.LessonNotFound);
            }

            var progress = await LoadLessonAsync(userId, lessonId, cancellationToken);
            return ProgressResult<LessonProgressDto>.Ok(progress ?? LessonProgressDto.NotStarted(lessonId));
        }

        // ── Ghi ──────────────────────────────────────────────────────

        public Task<ProgressResult<LessonProgressDto>> MarkLessonOpenedAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default) =>
            WriteAsync(userId, lessonId, async (_, ct) =>
            {
                await TouchLessonAsync(userId, lessonId, ct);
                return ProgressResult<LessonProgressDto>.Ok((await LoadLessonAsync(userId, lessonId, ct))!);
            }, cancellationToken);

        public Task<ProgressResult<LessonProgressDto>> MarkContentCompletedAsync(Guid userId, string lessonId, string contentId, int xp, bool countsAsWord, CancellationToken cancellationToken = default)
        {
            if (xp < 0)
            {
                return Task.FromResult(ProgressResult<LessonProgressDto>.Fail(ProgressError.InvalidInput));
            }

            if (_lessons.LessonExists(lessonId) && !_lessons.ContentExists(lessonId, contentId))
            {
                return Task.FromResult(ProgressResult<LessonProgressDto>.Fail(ProgressError.ContentNotFound));
            }

            return WriteAsync(userId, lessonId, async (today, ct) =>
            {
                await TouchLessonAsync(userId, lessonId, ct);

                var inserted = await _db.Database.ExecuteSqlInterpolatedAsync($"""
                    insert into public.user_content_progress (user_id, lesson_id, content_id)
                    values ({userId}, {lessonId}, {contentId})
                    on conflict (user_id, lesson_id, content_id) do nothing
                    """, ct);

                // Mục đã học rồi: không cộng XP / streak lần nữa.
                if (inserted == 1)
                {
                    await AddLessonXpAsync(userId, lessonId, xp, ct);
                    await RecordActivityAsync(userId, today, xp, lessonsCompleted: 0, wordsLearned: countsAsWord ? 1 : 0, ct);
                }

                return ProgressResult<LessonProgressDto>.Ok((await LoadLessonAsync(userId, lessonId, ct))!);
            }, cancellationToken);
        }

        public Task<ProgressResult<QuizAttemptResultDto>> RecordQuizAttemptAsync(Guid userId, string lessonId, int correctCount, int totalCount, int xp, CancellationToken cancellationToken = default)
        {
            if (totalCount is <= 0 or > short.MaxValue || correctCount < 0 || correctCount > totalCount || xp < 0)
            {
                return Task.FromResult(ProgressResult<QuizAttemptResultDto>.Fail(ProgressError.InvalidInput));
            }

            var score = IProgressService.QuizScore(correctCount, totalCount);

            return WriteAsync(userId, lessonId, async (today, ct) =>
            {
                await TouchLessonAsync(userId, lessonId, ct);
                var wasCompleted = await LockLessonStatusAsync(userId, lessonId, ct) == UserLessonProgress.StatusCompleted;
                var completesNow = !wasCompleted && score >= IProgressService.QuizPassScore;

                var attemptId = await _db.Database
                    .SqlQuery<long>($"""
                        insert into public.user_quiz_attempts (user_id, lesson_id, correct_count, total_count, score, xp_awarded)
                        values ({userId}, {lessonId}, {(short)correctCount}, {(short)totalCount}, {score}, {xp})
                        returning id as "Value"
                        """)
                    .ToListAsync(ct);

                await _db.Database.ExecuteSqlInterpolatedAsync($"""
                    update public.user_lesson_progress
                    set quiz_attempts   = quiz_attempts + 1,
                        last_quiz_score = {score},
                        best_quiz_score = greatest(best_quiz_score, {score}),
                        xp_earned       = xp_earned + {xp},
                        status          = case when {completesNow} then 'completed' else status end,
                        completed_at    = case when {completesNow} then now() else completed_at end
                    where user_id = {userId} and lesson_id = {lessonId}
                    """, ct);

                await RecordActivityAsync(userId, today, xp, lessonsCompleted: completesNow ? 1 : 0, wordsLearned: 0, ct);

                var progress = (await LoadLessonAsync(userId, lessonId, ct))!;
                return ProgressResult<QuizAttemptResultDto>.Ok(new QuizAttemptResultDto(
                    attemptId.Single(), (short)correctCount, (short)totalCount, score, xp, completesNow, progress));
            }, cancellationToken);
        }

        public Task<ProgressResult<LessonProgressDto>> MarkLessonCompletedAsync(Guid userId, string lessonId, int xp, CancellationToken cancellationToken = default)
        {
            if (xp < 0)
            {
                return Task.FromResult(ProgressResult<LessonProgressDto>.Fail(ProgressError.InvalidInput));
            }

            return WriteAsync(userId, lessonId, async (today, ct) =>
            {
                await TouchLessonAsync(userId, lessonId, ct);

                if (await LockLessonStatusAsync(userId, lessonId, ct) != UserLessonProgress.StatusCompleted)
                {
                    await _db.Database.ExecuteSqlInterpolatedAsync($"""
                        update public.user_lesson_progress
                        set status = 'completed', completed_at = now(), xp_earned = xp_earned + {xp}
                        where user_id = {userId} and lesson_id = {lessonId}
                        """, ct);

                    await RecordActivityAsync(userId, today, xp, lessonsCompleted: 1, wordsLearned: 0, ct);
                }

                return ProgressResult<LessonProgressDto>.Ok((await LoadLessonAsync(userId, lessonId, ct))!);
            }, cancellationToken);
        }

        // ── Helpers ──────────────────────────────────────────────────

        /// <summary>
        /// Kiểm tra bài học + hồ sơ active, rồi chạy thao tác ghi trong 1 transaction.
        /// write nhận ngày hôm nay theo timezone của user.
        /// </summary>
        private async Task<ProgressResult<T>> WriteAsync<T>(
            Guid userId,
            string lessonId,
            Func<DateOnly, CancellationToken, Task<ProgressResult<T>>> write,
            CancellationToken cancellationToken)
        {
            if (!_lessons.LessonExists(lessonId))
            {
                return ProgressResult<T>.Fail(ProgressError.LessonNotFound);
            }

            var timezone = await _db.Profiles
                .AsNoTracking()
                .Where(p => p.Id == userId && p.Status == "active")
                .Select(p => p.Timezone)
                .SingleOrDefaultAsync(cancellationToken);

            if (timezone is null)
            {
                return ProgressResult<T>.Fail(ProgressError.ProfileNotActive);
            }

            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            var result = await write(Today(timezone), cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }

        private Task<int> TouchLessonAsync(Guid userId, string lessonId, CancellationToken ct) =>
            _db.Database.ExecuteSqlInterpolatedAsync($"""
                insert into public.user_lesson_progress (user_id, lesson_id)
                values ({userId}, {lessonId})
                on conflict (user_id, lesson_id) do update set last_studied_at = now()
                """, ct);

        /// <summary>Khóa dòng tiến độ tới hết transaction để 2 request không cùng đánh dấu completed.</summary>
        private async Task<string> LockLessonStatusAsync(Guid userId, string lessonId, CancellationToken ct) =>
            (await _db.Database
                .SqlQuery<string>($"""
                    select status as "Value" from public.user_lesson_progress
                    where user_id = {userId} and lesson_id = {lessonId}
                    for update
                    """)
                .ToListAsync(ct))
            .Single();

        private Task<int> AddLessonXpAsync(Guid userId, string lessonId, int xp, CancellationToken ct) =>
            _db.Database.ExecuteSqlInterpolatedAsync($"""
                update public.user_lesson_progress set xp_earned = xp_earned + {xp}
                where user_id = {userId} and lesson_id = {lessonId}
                """, ct);

        /// <summary>
        /// Cộng XP / số bài / số từ vào ngày hôm nay và cập nhật streak:
        /// học lại trong ngày giữ nguyên, học tiếp ngày hôm sau +1, bỏ ngày thì về 1.
        /// </summary>
        private async Task RecordActivityAsync(Guid userId, DateOnly today, int xp, int lessonsCompleted, int wordsLearned, CancellationToken ct)
        {
            await _db.Database.ExecuteSqlInterpolatedAsync($"""
                insert into public.user_daily_activity (user_id, activity_date, xp_earned, lessons_completed, words_learned)
                values ({userId}, {today}, {xp}, {lessonsCompleted}, {wordsLearned})
                on conflict (user_id, activity_date) do update set
                    xp_earned         = user_daily_activity.xp_earned + excluded.xp_earned,
                    lessons_completed = user_daily_activity.lessons_completed + excluded.lessons_completed,
                    words_learned     = user_daily_activity.words_learned + excluded.words_learned
                """, ct);

            await _db.Database.ExecuteSqlInterpolatedAsync($"""
                insert into public.user_stats (user_id, total_xp, current_streak, longest_streak, last_activity_date)
                values ({userId}, {(long)xp}, 1, 1, {today})
                on conflict (user_id) do update set
                    total_xp           = user_stats.total_xp + excluded.total_xp,
                    current_streak     = case
                                           when user_stats.last_activity_date >= excluded.last_activity_date then user_stats.current_streak
                                           when user_stats.last_activity_date = excluded.last_activity_date - 1 then user_stats.current_streak + 1
                                           else 1
                                         end,
                    longest_streak     = greatest(user_stats.longest_streak, case
                                           when user_stats.last_activity_date >= excluded.last_activity_date then user_stats.current_streak
                                           when user_stats.last_activity_date = excluded.last_activity_date - 1 then user_stats.current_streak + 1
                                           else 1
                                         end),
                    last_activity_date = greatest(user_stats.last_activity_date, excluded.last_activity_date),
                    updated_at         = now()
                """, ct);
        }

        private async Task<LessonProgressDto?> LoadLessonAsync(Guid userId, string lessonId, CancellationToken ct)
        {
            var progress = await _db.UserLessonProgresses
                .AsNoTracking()
                .Include(l => l.CompletedContents)
                .SingleOrDefaultAsync(l => l.UserId == userId && l.LessonId == lessonId, ct);

            return progress is null ? null : ToDto(progress);
        }

        private static LessonProgressDto ToDto(UserLessonProgress progress) => new(
            progress.LessonId,
            progress.Status,
            progress.FirstOpenedAt,
            progress.LastStudiedAt,
            progress.CompletedAt,
            progress.CompletedContents
                .OrderBy(c => int.TryParse(c.ContentId, out var n) ? n : int.MaxValue)
                .Select(c => c.ContentId)
                .ToList(),
            progress.QuizAttempts,
            progress.BestQuizScore,
            progress.LastQuizScore,
            progress.XpEarned);

        /// <summary>Ngày hiện tại theo timezone của user; timezone lạ thì dùng giờ Việt Nam.</summary>
        private DateOnly Today(string timezone)
        {
            if (!TimeZoneInfo.TryFindSystemTimeZoneById(timezone, out var zone)
                && !TimeZoneInfo.TryFindSystemTimeZoneById(DefaultTimezone, out zone))
            {
                zone = TimeZoneInfo.CreateCustomTimeZone(DefaultTimezone, TimeSpan.FromHours(7), DefaultTimezone, DefaultTimezone);
            }

            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(_clock.GetUtcNow(), zone).DateTime);
        }
    }
}
