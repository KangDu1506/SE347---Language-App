// SCRUM-76: coordinates real progress API calls for Flashcard sessions.
document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.flashcard-page');
    if (!page || !window.AppApi) return;

    const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    let current = null;
    let openSessionId = null;
    const message = key => window.AppI18n?.t(key) || 'ChÆ°a thá»ƒ Ä‘á»“ng bá»™ tiáº¿n Ä‘á»™ bÃ i há»c. Báº¡n váº«n cÃ³ thá»ƒ tiáº¿p tá»¥c Ã´n táº­p.';

    const emitState = (session, revision, phase, persistence, extra = {}) => {
        if (current?.session.sessionId !== session.sessionId || page.flashcardSession?.sessionId !== session.sessionId) return;
        page.dispatchEvent(new CustomEvent('flashcard:completion-state', { bubbles: true,
            detail: { lessonId: session.lessonId, sessionId: session.sessionId, revision, phase, persistence, ...extra } }));
    };

    async function startSession(session) {
        if (!session || session.preview || !slug.test(session.lessonId) || !Array.isArray(session.contentIds)
            || !session.contentIds.length || session.contentIds.some(id => typeof id !== 'string' || !id.trim())) return;
        const context = { session, revision: 0, completionPromise: null, progress: null, completed: false };
        current = context;

        const progressTask = window.AppApi.get(`/api/progress/lessons/${encodeURIComponent(session.lessonId)}`)
            .then(progress => {
                if (current === context && page.flashcardSession?.sessionId === session.sessionId) context.progress = progress;
                return progress;
            });
        if (openSessionId !== session.sessionId) {
            openSessionId = session.sessionId;
            window.AppApi.post(`/api/progress/lessons/${encodeURIComponent(session.lessonId)}/open`).catch(error => {
                if (current !== context) return;
                console.warn('Flashcard lesson-open progress request failed.', error);
                if (error.status !== 401) window.AppToast?.warning(message('flashcard.progress_open_error'));
            });
        }
        // Lesson content remains usable if the optional progress read is temporarily unavailable.
        progressTask.catch(error => {
            if (current === context) console.warn('Flashcard lesson-progress request failed.', error);
        });
    }

    async function persistCompletion(context) {
        const { session } = context;
        emitState(session, ++context.revision, 'saving', 'pending');
        try {
            // The server owns XP/idempotency. A failed progress read only means requests may
            // be repeated; the content endpoint is idempotent for an already completed item.
            const prior = context.progress ?? await window.AppApi.get(`/api/progress/lessons/${encodeURIComponent(session.lessonId)}`);
            if (current !== context || page.flashcardSession?.sessionId !== session.sessionId) return;
            const completed = new Set(Array.isArray(prior?.completedContentIds) ? prior.completedContentIds : []);
            let result = prior;
            for (const contentId of session.contentIds) {
                if (completed.has(contentId)) continue;
                result = await window.AppApi.post(`/api/progress/lessons/${encodeURIComponent(session.lessonId)}/contents/${encodeURIComponent(contentId)}/complete`);
                if (current !== context || page.flashcardSession?.sessionId !== session.sessionId) return;
                completed.add(contentId);
                context.progress = result;
            }

            // Flashcard sessions can finish a lesson without a quiz. Lessons with quizzes
            // must use the quiz submit flow to become lesson-complete.
            if (!session.hasQuiz) {
                result = await window.AppApi.post(`/api/progress/lessons/${encodeURIComponent(session.lessonId)}/complete`);
                if (current !== context || page.flashcardSession?.sessionId !== session.sessionId) return;
                context.progress = result;
            }
            context.completed = true;
            emitState(session, ++context.revision, 'completed', 'saved');
        } catch (error) {
            if (current !== context || page.flashcardSession?.sessionId !== session.sessionId) return;
            console.error('Flashcard completion could not be saved.', error);
            emitState(session, ++context.revision, 'error', 'failed', { canRetry: true });
        }
    }

    function requestCompletion(event) {
        const session = current?.session;
        const detail = event.detail;
        if (!session || current.completed || current.completionPromise || detail?.lessonId !== session.lessonId
            || detail?.sessionId !== session.sessionId || page.flashcardSession?.sessionId !== session.sessionId) return;
        const context = current;
        context.completionPromise = persistCompletion(context).finally(() => {
            if (current === context) context.completionPromise = null;
        });
    }

    page.addEventListener('flashcard:session-ready', event => { void startSession(event.detail); });
    // SCRUM-77 emits this only after its own full-deck completion rule is satisfied.
    page.addEventListener('flashcard:session-complete', requestCompletion);
    page.addEventListener('flashcard:completion-retry', event => {
        const session = current?.session;
        if (!session || current.completionPromise || event.detail?.lessonId !== session.lessonId
            || event.detail?.sessionId !== session.sessionId || event.detail?.revision !== current.revision) return;
        requestCompletion({ detail: { lessonId: session.lessonId, sessionId: session.sessionId } });
    });
});
