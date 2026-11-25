using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.DTOs.Lesson;
using SE347.Models;

namespace SE347.Services
{
    public class LearningPathService : ILearningPathService
    {
        private readonly ApplicationDbContext _db;
        private readonly ILessonService _lessons;

        public LearningPathService(ApplicationDbContext db, ILessonService lessons)
        {
            _db = db;
            _lessons = lessons;
        }

        public async Task<IReadOnlyList<LearningPathSummaryDto>> GetPathsAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var progress = await LoadProgressAsync(userId, cancellationToken);

            return _lessons.GetLearningPaths()
                .Select(path => BuildBoard(path, progress, SummariesById()))
                .Select(board => new LearningPathSummaryDto(board.Id, board.Title, board.Description, board.Version,
                    board.LessonCount, board.CompletedCount, board.CurrentLessonId))
                .ToList();
        }

        public async Task<LearningPathBoardDto?> GetBoardAsync(Guid userId, string pathId, CancellationToken cancellationToken = default)
        {
            var path = _lessons.GetLearningPaths().FirstOrDefault(p => string.Equals(p.Id, pathId, StringComparison.Ordinal));
            if (path is null)
            {
                return null;
            }

            return BuildBoard(path, await LoadProgressAsync(userId, cancellationToken), SummariesById());
        }

        public async Task<IReadOnlyList<LessonRecommendationDto>> GetRecommendationsAsync(Guid userId, int limit, string scope,
            CancellationToken cancellationToken = default)
        {
            var progress = await LoadProgressAsync(userId, cancellationToken);
            var summaries = SummariesById();
            var outsideOnly = scope == "outside_path";
            var result = new List<LessonRecommendationDto>();
            var added = new HashSet<string>(StringComparer.Ordinal);

            void Add(string lessonId, string reason)
            {
                if (result.Count >= limit || !added.Add(lessonId))
                {
                    return;
                }

                if (summaries.TryGetValue(lessonId, out var summary))
                {
                    result.Add(new LessonRecommendationDto(summary, reason, progress.StatusOf(lessonId), MaxXp(summary),
                        _lessons.GetLearningPathId(lessonId)));
                }
            }

            // 1. Bài đang học dở, học gần nhất trước (đã mở nên luôn mở khóa)
            foreach (var row in progress.Rows
                .Where(r => r.Status == UserLessonProgress.StatusInProgress && _lessons.LessonExists(r.LessonId))
                .Where(r => !outsideOnly || _lessons.GetLearningPathId(r.LessonId) is null)
                .OrderByDescending(r => r.LastStudiedAt))
            {
                Add(row.LessonId, RecommendationReasons.Continue);
            }

            // 2. Bài kế tiếp đã mở khóa trong lộ trình, mạch chính trước rồi tới nhánh cùng cột
            if (!outsideOnly)
            {
                foreach (var node in _lessons.GetLearningPaths()
                    .SelectMany(path => BuildBoard(path, progress, summaries).Nodes)
                    .Where(n => n.State == BoardNodeStates.Current && n.ProgressStatus == LessonProgressStatuses.NotStarted))
                {
                    Add(node.LessonId, RecommendationReasons.NextInPath);
                }
            }

            // 3. Bài lẻ ngoài lộ trình chưa học, theo thứ tự trình độ -> order của danh sách bài
            foreach (var lesson in _lessons.GetAll()
                .Where(l => _lessons.GetLearningPathId(l.LessonId) is null && !progress.HasRow(l.LessonId))
                .Where(l => LessonUnlockRule.IsUnlocked(_lessons.GetPrerequisites(l.LessonId), progress.Completed, alreadyOpened: false)))
            {
                Add(lesson.LessonId, RecommendationReasons.OutsidePath);
            }

            return result;
        }

        private Dictionary<string, LessonSummaryDto> SummariesById() =>
            _lessons.GetAll().ToDictionary(l => l.LessonId, StringComparer.Ordinal);

