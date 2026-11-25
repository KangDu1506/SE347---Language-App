const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../wwwroot/js/dashboard-data.js'), 'utf8'), context);
const { loadDashboard } = context.window.DashboardData;
const lesson = id => ({ lessonId: id, name: id, description: id, category: 'vocabulary', topic: id,
    level: 'A1', order: 1, estimatedMinutes: 10, image: null, contentCount: 4, questionCount: 0 });
const overview = { stats: { totalXp: 0, currentStreak: 0, longestStreak: 0, todayXp: 0,
    lessonsCompleted: 1, lessonsInProgress: 1, lastActivityDate: null }, lessons: [
    { lessonId: 'current', status: 'in_progress', completedContentIds: ['c1'], lastStudiedAt: '2026-11-20T08:00:00Z' },
    { lessonId: 'removed', status: 'completed', completedContentIds: [], lastStudiedAt: null }
] };
const catalog = ['current', 'locked', 'next', 'standalone', 'extra'].map(lesson);
// Server (S3-25) đã bỏ bài khóa ('locked') và bài đã hoàn thành; bài đang học dở đứng đầu.
const recommendations = [
    { lesson: lesson('current'), reason: 'continue', progressStatus: 'in_progress', maxXp: 40, learningPathId: 'p' },
    { lesson: lesson('next'), reason: 'next_in_path', progressStatus: 'not_started', maxXp: 40, learningPathId: 'p' },
    { lesson: lesson('standalone'), reason: 'outside_path', progressStatus: 'not_started', maxXp: 40, learningPathId: null },
    { lesson: lesson('extra'), reason: 'outside_path', progressStatus: 'not_started', maxXp: 40, learningPathId: null }
];
const RECS = '/api/lessons/recommendations?limit=4';
const api = (overrides = {}, calls = []) => ({ get: async url => {
    calls.push(url);
    if (url in overrides) {
        if (overrides[url] instanceof Error) throw overrides[url];
        return overrides[url];
    }
    if (url === '/api/progress') return overview;
    if (url === '/api/lessons') return catalog;
    if (url === RECS) return recommendations;
    throw new Error(`Unexpected request ${url}`);
} });
const error = (status, code) => Object.assign(new Error('API failure'), { status, body: { code } });

(async () => {
    const calls = [];
    const data = await loadDashboard(api({}, calls));
    assert.equal(data.current.lessonId, 'current');
    assert.equal(data.completion.percent, 0); // Removed historical completion is not catalog progress.
    assert.equal(data.stats.lessonsCompleted, 1); // Preserve original stats for debugging.
    // Bài hiện tại không lặp lại trong gợi ý; tối đa 3 bài theo đúng thứ tự server trả về.
    assert.equal(data.recommendations.map(item => item.lessonId).join(','), 'next,standalone,extra');
    assert.equal(data.recommendations[0].progressStatus, 'not_started');
    // Không còn gọi từng /api/lessons/{id} để lọc bài khóa: đúng 3 request, không ghi tiến độ.
    assert.deepEqual([...calls].sort(), ['/api/lessons', '/api/progress', RECS].sort());
    assert.equal(calls.some(url => url.endsWith('/open')), false);

    // Không có bài đang học: gợi ý giữ nguyên thứ tự server (kể cả bài đang học dở) và vẫn tối đa 3.
    const noCurrent = { ...overview, lessons: [] };
    const fresh = await loadDashboard(api({ '/api/progress': noCurrent }));
    assert.equal(fresh.current, null);
    assert.equal(fresh.recommendations.map(item => item.lessonId).join(','), 'current,next,standalone');
    assert.equal(fresh.recommendations[0].progressStatus, 'in_progress');

    // Bài đang học đã bị gỡ khỏi catalog -> current-unavailable (do mapDashboard)
    const gone = await loadDashboard(api({ '/api/lessons': catalog.filter(item => item.lessonId !== 'current') }));
    assert.equal(gone.current, null);
    assert.equal(gone.currentUnavailable, true);
    assert.equal(gone.mode, 'current-unavailable');

    for (const failure of [error(0), error(400), error(401), error(403, 'profile_inactive'), error(500)]) {
        await assert.rejects(loadDashboard(api({ [RECS]: failure })), value => value === failure);
        await assert.rejects(loadDashboard(api({ '/api/progress': failure })), value => value === failure);
    }
    await assert.rejects(loadDashboard(api({ '/api/progress': null })), /Invalid dashboard/);
    await assert.rejects(loadDashboard(api({ [RECS]: {} })), /Invalid recommendations/);
    await assert.rejects(loadDashboard(api({ [RECS]: [{ lesson: {}, progressStatus: 'not_started' }] })), /Invalid recommendations/);
    await assert.rejects(loadDashboard(api({ [RECS]: [{ lesson: lesson('x'), progressStatus: 'weird' }] })), /Invalid recommendations/);
    const noCalls = [];
    assert.equal(await loadDashboard(api({}, noCalls), () => false), null);
    assert.equal(noCalls.length, 3);

    // Tự request POST /api/progress/init khi /api/progress trả 404 (tài khoản cũ chưa khởi tạo).
    let initCalls = 0;
    let progressAttempt = 0;
    const autoInitApi = {
        get: async url => {
            if (url === '/api/progress') {
                progressAttempt++;
                if (progressAttempt === 1) throw error(404);
                return overview;
            }
            if (url === '/api/lessons') return catalog;
            if (url === RECS) return recommendations;
            throw new Error(`Unexpected request ${url}`);
        },
        post: async url => {
            assert.equal(url, '/api/progress/init');
            initCalls++;
            return overview;
        }
    };
    const recovered = await loadDashboard(autoInitApi);
    assert.equal(initCalls, 1);
    assert.equal(progressAttempt, 2);
    assert.equal(recovered.recommendations.map(item => item.lessonId).join(','), 'next,standalone,extra');

    console.log('PASS: server recommendations (no per-lesson probes), current lesson excluded, removed lessons, failure propagation, invalid payloads, stale requests and auto init.');
})().catch(error => { console.error(error); process.exitCode = 1; });
