// Chi tiết bài học (Pages/Lesson.cshtml, SCRUM-57).
// GET /api/lessons/{id} -> render nội dung; GET /api/lessons -> bài trước/tiếp theo;
// POST /api/progress/lessons/{id}/open -> ghi nhận đã mở bài. Gọi API qua window.AppApi (js/Shared/api.js).
document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.lesson-page');
    if (!page) return;

    const lessonId = page.dataset.lessonId || '';
    const LESSON_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/; // khớp LessonIds.Pattern ở backend
    const CATEGORY_KEYS = { vocabulary: 'ui.vocabulary', grammar: 'ui.grammar', listening: 'ui.listening' };
    // Route trang flashcard (SCRUM-58) mà nút "Bắt đầu ôn tập" trỏ tới
    const reviewUrl = id => `/Flashcard/${encodeURIComponent(id)}`;

    const $ = (selector, root = page) => root.querySelector(selector);
    const t = (key, fallback) => window.AppI18n?.t(key, fallback) || fallback;

    // Gắn key i18n để chữ tự đổi khi người dùng chuyển vi/en
    function setI18n(element, key, fallback) {
        element.dataset.i18n = key;
        element.textContent = t(key, fallback);
    }

    // ---------- Trạng thái trang ----------
    function show(state) {
        page.querySelectorAll('[data-state]').forEach(section => { section.hidden = section.dataset.state !== state; });
        $('[data-state="loading"]').setAttribute('aria-busy', String(state === 'loading'));
    }

    const MESSAGES = {
        not_found: ['lesson.not_found_title', 'Không tìm thấy bài học', 'lesson.not_found_text', 'Bài học này không tồn tại hoặc đã bị gỡ. Hãy chọn bài khác ở trang Học tập.'],
        network: ['lesson.error_title', 'Không tải được bài học', 'lesson.network_text', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'],
        error: ['lesson.error_title', 'Không tải được bài học', 'lesson.error_text', 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.']
    };

    function showMessage(kind) {
        const [titleKey, title, textKey, text] = MESSAGES[kind];
        setI18n($('[data-message-title]'), titleKey, title);
        setI18n($('[data-message-text]'), textKey, text);
        $('[data-action="retry"]').hidden = kind === 'not_found';
        show('message');
    }

    // ---------- Render ----------
    function setText(selector, value) {
        const element = $(selector);
        if (element) element.textContent = value ?? '';
    }

    function renderHeader(lesson) {
        setText('[data-lesson-crumb]', lesson.name);
        setText('[data-lesson-name]', lesson.name);
        setText('[data-lesson-description]', lesson.description);
        setText('[data-lesson-level]', lesson.level);
        setText('[data-lesson-topic]', lesson.topic);
        setText('[data-lesson-minutes]', lesson.estimatedMinutes);
        setText('[data-lesson-count]', lesson.contents.length);
        setText('[data-lesson-quiz]', lesson.quiz.length);
        $('[data-lesson-quiz-wrap]').hidden = lesson.quiz.length === 0;

        const category = $('[data-lesson-category]');
        const categoryKey = CATEGORY_KEYS[lesson.category];
        if (categoryKey) setI18n(category, categoryKey, lesson.category);
        else category.textContent = lesson.category;

        const review = $('[data-action="review"]');
        review.href = reviewUrl(lesson.lessonId);
        review.hidden = lesson.contents.length === 0;

        // Tiêu đề tab = tên bài; bỏ data-i18n để bộ dịch không ghi đè
        const title = document.querySelector('title');
        title?.removeAttribute('data-i18n');
        document.title = `${lesson.name} · Wordfox`;
    }

    function chips(container, words) {
        container.replaceChildren(...words.map(word => {
            const chip = document.createElement('span');
            chip.textContent = word;
            return chip;
        }));
    }

    function renderItem(item, index) {
        const node = $('#lesson-item-template').content.firstElementChild.cloneNode(true);
        const field = name => node.querySelector(`[data-field="${name}"]`);

        field('no').textContent = String(index + 1).padStart(2, '0');
        field('content').textContent = item.content;
        field('definition-vi').textContent = item['definition-vi'];
        field('definition-en').textContent = item['definition-en'];

        const bre = item['pronunciation-bre'];
        const name = item['pronunciation-name'];
        if (bre || name) {
            const ipa = field('ipa');
            const parts = [['UK', bre], ['US', name]].filter(([, value]) => value);
            ipa.replaceChildren(...parts.flatMap(([label, value], i) => {
                const tag = document.createElement('b');
                tag.textContent = label;
                return [...(i ? [document.createTextNode(' · ')] : []), tag, document.createTextNode(value)];
            }));
            ipa.hidden = false;
        }

        if (item.audio) {
            const audio = field('audio');
            audio.dataset.src = item.audio;
            audio.hidden = false;
        }

        if (item.image) {
            const image = field('image');
            image.src = item.image;
            image.alt = item.content;
            image.hidden = false;
        }

        const examples = item.examples || [];
        if (examples.length) {
            field('examples').replaceChildren(...examples.map(example => {
                const li = document.createElement('li');
                const term = document.createElement('q');
                term.lang = 'en';
                term.textContent = example.term;
                const translation = document.createElement('small');
                translation.textContent = example.translation;
                li.append(term, translation);
                return li;
            }));
            field('examples-wrap').hidden = false;
        }

        const synonyms = item.synonyms || [];
        const antonyms = item.antonyms || [];
        if (synonyms.length) { chips(field('synonyms'), synonyms); field('synonyms-wrap').hidden = false; }
        if (antonyms.length) { chips(field('antonyms'), antonyms); field('antonyms-wrap').hidden = false; }
        field('related').hidden = !synonyms.length && !antonyms.length;

        if (/^https?:\/\//i.test(item['oxford-link'] || '')) {
            const oxford = field('oxford');
            oxford.href = item['oxford-link'];
            oxford.hidden = false;
        }

        return node;
    }

    function render(lesson) {
        lesson.contents = lesson.contents || [];
        lesson.quiz = lesson.quiz || [];
        renderHeader(lesson);
        $('[data-lesson-items]').replaceChildren(...lesson.contents.map(renderItem));
        $('[data-lesson-empty]').hidden = lesson.contents.length > 0;
    }

    // ---------- Audio: một trình phát dùng chung, bấm lại để dừng ----------
    const player = new Audio();
    let playingButton = null;

    function resetAudioButton() {
        playingButton?.setAttribute('aria-pressed', 'false');
        playingButton = null;
    }

    player.addEventListener('ended', resetAudioButton);

    page.addEventListener('click', event => {
        const button = event.target.closest('[data-field="audio"]');
        if (!button) return;
        const wasPlaying = playingButton === button;
        player.pause();
        resetAudioButton();
        if (wasPlaying) return;

        playingButton = button;
        button.setAttribute('aria-pressed', 'true');
        player.src = button.dataset.src;
        player.play().catch(error => {
            if (error?.name === 'AbortError') return; // bị ngắt do bấm sang mục khác
            if (playingButton === button) resetAudioButton();
            window.AppToast?.error(t('lesson.audio_error', 'Không phát được âm thanh của mục này.'));
        });
    });

    // ---------- Bài trước / tiếp theo (theo thứ tự level -> order của GET /api/lessons) ----------
    function setPagerLink(link, lesson) {
        if (!lesson) {
            link.hidden = true;
            return;
        }
        link.href = `/Lesson/${encodeURIComponent(lesson.lessonId)}`;
        link.querySelector('[data-pager-name]').textContent = lesson.name;
        link.hidden = false;
    }

    async function loadPager(id) {
        try {
            const lessons = await window.AppApi.get('/api/lessons');
            const index = lessons.findIndex(lesson => lesson.lessonId === id);
            if (index < 0) return;
            setPagerLink($('[data-lesson-prev]'), lessons[index - 1]);
            setPagerLink($('[data-lesson-next]'), lessons[index + 1]);
        } catch {
            // Không có danh sách thì ẩn điều hướng, nội dung bài vẫn dùng được
        }
    }

    // ---------- Tải bài ----------
    async function load() {
        if (!LESSON_ID_PATTERN.test(lessonId)) {
            showMessage('not_found');
            return;
        }
        if (!window.AppApi) {
            showMessage('error');
            return;
        }

        show('loading');
        try {
            const lesson = await window.AppApi.get(`/api/lessons/${encodeURIComponent(lessonId)}`);
            render(lesson);
            show('ready');
            loadPager(lesson.lessonId);
            // Ghi nhận đã mở bài; lỗi ở đây không ảnh hưởng việc học
            window.AppApi.post(`/api/progress/lessons/${encodeURIComponent(lesson.lessonId)}/open`).catch(() => {});
        } catch (error) {
            if (error.status === 401) return; // AppApi đã chuyển sang trang đăng nhập
            if (error.status === 404 || error.status === 400) showMessage('not_found');
            else showMessage(error.status === 0 ? 'network' : 'error');
        }
    }

    $('[data-action="retry"]').addEventListener('click', load);
    load();
});
