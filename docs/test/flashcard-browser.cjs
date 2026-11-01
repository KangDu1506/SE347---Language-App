// Node 22+, running app, Chrome --remote-debugging-port=9347.
// UI contract tests: lesson responses and Supabase session are isolated fixtures,
// not an end-to-end test of authentication or progress persistence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.APP_URL || 'http://localhost:5347';
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9347';
const root = path.resolve(__dirname, '../..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'Storage/LessonTemplate/at-the-coffee-shop/content.json'), 'utf8'));
const lesson = { lessonId: 'at-the-coffee-shop', name: 'At the coffee shop', contents: source };

(async () => {
    const target = await (await fetch(debug + '/json/new?about:blank', { method: 'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let nextId = 0;
    const pending = new Map();
    const errors = [];
    const requests = [];
    let scenario = { status: 200, body: lesson };
    let releaseResponse;
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
        pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const fulfill = (requestId, status, body, type = 'application/json', sessionId) => send('Fetch.fulfillRequest', {
        requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: type }],
        body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64')
    }, sessionId);
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id) {
            const item = pending.get(message.id);
            pending.delete(message.id);
            if (item) message.error ? item.reject(message.error) : item.resolve(message.result);
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(JSON.stringify(message.params.args));
        if (message.method === 'Fetch.requestPaused') {
            const { requestId, request } = message.params;
            const reply = (status, body, type) => fulfill(requestId, status, body, type, message.sessionId);
            let task;
            if (request.url.includes('/api/')) {
                requests.push({ method: request.method, url: request.url });
                const response = { ...scenario };
                if (response.networkError) task = send('Fetch.failRequest', { requestId, errorReason: 'ConnectionFailed' }, message.sessionId);
                else if (response.delay) releaseResponse = () => reply(response.status, response.body);
                else task = reply(response.status, response.body);
            } else if (request.url.includes('/js/supabase-client')) {
                task = reply(200, `window.testUser='flashcard-ui-test-a';window.sb={auth:{getSession:async()=>({data:{session:{user:{id:window.testUser}}}}),onAuthStateChange:callback=>{window.authChange=callback;return {data:{subscription:{unsubscribe(){}}}}}}};`, 'text/javascript');
            } else task = reply(200, '', request.url.includes('fonts.googleapis') ? 'text/css' : 'text/javascript');
            task?.catch(error => errors.push(String(error)));
        }
    });
    const run = async (expression, sessionId) => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const wait = async (expression, sessionId) => {
        for (let i = 0; i < 150; i++) {
            if (await run(expression, sessionId)) return;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        throw new Error('Timed out: ' + expression);
    };
    const visible = view => `!!document.querySelector('[data-view="${view}"]:not([hidden])')`;
    const click = (selector, sessionId) => run(`document.querySelector(${JSON.stringify(selector)}).click()`, sessionId);
    const patterns = [
        { urlPattern: '*://*/api/*' }, { urlPattern: '*/js/supabase-client*' },
        { urlPattern: 'https://cdn.jsdelivr.net/*' }, { urlPattern: 'https://fonts.googleapis.com/*' }
    ];
    let peerId;
    const navigate = async (id = lesson.lessonId, response = { status: 200, body: lesson }, view = 'ready') => {
        scenario = response;
        await send('Page.navigate', { url: base + '/Flashcard/' + id });
        await wait(`location.pathname === '/Flashcard/${id}' && ${visible(view)} && !!window.AppI18n`);
        await run('AppI18n.ready');
    };
    try {
        await send('Runtime.enable');
        await send('Page.enable');
        await send('Fetch.enable', { patterns });
        const beforePreview = requests.length;
        await send('Page.navigate', { url: base + '/Flashcard/' + lesson.lessonId + '?preview=1' });
        await wait(visible('ready'));
        assert(await run("!!document.querySelector('[data-preview-lesson]') && !!document.querySelector('.flashcard-preview')"));
        assert.equal(await run("document.querySelector('[data-card-term]').textContent"), source[0].content);
        assert(await run("!document.querySelector('[data-action=flip]')"), 'Standalone flip button removed');
        await send('DOM.enable');
        await send('CSS.enable');
        const documentNode = (await send('DOM.getDocument')).root.nodeId;
        const cardNode = (await send('DOM.querySelector', { nodeId: documentNode, selector: '[data-card-side]' })).nodeId;
        await send('CSS.forcePseudoState', { nodeId: cardNode, forcedPseudoClasses: ['hover'] });
        await wait("getComputedStyle(document.querySelector('[data-card-side]')).transform!=='none'");
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await wait("getComputedStyle(document.querySelector('[data-card-side]')).transform==='none'");
        assert(await run("getComputedStyle(document.querySelector('[data-card-side]')).transitionDuration==='0s'"));
        await send('CSS.forcePseudoState', { nodeId: cardNode, forcedPseudoClasses: [] });
        await send('Emulation.setEmulatedMedia', { features: [] });
        console.log('PASS: standalone flip removed, hover feedback and reduced motion');
        await click('[data-card-side]');
        assert.equal(await run("document.querySelector('[data-definition-vi]').textContent"), source[0]['definition-vi']);
        await click('[data-rating="know"]');
        assert.equal(requests.length, beforePreview, 'Local preview must not request API data');
        console.log('PASS: Development preview renders real lesson without auth/API');
        await navigate();
        await run("Object.keys(localStorage).filter(key=>key.startsWith('se347.flashcard.rating.v1:user%3Aflashcard-ui-test-')).forEach(key=>localStorage.removeItem(key))");
        await navigate();
        assert(await run("[...document.querySelectorAll('[data-rating]')].every(b=>b.getAttribute('aria-pressed')==='false')"), 'Preview must not share account choices');
        assert.equal(await run("document.querySelector('[data-card-term]').textContent"), source[0].content);
        assert(await run("document.querySelector('[data-action=previous]').disabled && document.querySelector('[data-card-back]').hidden"));
        await run("window.uiEvents=[]; ['rate','flip','change'].forEach(name=>document.addEventListener('flashcard:'+name,e=>uiEvents.push({name,...e.detail})))");
        await click('[data-card-side]');
        assert(await run("!document.querySelector('[data-card-back]').hidden"));
        assert.equal(await run("document.querySelector('[data-definition-vi]').textContent"), source[0]['definition-vi']);
        await click('[data-rating="know"]');
        assert(await run("document.querySelector('[data-rating=know]').getAttribute('aria-pressed')==='true' && uiEvents.at(-1).contentId==='1' && uiEvents.at(-1).rating==='know'"));
        await click('[data-rating="again"]');
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true' && document.querySelector('[data-rating=know]').getAttribute('aria-pressed')==='false'"));
        await click('[data-action="next"]');
        assert.equal(await run("document.querySelector('[data-card-term]').textContent"), source[1].content);
        assert(await run("document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')==='2' && document.querySelector('[data-card-back]').hidden"));
        await click('[data-action="previous"]');
        assert.equal(await run("document.querySelector('[data-card-term]').textContent"), source[0].content);
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true'"), 'Restore per-card rating');
        const geometry = await run("({height:document.querySelector('[data-card-side]').getBoundingClientRect().height,controls:document.querySelector('.flashcard-navigation').getBoundingClientRect().top})");
        await click('[data-card-term]');
        assert(await run("document.querySelector('[data-card-side]').dataset.cardSide==='back'"), 'Click card to flip');
        assert.deepEqual(await run("({height:document.querySelector('[data-card-side]').getBoundingClientRect().height,controls:document.querySelector('.flashcard-navigation').getBoundingClientRect().top})"), geometry);
        await run("document.querySelector('[data-card-side]').focus()");
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        assert(await run("document.querySelector('[data-card-side]').dataset.cardSide==='front'"));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        assert(await run("document.querySelector('[data-card-side]').dataset.cardSide==='back'"));
        await navigate();
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true'"), 'Restore after page reload');

        peerId = (await send('Target.createTarget', { url: 'about:blank' })).targetId;
        const peer = (await send('Target.attachToTarget', { targetId: peerId, flatten: true })).sessionId;
        await send('Runtime.enable', {}, peer);
        await send('Page.enable', {}, peer);
        await send('Fetch.enable', { patterns }, peer);
        await send('Page.navigate', { url: base + '/Flashcard/' + lesson.lessonId }, peer);
        await wait(visible('ready'), peer);
        await run('window.rateEvents=0;document.addEventListener("flashcard:rate",()=>rateEvents++)', peer);
        await click('[data-rating="know"]');
        await wait("document.querySelector('[data-rating=know]').getAttribute('aria-pressed')==='true'", peer);
        assert.equal(await run('rateEvents', peer), 0, 'Sync must not emit a user rate event');
        await click('[data-action="next"]', peer);
        await click('[data-rating="again"]', peer);
        await click('[data-action="next"]');
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true'"));
        await click('[data-action="previous"]');
        assert(await run("document.querySelector('[data-rating=know]').getAttribute('aria-pressed')==='true'"), 'Different card writes must not overwrite each other');
        await run("localStorage.removeItem('se347.flashcard.rating.v1:user%3Aflashcard-ui-test-a:at-the-coffee-shop:1')", peer);
        await wait("document.querySelector('[data-rating=know]').getAttribute('aria-pressed')==='false'");
        await click('[data-rating="again"]');
        await run("window.testUser='flashcard-ui-test-b';authChange('SIGNED_IN',{user:{id:testUser}})");
        await wait(visible('ready'));
        assert(await run("[...document.querySelectorAll('[data-rating]')].every(b=>b.getAttribute('aria-pressed')==='false')"), 'Accounts must not share choices');
        await click('[data-rating="know"]');
        await run("window.testUser='flashcard-ui-test-a';authChange('SIGNED_IN',{user:{id:testUser}})");
        await wait(visible('ready'));
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true'"));
        await send('Target.closeTarget', { targetId: peerId });
        peerId = null;
        console.log('PASS: click/keyboard flip, stable geometry, per-card persistence, real cross-tab sync, account isolation');
        for (let i = 0; i < source.length + 1; i++) await click('[data-action="next"]');
        assert(await run(`document.querySelector('[data-action=next]').disabled && document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')==='${source.length}'`));
        await run("AppI18n.setLanguage('en');AppI18n.setTheme('dark')");
        assert.equal(await run("document.querySelector('[data-card-count]').textContent"), `Card ${source.length} / ${source.length}`);
        assert(await run("document.querySelector('[data-back-to-lesson]').getAttribute('href')==='/Lesson/at-the-coffee-shop'"));
        console.log('PASS: real lesson content, flip, rating events, navigation bounds, position, language/theme, lesson link');

        await navigate(lesson.lessonId, { status: 200, body: { ...lesson, contents: [] } }, 'empty');
        assert(await run("document.querySelector('[data-view=ready]').hidden"));
        await navigate(lesson.lessonId, { status: 200, body: lesson, delay: true }, 'loading');
        await wait('document.readyState === "complete"');
        assert(await run("document.querySelector('[data-view=ready]').hidden && document.querySelector('[data-view=loading]').getAttribute('aria-busy')==='true'"));
        await releaseResponse();
        await wait(visible('ready'));
        console.log('PASS: empty and delayed loading');

        for (const body of [null, { ...lesson, contents: null }, { ...lesson, lessonId: 'another-lesson' },
            { ...lesson, contents: [{ ...source[0], content: '' }] }, { ...lesson, contents: [source[0], source[0]] }]) {
            await navigate(lesson.lessonId, { status: 200, body }, 'message');
            assert(await run("document.querySelector('[data-message-text]').dataset.i18n==='flashcard.invalid_data' && !document.querySelector('[data-action=retry]').hidden"));
        }
        for (const status of [400, 404, 403, 500]) {
            await navigate(lesson.lessonId, { status, body: { code: status === 403 ? 'lesson_locked' : '' } }, 'message');
            assert.equal(await run("document.querySelector('[data-action=retry]').hidden"), status !== 500);
        }
        scenario = { status: 200, body: lesson };
        await click('[data-action="retry"]');
        await wait(visible('ready'));
        await navigate(lesson.lessonId, { networkError: true }, 'message');
        assert(await run("document.querySelector('[data-message-text]').dataset.i18n==='lesson.network_text' && !document.querySelector('[data-action=retry]').hidden"));
        await navigate(lesson.lessonId, { status: 403, body: { code: 'profile_inactive' } }, 'message');
        assert(await run("document.querySelector('[data-message-title]').dataset.i18n==='lesson.inactive_title'"));
        console.log('PASS: invalid payload, mismatched lesson, duplicate IDs, HTTP errors, retry, inactive profile');

        const other = { ...lesson, lessonId: 'other-lesson', name: 'Other lesson', contents: [{ ...source[0], content: 'Long content '.repeat(100) }] };
        await navigate(other.lessonId, { status: 200, body: other });
        assert.equal(await run("document.querySelector('[data-card-term]').textContent"), other.contents[0].content);
        assert(await run("document.querySelector('[data-action=previous]').disabled && document.querySelector('[data-action=next]').disabled && document.querySelector('[data-pronunciation]').hidden"));
        assert(await run("[...document.querySelectorAll('[data-rating]')].every(b=>b.getAttribute('aria-pressed')==='false')"), 'Lessons must not share choices');
        for (const width of [375, 1280]) {
            await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
            assert(await run('document.documentElement.scrollWidth <= innerWidth'), 'Document overflow at ' + width);
            const before = await run("document.querySelector('[data-card-side]').getBoundingClientRect().height");
            await click('[data-card-side]');
            assert.equal(await run("document.querySelector('[data-card-side]').getBoundingClientRect().height"), before);
            assert(await run("document.querySelector('.flashcard-card__content').scrollHeight > document.querySelector('.flashcard-card__content').clientHeight"), 'Long content must remain scrollable');
            assert(await run("getComputedStyle(document.querySelector('.flashcard-card__content')).scrollbarWidth==='none'"), 'Scrollbar hidden');
            assert(await run("document.querySelector('.flashcard-card__content').scrollTop=100;document.querySelector('.flashcard-card__content').scrollTop>0"), 'Hidden scrollbar still allows scrolling');
        }
        await navigate();
        await run("window.storageDescriptor=Object.getOwnPropertyDescriptor(window,'localStorage');Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('Storage unavailable')}});true");
        await click('[data-rating="again"]');
        await click('[data-action="next"]');
        await click('[data-rating="know"]');
        await click('[data-action="previous"]');
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true'"));
        await run("Object.defineProperty(window,'localStorage',storageDescriptor);true");
        console.log('PASS: preview/lesson isolation, fixed-size scrollable long content, blocked storage fallback');
        scenario = { status: 200, body: { ...lesson, quiz: [] } };
        await send('Page.navigate', { url: base + '/Lesson/' + lesson.lessonId });
        await wait("!!document.querySelector('[data-state=ready]:not([hidden])')");
        assert.equal(await run("document.querySelector('[data-action=review]').getAttribute('href')"), '/Flashcard/' + lesson.lessonId);
        assert.equal(await run("document.querySelector('[data-field=content]').textContent"), source[0].content);
        await click('[data-action="review"]');
        await wait(visible('ready'));
        assert.equal(await run('location.pathname'), '/Flashcard/' + lesson.lessonId);
        assert.equal(requests.filter(request => request.method === 'POST' && !request.url.endsWith('/open')).length, 0);
        assert.deepEqual(errors, []);
        console.log('PASS: lesson switch, single card, long content, static lesson/review entry, no progress writes, no JS errors');
    } finally {
        if (peerId) await send('Target.closeTarget', { targetId: peerId });
        socket.close();
        await fetch(debug + '/json/close/' + target.id);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
