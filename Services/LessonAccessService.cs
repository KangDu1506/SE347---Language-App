using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.Models;

namespace SE347.Services
{
    public class LessonAccessService : ILessonAccessService
    {
        private readonly ApplicationDbContext _db;
        private readonly ILessonService _lessons;

        public LessonAccessService(ApplicationDbContext db, ILessonService lessons)
        {
            _db = db;
            _lessons = lessons;
        }

        public async Task<LessonAccess> CheckProfileAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var active = await _db.Profiles
                .AsNoTracking()
                .AnyAsync(p => p.Id == userId && p.Status == "active", cancellationToken);

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

            var completed = await _db.UserLessonProgresses
                .AsNoTracking()
                .Where(p => p.UserId == userId
                    && prerequisites.Contains(p.LessonId)
                    && p.Status == UserLessonProgress.StatusCompleted)
                .CountAsync(cancellationToken);

            return completed == prerequisites.Count ? LessonAccess.Allowed : LessonAccess.Locked;
        }
    }
}
