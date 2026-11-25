(() => {
    const STATUSES = new Set(['not_started', 'in_progress', 'completed']);
    const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const isText = value => typeof value === 'string' && value.trim().length > 0;
    const isCount = value => Number.isSafeInteger(value) && value >= 0;
    const isOptionalText = value => value === null || value === undefined || typeof value === 'string';

    function mapLesson(raw) {
        if (!isObject(raw)
            || !isText(raw.lessonId)
            || !isText(raw.name)
            || !isText(raw.description)
            || !isText(raw.category)
            || !isText(raw.topic)
            || !isText(raw.level)
            || !isCount(raw.order)
            || !isCount(raw.estimatedMinutes)
            || !isCount(raw.contentCount)
            || !isCount(raw.questionCount)
            || !isOptionalText(raw.image)) {
            return null;
        }

        return {
            lessonId: raw.lessonId,
            name: raw.name,
            description: raw.description,
            category: raw.category,
            topic: raw.topic,
            level: raw.level,
            order: raw.order,
            estimatedMinutes: raw.estimatedMinutes,
            image: typeof raw.image === 'string' ? raw.image : null,
            contentCount: raw.contentCount,
            questionCount: raw.questionCount
        };
    }

    function mapProgress(raw) {
        if (!isObject(raw)
            || !isText(raw.lessonId)
            || !STATUSES.has(raw.status)
            || !Array.isArray(raw.completedContentIds)
            || !raw.completedContentIds.every(isText)
            || !isOptionalText(raw.lastStudiedAt)) {
            return null;
        }

        return {
            lessonId: raw.lessonId,
            status: raw.status,
            completedContentIds: [...new Set(raw.completedContentIds)],
            lastStudiedAt: typeof raw.lastStudiedAt === 'string' ? raw.lastStudiedAt : null
        };
    }

    function mapDashboard(overview, rawLessons) {
        if (!isObject(overview) || !isObject(overview.stats)
            || !Array.isArray(overview.lessons) || !Array.isArray(rawLessons)) {
            return null;
        }

        const rawStats = overview.stats;
        if (!isCount(rawStats.totalXp)
            || !isCount(rawStats.currentStreak)
            || !isCount(rawStats.longestStreak)
            || !isCount(rawStats.todayXp)
            || !isCount(rawStats.lessonsCompleted)
            || !isCount(rawStats.lessonsInProgress)
            || !isOptionalText(rawStats.lastActivityDate)) {
            return null;
        }

        const lessons = [];
        const lessonById = new Map();
        for (const raw of rawLessons) {
            const lesson = mapLesson(raw);
            if (!lesson || lessonById.has(lesson.lessonId)) return null;
            lessons.push(lesson);
            lessonById.set(lesson.lessonId, lesson);
        }

        const progress = [];
        const progressById = new Map();
        for (const raw of overview.lessons) {
            const item = mapProgress(raw);
            if (!item || progressById.has(item.lessonId)) return null;
            progress.push(item);
            progressById.set(item.lessonId, item);
        }

        const completedIds = new Set(progress.filter(item => item.status === 'completed').map(item => item.lessonId));
        const inProgressIds = new Set(progress.filter(item => item.status === 'in_progress').map(item => item.lessonId));
        // ProgressService.GetOverviewAsync guarantees LastStudiedAt descending order.
        const currentProgress = progress.find(item => item.status === 'in_progress') || null;
        const currentLesson = currentProgress ? lessonById.get(currentProgress.lessonId) || null : null;
        const totalLessons = lessons.length;
        // GetAll returns the complete, unpaginated catalog. Historical progress may
        // reference removed lessons: only count completed / in-progress lessons in this denominator.
        const completed = lessons.filter(lesson => completedIds.has(lesson.lessonId)).length;
        const inProgress = lessons.filter(lesson => inProgressIds.has(lesson.lessonId)).length;
        const percent = totalLessons === 0
            ? 0
            : Math.max(0, Math.min(100, Math.round(completed / totalLessons * 100)));

        const withProgress = lesson => {
            const item = progressById.get(lesson.lessonId);
            return {
                ...lesson,
                progressStatus: item?.status || 'not_started',
                completedContents: item?.completedContentIds.length || 0,
                lastStudiedAt: item?.lastStudiedAt || null
            };
        };

        const recommendations = lessons
            // LessonService.GetAll guarantees level -> order -> lessonId ordering.
            .filter(lesson => !completedIds.has(lesson.lessonId) && lesson.lessonId !== currentProgress?.lessonId)
            .slice(0, 3)
            .map(withProgress);

        const stats = {
            totalXp: rawStats.totalXp,
            currentStreak: rawStats.currentStreak,
            longestStreak: rawStats.longestStreak,
            todayXp: rawStats.todayXp,
            lessonsCompleted: rawStats.lessonsCompleted,
            lessonsInProgress: rawStats.lessonsInProgress,
            lastActivityDate: typeof rawStats.lastActivityDate === 'string' ? rawStats.lastActivityDate : null
        };

        const hasProgress = progress.length > 0;
        let mode = 'ready';
        if (totalLessons === 0) mode = 'empty';
        else if (!hasProgress && stats.lessonsCompleted === 0 && stats.lessonsInProgress === 0) mode = 'first-use';
        else if (currentProgress && !currentLesson) mode = 'current-unavailable';

        return {
            mode,
            hasProgress,
            stats,
            completion: {
                completed,
                inProgress,
                total: totalLessons,
                percent
            },
            current: currentLesson ? {
                ...withProgress(currentLesson),
                contentPercent: currentLesson.contentCount === 0
                    ? 0
                    : Math.max(0, Math.min(100, Math.round(
                        Math.min(currentProgress.completedContentIds.length, currentLesson.contentCount)
                        / currentLesson.contentCount * 100)))
            } : null,
            currentUnavailable: Boolean(currentProgress && !currentLesson),
            recommendations
        };
    }

    async function fetchDashboardInputs(api) {
        const [progressResult, lessonsResult, recsResult] = await Promise.allSettled([
            api.get('/api/progress'),
            api.get('/api/lessons'),
            // One extra slot: the first suggestion is usually the current lesson, shown separately.
            api.get('/api/lessons/recommendations?limit=4')
        ]);

        if (progressResult.status === 'fulfilled'
            && lessonsResult.status === 'fulfilled'
            && recsResult.status === 'fulfilled') {
            return [progressResult.value, lessonsResult.value, recsResult.value];
        }

        const otherFailure = [progressResult, lessonsResult, recsResult]
            .find(res => res.status === 'rejected' && res.reason?.status !== 404);
        const needsInit = (progressResult.status === 'rejected' && progressResult.reason?.status === 404)
            || (recsResult.status === 'rejected' && recsResult.reason?.status === 404);

        if (!otherFailure && needsInit && typeof api.post === 'function') {
            await api.post('/api/progress/init');
            return await Promise.all([
                api.get('/api/progress'),
                api.get('/api/lessons'),
                api.get('/api/lessons/recommendations?limit=4')
            ]);
        }

        if (progressResult.status === 'rejected') throw progressResult.reason;
        if (lessonsResult.status === 'rejected') throw lessonsResult.reason;
        throw recsResult.reason;
    }

    // GET /api/lessons/recommendations: in-progress -> next unlocked lesson in the
    // learning path -> standalone lessons. The server already drops locked and
    // completed lessons, so no per-lesson access probes are needed.
    function mapRecommendations(rawItems, data, progressById) {
        if (!Array.isArray(rawItems)) return null;
        const items = [];
        for (const raw of rawItems) {
            const lesson = mapLesson(raw?.lesson);
            if (!lesson || !STATUSES.has(raw.progressStatus)) return null;
            if (lesson.lessonId === data.current?.lessonId || items.some(item => item.lessonId === lesson.lessonId)) continue;
            const progress = progressById.get(lesson.lessonId);
            items.push({
                ...lesson,
                progressStatus: raw.progressStatus,
                completedContents: progress?.completedContentIds.length || 0,
                lastStudiedAt: progress?.lastStudiedAt || null
            });
        }
        return items.slice(0, 3);
    }

    async function loadDashboard(api, isCurrent = () => true) {
        const [overview, lessons, rawRecommendations] = await fetchDashboardInputs(api);
        if (!isCurrent()) return null;
        const data = mapDashboard(overview, lessons);
        if (!data) throw new Error('Invalid dashboard response');

        const progressById = new Map(overview.lessons.map(item => [item.lessonId, mapProgress(item)]));
        const recommendations = mapRecommendations(rawRecommendations, data, progressById);
        if (!recommendations) throw new Error('Invalid recommendations response');
        data.recommendations = recommendations;
        return data;
    }

    window.DashboardData = Object.freeze({ mapDashboard, mapRecommendations, loadDashboard });
})();