        private static LearningPathBoardDto BuildBoard(LearningPathLayout path, UserProgress progress,
            IReadOnlyDictionary<string, LessonSummaryDto> summaries)
        {
            var nodes = new List<LearningPathBoardNodeDto>();
            foreach (var node in path.Nodes.OrderBy(n => n.Column).ThenBy(n => n.IsBranch))
            {
                if (!summaries.TryGetValue(node.LessonId, out var summary))
                {
                    continue;
                }

                var status = progress.StatusOf(node.LessonId);
                var state = status == LessonProgressStatuses.Completed
                    ? BoardNodeStates.Done
                    : LessonUnlockRule.IsUnlocked(node.Prerequisites, progress.Completed, progress.HasRow(node.LessonId))
                        ? BoardNodeStates.Current
                        : BoardNodeStates.Locked;

                nodes.Add(new LearningPathBoardNodeDto(
                    node.ItemId, node.LessonId, summary.Name, summary.Description, summary.Category, summary.Topic,
                    summary.Level, summary.EstimatedMinutes, summary.Image, summary.ContentCount, summary.QuestionCount,
                    MaxXp(summary), node.IsBranch, node.BranchId, node.BranchTitle, node.BranchRequired,
                    node.Column, node.Row, node.Prerequisites, state, status));
            }

            // Bài nên học tiếp: bài đang học dở gần nhất trong lộ trình, nếu không có thì bài mở khóa đầu tiên
            var nodeIds = nodes.Select(n => n.LessonId).ToHashSet(StringComparer.Ordinal);
            var currentLessonId = progress.Rows
                    .Where(r => r.Status == UserLessonProgress.StatusInProgress && nodeIds.Contains(r.LessonId))
                    .OrderByDescending(r => r.LastStudiedAt)
                    .Select(r => r.LessonId)
                    .FirstOrDefault()
                ?? nodes.FirstOrDefault(n => n.State == BoardNodeStates.Current)?.LessonId;

            return new LearningPathBoardDto(path.Id, path.Title, path.Description, path.Version,
                LessonCount: nodes.Count,
                CompletedCount: nodes.Count(n => n.State == BoardNodeStates.Done),
                currentLessonId,
                nodes);
        }

        /// <summary>XP tối đa của 1 bài: 5 XP/mục + 10 XP/câu quiz đúng (lần đầu đạt), hoặc +20 XP nếu bài không có quiz.</summary>
        private static int MaxXp(LessonSummaryDto lesson) =>
            lesson.ContentCount * ILearningResultService.XpPerContent
            + (lesson.QuestionCount > 0
                ? lesson.QuestionCount * ILearningResultService.XpPerCorrectAnswer
                : ILearningResultService.XpLessonCompleted);

        private async Task<UserProgress> LoadProgressAsync(Guid userId, CancellationToken cancellationToken)
        {
            var rows = await _db.UserLessonProgresses
                .AsNoTracking()
                .Where(p => p.UserId == userId)
                .Select(p => new ProgressRow(p.LessonId, p.Status, p.LastStudiedAt))
                .ToListAsync(cancellationToken);

            return new UserProgress(rows);
        }

        private sealed record ProgressRow(string LessonId, string Status, DateTimeOffset LastStudiedAt);

        private sealed class UserProgress
        {
            private readonly Dictionary<string, ProgressRow> _byLesson;

            public UserProgress(IReadOnlyList<ProgressRow> rows)
            {
                Rows = rows;
                _byLesson = rows.ToDictionary(r => r.LessonId, StringComparer.Ordinal);
                Completed = rows.Where(r => r.Status == UserLessonProgress.StatusCompleted)
                    .Select(r => r.LessonId)
                    .ToHashSet(StringComparer.Ordinal);
            }

            public IReadOnlyList<ProgressRow> Rows { get; }

            public IReadOnlySet<string> Completed { get; }

            public bool HasRow(string lessonId) => _byLesson.ContainsKey(lessonId);

            public string StatusOf(string lessonId) => _byLesson.TryGetValue(lessonId, out var row)
                ? row.Status == UserLessonProgress.StatusCompleted ? LessonProgressStatuses.Completed : LessonProgressStatuses.InProgress
                : LessonProgressStatuses.NotStarted;
        }
    }
}
