// Requires Node 22+ and Chrome with --remote-debugging-port=9347.
// Start the app first. No npm dependencies are required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.APP_URL || 'http://localhost:5347';
const debug = process.env.CHROME_DEBUG_URL || 'http://localhost:9347';
let nextId = 0;
async function connect() {
    const target = await (await fetch(debug + '/json/new?about:blank', { method: 'PUT' })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    const pending = new Map();
    const errors = [];
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (p) message.error ? p.reject(message.error) : p.resolve(message.result); }
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: '+method)); },15000);
        pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.bringToFront');
    await send('Network.enable');
    await send('Network.setCacheDisabled',{cacheDisabled:true});
    const close = async () => { socket.close(); await fetch(debug+'/json/close/'+target.id); };
    return { socket, send, evaluate, errors, close };
}
(async () => {
    const c = await connect();
    const { send, evaluate: run } = c;
    async function press(key,code,windowsVirtualKeyCode) {
        await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
        await new Promise(resolve=>setTimeout(resolve,50));
    }
    await send('Network.setCookie', { name: 'userToken', value: 'authenticated', url: base, path: '/' });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "sessionStorage.setItem('userToken','authenticated')" });
    async function navigate(path) {
        if(process.env.TRACE) console.log('Navigate '+path);
        await send('Page.navigate', { url: base + path });
        for (let i=0;i<100;i++) {
            await new Promise(r => setTimeout(r, 50));
            if (await run(`location.pathname === ${JSON.stringify(path)} && document.readyState === 'complete' && !!window.AppI18n`)) {
                await run('AppI18n.ready'); return;
            }
        }
        throw new Error('Navigation timed out: '+path);
    }
    const paths = ['/Index','/Study','/Ranking','/Account/Profile','/CreateQuiz','/TrialTest','/Account/Login','/Account/Signup','/Account/Authentication','/Account/ForgetPassword','/Account/ResetPassword','/Account/Terms'];
    const results=[];
    const issues=[];
    const untranslated=[];
    for(const width of [320,375,390,430,520,521,760,761,768,1000,1001,1280]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        for(const path of paths) {
            await navigate(path);
            for(const lang of ['vi','en']) for(const theme of ['light','dark']) {
                const result=await run(`(() => {
                    AppI18n.setLanguage('${lang}');
                    const geometry = () => [...document.querySelectorAll('main, main input, main button, main a, .site-nav, .app-preferences')].map(e => {const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});
                    const before = geometry();
                    AppI18n.setTheme('${theme}');
                    const shifted = JSON.stringify(before)!==JSON.stringify(geometry());
                    const missing = [...document.querySelectorAll('[data-i18n]')].filter(e => !AppI18n.t(e.dataset.i18n)).map(e=>e.dataset.i18n);
                    const viewport = document.documentElement.clientWidth;
                    const menu = document.querySelector('[data-preferences-menu]');
                    if(menu) menu.open = true;
                    const controls = [...document.querySelectorAll('[data-language-toggle], [data-theme-toggle]')];
                    const languageButton=document.querySelector('[data-language-toggle]');
                    const flag=[...languageButton.querySelectorAll('img')].find(e=>getComputedStyle(e).display!=='none');
                    const badFlag=!flag || !flag.complete || !flag.naturalWidth || new URL(flag.src).pathname.split('/').pop().split('.')[0]!==('${lang}'==='vi'?'vi':'gb');
                    const badControls = controls.filter(e => {const r=e.getBoundingClientRect();return r.width<44 || r.height<44 || r.left<0 || r.right>viewport+1}).map(e=>e.className);
                    const panel=menu?.querySelector('.preferences-menu__panel').getBoundingClientRect();
                    const badPanel=!!panel && (panel.left<0 || panel.right>viewport+1);
                    const misplaced = document.querySelectorAll('.app-preferences').length!==1 || !document.querySelector('.app-preferences')?.closest('header');
                    const overflow = Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)>viewport+1;
                    const outside = [...document.querySelectorAll('main *, .site-header *, .app-preferences *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && (r.right>viewport+1 || r.left < -1)}).slice(0,6).map(e=>e.className || e.tagName);
                    if(menu) menu.open = false;
                    return {missing,overflow,outside,shifted,badControls,badPanel,misplaced,badFlag};
                })()`);
                if(result.missing.length || result.overflow || result.shifted || result.badControls.length || result.badPanel || result.misplaced || result.badFlag) issues.push({path,width,lang,theme,...result});
                results.push({path,width,lang,theme});
            }
            if(width===1280) {
                const text=await run(`(() => {const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const found=[];while(w.nextNode()){const n=w.currentNode;if(!n.parentElement.closest('script,style,option') && n.parentElement.getClientRects().length && /[ăâđêôơưĂÂĐÊÔƠƯ\\u1ea0-\\u1ef9]/u.test(n.textContent))found.push(n.textContent.trim())}return found})()`);
                if(text.length) untranslated.push({path,text});
            }
        }
    }
    console.log(JSON.stringify({cases:results.length,issueCount:issues.length,issues:issues.slice(0,8),untranslated,exceptions:c.errors},null,2));
    if(process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
        await send('Emulation.setScrollbarsHidden',{hidden:true});
        for(const width of [320,768,1280]) for(const path of ['/Index','/Account/Login','/Account/Signup']) {
            await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
            await navigate(path);
            for(const lang of ['vi','en']) for(const theme of ['light','dark']) {
            await run(`AppI18n.setLanguage('${lang}');AppI18n.setTheme('${theme}')`);
            await new Promise(resolve=>setTimeout(resolve,250));
            const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
            fs.writeFileSync(process.env.SCREENSHOT_DIR+'/'+path.replaceAll('/','_')+'_'+width+'_'+lang+'_'+theme+'.png',Buffer.from(shot.data,'base64'));
            if(path==='/Index' && lang==='en' && theme==='dark') {
                await run("document.querySelector('[data-preferences-menu]').open=true");
                const menuShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
                fs.writeFileSync(process.env.SCREENSHOT_DIR+'/_PreferencesMenu_'+width+'.png',Buffer.from(menuShot.data,'base64'));
                await run("document.querySelector('[data-preferences-menu]').open=false");
            }
            }
        }
        await send('Emulation.setScrollbarsHidden',{hidden:false});
    }
    // Every existing reveal control keeps icons, values and translated labels in sync.
    for(const path of ['/Account/Login','/Account/Signup','/Account/ResetPassword']) {
        await navigate(path);
        for(const lang of ['vi','en']) for(const theme of ['light','dark']) {
            assert(await run(`(() => {
                AppI18n.setLanguage('${lang}');AppI18n.setTheme('${theme}');
                const button=document.querySelector('.password-toggle');
                const inputs=button.getAttribute('aria-controls').split(' ').map(id=>document.getElementById(id));
                inputs.forEach(input=>{input.value='Preview123!';input.type='password'});
                button.click();
                const shown=inputs.every(input=>input.type==='text' && input.value==='Preview123!') && button.getAttribute('aria-pressed')==='true' && getComputedStyle(button.querySelector('.password-toggle__eye-off')).display!=='none';
                button.click();
                const hidden=inputs.every(input=>input.type==='password' && input.value==='Preview123!') && button.getAttribute('aria-pressed')==='false' && getComputedStyle(button.querySelector('.password-toggle__eye-off')).display==='none';
                return shown && hidden && button.querySelectorAll('svg').length===2 && !button.textContent.trim() && !button.hasAttribute('data-i18n');
            })()`));
        }
        await run("document.querySelector('.password-toggle').focus()");
        await press('Enter','Enter',13);
        assert(await run("document.querySelector('.password-toggle').getAttribute('aria-pressed')==='true' && document.querySelector('.password-toggle').getAttribute('aria-label')===AppI18n.t('ui.hide_password')"));
        await press('Enter','Enter',13);
        assert(await run("document.querySelector('.password-toggle').getAttribute('aria-pressed')==='false'"));
    }
    await navigate('/Account/Login');
    for(const lang of ['vi','en']) {
        assert(await run(`(() => {AppI18n.setLanguage('${lang}');const p=document.querySelector('.auth-layout--login .auth-layout__text');const range=document.createRange();range.selectNodeContents(p);return range.getClientRects().length===1 && p.scrollWidth<=p.clientWidth+1})()`),'Login caption should fit on one line on desktop');
    }
    // Form/quiz identity, focus and selection must survive toggles.
    await navigate('/CreateQuiz');
    assert(await run(`(() => {const input=document.querySelector('[name=quizTitle]');input.value='My draft';input.focus();input.setSelectionRange(2,4);const topic=document.querySelector('[name=quizTopic]');const value=topic.value;AppI18n.setLanguage('en');AppI18n.setTheme('dark');return input===document.querySelector('[name=quizTitle]') && input.value==='My draft' && input.selectionStart===2 && document.activeElement===input && topic.value===value})()`));
    await navigate('/TrialTest');
    assert(await run(`(() => {const input=document.querySelector('[value=have]');input.checked=true;const q=document.querySelector('.trial-question').textContent;AppI18n.setLanguage('vi');AppI18n.setTheme('light');return input.checked && q===document.querySelector('.trial-question').textContent})()`));
    await run("document.querySelector('[data-language-toggle]').click();document.querySelector('[data-theme-toggle]').click()");
    await navigate('/Account/Profile');
    assert(await run("document.documentElement.lang==='en' && document.documentElement.dataset.theme==='dark'"));
    await send('Page.reload');
    await new Promise(r=>setTimeout(r,700)); await run('AppI18n.ready');
    assert(await run("AppI18n.language==='en' && AppI18n.theme==='dark'"));
    assert(await run("document.querySelector('[data-theme-toggle]').getAttribute('aria-pressed')==='true'"));
    // Native details supports the keyboard; Escape returns focus, outside click dismisses.
    await run("document.querySelector('[data-preferences-menu] summary').focus()");
    await press('Enter','Enter',13);
    assert(await run("document.querySelector('[data-preferences-menu]').open"));
    await press('Escape','Escape',27);
    assert(await run("!document.querySelector('[data-preferences-menu]').open && document.activeElement.matches('summary')"));
    await run("document.querySelector('[data-preferences-menu]').open=true;document.querySelector('main').click()");
    assert(await run("!document.querySelector('[data-preferences-menu]').open"));
    await run("document.querySelector('[data-preferences-menu]').open=true;document.querySelector('[data-theme-toggle]').focus()");
    await press('Enter','Enter',13);
    assert(await run("AppI18n.theme==='light' && AppI18n.language==='en' && document.querySelector('[data-theme-toggle]').getAttribute('aria-pressed')==='false'"));
    await run("document.querySelector('[data-language-toggle]').focus()");
    await press('Enter','Enter',13);
    assert(await run("AppI18n.language==='vi' && AppI18n.theme==='light' && document.querySelector('[data-language-toggle]').getAttribute('aria-label')===AppI18n.t('settings.switch_to_en')"));
    await press('Enter','Enter',13);
    assert(await run("AppI18n.language==='en' && AppI18n.theme==='light' && localStorage.getItem('se347.language')==='en'"));
    // Unknown DOM keys retain their supplied readable fallback; t never leaks a key.
    assert(await run(`(() => {const e=document.createElement('span');e.textContent='Readable fallback';AppI18n.setText(e,'unknown.key');return e.textContent==='Readable fallback' && AppI18n.t('unknown.key')===''})()`));
    // Existing validation messages and password controls react without changing values.
    await navigate('/Account/Signup');
    await run("document.querySelector('.account-form').requestSubmit();AppI18n.setLanguage('en')");
    assert(await run("document.querySelector('.field-error').textContent==='Please fill out this field.' && !!document.querySelector('#terms-error')"));
    await run("document.querySelector('#password').value='Example123!';document.querySelector('#password').dispatchEvent(new Event('input'));document.querySelector('#signupPasswordToggle').click();AppI18n.setLanguage('vi')");
    assert(await run("document.querySelector('#password').value==='Example123!' && document.querySelector('#password').type==='text' && document.querySelector('#signupPasswordToggle').getAttribute('aria-label')===AppI18n.t('ui.hide_password')"));
    // Late-added nodes and translated attributes use the current language.
    assert(await run(`(() => {const e=document.createElement('input');e.dataset.i18nPlaceholder='ui.password';document.body.append(e);AppI18n.translate(e);return e.placeholder===AppI18n.t('ui.password')})()`));
    // A second tab receives actual storage events.
    const second=await connect();
    await second.send('Page.navigate',{url:base+'/Account/Login'});
    await new Promise(r=>setTimeout(r,700));await second.evaluate('AppI18n.ready');
    await run("AppI18n.setLanguage('vi');AppI18n.setTheme('light')");
    await new Promise(r=>setTimeout(r,100));
    assert(await second.evaluate("AppI18n.language==='vi' && AppI18n.theme==='light'"));
    await second.close();
    const failure=await connect();
    await failure.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.fetch=()=>Promise.reject(new Error('fixture: offline'));Object.defineProperty(window,'localStorage',{get(){throw new Error('fixture: storage blocked')}})"});
    await failure.send('Page.navigate',{url:base+'/Account/Login'});
    await new Promise(r=>setTimeout(r,700));await failure.evaluate('AppI18n.ready');
    assert(await failure.evaluate(`(() => {AppI18n.setLanguage('en');AppI18n.setTheme('dark');const e=document.createElement('p');AppI18n.setText(e,'unknown.key');return e.textContent==='Please try again.' && AppI18n.theme==='dark' && document.querySelector('#password')!==null})()`));
    assert.equal(failure.errors.length,0); await failure.close();
    await c.close();
    assert.equal(issues.length,0,'Layout or translation issues');
    assert.equal(c.errors.length,0,'Browser exceptions');
    console.log('PASS: matrix, form identity, quiz state, controls, reload, navigation, fallback and cross-tab sync.');
})().catch(e=>{console.error(e);process.exit(1)});
