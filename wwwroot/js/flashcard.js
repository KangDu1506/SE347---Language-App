// Flashcard UI: local per-card choices; no server progress or XP writes.
document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.flashcard-page');
    if (!page) return;

    const lessonId = page.dataset.lessonId || '';
    const LESSON_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    const $ = selector => page.querySelector(selector);
    const views = [...page.querySelectorAll('[data-view]')];
    // This element is only emitted by Razor in Development with ?preview=1.
    const previewData = $('[data-preview-lesson]');
    const state = { contents: [], index: 0, flipped: false, rating: null, view: 'loading',
        sessionId: null, completion: null, retryRequested: false, navigating: false, completionRequested: false };
    let requestId = 0;
    let ratingScope = null;
    const ratings = new Map();
    const unsavedRatings = new Set();
    const t = (key, fallback) => window.AppI18n?.t(key, fallback) || fallback;

    function sessionContext() {
        return state.sessionId ? Object.freeze({ lessonId, sessionId: state.sessionId,
            contentIds: Object.freeze(state.contents.map(item => item.id)), hasQuiz: state.hasQuiz, preview: !!previewData }) : null;
    }
    // A late-loading adapter can read the same context as the session-ready event.
    Object.defineProperty(page, 'flashcardSession', { get: sessionContext });
    const createSessionId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

    const isRating = value => value === 'know' || value === 'again';
    const ratingPrefix = () => ratingScope ? `se347.flashcard.rating.v1:${encodeURIComponent(ratingScope)}:${encodeURIComponent(lessonId)}:` : null;
    const ratingKey = id => ratingPrefix() + encodeURIComponent(id);

    function readRating(id) {
        if (ratingScope && !unsavedRatings.has(id)) {
            try {
                const value = localStorage.getItem(ratingKey(id));
                if (isRating(value)) ratings.set(id, value);
                else ratings.delete(id);
            } catch { /* Keep the in-memory choice when storage is unavailable. */ }
        }
        return ratings.get(id) ?? null;
    }

    function saveRating(id, value) {
        ratings.set(id, value);
        if (!ratingScope) return;
        try {
            localStorage.setItem(ratingKey(id), value);
            unsavedRatings.delete(id);
        } catch { unsavedRatings.add(id); }
    }

    function hydrateRatings() {
        state.contents.forEach(item => readRating(item.id));
    }

    function classificationStats() {
        let remembered = 0;
        let notRemembered = 0;
        for (const item of state.contents) {
            const mark = ratings.get(item.id);
            if (mark === 'know') remembered++;
            else if (mark === 'again') notRemembered++;
        }
        return { total: state.contents.length, remembered, notRemembered, answered: remembered + notRemembered };
    }

    const isDeckClassified = () => {
        const stats = classificationStats();
        return stats.total > 0 && stats.answered === stats.total;
    };

    const userScope = session => session?.user?.id ? `user:${session.user.id}` : null;

    function show(view) {
        const previous = state.view;
        state.view = view;
        views.forEach(element => { element.hidden = element.dataset.view !== view; });
        $('[data-view="loading"]').setAttribute('aria-busy', String(view === 'loading'));
        if (view === 'complete' && previous !== view) $('[data-view="complete"]').focus();
    }

    function setText(selector, value) {
        const element = $(selector);
        if (element) element.textContent = value ?? '';
    }

    function setMessage(titleKey, titleFallback, textKey, textFallback, retry = false) {
        const title = $('[data-message-title]');
        const text = $('[data-message-text]');
        title.dataset.i18n = titleKey;
        title.textContent = t(titleKey, titleFallback);
        text.dataset.i18n = textKey;
        text.textContent = t(textKey, textFallback);
        $('[data-action="retry"]').hidden = !retry;
        show('message');
    }

    // UI integration only: consumers own learning rules and server persistence.
    function emit(name) {
        page.dispatchEvent(new CustomEvent(`flashcard:${name}`, {
            bubbles: true,
            detail: { lessonId, sessionId: state.sessionId, contentId: state.contents[state.index].id, index: state.index,
                total: state.contents.length, side: state.flipped ? 'back' : 'front', rating: state.rating }
        }));
    }

    function resetRating() {
        state.rating = null;
        page.querySelectorAll('[data-rating]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    }

    function renderCard() {
        const item = state.contents[state.index];
        state.rating = readRating(item.id);
        const total = state.contents.length;
        const current = state.index + 1;
        const front = !state.flipped;
        const card = $('[data-card-side]');
        const progress = $('[role="progressbar"]');

        const count = t('flashcard.card_count', 'Thẻ {current} / {total}').replace('{current}', current).replace('{total}', total);
        setText('[data-card-count]', count);
        progress.setAttribute('aria-valuemax', String(total));
        progress.setAttribute('aria-valuenow', String(current));
        progress.setAttribute('aria-valuetext', count);
        $('[data-progress-fill]').style.width = `${(current / total) * 100}%`;

        const stats = classificationStats();
        const answered = t('flashcard.answered_count', 'Đã phân loại {answered}/{total}')
            .replace('{answered}', stats.answered).replace('{total}', stats.total);
        setText('[data-answered-count]', answered);

        card.dataset.cardSide = front ? 'front' : 'back';
        $('[data-card-label]').textContent = t(front ? 'flashcard.front_label' : 'flashcard.back_label', front ? 'Mặt trước' : 'Mặt sau');
        $('[data-card-label]').dataset.i18n = front ? 'flashcard.front_label' : 'flashcard.back_label';
        setText('[data-card-term]', item.content);
        $('[data-card-back]').hidden = front;
        setText('[data-definition-vi]', item['definition-vi']);
        const definitionEn = $('[data-definition-en]');
        definitionEn.textContent = item['definition-en'] || '';
        definitionEn.hidden = !item['definition-en'];

        const pronunciations = [item['pronunciation-bre'] && `UK ${item['pronunciation-bre']}`, item['pronunciation-name'] && `US ${item['pronunciation-name']}`].filter(Boolean);
        const pronunciation = $('[data-pronunciation]');
        pronunciation.textContent = pronunciations.join(' · ');
        pronunciation.hidden = pronunciations.length === 0;

        const examplesWrap = $('[data-examples-wrap]');
        const examples = Array.isArray(item.examples) ? item.examples : [];
        $('[data-examples]').replaceChildren(...examples.map(example => {
            const li = document.createElement('li');
            const term = document.createElement('q');
            term.lang = 'en';
            term.textContent = example.term || '';
            li.append(term);
            if (example.translation) li.append(document.createTextNode(` — ${example.translation}`));
            return li;
        }));
        examplesWrap.hidden = examples.length === 0;

        const flipKey = front ? 'flashcard.flip_to_back' : 'flashcard.flip_to_front';
        const flipFallback = front ? 'Lật thẻ để xem mặt sau' : 'Lật thẻ để xem mặt trước';
        const sideLabel = $('[data-card-label]').textContent;
        const toggle = $('[data-card-toggle]');
        toggle.setAttribute('aria-label', `${sideLabel}. ${t(flipKey, flipFallback)}`);
        toggle.setAttribute('aria-controls', 'flashcard-back');
        toggle.setAttribute('aria-expanded', String(!front));
        const announcement = $('[data-card-announcement]');
        const message = `${count}. ${sideLabel}`;
        if (announcement.textContent !== message) announcement.textContent = message;
        $('[data-action="previous"]').disabled = state.index === 0;
        $('[data-action="next"]').disabled = state.index === total - 1;

        page.querySelectorAll('[data-rating]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rating === state.rating)));
        window.AppI18n?.translate(page);
    }

    function setLessonLinks(lesson) {
        const url = `/Lesson/${encodeURIComponent(lesson.lessonId)}`;
        page.querySelectorAll('[data-back-to-lesson], [data-empty-back], [data-complete-back-to-lesson]').forEach(link => { link.href = url; });
        setText('[data-lesson-name]', lesson.name);
        setText('[data-lesson-heading]', lesson.name);
        document.title = `${lesson.name} · Wordfox`;
    }

    async function load() {
        const currentRequest = ++requestId;
        invalidateSession();
        state.contents = [];
        state.index = 0;
        state.flipped = false;
        resetRating();
        setText('[data-lesson-name]', '');
        setText('[data-lesson-heading]', '');
        setText('[data-card-term]', '');
        setText('[data-answered-count]', '');
        $('[data-card-back]').hidden = true;
        $('[data-examples]').replaceChildren();
        const lessonUrl = LESSON_ID_PATTERN.test(lessonId) ? `/Lesson/${encodeURIComponent(lessonId)}` : '/Study';
        page.querySelectorAll('[data-back-to-lesson], [data-empty-back], [data-complete-back-to-lesson]').forEach(link => { link.href = lessonUrl; });
        document.querySelector('title')?.removeAttribute('data-i18n');
        document.title = 'Flashcard · Wordfox';
        show('loading');
        if (!LESSON_ID_PATTERN.test(lessonId)) {
            setMessage('lesson.not_found_title', 'Không tìm thấy bài học', 'lesson.not_found_text', 'Bài học này không tồn tại hoặc đã bị gỡ.');
            return;
        }
        if (!previewData && !window.AppApi) {
            setMessage('lesson.error_title', 'Không tải được bài học', 'lesson.error_text', 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.', true);
            return;
        }

        try {
            // Preview and authenticated accounts never share local choices.
            const scope = previewData ? 'preview' : userScope((await window.sb?.auth.getSession())?.data?.session);
            if (currentRequest !== requestId) return;
            if (scope !== ratingScope) {
                ratings.clear();
                unsavedRatings.clear();
                ratingScope = scope;
            }
            const response = previewData ? JSON.parse(previewData.textContent)
                : await window.AppApi.get(`/api/lessons/${encodeURIComponent(lessonId)}`);
            if (currentRequest !== requestId) return;
            const lesson = window.FlashcardData?.mapLesson(response, lessonId);
            if (!lesson) {
                setMessage('lesson.error_title', 'Không tải được bài học', 'flashcard.invalid_data', 'Dữ liệu thẻ không hợp lệ. Vui lòng thử lại.', true);
                return;
            }
            state.contents = lesson.contents;
            state.hasQuiz = lesson.hasQuiz;
            hydrateRatings();
            setLessonLinks(lesson);
            if (state.contents.length === 0) {
                show('empty');
                return;
            }
            renderCard();
            state.sessionId = createSessionId();
            page.dataset.sessionId = state.sessionId;
            show('ready');
            page.dispatchEvent(new CustomEvent('flashcard:session-ready', { bubbles: true,
                detail: sessionContext() }));
        } catch (error) {
            if (currentRequest !== requestId) return;
            if (error.status === 401) return;
            if (error.status === 404 || error.status === 400) {
                setMessage('lesson.not_found_title', 'Không tìm thấy bài học', 'lesson.not_found_text', 'Bài học này không tồn tại hoặc đã bị gỡ.');
            } else if (error.status === 403 && error.body?.code === 'lesson_locked') {
                setMessage('lesson.locked_title', 'Bài học đang khóa', 'lesson.locked_text', 'Hoàn thành các bài trước trong lộ trình để mở bài này.');
            } else if (error.status === 403) {
                setMessage('lesson.inactive_title', 'Tài khoản không hoạt động', 'lesson.inactive_text', 'Tài khoản của bạn đang bị khóa hoặc đã xóa nên không mở được bài học.');
            } else if (error.status === 0) {
                setMessage('lesson.error_title', 'Không tải được bài học', 'lesson.network_text', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', true);
            } else {
                setMessage('lesson.error_title', 'Không tải được bài học', 'lesson.error_text', 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.', true);
            }
        }
    }

    // SCRUM-77 determines completion; SCRUM-76 owns persistence and retry requests.
    // The UI accepts one ordered completion stream for the current session only.
    function invalidateSession() {
        state.sessionId = null;
        state.completion = null;
        state.retryRequested = false;
        state.completionRequested = false;
        delete page.dataset.sessionId;
        resetNavigation();
        const next = $('[data-complete-next]');
        next.hidden = true;
        next.removeAttribute('href');
        $('[data-action="retry-completion"]').hidden = true;
    }

    function resetNavigation() {
        state.navigating = false;
        page.querySelectorAll('[data-completion-navigation]').forEach(link => {
            link.removeAttribute('aria-disabled');
            link.removeAttribute('aria-busy');
        });
    }

    function setCompletionText(selector, key, fallback) {
        const element = $(selector);
        element.dataset.i18n = key;
        element.textContent = t(key, fallback);
    }

    function renderCompletion() {
        const completion = state.completion;
        const panel = $('[data-view="complete"]');
        const focused = document.activeElement;
        const saving = completion.phase === 'saving';
        const failed = completion.phase === 'error';
        const done = completion.phase === 'completed';
        panel.dataset.phase = completion.phase;
        $('[data-completion-message]').setAttribute('role', failed ? 'alert' : 'status');
        $('[data-completion-message]').setAttribute('aria-live', failed ? 'assertive' : 'polite');
        setCompletionText('[data-completion-title]', saving ? 'flashcard.saving_title' : failed ? 'flashcard.save_error_title' : 'flashcard.complete_title',
            saving ? 'Đang ghi nhận phiên ôn tập' : failed ? 'Chưa lưu được tiến độ' : 'Bạn đã hoàn thành phiên ôn tập');
        const textKey = saving ? 'flashcard.saving_text' : failed ? 'flashcard.save_error_text'
            : completion.persistence === 'saved' ? 'flashcard.saved_text' : 'flashcard.local_complete_text';
        const text = saving ? 'Đang chờ máy chủ xác nhận. Tiến độ chưa được xác nhận lưu.'
            : failed ? 'Tiến độ chưa được xác nhận lưu lên máy chủ. Bạn có thể quay lại bài học hoặc trang Học tập.'
            : completion.persistence === 'saved' ? 'Tiến độ phiên ôn tập đã được máy chủ xác nhận.'
            : 'Phiên ôn tập đã kết thúc. Tiến độ của phiên này không được lưu lên máy chủ.';
        setCompletionText('[data-completion-message]', textKey, text);
        const retry = $('[data-action="retry-completion"]');
        retry.hidden = !failed || !completion.canRetry;
        retry.disabled = state.retryRequested;
        retry.setAttribute('aria-busy', String(state.retryRequested));
        const next = $('[data-complete-next]');
        next.hidden = !done || !completion.nextLessonId;
        if (!next.hidden) next.href = `/Lesson/${encodeURIComponent(completion.nextLessonId)}`;
        else next.removeAttribute('href');
        $('[data-complete-back-to-lesson]').classList.toggle('btn--ink', done && next.hidden);
        // If an async update hides the focused Retry link/button, focus the new state.
        const refocus = panel.contains(focused) && (focused.closest('[hidden]') || focused.disabled);
        show('complete');
        if (refocus) panel.focus();
    }

    page.addEventListener('flashcard:completion-state', event => {
        const update = event.detail;
        if (!update || !state.sessionId || !state.contents.length || !['ready', 'complete'].includes(state.view)
            || update.lessonId !== lessonId || update.sessionId !== state.sessionId
            || !Number.isSafeInteger(update.revision) || update.revision < 1
            || update.revision <= (state.completion?.revision ?? 0) || state.completion?.phase === 'completed') return;
        const validPair = (update.phase === 'saving' && update.persistence === 'pending')
            || (update.phase === 'error' && update.persistence === 'failed')
            || (update.phase === 'completed' && ['saved', 'not-required'].includes(update.persistence));
        if (!validPair || (previewData && update.persistence === 'saved')) return;
        const next = update.nextStep;
        const nextLessonId = next?.type === 'lesson' && typeof next.lessonId === 'string'
            && LESSON_ID_PATTERN.test(next.lessonId) && next.lessonId !== lessonId ? next.lessonId : null;
        state.completion = { revision: update.revision, phase: update.phase, persistence: update.persistence,
            canRetry: update.phase === 'error' && update.canRetry === true, nextLessonId };
        state.retryRequested = false;
        renderCompletion();
    });

    window.addEventListener('pageshow', resetNavigation);

    function flipCard() {
        if (state.view !== 'ready') return;
        state.flipped = !state.flipped;
        $('.flashcard-card__content').scrollTop = 0;
        renderCard();
        emit('flip');
    }

    const card = $('[data-card-side]');
    let gesture = null;
    // Native scrolling owns touch input. Only a tap/click should flip the card.
    card.addEventListener('pointerdown', event => {
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    }, { passive: true });
    card.addEventListener('pointermove', event => {
        if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true;
    }, { passive: true });
    card.addEventListener('pointercancel', () => { if (gesture) gesture.moved = true; }, { passive: true });
    card.addEventListener('click', event => {
        if (event.detail !== 0 && gesture?.moved) return;
        const control = event.target.closest('a, button, input, select, textarea');
        if ((control && !control.matches('[data-card-toggle]')) || window.getSelection()?.isCollapsed === false) return;
        flipCard();
    });
    card.addEventListener('keydown', event => {
        if (event.target.matches('[data-card-toggle]')) {
            if (event.repeat && event.key === 'Enter') event.preventDefault();
            return; // Native button owns Enter/Space and emits one click.
        }
        const content = $('.flashcard-card__content');
        if (event.target !== content || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (content.scrollHeight > content.clientHeight
            && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const step = event.key.startsWith('Page') ? content.clientHeight * 0.8 : 40;
            if (event.key === 'Home') content.scrollTop = 0;
            else if (event.key === 'End') content.scrollTop = content.scrollHeight;
            else content.scrollTop += event.key === 'ArrowUp' || event.key === 'PageUp' ? -step : step;
            return;
        }
    });

    page.addEventListener('click', event => {
        const link = event.target.closest('[data-completion-navigation]');
        if (link && page.contains(link)) {
            if (state.view !== 'complete' || link.hidden || !link.hasAttribute('href')) { event.preventDefault(); return; }
            if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            if (state.navigating) { event.preventDefault(); return; }
            state.navigating = true;
            page.querySelectorAll('[data-completion-navigation]').forEach(action => action.setAttribute('aria-disabled', 'true'));
            link.setAttribute('aria-busy', 'true');
            return; // Native link preserves normal history/back behavior.
        }
        const button = event.target.closest('button');
        if (!button || !page.contains(button) || button.disabled) return;
        if (button.dataset.action === 'retry-completion') {
            if (state.view !== 'complete' || state.completion?.phase !== 'error' || !state.completion.canRetry || state.retryRequested) return;
            state.retryRequested = true;
            const wasFocused = document.activeElement === button;
            renderCompletion();
            if (wasFocused) $('[data-view="complete"]').focus();
            page.dispatchEvent(new CustomEvent('flashcard:completion-retry', { bubbles: true,
                detail: { lessonId, sessionId: state.sessionId, revision: state.completion.revision } }));
            return;
        }
        if (button.dataset.action === 'retry') {
            if (state.view === 'message' && !button.hidden) load();
            return;
        }
        if (state.view !== 'ready') return;
        if (button.dataset.action === 'previous' && state.index > 0) {
            state.index--;
            state.flipped = false;
            $('.flashcard-card__content').scrollTop = 0;
            renderCard();
            emit('change');
        }
        if (button.dataset.action === 'next' && state.index < state.contents.length - 1) {
            state.index++;
            state.flipped = false;
            $('.flashcard-card__content').scrollTop = 0;
            renderCard();
            emit('change');
        }
        if (['know', 'again'].includes(button.dataset.rating)) {
            const wasClassified = isDeckClassified();
            saveRating(state.contents[state.index].id, button.dataset.rating);
            renderCard();
            emit('rate');
            if (!wasClassified && !state.completionRequested && isDeckClassified()) {
                state.completionRequested = true;
                page.dispatchEvent(new CustomEvent('flashcard:session-complete', { bubbles: true,
                    detail: { lessonId, sessionId: state.sessionId,
                        contentIds: Object.freeze(state.contents.map(item => item.id)), total: state.contents.length } }));
            }
        }
    });

    window.addEventListener('storage', event => {
        if (!ratingScope || (event.key !== null && !event.key.startsWith(ratingPrefix()))) return;
        // Read the latest stored value, not a potentially stale queued event value.
        if (event.key === null) {
            ratings.clear();
            unsavedRatings.clear();
        } else {
            const id = state.contents.find(item => ratingKey(item.id) === event.key)?.id;
            if (id) unsavedRatings.delete(id);
        }
        if (state.view === 'ready') renderCard();
    });

    if (!previewData) {
        const subscription = window.sb?.auth.onAuthStateChange?.((event, session) => {
            if (event === 'INITIAL_SESSION' || userScope(session) === ratingScope) return;
            ++requestId;
            invalidateSession();
            state.contents = [];
            ratings.clear();
            unsavedRatings.clear();
            show('loading');
            // Avoid calling Supabase again inside its auth callback lock.
            setTimeout(load, 0);
        });
        window.addEventListener('pagehide', event => {
            if (!event.persisted) subscription?.data.subscription.unsubscribe();
        });
    }

    window.addEventListener('app:languagechange', () => {
        if (state.view === 'ready') renderCard();
        else if (state.view === 'complete') renderCompletion();
    });
    window.AppI18n?.ready.then(() => {
        if (state.view === 'ready') renderCard();
        else if (state.view === 'complete') renderCompletion();
    });

    load();
});
