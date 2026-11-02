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
    { lessonId: 'current', status: 'in_progress', completedContentIds: [], lastStudiedAt: null },
    { lessonId: 'removed', status: 'completed', completedContentIds: [], lastStudiedAt: null }
] };
const catalog = ['current', 'locked', 'missing', 'available'].map(lesson);
const api = (overrides = {}, calls = []) => ({ get: async url => {
    calls.push(url);
    if (url in overrides) {
        if (overrides[url] instanceof Error) throw overrides[url];
        return overrides[url];
    }
    if (url === '/api/progress') return overview;
    if (url === '/api/lessons') return catalog;
    return { lessonId: url.split('/').at(-1) };
} });
const error = (status, code) => Object.assign(new Error('API failure'), { status, body: { code } });

(async () => {
    const calls = [];
    const data = await loadDashboard(api({
        '/api/lessons/current': error(403, 'lesson_locked'),
        '/api/lessons/locked': error(403, 'lesson_locked'),
        '/api/lessons/missing': error(404)
    }, calls));
    assert.equal(data.current, null);
    assert.equal(data.currentUnavailable, true);
    assert.equal(data.completion.percent, 0); // Removed historical completion is not catalog progress.
    assert.equal(data.stats.lessonsCompleted, 1); // Preserve original stats for debugging.
    assert.equal(data.recommendations.map(item => item.lessonId).join(','), 'available');
    assert.equal(calls.length, new Set(calls).size);
    assert.equal(calls.some(url => url.endsWith('/open')), false);

    for (const failure of [error(0), error(400), error(401), error(403, 'profile_inactive'), error(500)]) {
        await assert.rejects(loadDashboard(api({ '/api/lessons/locked': failure })), value => value === failure);
        await assert.rejects(loadDashboard(api({ '/api/progress': failure })), value => value === failure);
    }
    await assert.rejects(loadDashboard(api({ '/api/progress': null })), /Invalid dashboard/);
    await assert.rejects(loadDashboard(api({ '/api/lessons/current': {} })), /Invalid lesson/);
    const noCalls = [];
    assert.equal(await loadDashboard(api({}, noCalls), () => false), null);
    assert.equal(noCalls.length, 2);
    let active = true;
    const staleApi = api();
    const get = staleApi.get;
    staleApi.get = async url => {
        const response = await get(url);
        if (url.startsWith('/api/lessons/')) active = false;
        return response;
    };
    assert.equal(await loadDashboard(staleApi, () => active), null);
    console.log('PASS: authenticated read-only loading, access filtering, removed lessons, failure propagation, invalid payloads and stale requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
