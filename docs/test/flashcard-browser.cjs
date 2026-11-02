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
        await run("document.querySelector('[data-card-toggle]').focus()");
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        assert(await run("document.querySelector('[data-card-side]').dataset.cardSide==='front'"));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
        assert(await run("document.querySelector('[data-card-side]').dataset.cardSide==='back'"));
        assert(await run("document.activeElement.matches('[data-card-toggle]')"), 'Native flip button retains focus');
        const ax = (await send('Accessibility.getFullAXTree')).nodes;
        assert(ax.some(node => !node.ignored && node.role?.value === 'heading' && node.name?.value === source[0].content));
        assert(ax.some(node => !node.ignored && node.role?.value === 'StaticText' && node.name?.value === source[0]['definition-vi']), 'Back content must remain exposed to assistive technology');
        for (const selector of ['.flashcard-card__content', '[data-rating=know]', '[data-rating=again]', '[data-action=next]']) {
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
            assert(await run(`document.activeElement.matches('${selector}') && getComputedStyle(document.activeElement).outlineStyle==='solid'`), 'Tab reaches the next available control: ' + selector);
        }
        const mousePoint = await run("(() => {const b=document.querySelector('[data-rating=know]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
        const rateBeforeMouse = await run("uiEvents.filter(e=>e.name==='rate').length");
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...mousePoint });
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...mousePoint });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...mousePoint });
        assert.equal(await run("uiEvents.filter(e=>e.name==='rate').length"), rateBeforeMouse + 1);
        assert(await run("document.querySelector('[data-rating=know]').getAttribute('aria-pressed')==='true' && getComputedStyle(document.querySelector('[data-rating=know]'),'::before').visibility==='visible'"), 'Selected choice has a non-color check indicator');
        await click('[data-rating="again"]');
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

        const other = { ...lesson, lessonId: 'other-lesson', name: 'Other lesson', contents: [{ ...source[0],
            content: 'Từ dài tiếng Việt '.repeat(100) + 'ChuoiKhongDauCach'.repeat(60),
            'definition-vi': 'Đáp án dài nhiều đoạn. '.repeat(100) + 'ChuoiKhongDauCach'.repeat(60),
            'definition-en': 'A long answer paragraph. '.repeat(100),
            examples: [{ term: 'A long example. '.repeat(60), translation: 'Ví dụ dài. '.repeat(60) }]
        }] };
        await navigate(other.lessonId, { status: 200, body: other });
        assert.equal(await run("document.querySelector('[data-card-term]').textContent"), other.contents[0].content);
        assert(await run("document.querySelector('[data-action=previous]').disabled && document.querySelector('[data-action=next]').disabled && document.querySelector('[data-pronunciation]').hidden"));
        assert(await run("[...document.querySelectorAll('[data-rating]')].every(b=>b.getAttribute('aria-pressed')==='false')"), 'Lessons must not share choices');
        for (const [width, height] of [[1440, 900], [1280, 800], [768, 1024], [390, 844], [320, 720], [844, 390], [568, 320]]) {
            await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: Math.min(width, height) < 600 });
            for (const theme of ['light', 'dark']) {
                for (const language of ['vi', 'en']) {
                    await run(`AppI18n.setTheme('${theme}',false);AppI18n.setLanguage('${language}',false)`);
                    assert(await run("[...document.querySelectorAll('.flashcard-page button,.flashcard-page a')].filter(b=>b.getClientRects().length).every(b=>{const r=b.getBoundingClientRect();return r.left>=5&&r.right<=innerWidth-5&&b.scrollWidth<=b.clientWidth+1})"), `Controls must fit: ${width}x${height} ${theme}/${language}`);
                }
            }
            assert(await run('document.documentElement.scrollWidth <= innerWidth'), 'Document overflow at ' + width);
            const before = await run("document.querySelector('[data-card-side]').getBoundingClientRect().height");
            assert(await run("document.querySelector('.flashcard-card__content').scrollHeight > document.querySelector('.flashcard-card__content').clientHeight"), 'Long content must remain scrollable');
            assert(await run("document.querySelector('.flashcard-card__content').scrollWidth<=document.querySelector('.flashcard-card__content').clientWidth+1"), 'Long front text must wrap inside the card');
            assert(await run("getComputedStyle(document.querySelector('.flashcard-card__content')).scrollbarWidth==='none'"), 'Scrollbar stays hidden by product request');
            assert(await run("document.querySelector('.flashcard-card__content').scrollTop=100;document.querySelector('.flashcard-card__content').scrollTop>0"), 'Long content must remain scrollable');
            assert.equal(await run("document.querySelector('[data-card-side]').getBoundingClientRect().height"), before);
            assert(await run("[...document.querySelectorAll('.flashcard-page button')].filter(b=>!b.disabled && !b.closest('[hidden]')).every(b=>b.getBoundingClientRect().height>=44)"), 'Touch targets should be at least 44px high');
            assert(await run("[...document.querySelectorAll('.flashcard-page button,.flashcard-page a')].filter(b=>b.getClientRects().length).every(b=>{const r=b.getBoundingClientRect();return r.left>=5&&r.right<=innerWidth-5})"), 'Controls and their focus rings must fit horizontally, not merely be clipped by the document');
            await run("document.querySelector('[data-card-toggle]').focus()");
            const tab = async shift => {
                await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 });
                await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 });
            };
            for (const selector of ['.flashcard-card__content', '[data-rating=know]', '[data-rating=again]']) {
                await tab(false);
                assert(await run(`document.activeElement.matches('${selector}') && getComputedStyle(document.activeElement).outlineStyle==='solid' && getComputedStyle(document.activeElement).outlineWidth==='3px'`), 'Real Tab navigation and visible focus: ' + selector);
                assert(await run("(() => {const e=document.activeElement;const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&e.contains(hit)})()"), 'Focused control must not be covered by sticky header or mobile navigation');
            }
            await tab(true);
            assert(await run("document.activeElement.matches('[data-rating=know]')"), 'Shift+Tab order');
            await tab(true);
            assert(await run("document.activeElement.matches('.flashcard-card__content')"));
            await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
            assert(await run("document.querySelector('.flashcard-card__content').scrollTop>100"), 'Keyboard must scroll long card content');
            await click('[data-card-side]');
            assert(await run("document.querySelector('.flashcard-card__content').scrollTop===0"), 'Flip should reset the content scroll position');
            assert(await run("document.querySelector('.flashcard-card__content').scrollHeight>document.querySelector('.flashcard-card__content').clientHeight && document.querySelector('.flashcard-card__content').scrollWidth<=document.querySelector('.flashcard-card__content').clientWidth+1"), 'Long answers must remain readable without horizontal overflow');
            assert(await run("document.querySelector('[data-definition-vi]').textContent.includes('ChuoiKhongDauCach') && document.querySelector('[data-definition-en]').textContent.startsWith('A long answer')"), 'Long back-side text must not be truncated');
            await click('[data-card-side]');
            assert.equal(await run("document.querySelector('[data-card-side]').getBoundingClientRect().height"), before);
        }
        await run("window.touchRateCount=0;document.querySelector('.flashcard-page').addEventListener('flashcard:rate',()=>window.touchRateCount++)");
        await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        const rateEventsBeforeTouch = await run('window.touchRateCount');
        const touchTarget = await run("(() => {const b=document.querySelector('[data-rating=again]');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchTarget] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true'"), 'Touch should activate the rating control once');
        assert.equal(await run('window.touchRateCount'), rateEventsBeforeTouch + 1, 'A touch should not trigger the rating twice');
        await run("window.touchFlipCount=0;document.querySelector('.flashcard-page').addEventListener('flashcard:flip',()=>window.touchFlipCount++)");
        const cardTarget = await run("(() => {const c=document.querySelector('.flashcard-card__content');document.querySelector('[data-card-side]').scrollIntoView({block:'center'});c.scrollTop=0;const r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.75,distance:r.height*.5}})()");
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cardTarget.x, y: cardTarget.y }] });
        for (let i = 1; i <= 6; i++) {
            await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cardTarget.x, y: cardTarget.y - cardTarget.distance * i / 6 }] });
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await wait("document.querySelector('.flashcard-card__content').scrollTop>0");
        assert.equal(await run('window.touchFlipCount'), 0, 'Swiping long content must not flip');
        const tapPoint = { x: cardTarget.x, y: cardTarget.y - cardTarget.distance / 2 };
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tapPoint] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await wait('window.touchFlipCount===1');
        assert.equal(await run('window.touchFlipCount'), 1, 'A card tap must flip once');
        await run("(() => {const c=document.querySelector('[data-card-side]');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,clientX:20,clientY:20}));c.dispatchEvent(new PointerEvent('pointercancel',{pointerId:99}));c.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))})()");
        assert.equal(await run('window.touchFlipCount'), 1, 'A cancelled gesture must not flip');
        await send('Emulation.setTouchEmulationEnabled', { enabled: false });

        for (const [term, definition] of [[source[0].content, other.contents[0]['definition-vi']], [other.contents[0].content, source[0]['definition-vi']], [source[0].content, source[0]['definition-vi']]]) {
            const variant = { ...other, contents: [{ ...source[0], content: term, 'definition-vi': definition }] };
            await navigate(other.lessonId, { status: 200, body: variant });
            for (const width of [320, 1440]) {
                await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 320 });
                const geometry = await run("({height:document.querySelector('[data-card-side]').offsetHeight,controls:document.querySelector('.flashcard-rating').offsetTop})");
                await click('[data-card-side]');
                assert.equal(await run("document.querySelector('[data-definition-vi]').textContent"), definition);
                assert.deepEqual(await run("({height:document.querySelector('[data-card-side]').offsetHeight,controls:document.querySelector('.flashcard-rating').offsetTop})"), geometry);
                assert(await run("document.querySelector('.flashcard-card__content').scrollWidth<=document.querySelector('.flashcard-card__content').clientWidth+1"));
                await click('[data-card-side]');
            }
        }
        for (const [view, response] of [['empty', { status: 200, body: { ...lesson, contents: [] } }], ['message', { status: 500, body: {} }], ['loading', { status: 200, body: lesson, delay: true }]]) {
            await navigate(lesson.lessonId, response, view);
            for (const width of [320, 768, 1440]) {
                await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width === 320 });
                assert(await run("[...document.querySelectorAll('.flashcard-page [data-view]:not([hidden]),.flashcard-page a,.flashcard-page button')].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})"), `${view} layout at ${width}`);
            }
            if (view === 'loading') { await releaseResponse(); await wait(visible('ready')); }
        }
        await navigate();
        await run("window.storageDescriptor=Object.getOwnPropertyDescriptor(window,'localStorage');Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('Storage unavailable')}});true");
        await click('[data-rating="again"]');
        await click('[data-action="next"]');
        await click('[data-rating="know"]');
        await click('[data-action="previous"]');
        assert(await run("document.querySelector('[data-rating=again]').getAttribute('aria-pressed')==='true'"));
        await run("Object.defineProperty(window,'localStorage',storageDescriptor);true");
        console.log('PASS: responsive viewports, focus ring, keyboard scrolling, fixed-size long content, blocked storage fallback');
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
