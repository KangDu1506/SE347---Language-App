// Standalone contract tests for the SCRUM-76 browser adapters (no new npm dependency).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

class TestEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}
class Target {
    listeners = new Map();
    addEventListener(type, callback) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]); }
    async dispatchEvent(event) {
        await Promise.all((this.listeners.get(event.type) ?? []).map(callback => callback(event)));
        return true;
    }
}

function loadScript(file, context) {
    vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

async function main() {
    const mappedContext = { window: {}, Object, Array, Set };
    loadScript('wwwroot/js/flashcard-data.js', mappedContext);
    const dto = { lessonId: 'sample-lesson', name: 'Sample', category: 'vocabulary', quiz: [], contents: [
        { id: 'word-1', content: 'hello', 'definition-en': 'a greeting', 'definition-vi': 'xin chào', image: '/api/media.png', examples: [{ term: 'Hello!', translation: 'Xin chào!' }] },
        { id: 'bad', content: '', 'definition-en': 'missing front', 'definition-vi': 'mặt sau' },
        { id: 'word-1', content: 'duplicate', 'definition-en': 'duplicate', 'definition-vi': 'duplicate' },
        null
    ] };
    const mapped = mappedContext.window.FlashcardData.mapLesson(dto, dto.lessonId);
    assert.equal(mapped.contents.length, 1, 'mapper skips invalid and duplicate content');
    assert.equal(mapped.contents[0].id, 'word-1');
    assert.equal(mapped.contents[0].image, '/api/media.png');
    assert.equal(mapped.contents[0].examples[0].translation, 'Xin chào!');
    assert.equal(dto.contents[0].image, '/api/media.png', 'mapper does not mutate API DTO');
    assert.equal(mappedContext.window.FlashcardData.mapLesson({ ...dto, contents: [] }, dto.lessonId).contents.length, 0);
    assert.equal(mappedContext.window.FlashcardData.mapLesson(dto, 'another-lesson'), null);

    const document = new Target();
    const page = new Target();
    document.querySelector = () => page;
    const calls = [];
    let failNextContentWrite = false;
    page.flashcardSession = null;
    page.querySelector = () => page;
    const progress = { lessonId: 'sample-lesson', status: 'not_started', completedContentIds: [] };
    const api = {
        async get(url) { calls.push(['GET', url]); return progress; },
        async post(url) {
            calls.push(['POST', url]);
            if (failNextContentWrite && url.includes('/contents/')) {
                failNextContentWrite = false;
                throw { status: 0, message: 'Network error' };
            }
            return progress;
        }
    };
    const window = { AppApi: api };
    const context = { document, window, console: { warn() {}, error() {} }, CustomEvent: TestEvent,
        encodeURIComponent, Array, Set, Object, Number, String };
    loadScript('wwwroot/js/flashcard-progress.js', context);
    await document.dispatchEvent(new TestEvent('DOMContentLoaded'));

    const session = { lessonId: 'sample-lesson', sessionId: 'session-1', contentIds: ['word-1', 'word-2'], hasQuiz: false, preview: false };
    page.flashcardSession = session;
    await page.dispatchEvent(new TestEvent('flashcard:session-ready', { detail: session }));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.slice(0, 2), [
        ['GET', '/api/progress/lessons/sample-lesson'],
        ['POST', '/api/progress/lessons/sample-lesson/open']
    ]);

    const states = [];
    page.addEventListener('flashcard:completion-state', event => states.push(event.detail));
    await page.dispatchEvent(new TestEvent('flashcard:session-complete', { detail: { lessonId: 'sample-lesson', sessionId: 'session-1' } }));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls.slice(2), [
        ['POST', '/api/progress/lessons/sample-lesson/contents/word-1/complete'],
        ['POST', '/api/progress/lessons/sample-lesson/contents/word-2/complete'],
        ['POST', '/api/progress/lessons/sample-lesson/complete']
    ]);
    assert.deepEqual(states.map(state => [state.phase, state.persistence, state.revision]),
        [['saving', 'pending', 1], ['completed', 'saved', 2]]);
    const afterFirstCompletion = calls.length;
    await page.dispatchEvent(new TestEvent('flashcard:session-complete', { detail: { lessonId: 'sample-lesson', sessionId: 'session-1' } }));
    assert.equal(calls.length, afterFirstCompletion, 'duplicate finish events do not repeat persistence');

    page.flashcardSession = { ...session, sessionId: 'session-2', hasQuiz: true };
    await page.dispatchEvent(new TestEvent('flashcard:session-ready', { detail: page.flashcardSession }));
    await new Promise(resolve => setImmediate(resolve));
    const beforeQuizCompletion = calls.length;
    await page.dispatchEvent(new TestEvent('flashcard:session-complete', { detail: { lessonId: 'sample-lesson', sessionId: 'session-2' } }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.slice(beforeQuizCompletion).some(([, url]) => url === '/api/progress/lessons/sample-lesson/complete'), false,
        'quiz lessons are not completed through the no-quiz endpoint');

    page.flashcardSession = { ...session, sessionId: 'session-3' };
    await page.dispatchEvent(new TestEvent('flashcard:session-ready', { detail: page.flashcardSession }));
    await new Promise(resolve => setImmediate(resolve));
    failNextContentWrite = true;
    await page.dispatchEvent(new TestEvent('flashcard:session-complete', { detail: { lessonId: 'sample-lesson', sessionId: 'session-3' } }));
    for (let i = 0; i < 10 && states.at(-1)?.phase !== 'error'; i++) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([states.at(-1).phase, states.at(-1).persistence, states.at(-1).canRetry, states.at(-1).revision],
        ['error', 'failed', true, 2]);
    const retryRevision = states.at(-1).revision;
    await new Promise(resolve => setImmediate(resolve));
    await page.dispatchEvent(new TestEvent('flashcard:completion-retry', { detail: {
        lessonId: 'sample-lesson', sessionId: 'session-3', revision: retryRevision
    } }));
    for (let i = 0; i < 10 && states.at(-1)?.phase !== 'completed'; i++) await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([states.at(-1).phase, states.at(-1).persistence, states.at(-1).revision], ['completed', 'saved', 4]);

    console.log('PASS: lesson DTO mapper, progress open/read, completion success/retry, revision, and quiz guard');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
