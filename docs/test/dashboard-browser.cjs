const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.APP_URL || 'http://localhost:5347';
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9347';
let nextId = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect() {
    const target = await (await fetch(debug + '/json/new?about:blank', { method: 'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    const pending = new Map();
    const eventHandlers = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id) {
            const p = pending.get(message.id);
            pending.delete(message.id);
            if (p) message.error ? p.reject(message.error) : p.resolve(message.result);
        }
        if (message.method === 'Runtime.exceptionThrown') {
            errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        }
        eventHandlers.get(message.method)?.(message.params);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
        pending.set(id, {
            resolve: value => { clearTimeout(timer); resolve(value); },
            reject: error => { clearTimeout(timer); reject(error); }
        });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const on = (method, handler) => eventHandlers.set(method, handler);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Page.bringToFront');
    const close = async () => {
        socket.close();
        await fetch(debug + '/json/close/' + target.id);
    };
    return { send, evaluate, on, errors, close };
}

(async () => {
    const lesson = (lessonId, name, order, topic, minutes, contentCount) => ({
        lessonId,
        name,
        description: `${name} description`,
        category: 'vocabulary',
        topic,
        level: 'A1',
        order,
        estimatedMinutes: minutes,
        image: null,
        contentCount,
        questionCount: 2
    });
    const progress = (lessonId, status, completedContentIds = [], lastStudiedAt = null) => ({
        lessonId,
        status,
        firstOpenedAt: '2026-10-01T08:00:00Z',
        lastStudiedAt,
        completedAt: status === 'completed' ? '2026-10-02T08:00:00Z' : null,
        completedContentIds,
        quizAttempts: 0,
        bestQuizScore: null,
        lastQuizScore: null,
        xpEarned: 0
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

    const lessons = [
        lesson('first-lesson', 'First Lesson', 1, 'Greetings', 8, 4),
        lesson('second-lesson', 'Second Lesson', 2, 'Numbers', 12, 6),
        lesson('third-lesson', 'Third Lesson', 3, 'Family', 10, 5),
        lesson('fourth-lesson', 'Fourth Lesson', 4, 'Food', 9, 3)
    ];
    const fullProgress = {
        stats: stats({
            totalXp: 1250,
            currentStreak: 5,
            longestStreak: 9,
            lastActivityDate: '2026-10-30',
            todayXp: 20,
            lessonsCompleted: 1,
            lessonsInProgress: 1
        }),
        lessons: [
            progress('second-lesson', 'in_progress', ['1', '2', '3'], '2026-10-30T09:15:00Z'),
            progress('first-lesson', 'completed')
        ]
    };
    const firstUseProgress = { stats: stats(), lessons: [] };
    const unavailableProgress = {
        stats: stats({ lessonsInProgress: 1 }),
        lessons: [progress('missing-lesson', 'in_progress')]
    };
    const allDoneProgress = {
        stats: stats({ lessonsCompleted: 4, currentStreak: 3, longestStreak: 3 }),
        lessons: lessons.map(item => progress(item.lessonId, 'completed'))
    };
    const emptyProgress = { stats: stats(), lessons: [] };

    const userA = {
        id: 'a1111111-1111-1111-1111-111111111111',
        email: 'minhanh@example.com',
        user_metadata: { display_name: 'Nguyễn Minh Anh' }
    };
    const userB = {
        id: 'b2222222-2222-2222-2222-222222222222',
        email: 'bao@example.com',
        user_metadata: { display_name: 'Trần Bảo' }
    };

    const boot = `(() => {
        localStorage.setItem('se347.language', 'vi');
        localStorage.setItem('se347.theme', 'light');
        const fallback = ${JSON.stringify(userA)};
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem('dashboard-test-user') || 'null'); } catch {}
        window.__dashboardTest = {
            user: stored || fallback,
            authCb: null,
            setUser(user) {
                this.user = user;
                localStorage.setItem('dashboard-test-user', JSON.stringify(user));
            },
            signIn(user) {
                this.setUser(user);
                this.authCb?.('SIGNED_IN', { user });
            }
        };
        window.supabase = {
            createClient: () => ({
                auth: {
                    getUser: async () => ({ data: { user: window.__dashboardTest.user }, error: null }),
                    getSession: async () => ({
                        data: { session: { access_token: 'dashboard-test-token', user: window.__dashboardTest.user } },
                        error: null
                    }),
                    onAuthStateChange: cb => {
                        window.__dashboardTest.authCb = cb;
                        return { data: { subscription: { unsubscribe() {} } } };
                    },
                    signOut: async () => ({})
                }
            })
        };
    })();`;

    const c = await connect();
    const { send, evaluate: run, on, errors } = c;
    // Isolate repeated runs in the dedicated test browser profile.
    await send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'local_storage' });
    async function screenshot(name) {
        if (!process.env.SCREENSHOT_DIR) return;
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
        const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR, `${name}.png`), Buffer.from(data, 'base64'));
    }
    await send('Network.setBlockedURLs', { urls: ['*cdn.jsdelivr.net*', '*supabase-js*'] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: boot });
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    let scenario = {};
    const counts = { progress: 0, lessons: 0 };

    function setScenario(options = {}) {
        scenario = {
            progress: {
                status: options.progressStatus || 200,
                body: options.progress || fullProgress,
                delay: options.progressDelay || 0,
                fail: options.progressFail || null
            },
            lessons: {
                status: options.lessonsStatus || 200,
                body: options.lessons ?? lessons,
                delay: options.lessonsDelay || 0,
                fail: options.lessonsFail || null
            }
        };
        counts.progress = 0;
        counts.lessons = 0;
    }

    async function handleFetch(params) {
        const path = new URL(params.request.url).pathname;
        const kind = path === '/api/progress' ? 'progress' : path === '/api/lessons' ? 'lessons' : null;
        if (kind || path.startsWith('/api/lessons/')) {
            assert.equal(params.request.method, 'GET');
            assert.equal(params.request.headers.Authorization, 'Bearer dashboard-test-token');
        }
        if (path.startsWith('/api/lessons/')) {
            const id = decodeURIComponent(path.split('/').at(-1));
            const locked = scenario.locked?.includes(id);
            await send('Fetch.fulfillRequest', {
                requestId: params.requestId,
                responseCode: locked ? 403 : 200,
                responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
                body: Buffer.from(JSON.stringify(locked ? { code: 'lesson_locked' } : { lessonId: id })).toString('base64')
            });
            return;
        }
        if (!kind) {
            await send('Fetch.continueRequest', { requestId: params.requestId });
            return;
        }

        const response = scenario[kind];
        counts[kind]++;
        if (response.delay) await delay(response.delay);
        if (response.fail) {
            await send('Fetch.failRequest', { requestId: params.requestId, errorReason: response.fail });
            return;
        }
        await send('Fetch.fulfillRequest', {
            requestId: params.requestId,
            responseCode: response.status,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
            body: Buffer.from(JSON.stringify(response.body)).toString('base64')
        });
    }

    on('Fetch.requestPaused', params => { handleFetch(params).catch(() => {}); });
    await send('Fetch.enable', {
        patterns: [
            { urlPattern: '*/api/progress', requestStage: 'Request' },
            { urlPattern: '*/api/lessons', requestStage: 'Request' },
            { urlPattern: '*/api/lessons/*', requestStage: 'Request' }
        ]
    });
    await send('Network.setCookie', { name: 'userToken', value: 'authenticated', url: base, path: '/' });

    async function waitFor(expression, timeout = 6000) {
        const started = Date.now();
        while (Date.now() - started < timeout) {
            if (await run(expression)) return;
            await delay(40);
        }
        throw new Error('Timed out: ' + expression);
    }

    async function navigate(path, expected) {
        const previousOrigin = await run('performance.timeOrigin');
        await send('Page.navigate', { url: base + path });
        await waitFor(`performance.timeOrigin !== ${previousOrigin}
            && document.readyState === 'complete'
            && !!window.AppI18n
            && !!document.querySelector('.home-page')
            && !document.querySelector('.home-page').hidden`, 8000);
        await run('AppI18n.ready');
        if (expected) {
            await waitFor(`document.querySelector('.home-page').dataset.dashboardState === ${JSON.stringify(expected)}`);
        }
    }

    const readState = () => run(`(() => {
        const page = document.querySelector('.home-page');
        const element = selector => document.querySelector(selector);
        const text = selector => element(selector)?.textContent.trim() ?? null;
        return {
            path: location.pathname,
            state: page?.dataset.dashboardState,
            mode: page?.dataset.dashboardMode,
            loadingHidden: element('[data-dashboard-view="loading"]')?.hidden,
            readyHidden: element('[data-dashboard-view="ready"]')?.hidden,
            errorHidden: element('[data-dashboard-view="error"]')?.hidden,
            summary: text('[data-dashboard-summary]'),
            name: text('[data-user-name]'),
            totalXp: text('[data-stat="total-xp"]'),
            todayXp: text('[data-stat="today-xp"]'),
            completed: text('[data-stat="lessons-completed"]'),
            completedMeta: text('[data-stat="completed-meta"]'),
            inProgress: text('[data-stat="lessons-in-progress"]'),
            inProgressMeta: text('[data-stat="in-progress-meta"]'),
            percent: text('[data-completion-percent]'),
            completionMeta: text('[data-completion-meta]'),
            completionBar: Number(element('[data-completion-bar]')?.getAttribute('aria-valuenow')),
            streak: text('[data-stat="streak"]'),
            longest: text('[data-stat="longest-streak"]'),
            streakLabel: element('[data-dashboard-streak]')?.getAttribute('aria-label'),
            streakHidden: element('[data-dashboard-streak]')?.hidden,
            currentTag: text('[data-current-tag]'),
            currentTitle: text('[data-current-title]'),
            currentText: text('[data-current-text]'),
            currentMeta: text('[data-current-meta]'),
            currentDate: text('[data-current-date]'),
            currentDateHidden: element('[data-current-date]')?.hidden,
            currentLink: text('[data-current-link]'),
            currentHref: element('[data-current-link]')?.getAttribute('href'),
            currentLinkHidden: element('[data-current-link]')?.hidden,
            currentBar: Number(element('[data-current-bar]')?.getAttribute('aria-valuenow')),
            currentBarHidden: element('[data-current-bar]')?.hidden,
            recs: [...document.querySelectorAll('[data-recommendations] a')].map(a => ({
                text: a.textContent.trim(),
                href: a.getAttribute('href')
            })),
            recsEmpty: text('[data-recs-empty]'),
            recsEmptyHidden: element('[data-recs-empty]')?.hidden,
            errorTitle: text('[data-error-title]'),
            errorText: text('[data-error-text]'),
            retryHidden: element('[data-dashboard-retry]')?.hidden,
            missing: [...document.querySelectorAll('[data-i18n]')]
                .filter(node => !AppI18n.t(node.dataset.i18n))
                .map(node => node.dataset.i18n),
            overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth)
                > document.documentElement.clientWidth + 1,
            language: document.documentElement.lang
        };
    })()`);

    setScenario({ progress: fullProgress, lessons, progressDelay: 900, lessonsDelay: 900 });
    await navigate('/Index');
    await waitFor("document.querySelector('.home-page').dataset.dashboardState === 'loading'");
    let state = await readState();
    assert.equal(state.loadingHidden, false);
    assert.equal(state.readyHidden, true);
    assert.equal(state.errorHidden, true);
    assert.equal(state.streakHidden, true);
    await screenshot('dashboard-loading');

    await waitFor("document.querySelector('.home-page').dataset.dashboardState === 'ready'");
    state = await readState();
    assert.equal(state.mode, 'ready');
    assert.equal(state.readyHidden, false);
    assert.equal(state.loadingHidden, true);
    assert.equal(state.name, 'Minh Anh');
    assert.equal(state.summary, '1/4 bài đã hoàn thành · 1 bài đang học');
    assert.equal(state.totalXp, '1.250');
    assert.equal(state.todayXp, 'Hôm nay +20 XP');
    assert.equal(state.completed, '1');
    assert.equal(state.completedMeta, 'trong tổng số 4 bài');
    assert.equal(state.inProgress, '1');
    assert.equal(state.inProgressMeta, '1 bài đã bắt đầu');
    assert.equal(state.percent, '25%');
    assert.equal(state.completionMeta, '1/4 bài đã hoàn thành');
    assert.equal(state.completionBar, 25);
    assert.equal(state.streak, '5');
    assert.equal(state.longest, 'Kỷ lục 9 ngày');
    assert.equal(state.streakLabel, 'Chuỗi 5 ngày');
    assert.equal(state.streakHidden, false);
    assert.equal(state.currentTitle, 'Second Lesson');
    assert.equal(state.currentMeta, 'Numbers · 3/6 mục · 12 phút');
    assert.match(state.currentDate, /30.*2026/);
    assert.equal(state.currentDateHidden, false);
    assert.equal(state.currentBar, 50);
    assert.equal(state.currentBarHidden, false);
    assert.equal(state.currentHref, '/Lesson/second-lesson');
    assert.equal(state.currentLink, 'Tiếp tục bài học →');
    assert.equal(state.currentLinkHidden, false);
    assert.deepEqual(state.recs.map(item => item.href), ['/Lesson/third-lesson', '/Lesson/fourth-lesson']);
    assert.match(state.recs[0].text, /Third Lesson/);
    assert.equal(state.recsEmptyHidden, true);
    assert.deepEqual(state.missing, []);
    assert.equal(state.overflow, false);
    await screenshot('dashboard-loaded');

    await run("AppI18n.setLanguage('en')");
    await delay(80);
    state = await readState();
    assert.equal(state.language, 'en');
    assert.equal(state.summary, '1/4 lessons completed · 1 in progress');
    assert.equal(state.totalXp, '1,250');
    assert.equal(state.currentMeta, 'Numbers · 3/6 items · 12 min');
    assert.equal(state.currentLink, 'Continue lesson →');
    assert.match(state.recs[0].text, /min/);
    assert.deepEqual(state.missing, []);

    await run("AppI18n.setLanguage('vi')");
    await delay(80);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await delay(80);
    state = await readState();
    assert.equal(state.overflow, false);
    assert.equal(state.currentHref, '/Lesson/second-lesson');
    await screenshot('dashboard-mobile');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    setScenario({ progress: firstUseProgress, lessons });
    await navigate('/Index', 'ready');
    state = await readState();
    assert.equal(state.mode, 'first-use');
    assert.equal(state.summary, 'Bạn chưa bắt đầu bài học nào. Chọn một bài để bắt đầu.');
    assert.equal(state.totalXp, '0');
    assert.equal(state.todayXp, 'Hôm nay +0 XP');
    assert.equal(state.completed, '0');
    assert.equal(state.percent, '0%');
    assert.equal(state.completionBar, 0);
    assert.equal(state.streak, '0');
    assert.equal(state.currentTag, 'Bắt đầu');
    assert.equal(state.currentTitle, 'Bạn chưa bắt đầu bài học nào');
    assert.equal(state.currentHref, '/Lesson/first-lesson');
    assert.equal(state.currentLink, 'Bắt đầu bài đầu tiên →');
    assert.equal(state.currentBarHidden, true);
    await screenshot('dashboard-first-use');
    assert.deepEqual(state.recs.map(item => item.href), [
        '/Lesson/first-lesson',
        '/Lesson/second-lesson',
        '/Lesson/third-lesson'
    ]);

    setScenario({ progress: unavailableProgress, lessons });
    await navigate('/Index', 'ready');
    state = await readState();
    assert.equal(state.mode, 'current-unavailable');
    assert.equal(state.currentTitle, 'Bài đang học không còn khả dụng');
    assert.equal(state.currentHref, '/Study');
    assert.equal(state.currentLink, 'Chọn bài ở trang Học tập →');
    assert.equal(state.summary, 'Bài đang học không còn khả dụng.');

    setScenario({ progress: allDoneProgress, lessons });
    await navigate('/Index', 'ready');
    state = await readState();
    assert.equal(state.currentTitle, 'Bạn đã hoàn thành tất cả bài học');
    assert.equal(state.currentHref, '/Study');
    assert.equal(state.percent, '100%');
    assert.equal(state.completionBar, 100);
    assert.equal(state.recs.length, 0);
    assert.equal(state.recsEmptyHidden, false);
    assert.equal(state.recsEmpty, 'Bạn đã hoàn thành tất cả bài học hiện có.');

    setScenario({ progress: emptyProgress, lessons: [] });
    await navigate('/Index', 'ready');
    state = await readState();
    assert.equal(state.mode, 'empty');
    assert.equal(state.currentTitle, 'Chưa có bài học');
    assert.equal(state.currentLinkHidden, true);
    assert.equal(state.percent, '0%');
    assert.equal(state.completionMeta, 'Chưa có bài học để tính tiến độ.');
    assert.equal(state.recs.length, 0);
    assert.equal(state.recsEmpty, 'Chưa có bài học để gợi ý.');

    setScenario({ progress: { error: 'fixture failed' }, lessons, progressStatus: 500 });
    await navigate('/Index', 'error');
    state = await readState();
    assert.equal(state.errorHidden, false);
    assert.equal(state.readyHidden, true);
    assert.equal(state.streakHidden, true);
    assert.equal(state.errorTitle, 'Chưa tải được trang chủ');
    assert.equal(state.errorText, 'Không tải được tiến độ học tập. Vui lòng thử lại.');
    assert.equal(state.retryHidden, false);
    await screenshot('dashboard-error');
    setScenario({ progress: fullProgress, lessons });
    const beforeRetry = counts.progress;
    await run("document.querySelector('[data-dashboard-retry]').click()");
    await waitFor("document.querySelector('.home-page').dataset.dashboardState === 'ready'");
    state = await readState();
    assert.equal(state.totalXp, '1.250');
    assert.equal(state.errorHidden, true);
    assert.equal(counts.progress > beforeRetry, true);

    setScenario({ progress: null, lessons, progressFail: 'Failed' });
    await navigate('/Index', 'error');
    state = await readState();
    assert.equal(state.errorTitle, 'Chưa tải được trang chủ');
    assert.equal(state.errorText, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
    assert.equal(state.retryHidden, false);

    setScenario({
        progress: { error: 'Tài khoản không hoạt động.', code: 'profile_inactive' },
        lessons,
        progressStatus: 403
    });
    await navigate('/Index', 'error');
    state = await readState();
    assert.equal(state.errorTitle, 'Tài khoản không hoạt động');
    assert.equal(state.errorText, 'Tài khoản của bạn không hoạt động nên chưa thể tải tiến độ.');
    assert.equal(state.retryHidden, true);

    setScenario({ progress: fullProgress, lessons, progressDelay: 700, lessonsDelay: 700 });
    await navigate('/Index');
    await waitFor("document.querySelector('.home-page').dataset.dashboardState === 'loading'");
    await waitFor("!!window.__dashboardTest.authCb");
    for (let i = 0; i < 100 && (counts.progress < 1 || counts.lessons < 1); i++) await delay(20);
    assert.equal(counts.progress >= 1 && counts.lessons >= 1, true);
    setScenario({ progress: firstUseProgress, lessons });
    await run(`window.__dashboardTest.signIn(${JSON.stringify(userB)})`);
    await waitFor("document.querySelector('.home-page').dataset.dashboardState === 'ready'");
    state = await readState();
    assert.equal(state.mode, 'first-use');
    assert.equal(state.name, 'Trần Bảo');
    assert.equal(state.totalXp, '0');
    assert.equal(state.currentHref, '/Lesson/first-lesson');
    await delay(850);
    state = await readState();
    assert.equal(state.name, 'Trần Bảo');
    assert.equal(state.totalXp, '0');
    assert.equal(state.mode, 'first-use');

    assert.deepEqual(errors, []);
    setScenario({ progress: firstUseProgress, lessons });
    scenario.locked = lessons.slice(0, 3).map(item => item.lessonId);
    await navigate('/Index', 'ready');
    state = await readState();
    assert.equal(state.recs.length, 0);
    assert.equal(state.currentHref, '/Study');
    assert.equal(state.recsEmpty, 'Chưa có gợi ý khả dụng. Xem các bài học ở trang Học tập.');

    await run("window.__dashboardTest.authCb('SIGNED_OUT', null)");
    await waitFor("location.pathname === '/Account/Login'");

    setScenario({ progressStatus: 401, progress: { error: 'Unauthorized' }, lessons });
    await send('Page.navigate', { url: base + '/Index' });
    await waitFor("location.pathname === '/Account/Login'");
    await c.close();
    console.log('PASS: dashboard loading, real data, language switch, mobile layout, first-use, unavailable, completed, empty, error/retry, network, inactive and stale response handling.');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
