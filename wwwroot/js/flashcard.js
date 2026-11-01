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
    const state = { contents: [], index: 0, flipped: false, rating: null, view: 'loading' };
    let requestId = 0;
    let ratingScope = null;
    const ratings = new Map();
    const unsavedRatings = new Set();
    const t = (key, fallback) => window.AppI18n?.t(key, fallback) || fallback;

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

    const userScope = session => session?.user?.id ? `user:${session.user.id}` : null;

    function show(view) {
        state.view = view;
        views.forEach(element => { element.hidden = element.dataset.view !== view; });
        $('[data-view="loading"]').setAttribute('aria-busy', String(view === 'loading'));
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

    // Check the existing lesson contract; malformed data must not look like an empty deck.
    const hasText = value => typeof value === 'string' && value.trim().length > 0;
    function validLesson(lesson) {
        if (!lesson || lesson.lessonId !== lessonId || !hasText(lesson.name) || !Array.isArray(lesson.contents)) return false;
        const ids = new Set();
        return lesson.contents.every(item => {
            if (!item || !hasText(item.id) || ids.has(item.id) || !hasText(item.content)
                || !hasText(item['definition-vi']) || !hasText(item['definition-en'])) return false;
            ids.add(item.id);
            return ['pronunciation-bre', 'pronunciation-name'].every(key => item[key] == null || typeof item[key] === 'string')
                && (item.examples == null || (Array.isArray(item.examples)
                    && item.examples.every(example => example && hasText(example.term) && hasText(example.translation))));
        });
    }

    // UI integration only: consumers own learning rules and server persistence.
    function emit(name) {
        page.dispatchEvent(new CustomEvent(`flashcard:${name}`, {
            bubbles: true,
            detail: { lessonId, contentId: state.contents[state.index].id, index: state.index,
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
        card.setAttribute('aria-label', `${item.content}. ${t(flipKey, flipFallback)}`);
        $('[data-action="previous"]').disabled = state.index === 0;
        $('[data-action="next"]').disabled = state.index === total - 1;

        page.querySelectorAll('[data-rating]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rating === state.rating)));
        window.AppI18n?.translate(page);
    }

    function setLessonLinks(lesson) {
        const url = `/Lesson/${encodeURIComponent(lesson.lessonId)}`;
        page.querySelectorAll('[data-back-to-lesson], [data-empty-back]').forEach(link => { link.href = url; });
        setText('[data-lesson-name]', lesson.name);
        setText('[data-lesson-heading]', lesson.name);
        document.title = `${lesson.name} · Wordfox`;
    }

    async function load() {
        const currentRequest = ++requestId;
        state.contents = [];
        state.index = 0;
        state.flipped = false;
        resetRating();
        setText('[data-lesson-name]', '');
        setText('[data-lesson-heading]', '');
        setText('[data-card-term]', '');
        $('[data-card-back]').hidden = true;
        $('[data-examples]').replaceChildren();
        const lessonUrl = LESSON_ID_PATTERN.test(lessonId) ? `/Lesson/${encodeURIComponent(lessonId)}` : '/Study';
        page.querySelectorAll('[data-back-to-lesson], [data-empty-back]').forEach(link => { link.href = lessonUrl; });
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
            const lesson = previewData ? JSON.parse(previewData.textContent)
                : await window.AppApi.get(`/api/lessons/${encodeURIComponent(lessonId)}`);
            if (currentRequest !== requestId) return;
            if (!validLesson(lesson)) {
                setMessage('lesson.error_title', 'Không tải được bài học', 'flashcard.invalid_data', 'Dữ liệu thẻ không hợp lệ. Vui lòng thử lại.', true);
                return;
            }
            state.contents = lesson.contents;
            setLessonLinks(lesson);
            if (state.contents.length === 0) {
                show('empty');
                return;
            }
            renderCard();
            show('ready');
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

    function flipCard() {
        if (state.view !== 'ready') return;
        state.flipped = !state.flipped;
        $('.flashcard-card__content').scrollTop = 0;
        renderCard();
        emit('flip');
    }

    const card = $('[data-card-side]');
    card.addEventListener('click', event => {
        if (event.target.closest('a, button, input, select, textarea') || window.getSelection()?.isCollapsed === false) return;
        flipCard();
    });
    card.addEventListener('keydown', event => {
        if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        if (!event.repeat) flipCard();
    });

    page.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || !page.contains(button) || button.disabled) return;
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
            saveRating(state.contents[state.index].id, button.dataset.rating);
            renderCard();
            emit('rate');
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
    });
    window.AppI18n?.ready.then(() => { if (state.view === 'ready') renderCard(); });

    load();
});
