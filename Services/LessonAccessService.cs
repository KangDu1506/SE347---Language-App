using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.Models;

namespace SE347.Services
{
    public class LessonAccessService : ILessonAccessService
    {
        private readonly ApplicationDbContext _db;
        private readonly ILessonService _lessons;
        private readonly IUserProfileInitializer _initializer;

        public LessonAccessService(ApplicationDbContext db, ILessonService lessons, IUserProfileInitializer initializer)
        {
            _db = db;
            _lessons = lessons;
            _initializer = initializer;
        }

        public async Task<LessonAccess> CheckProfileAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var active = await _db.Profiles
                .AsNoTracking()
                .AnyAsync(p => p.Id == userId && p.Status == "active", cancellationToken);

            if (!active && await _initializer.EnsureInitializedAsync(userId, cancellationToken))
            {
                active = await _db.Profiles
                    .AsNoTracking()
                    .AnyAsync(p => p.Id == userId && p.Status == "active", cancellationToken);
            }

            return active ? LessonAccess.Allowed : LessonAccess.ProfileNotActive;
        }

        public async Task<LessonAccess> CheckLessonAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default)
        {
            var profile = await CheckProfileAsync(userId, cancellationToken);
            if (profile != LessonAccess.Allowed)
            {
                return profile;
            }

            var prerequisites = _lessons.GetPrerequisites(lessonId);
            if (prerequisites.Count == 0)
            {
                return LessonAccess.Allowed;
            }

            var progress = await _db.UserLessonProgresses
                .AsNoTracking()
                .Where(p => p.UserId == userId && (p.LessonId == lessonId || prerequisites.Contains(p.LessonId)))
                .Select(p => new { p.LessonId, p.Status })
                .ToListAsync(cancellationToken);

            var completed = progress
                .Where(p => p.Status == UserLessonProgress.StatusCompleted)
                .Select(p => p.LessonId)
                .ToHashSet(StringComparer.Ordinal);
            var alreadyOpened = progress.Any(p => p.LessonId == lessonId);

            return LessonUnlockRule.IsUnlocked(prerequisites, completed, alreadyOpened) ? LessonAccess.Allowed : LessonAccess.Locked;
        }
    }
}
