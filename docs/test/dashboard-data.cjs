const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../../wwwroot/js/dashboard-data.js'), 'utf8');
global.window = {};
vm.runInThisContext(source, { filename: 'dashboard-data.js' });
const map = global.window.DashboardData.mapDashboard;
delete global.window;

const lesson = (lessonId, order, extra = {}) => ({
    lessonId,
    name: `Lesson ${order}`,
    description: `Description ${order}`,
    category: 'vocabulary',
    topic: `Topic ${order}`,
    level: 'A1',
    order,
    estimatedMinutes: 10,
    image: null,
    contentCount: 4,
    questionCount: 2,
    ...extra
});

const progress = (lessonId, status, extra = {}) => ({
    lessonId,
    status,
    firstOpenedAt: '2026-10-01T08:00:00Z',
    lastStudiedAt: '2026-10-02T08:00:00Z',
    completedAt: status === 'completed' ? '2026-10-02T08:00:00Z' : null,
    completedContentIds: [],
    quizAttempts: 0,
    bestQuizScore: null,
    lastQuizScore: null,
    xpEarned: 0,
    ...extra
});

const stats = (extra = {}) => ({
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    todayXp: 0,
    lessonsCompleted: 0,
    lessonsInProgress: 0,
    ...extra
});

const lessons = [lesson('third', 3), lesson('first', 1), lesson('second', 2), lesson('fourth', 4)];
const overview = (overrides = {}, progressItems = []) => ({
    stats: stats(overrides),
    lessons: progressItems
});

{
    const result = map(overview(
        { totalXp: 1234, currentStreak: 5, longestStreak: 9, todayXp: 20, lessonsCompleted: 2, lessonsInProgress: 1 },
        [
            progress('second', 'completed', { completedContentIds: ['1', '2', '3', '4'] }),
            progress('third', 'in_progress', { completedContentIds: ['1', '2'] }),
            progress('first', 'completed', { completedContentIds: ['1'] }),
            progress('fourth', 'in_progress', { completedContentIds: ['1'] })
        ]
    ), lessons);

    assert.equal(result.mode, 'ready');
    assert.equal(result.stats.totalXp, 1234);
    assert.equal(result.completion.completed, 2);
    assert.equal(result.completion.total, 4);
    assert.equal(result.completion.percent, 50);
    assert.equal(result.current.lessonId, 'third');
    assert.equal(result.current.completedContents, 2);
    assert.equal(result.current.contentPercent, 50);
    assert.deepEqual(result.recommendations.map(item => item.lessonId), ['fourth']);
    assert.equal(result.recommendations[0].progressStatus, 'in_progress');
}

{
    const result = map(overview({}, []), lessons);
    assert.equal(result.mode, 'first-use');
    assert.equal(result.current, null);
    assert.equal(result.currentUnavailable, false);
    assert.equal(result.completion.percent, 0);
    assert.deepEqual(result.recommendations.map(item => item.lessonId), ['third', 'first', 'second']);
    assert.equal(result.recommendations.every(item => item.progressStatus === 'not_started'), true);
}

{
    const result = map(overview({}, []), []);
    assert.equal(result.mode, 'empty');
    assert.equal(result.completion.total, 0);
    assert.equal(result.completion.percent, 0);
    assert.deepEqual(result.recommendations, []);
}

{
    const result = map(overview({ lessonsCompleted: 7 }, []), lessons);
    assert.equal(result.completion.completed, 0);
    assert.equal(result.completion.percent, 0);
    assert.equal(result.stats.lessonsCompleted, 7);
}

{
    const result = map(overview({ lessonsInProgress: 1 }, [progress('missing', 'in_progress')]), lessons);
    assert.equal(result.mode, 'current-unavailable');
    assert.equal(result.current, null);
    assert.equal(result.currentUnavailable, true);
    assert.deepEqual(result.recommendations.map(item => item.lessonId), ['third', 'first', 'second']);
}

{
    const result = map(overview(
        { lessonsCompleted: 4 },
        lessons.map(item => progress(item.lessonId, 'completed'))
    ), lessons);
    assert.equal(result.current, null);
    assert.deepEqual(result.recommendations, []);
}

{
    const result = map(overview(
        { lessonsCompleted: 1, lessonsInProgress: 1 },
        [
            progress('third', 'completed'),
            progress('first', 'in_progress', {
                completedContentIds: ['1', '1', '2', '3', '4', '5'],
                lastStudiedAt: '2026-10-09T12:30:00Z'
            })
        ]
    ), lessons);
    assert.equal(result.current.contentPercent, 100);
    assert.equal(result.current.completedContents, 5);
    assert.equal(result.current.lastStudiedAt, '2026-10-09T12:30:00Z');
    assert.deepEqual(result.recommendations.map(item => item.lessonId), ['second', 'fourth']);
    assert.equal(result.recommendations[0].progressStatus, 'not_started');
}

{
    const validLesson = lesson('first', 1);
    const invalid = [
        [null, lessons],
        [overview(), null],
        [{ stats: stats(), lessons: 'no' }, lessons],
        [{ stats: stats({ totalXp: -1 }), lessons: [] }, []],
        [{ stats: stats({ lessonsCompleted: 1.5 }), lessons: [] }, []],
        [{ stats: stats({ lastActivityDate: 7 }), lessons: [] }, []],
        [overview(), [{ ...validLesson, name: '' }]],
        [overview(), [{ ...validLesson, order: -1 }]],
        [overview(), [{ ...validLesson, contentCount: '4' }]],
        [overview(), [validLesson, { ...validLesson, name: 'Duplicate' }]],
        [overview({}, [progress('first', 'unknown')]), [validLesson]],
        [overview({}, [progress('first', 'in_progress', { completedContentIds: [1] })]), [validLesson]],
        [overview({}, [progress('first', 'in_progress', { lastStudiedAt: 3 })]), [validLesson]],
        [overview({}, [progress('first', 'completed'), progress('first', 'completed')]), [validLesson]]
    ];
    for (const [overviewValue, lessonsValue] of invalid) {
        assert.equal(map(overviewValue, lessonsValue), null);
    }
}

{
    const result = map(overview({ lessonsCompleted: 2, lessonsInProgress: 1 }, [
        progress('removed', 'completed'),
        progress('first', 'completed'),
        progress('second', 'in_progress', { completedContentIds: [] })
    ]), [lesson('first', 1), lesson('second', 2, { contentCount: 0 }), lesson('third', 3)]);
    assert.equal(result.completion.completed, 1);
    assert.equal(result.completion.percent, 33);
    assert.equal(result.current.contentPercent, 0);
    assert.equal(result.stats.totalXp, 0);
    assert.equal(result.stats.currentStreak, 0);
}

{
    const rawOverview = overview(
        { totalXp: 100, lessonsCompleted: 1, lessonsInProgress: 1 },
        [progress('second', 'completed'), progress('first', 'in_progress')]
    );
    const rawLessons = [lesson('first', 1), lesson('second', 2)];
    const snapshot = JSON.stringify({ rawOverview, rawLessons });
    const result = map(rawOverview, rawLessons);
    assert.equal(JSON.stringify({ rawOverview, rawLessons }), snapshot);
    assert.notEqual(result.current, rawLessons[0]);
    assert.notEqual(result.recommendations, rawLessons);
}

console.log('PASS: dashboard mapper handles real progress, empty/first-use data, invalid payloads, completion bounds, current selection and recommendations.');
