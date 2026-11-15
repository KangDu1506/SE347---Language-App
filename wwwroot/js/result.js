// Trang Kết quả và ôn lại mini-game (SCRUM-60). Hướng dẫn: docs/frontend/RESULT_UI.md
// Điểm, đáp án đúng, giải thích lấy từ response chấm điểm của server (QuizResult.read);
// nội dung câu hỏi lấy từ GET /api/lessons/{id}; tiến độ mới nhất từ GET /api/progress/lessons/{id}.
document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.result-page');
    if (!page) return;

    const lessonId = page.dataset.lessonId || '';
    const passScore = Number(page.dataset.passScore) || 60;
    const LESSON_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    const BLANK = '<blank>';
    const $ = selector => page.querySelector(selector);
    const views = [...page.querySelectorAll('[data-view]')];
    const previewData = $('[data-preview-result]');
    const t = (key, fallback) => window.AppI18n?.t(key, fallback) || fallback;
    const fill = (text, values) => Object.entries(values).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), text);

    // Route mini-game (SCRUM-59). Đổi ở đây nếu trang mini-game dùng route khác.
    const playUrl = id => `/MiniGame/${encodeURIComponent(id)}`;
    const lessonUrl = id => `/Lesson/${encodeURIComponent(id)}`;
    const flashcardUrl = id => `/Flashcard/${encodeURIComponent(id)}`;

    const state = { view: 'loading', lesson: null, record: null, progress: null, filter: 'all' };
    let requestId = 0;

    function show(view) {
        state.view = view;
        views.forEach(element => { element.hidden = element.dataset.view !== view; });
        $('[data-view="loading"]').setAttribute('aria-busy', String(view === 'loading'));
    }

    function setMessage(titleKey, titleFallback, textKey, textFallback, reload = false) {
        const title = $('[data-message-title]');
        const text = $('[data-message-text]');
        title.dataset.i18n = titleKey;
        title.textContent = t(titleKey, titleFallback);
        text.dataset.i18n = textKey;
        text.textContent = t(textKey, textFallback);
        $('[data-action="reload"]').hidden = !reload;
        show('message');
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    const hasText = value => typeof value === 'string' && value.trim().length > 0;
    const validLesson = lesson => lesson && lesson.lessonId === lessonId && hasText(lesson.name) && Array.isArray(lesson.quiz);

    function formatTime(ms) {
        if (!Number.isFinite(ms) || ms < 0) return '—';
        const total = Math.round(ms / 1000);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = String(total % 60).padStart(2, '0');
        return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
    }

    function answerText(type, parts) {
        if (!parts.some(hasText)) return null;
        // Điền từ giữ đúng vị trí từng chỗ trống, chỗ bỏ trống hiện ___.
        const values = type === 'fill-in-the-blank' ? parts.map(v => hasText(v) ? v : '___') : parts.filter(hasText);
        if (type === 'true-false') {
            return values.map(v => v.toLowerCase() === 'true' ? t('result.true', 'Đúng') : v.toLowerCase() === 'false' ? t('result.false', 'Sai') : v).join(', ');
        }
        return values.join(type === 'fill-in-the-blank' ? ' / ' : ', ');
    }

    const typeLabel = type => ({
        'fill-in-the-blank': t('result.type_fill', 'Điền từ'),
        'single-choice': t('result.type_single', 'Chọn một đáp án'),
        'multiple-choice': t('result.type_multiple', 'Chọn nhiều đáp án'),
        'true-false': t('result.type_true_false', 'Đúng hay sai')
    })[type] || '';

    // Câu điền từ: thay từng <blank> bằng đáp án đúng (tô xanh) để đọc lại cả câu.
    function questionNode(question, result) {
        const p = el('p', 'result-item__question');
        p.lang = 'en';
        const text = question?.question;
        if (!hasText(text)) {
            p.textContent = t('result.question_missing', 'Câu hỏi này không còn trong bài.');
            p.removeAttribute('lang');
            p.classList.add('result-item__question--missing');
            return p;
        }
        const pieces = text.split(BLANK);
        // Điền từ, hoặc chọn một đáp án cho đúng một chỗ trống: điền đáp án đúng vào chỗ trống.
        const filled = result.type === 'fill-in-the-blank' || (result.type === 'single-choice' && pieces.length === 2);
        pieces.forEach((piece, index) => {
            p.append(document.createTextNode(piece));
            if (index === pieces.length - 1) return;
            const answer = filled ? result.correctAnswer[index] : null;
            p.append(hasText(answer) ? el('mark', 'result-blank', answer) : el('span', 'result-blank result-blank--empty', '___'));
        });
        return p;
    }

    function answerRow(label, value, className) {
        const row = el('div', `result-answer ${className}`);
        row.append(el('dt', null, label));
        const dd = el('dd');
        if (value == null) {
            dd.append(el('em', null, t('result.no_answer', 'Bỏ trống')));
        } else {
            dd.lang = 'en';
            dd.textContent = value;
        }
        row.append(dd);
        return row;
    }

    function explanationNode(result) {
        if (!hasText(result.explanation) && !hasText(result.translation)) return null;
        const box = el(result.isCorrect ? 'details' : 'div', 'result-explain');
        if (result.isCorrect) box.append(el('summary', null, t('result.show_explanation', 'Xem giải thích')));
        else box.append(el('p', 'result-explain__label', t('result.explanation', 'Giải thích')));
        const blanks = text => text.replaceAll(BLANK, '___');
        if (hasText(result.explanation)) {
            const en = el('p', 'result-explain__en', blanks(result.explanation));
            en.lang = 'en';
            box.append(en);
        }
        if (hasText(result.translation)) box.append(el('p', 'result-explain__vi', blanks(result.translation)));
        return box;
    }

    function itemNode(result, number, question) {
        const li = el('li', `sticker result-item ${result.isCorrect ? 'result-item--correct' : 'result-item--wrong'}`);
        li.dataset.correct = String(result.isCorrect);

        const head = el('div', 'result-item__head');
        head.append(el('span', 'result-item__number', fill(t('result.question_number', 'Câu {n}'), { n: number })));
        if (typeLabel(result.type)) head.append(el('span', 'result-item__type', typeLabel(result.type)));
        head.append(el('span', 'tag result-item__status', result.isCorrect ? t('result.correct', 'Đúng') : t('result.wrong', 'Sai')));
        li.append(head, questionNode(question, result));

        const options = Array.isArray(question?.options) ? question.options.filter(hasText) : [];
        const yours = answerText(result.type, result.userAnswer);
        // Câu chọn đáp án: tô màu ngay trên các lựa chọn, không lặp lại thành dòng chữ.
        if (options.length > 0 && result.type !== 'true-false') {
            const list = el('ul', 'result-options');
            const correct = new Set(result.correctAnswer.map(v => v.trim().toLowerCase()));
            const picked = new Set(result.userAnswer.map(v => v.trim().toLowerCase()));
            options.forEach(option => {
                const key = option.trim().toLowerCase();
                const item = el('li', 'result-option', option);
                item.lang = 'en';
                if (correct.has(key)) item.classList.add('result-option--correct');
                else if (picked.has(key)) item.classList.add('result-option--picked');
                if (picked.has(key)) item.append(el('span', 'visually-hidden', ` (${t('result.your_pick', 'bạn chọn')})`));
                if (correct.has(key)) item.append(el('span', 'visually-hidden', ` (${t('result.correct_answer', 'Đáp án đúng')})`));
                list.append(item);
            });
            li.append(list);
            if (yours == null) li.append(el('p', 'result-item__skipped', t('result.skipped', 'Bạn bỏ trống câu này.')));
        } else {
            const answers = el('dl', 'result-answers');
            answers.append(answerRow(t('result.your_answer', 'Bạn trả lời'), yours, result.isCorrect ? 'result-answer--ok' : 'result-answer--bad'));
            if (!result.isCorrect) answers.append(answerRow(t('result.correct_answer', 'Đáp án đúng'), answerText(result.type, result.correctAnswer), 'result-answer--fix'));
            li.append(answers);
        }

        const explain = explanationNode(result);
        if (explain) li.append(explain);
        return li;
    }

    function renderReview() {
        const { submission } = state.record;
        const questions = new Map(state.lesson.quiz.filter(q => q && hasText(q.id)).map(q => [q.id, q]));
        const counts = {
            wrong: submission.questions.filter(q => !q.isCorrect).length,
            correct: submission.questions.filter(q => q.isCorrect).length,
            all: submission.questions.length
        };
        const labels = {
            wrong: t('result.filter_wrong', 'Cần ôn'),
            all: t('result.filter_all', 'Tất cả'),
            correct: t('result.filter_correct', 'Đã đúng')
        };
        page.querySelectorAll('[data-filter]').forEach(button => {
            const filter = button.dataset.filter;
            button.textContent = `${labels[filter]} (${counts[filter]})`;
            button.setAttribute('aria-pressed', String(filter === state.filter));
        });

        const items = submission.questions
            .map((result, index) => ({ result, number: index + 1 }))
            .filter(({ result }) => state.filter === 'all' || (state.filter === 'wrong') !== result.isCorrect)
            .map(({ result, number }) => itemNode(result, number, questions.get(result.questionId)));
        $('[data-review-list]').replaceChildren(...items);

        const empty = $('[data-review-empty]');
        empty.hidden = items.length > 0;
        empty.textContent = state.filter === 'wrong'
            ? t('result.no_wrong', 'Không có câu nào sai. Không cần ôn gì thêm!')
            : t('result.no_correct', 'Chưa có câu nào đúng. Làm lại một lượt nhé!');
    }

    function badge(text, tone) {
        const li = el('li', `result-badge result-badge--${tone}`, text);
        return li;
    }

    function renderBadges() {
        const { attempt } = state.record.submission;
        const progress = state.progress || attempt.progress || null;
        const badges = [];
        if (attempt.lessonCompletedNow) badges.push(badge(t('result.badge_completed_now', 'Đã hoàn thành bài học'), 'done'));
        else if (progress?.status === 'completed') badges.push(badge(t('result.badge_completed', 'Bài học đã hoàn thành'), 'done'));
        else badges.push(badge(fill(t('result.badge_need_pass', 'Cần {pass} điểm để hoàn thành bài'), { pass: passScore }), 'todo'));
        if (Number.isInteger(progress?.bestQuizScore) && progress.quizAttempts > 1) {
            badges.push(badge(fill(t('result.badge_best', 'Điểm cao nhất: {score}'), { score: progress.bestQuizScore }), 'info'));
        }
        if (Number.isInteger(progress?.quizAttempts) && progress.quizAttempts > 0) {
            badges.push(badge(fill(t('result.badge_attempt', 'Lần làm thứ {n}'), { n: progress.quizAttempts }), 'info'));
        }
        $('[data-badges]').replaceChildren(...badges);
    }

    function renderReady() {
        const { attempt } = state.record.submission;
        const wrong = attempt.totalCount - attempt.correctCount;
        const passed = attempt.score >= passScore;
        const hero = $('.result-hero');
        hero.dataset.passed = String(passed);
        hero.style.setProperty('--score', attempt.score);

        $('[data-score]').textContent = attempt.score;
        $('[data-score-ring]').setAttribute('aria-label', fill(t('result.score_label', '{score} trên 100 điểm'), { score: attempt.score }));
        $('[data-foxy]').setAttribute('href', `/images/mascot/foxy.svg#${passed ? 'foxy-wave' : 'foxy-sad'}`);

        const title = attempt.score === 100 ? t('result.title_perfect', 'Xuất sắc, đúng hết!')
            : attempt.score >= 80 ? t('result.title_great', 'Làm tốt lắm!')
            : passed ? t('result.title_pass', 'Qua bài rồi!')
            : t('result.title_retry', 'Cố thêm chút nữa nhé!');
        $('[data-result-title]').textContent = title;
        const summary = fill(t('result.summary', 'Bạn trả lời đúng {correct}/{total} câu.'), { correct: attempt.correctCount, total: attempt.totalCount });
        $('[data-result-summary]').textContent = wrong > 0
            ? `${summary} ${fill(t('result.summary_wrong', 'Xem lại {wrong} câu sai bên dưới.'), { wrong })}`
            : summary;

        $('[data-stat="correct"]').textContent = attempt.correctCount;
        $('[data-stat="wrong"]').textContent = wrong;
        $('[data-stat="time"]').textContent = formatTime(state.record.durationMs);
        $('[data-stat="xp"]').textContent = `+${attempt.xpAwarded}`;
        $('[data-flashcard]').hidden = wrong === 0 || !Array.isArray(state.lesson.contents) || state.lesson.contents.length === 0;

        renderBadges();
        renderReview();
        window.AppI18n?.translate(page);
    }

    function renderEmpty() {
        const progress = state.progress;
        const text = $('[data-empty-text]');
        if (progress?.quizAttempts > 0 && Number.isInteger(progress.lastQuizScore)) {
            text.textContent = fill(t('result.empty_with_attempts', 'Lần gần nhất bạn được {last} điểm, cao nhất {best} điểm. Chi tiết từng câu chỉ xem được ngay sau lượt làm. Làm lại để xem nhé.'),
                { last: progress.lastQuizScore, best: progress.bestQuizScore ?? progress.lastQuizScore });
        } else {
            text.textContent = t('result.empty_text', 'Làm mini-game của bài này để xem điểm, đáp án đúng và các câu cần ôn.');
        }
        const play = $('[data-empty-play]');
        play.textContent = progress?.quizAttempts > 0 ? t('result.retry', 'Làm lại') : t('result.start', 'Làm mini-game');
        show('empty');
    }

    function setLessonLinks(lesson) {
        page.querySelectorAll('[data-back-to-lesson]').forEach(link => { link.href = lessonUrl(lesson.lessonId); });
        page.querySelectorAll('[data-play]').forEach(link => { link.href = playUrl(lesson.lessonId); });
        $('[data-flashcard]').href = flashcardUrl(lesson.lessonId);
        $('[data-lesson-name]').textContent = lesson.name;
        $('[data-lesson-heading]').textContent = lesson.name;
        document.querySelector('title')?.removeAttribute('data-i18n');
        document.title = `${t('result.crumb', 'Kết quả')} · ${lesson.name} · Wordfox`;
    }

    // Lấy tiến độ mới nhất sau khi nộp bài (điểm cao nhất, số lần làm). Lỗi ở đây không chặn trang kết quả.
    async function refreshProgress(currentRequest) {
        try {
            const progress = await window.AppApi.get(`/api/progress/lessons/${encodeURIComponent(lessonId)}`);
            if (currentRequest !== requestId || !progress || progress.lessonId !== lessonId) return;
            state.progress = progress;
            if (state.view === 'ready') renderBadges();
        } catch { /* Giữ tiến độ trả về cùng lần nộp bài. */ }
    }

    function showError(error) {
        if (error.status === 401) return;
        if (error.status === 404 || error.status === 400) {
            setMessage('lesson.not_found_title', 'Không tìm thấy bài học', 'lesson.not_found_text', 'Bài học này không tồn tại hoặc đã bị gỡ.');
        } else if (error.status === 403 && error.body?.code === 'lesson_locked') {
            setMessage('lesson.locked_title', 'Bài học đang khóa', 'lesson.locked_text', 'Hoàn thành các bài trước trong lộ trình để mở bài này.');
        } else if (error.status === 403) {
            setMessage('lesson.inactive_title', 'Tài khoản không hoạt động', 'lesson.inactive_text', 'Tài khoản của bạn đang bị khóa hoặc đã xóa nên không mở được bài học.');
        } else if (error.status === 0) {
            setMessage('result.error_title', 'Không tải được kết quả', 'lesson.network_text', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', true);
        } else {
            setMessage('result.error_title', 'Không tải được kết quả', 'lesson.error_text', 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.', true);
        }
    }

    async function load() {
        const currentRequest = ++requestId;
        Object.assign(state, { lesson: null, record: null, progress: null });
        page.querySelectorAll('[data-back-to-lesson]').forEach(link => {
            link.href = LESSON_ID_PATTERN.test(lessonId) ? lessonUrl(lessonId) : '/Study';
        });
        show('loading');

        if (!LESSON_ID_PATTERN.test(lessonId)) {
            setMessage('lesson.not_found_title', 'Không tìm thấy bài học', 'lesson.not_found_text', 'Bài học này không tồn tại hoặc đã bị gỡ.');
            return;
        }

        if (previewData) {
            const data = JSON.parse(previewData.textContent || 'null');
            if (!data || !validLesson(data.lesson)) {
                setMessage('result.no_quiz_title', 'Bài học này không có mini-game', 'result.no_quiz_text', 'Chọn bài khác có phần ôn tập để xem kết quả.');
                return;
            }
            state.lesson = data.lesson;
            state.record = { durationMs: data.durationMs, submission: data.submission };
            state.filter = data.submission.attempt.correctCount < data.submission.attempt.totalCount ? 'wrong' : 'all';
            setLessonLinks(data.lesson);
            renderReady();
            show('ready');
            return;
        }

        if (!window.AppApi || !window.QuizResult) {
            setMessage('result.error_title', 'Không tải được kết quả', 'lesson.error_text', 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.', true);
            return;
        }

        try {
            const [record, lesson] = await Promise.all([
                window.QuizResult.read(lessonId),
                window.AppApi.get(`/api/lessons/${encodeURIComponent(lessonId)}`)
            ]);
            if (currentRequest !== requestId) return;
            if (!validLesson(lesson)) {
                setMessage('result.error_title', 'Không tải được kết quả', 'lesson.error_text', 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.', true);
                return;
            }
            state.lesson = lesson;
            setLessonLinks(lesson);

            if (lesson.quiz.length === 0) {
                setMessage('result.no_quiz_title', 'Bài học này không có mini-game', 'result.no_quiz_text', 'Chọn bài khác có phần ôn tập để xem kết quả.');
                return;
            }

            if (record) {
                state.record = record;
                state.progress = record.submission.attempt.progress || null;
                state.filter = record.submission.attempt.correctCount < record.submission.attempt.totalCount ? 'wrong' : 'all';
                renderReady();
                show('ready');
                refreshProgress(currentRequest);
                return;
            }

            try {
                state.progress = await window.AppApi.get(`/api/progress/lessons/${encodeURIComponent(lessonId)}`);
            } catch (error) {
                if (error.status === 401) return;
                state.progress = null;
            }
            if (currentRequest !== requestId) return;
            renderEmpty();
        } catch (error) {
            if (currentRequest !== requestId) return;
            showError(error);
        }
    }

    page.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || !page.contains(button)) return;
        if (button.dataset.action === 'reload' && state.view === 'message') {
            load();
            return;
        }
        if (button.dataset.filter && state.view === 'ready' && button.dataset.filter !== state.filter) {
            state.filter = button.dataset.filter;
            renderReview();
        }
    });

    window.addEventListener('app:languagechange', () => {
        if (state.view === 'ready') renderReady();
        else if (state.view === 'empty') renderEmpty();
    });
    window.AppI18n?.ready.then(() => {
        if (state.view === 'ready') renderReady();
        else if (state.view === 'empty') renderEmpty();
    });

    load();
});
