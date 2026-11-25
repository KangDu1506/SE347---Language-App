// Chi tiết bài học (Pages/Lesson.cshtml, SCRUM-57).
// GET /api/lessons/{id} -> render nội dung; GET /api/lessons -> bài trước/tiếp theo;
// POST /api/progress/lessons/{id}/open -> ghi nhận đã mở bài. Gọi API qua window.AppApi (js/Shared/api.js).
document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.lesson-page');
    if (!page) return;

    const lessonId = page.dataset.lessonId || '';
    const LESSON_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/; // khớp LessonIds.Pattern ở backend
    const CATEGORY_KEYS = {
        vocabulary: 'ui.vocabulary',
        grammar: 'ui.grammar',
        listening: 'ui.listening',
        speaking: 'study.cat_speaking'
    };
    const searchParams = new URLSearchParams(window.location.search);
    let forceQuizRetry = searchParams.get('retry') === '1';
    const openQuizOnLoad = forceQuizRetry || searchParams.get('quiz') === '1' || window.location.hash === '#lesson-quiz';
    // Route trang flashcard (SCRUM-58) mà nút "Bắt đầu ôn tập" trỏ tới
    const reviewUrl = id => `/Flashcard/${encodeURIComponent(id)}`;

    // Giọng đọc của trình duyệt cho mục không có file ghi âm; null nếu trình duyệt không hỗ trợ
    const speech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null;

    let currentLesson = null;
    let lessonProgress = null;
    let completedContentIds = new Set();
    let renderedQuizQuestions = [];
    let suppressDraftSave = false;
    let activeQuestionIndex = 0;
    let userScope = 'anonymous';
    const checkedAnswers = new Map();

    const draftKey = id => `wordfox:quiz-draft:${userScope}:${id}`;
    function saveQuizDraft() {
        if (!currentLesson || suppressDraftSave) return;
        try {
            const answers = collectQuizAnswers();
            if (answers.every(item => item.answer.every(value => !value))) {
                sessionStorage.removeItem(draftKey(currentLesson.lessonId));
                return;
            }
            sessionStorage.setItem(draftKey(currentLesson.lessonId), JSON.stringify({
                savedAt: Date.now(),
                quizSignature: quizSignature(),
                activeQuestionIndex,
                answers,
                checkedAnswers: [...checkedAnswers.entries()]
            }));
        } catch { /* Browser storage may be unavailable. */ }
    }

    function restoreQuizDraft() {
        if (!currentLesson) return;
        try {
            const key = draftKey(currentLesson.lessonId);
            const draft = JSON.parse(sessionStorage.getItem(key) || 'null');
            if (!draft) return;
            if (!Array.isArray(draft.answers) || Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000 || draft.quizSignature !== quizSignature()) {
                sessionStorage.removeItem(key);
                return;
            }
            suppressDraftSave = true;
            for (const item of draft.answers) {
                const row = page.querySelector(`.lesson-quiz__item[data-question-id="${CSS.escape(item.questionId)}"]`);
                if (!row || !Array.isArray(item.answer)) continue;
                const inputs = [...row.querySelectorAll('input')];
                if (row.dataset.questionType === 'fill-in-the-blank') inputs.forEach((input, i) => { input.value = item.answer[i] || ''; });
                else inputs.forEach(input => { input.checked = item.answer.includes(input.value); });
            }
            if (Array.isArray(draft.checkedAnswers)) {
                for (const [questionId, checked] of draft.checkedAnswers) {
                    if (!checked?.result || !Array.isArray(checked.answer)) continue;
                    checkedAnswers.set(questionId, checked);
                    renderInstantFeedback(checked.result);
                }
            }
            if (Number.isInteger(draft.activeQuestionIndex)) {
                activeQuestionIndex = Math.max(0, Math.min(draft.activeQuestionIndex, renderedQuizQuestions.length - 1));
            }
        } catch {
            try { sessionStorage.removeItem(draftKey(currentLesson.lessonId)); } catch { /* Ignore unavailable storage. */ }
        } finally { suppressDraftSave = false; }
    }

    function quizSignature() {
        return JSON.stringify((currentLesson?.quiz || []).map(q => [q.id, q.type, q.question, q.options]));
    }

    function isQuestionAnswered(index = activeQuestionIndex) {
        const question = renderedQuizQuestions[index];
        if (!question) return false;
        const row = page.querySelector(`.lesson-quiz__item[data-question-id="${CSS.escape(question.id)}"]`);
        if (!row) return false;
        if (question.type === 'fill-in-the-blank') {
            const blanks = [...row.querySelectorAll('.lesson-quiz__blank')];
            return blanks.length > 0 && blanks.every(input => input.value.trim().length > 0);
        }
        return row.querySelectorAll('input:checked').length > 0;
    }

    function getQuestionAnswer(index = activeQuestionIndex) {
        const question = renderedQuizQuestions[index];
        if (!question) return { questionId: '', answer: [] };
        const row = page.querySelector(`.lesson-quiz__item[data-question-id="${CSS.escape(question.id)}"]`);
        if (!row) return { questionId: question.id, answer: [] };
        const answer = question.type === 'fill-in-the-blank'
            ? [...row.querySelectorAll('.lesson-quiz__blank')].map(input => input.value.trim())
            : [...row.querySelectorAll('input:checked')].map(input => input.value);
        return { questionId: question.id, answer };
    }

    function isCurrentAnswerChecked() {
        const current = getQuestionAnswer();
        const checked = checkedAnswers.get(current.questionId);
        return Boolean(checked && answersEqual(renderedQuizQuestions[activeQuestionIndex], checked.answer, current.answer));
    }

    function answersEqual(question, left, right) {
        if (!question || !Array.isArray(left) || !Array.isArray(right)) return false;
        if (question.type === 'multiple-choice') {
            const normalizedLeft = [...left].sort();
            const normalizedRight = [...right].sort();
            return normalizedLeft.length === normalizedRight.length
                && normalizedLeft.every((value, index) => value === normalizedRight[index]);
        }
        return JSON.stringify(left) === JSON.stringify(right);
    }

    function clearStaleCheck() {
        const current = getQuestionAnswer();
        const checked = checkedAnswers.get(current.questionId);
        if (!checked || answersEqual(renderedQuizQuestions[activeQuestionIndex], checked.answer, current.answer)) return;
        checkedAnswers.delete(current.questionId);
        const row = page.querySelector(`.lesson-quiz__item[data-question-id="${CSS.escape(current.questionId)}"]`);
        const feedback = row?.querySelector('[data-instant-feedback]');
        if (feedback) {
            feedback.hidden = true;
            feedback.replaceChildren();
        }
    }

    function renderInstantFeedback(result) {
        const row = page.querySelector(`.lesson-quiz__item[data-question-id="${CSS.escape(result.questionId)}"]`);
        if (!row) return;
        const feedback = row.querySelector('[data-instant-feedback]');
        if (!feedback) return;
        feedback.classList.toggle('is-wrong', !result.isCorrect);
        const title = document.createElement('strong');
        title.textContent = result.isCorrect
            ? t('lesson.fb_correct', '✓ Chính xác')
            : t('lesson.fb_wrong', '✕ Chưa đúng');
        feedback.replaceChildren(title);
        if (!result.isCorrect && result.correctAnswer?.length) {
            const correct = document.createElement('p');
            correct.textContent = `${t('lesson.fb_correct_answer', 'Đáp án đúng')}: ${result.correctAnswer.join(', ')}`;
            feedback.appendChild(correct);
        }
        if (result.explanation) {
            const explanation = document.createElement('p');
            explanation.textContent = `${t('lesson.fb_explanation', 'Giải thích')}: ${result.explanation}`;
            feedback.appendChild(explanation);
        }
        if (result.translation) {
            const translation = document.createElement('p');
            translation.textContent = `${t('lesson.fb_translation', 'Dịch')}: ${result.translation}`;
            feedback.appendChild(translation);
        }
        feedback.hidden = false;
    }

    async function checkCurrentAnswer() {
        if (!currentLesson || !isQuestionAnswered()) {
            const firstInput = page.querySelector(`.lesson-quiz__item[data-question-id="${CSS.escape(renderedQuizQuestions[activeQuestionIndex]?.id || '')}"] input`);
            window.AppToast?.error(t('lesson.answer_required', 'Hãy trả lời câu này trước khi tiếp tục.'));
            firstInput?.focus();
            return false;
        }
        clearStaleCheck();
        if (isCurrentAnswerChecked()) return true;
        const answer = getQuestionAnswer();
        const button = $('[data-action="check-answer"]');
        if (button) button.disabled = true;
        try {
            const result = await window.AppApi.post(
                `/api/progress/lessons/${encodeURIComponent(currentLesson.lessonId)}/quiz/check`,
                answer
            );
            checkedAnswers.set(answer.questionId, { answer: answer.answer, result });
            renderInstantFeedback(result);
            updateGameStep();
            return true;
        } catch (error) {
            if (error.status !== 401) window.AppToast?.error(error.message || t('lesson.quiz_submit_error', 'Không kiểm tra được đáp án.'));
            return false;
        } finally {
            if (button) button.disabled = false;
        }
    }

    function updateGameStep() {
        const rows = [...page.querySelectorAll('[data-quiz-questions] > .lesson-quiz__item')];
        const count = renderedQuizQuestions.length;
        const progress = $('[data-game-progress]');
        const progressLabel = $('[data-game-progress-label]');
        const progressBar = $('[data-game-progressbar]');
        const progressFill = $('[data-game-progress-fill]');
        const previous = $('[data-action="previous-question"]');
        const next = $('[data-action="next-question"]');
        const submit = $('[data-action="submit-quiz"]');
        if (!count) return;

        rows.forEach((row, index) => {
            const isCurrent = index === activeQuestionIndex;
            row.dataset.gameStepHidden = String(!isCurrent);
            if (isCurrent) row.removeAttribute('aria-hidden');
            else row.setAttribute('aria-hidden', 'true');
        });
        const correctSoFar = [...checkedAnswers.entries()].filter(([questionId, checked]) => {
            const index = renderedQuizQuestions.findIndex(q => q.id === questionId);
            return index >= 0 && checked.result?.isCorrect
                && answersEqual(renderedQuizQuestions[index], checked.answer, getQuestionAnswer(index).answer);
        }).length;
        const currentChecked = isCurrentAnswerChecked();
        const provisionalScore = Math.round((correctSoFar / count) * 100);
        if (progress) progress.hidden = false;
        if (progressLabel) progressLabel.textContent = `${t('ui.question', 'Câu hỏi')} ${activeQuestionIndex + 1} / ${count} · ${t('lesson.provisional_score', 'Điểm tạm tính')} ${provisionalScore}% (${correctSoFar}/${count})`;
        if (progressBar) {
            progressBar.setAttribute('aria-valuemax', String(count));
            progressBar.setAttribute('aria-valuenow', String(activeQuestionIndex + 1));
        }
        if (progressFill) progressFill.style.width = `${((activeQuestionIndex + 1) / count) * 100}%`;
        if (previous) previous.hidden = count < 2 || activeQuestionIndex === 0;
        if (next) next.hidden = count < 2 || activeQuestionIndex === count - 1 || !currentChecked;
        if (submit) submit.hidden = activeQuestionIndex !== count - 1 || !currentChecked;
        const check = $('[data-action="check-answer"]');
        if (check) check.hidden = currentChecked;
    }

    function moveQuestion(step) {
        if (step > 0 && !isCurrentAnswerChecked()) {
            window.AppToast?.error(t('lesson.check_before_continue', 'Hãy kiểm tra đáp án câu này trước khi tiếp tục.'));
            return false;
        }
        const nextIndex = activeQuestionIndex + step;
        if (nextIndex < 0 || nextIndex >= renderedQuizQuestions.length) return false;
        activeQuestionIndex = nextIndex;
        saveQuizDraft();
        updateGameStep();
        page.querySelector('[data-quiz-questions] > .lesson-quiz__item:not([data-game-step-hidden="true"])')?.querySelector('input')?.focus({ preventScroll: true });
        return true;
    }

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
        locked: ['lesson.locked_title', 'Bài học đang khóa', 'lesson.locked_text', 'Hoàn thành các bài trước trong lộ trình để mở bài này.'],
        inactive: ['lesson.inactive_title', 'Tài khoản không hoạt động', 'lesson.inactive_text', 'Tài khoản của bạn đang bị khóa hoặc đã xóa nên không mở được bài học.'],
        network: ['lesson.error_title', 'Không tải được bài học', 'lesson.network_text', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'],
        error: ['lesson.error_title', 'Không tải được bài học', 'lesson.error_text', 'Máy chủ đang gặp sự cố. Thử lại sau ít phút.']
    };

    function showMessage(kind) {
        const [titleKey, title, textKey, text] = MESSAGES[kind];
        setI18n($('[data-message-title]'), titleKey, title);
        setI18n($('[data-message-text]'), textKey, text);
        $('[data-action="retry"]').hidden = kind !== 'network' && kind !== 'error';
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

        page.querySelectorAll('[data-action="review"]').forEach(link => { link.href = reviewUrl(lesson.lessonId); });
        // Bài chưa có nội dung thì không có gì để ôn: ẩn nút ở phần đầu và dải ôn tập cuối bài
        page.querySelectorAll('[data-action="review"], [data-lesson-outro]').forEach(el => { el.hidden = lesson.contents.length === 0; });

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

        const number = String(index + 1).padStart(2, '0');
        node.dataset.contentId = item.id || '';
        field('no').textContent = number;       // cho trình đọc màn hình
        field('side').dataset.no = number;      // số lớn trang trí ở nửa màu (CSS ::after)
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

        // Nút nghe: có file ghi âm thì phát file, không có thì đọc bằng giọng tiếng Anh của trình duyệt
        const audio = field('audio');
        if (item.audio) {
            audio.dataset.src = item.audio;
            audio.hidden = false;
        } else if (speech) {
            audio.dataset.speak = item.content;
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

        const hasOxford = /^https?:\/\//i.test(item['oxford-link'] || '');
        if (hasOxford) {
            const oxford = field('oxford');
            oxford.href = item['oxford-link'];
            oxford.hidden = false;
        }
        field('foot').hidden = !synonyms.length && !antonyms.length && !hasOxford;

        const completeBtn = field('complete-btn');
        if (completeBtn) {
            if (item.id) {
                completeBtn.dataset.contentId = item.id;
            } else {
                field('progress-wrap').hidden = true;
            }
        }

        return node;
    }

    function shuffleCopy(list) {
        const arr = [...list];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function syncContentButtons() {
        page.querySelectorAll('[data-field="complete-btn"]').forEach(btn => {
            const done = completedContentIds.has(btn.dataset.contentId);
            btn.setAttribute('aria-pressed', String(done));
            btn.dataset.i18n = done ? 'lesson.learned' : 'lesson.mark_learned';
            btn.textContent = done
                ? t('lesson.learned', '✓ Đã học')
                : t('lesson.mark_learned', 'Đánh dấu đã học');
        });
        updateCompleteLessonWrap();
    }

    function renderProgressBadge() {
        const badge = $('[data-lesson-progress-badge]');
        if (!badge || !currentLesson) return;
        if (!lessonProgress) {
            badge.hidden = true;
            return;
        }
        const parts = [];
        if (lessonProgress.status === 'completed') {
            parts.push(t('lesson.status_completed', 'Đã hoàn thành'));
            badge.classList.add('is-completed');
        } else if (lessonProgress.status === 'in_progress') {
            parts.push(t('lesson.status_in_progress', 'Đang học'));
            badge.classList.remove('is-completed');
        } else {
            parts.push(t('lesson.status_not_started', 'Chưa bắt đầu'));
            badge.classList.remove('is-completed');
        }
        if (currentLesson.contents.length > 0) {
            parts.push(`${completedContentIds.size}/${currentLesson.contents.length} ${t('lesson.items', 'mục')}`);
        }
        if (typeof lessonProgress.bestQuizScore === 'number') {
            parts.push(`${t('lesson.best_score', 'Cao nhất')}: ${lessonProgress.bestQuizScore}%`);
        }
        badge.textContent = parts.join(' · ');
        badge.hidden = false;
    }

    function updateCompleteLessonWrap() {
        const completeBtn = $('[data-action="complete-lesson"]');
        const hint = $('[data-lesson-complete-hint]');
        if (!completeBtn || !currentLesson) return;
        const alreadyCompleted = lessonProgress?.status === 'completed';
        const allLearned = currentLesson.contents.length === 0
            || currentLesson.contents.every(item => completedContentIds.has(item.id));
        if (alreadyCompleted) {
            completeBtn.disabled = true;
            completeBtn.textContent = t('lesson.completed_btn', 'Đã hoàn thành bài học');
            if (hint) hint.textContent = t('lesson.completed_hint', 'Bạn đã hoàn thành toàn bộ nội dung bài học này.');
        } else {
            completeBtn.disabled = !allLearned;
            completeBtn.textContent = t('lesson.complete_btn', 'Hoàn thành bài học (+20 XP)');
            if (hint) {
                hint.textContent = allLearned
                    ? t('lesson.complete_ready_hint', 'Bạn đã học hết các mục nội dung. Bấm để hoàn thành và nhận +20 XP!')
                    : `${t('lesson.complete_hint', 'Đánh dấu đã học hết các mục nội dung để hoàn thành bài học này.')} (${completedContentIds.size}/${currentLesson.contents.length})`;
            }
        }
    }

    // Thời điểm hiện bài kiểm tra, để trang Kết quả hiển thị thời gian làm bài
    let quizStartedAt = 0;

    function renderQuizQuestions(lesson, restoreDraft = true) {
        quizStartedAt = Date.now();
        const listEl = $('[data-quiz-questions]');
        const formEl = $('[data-quiz-form]');
        const resultEl = $('[data-quiz-result]');
        const completeWrap = $('[data-lesson-complete-wrap]');
        const quizSection = $('[data-lesson-quiz-section]');
        if (!quizSection || !listEl || !formEl || !resultEl || !completeWrap) return;

        const resultLink = $('[data-quiz-result-link]');
        if (resultLink) resultLink.hidden = true;

        const hasQuiz = lesson.quiz.length > 0;
        const hasContent = lesson.contents.length > 0;
        quizSection.hidden = !hasQuiz && !hasContent;

        if (!hasQuiz) {
            formEl.hidden = true;
            resultEl.hidden = true;
            const gameProgress = $('[data-game-progress]');
            if (gameProgress) gameProgress.hidden = true;
            const prevBtn = $('[data-action="previous-question"]');
            if (prevBtn) prevBtn.hidden = true;
            const nextBtn = $('[data-action="next-question"]');
            if (nextBtn) nextBtn.hidden = true;
            const checkBtn = $('[data-action="check-answer"]');
            if (checkBtn) checkBtn.hidden = true;
            completeWrap.hidden = !hasContent;
            const subtitle = $('[data-quiz-subtitle]');
            if (subtitle) {
                subtitle.dataset.i18n = 'lesson.complete_subtitle';
                subtitle.textContent = t('lesson.complete_subtitle', 'Bài học này không có trắc nghiệm. Hoàn thành hết các mục nội dung để mở khóa bài kế tiếp.');
            }
            updateCompleteLessonWrap();
            return;
        }

        completeWrap.hidden = true;
        resultEl.hidden = true;
        formEl.hidden = false;

        const settings = lesson.quizSettings || {};
        const shouldShuffleQ = Boolean(settings['shuffle-questions'] || settings['randomize-questions']);
        const shouldShuffleA = Boolean(settings['shuffle-answers']);
        renderedQuizQuestions = shouldShuffleQ ? shuffleCopy(lesson.quiz) : [...lesson.quiz];
        activeQuestionIndex = 0;
        checkedAnswers.clear();

        const typeLabels = {
            'single-choice': t('lesson.q_type_single', 'Chọn 1 đáp án'),
            'multiple-choice': t('lesson.q_type_multi', 'Chọn nhiều đáp án'),
            'true-false': t('lesson.q_type_tf', 'Đúng / Sai'),
            'fill-in-the-blank': t('lesson.q_type_blank', 'Điền vào chỗ trống')
        };

        listEl.replaceChildren(...renderedQuizQuestions.map((q, idx) => {
            const li = document.createElement('li');
            li.className = 'lesson-quiz__item';
            li.dataset.questionId = q.id;
            li.dataset.questionType = q.type;

            const head = document.createElement('div');
            head.className = 'lesson-quiz__q-head';
            const no = document.createElement('span');
            no.className = 'lesson-quiz__q-no';
            no.textContent = `${t('ui.question', 'Câu hỏi')} ${String(idx + 1).padStart(2, '0')}`;
            const kind = document.createElement('span');
            kind.className = 'lesson-quiz__q-type';
            kind.textContent = typeLabels[q.type] || q.type;
            head.append(no, kind);
            li.appendChild(head);

            if (q.audio || q.image) {
                const media = document.createElement('div');
                media.className = 'lesson-quiz__media';
                if (q.audio) {
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.preload = 'none';
                    audio.src = q.audio;
                    media.appendChild(audio);
                }
                if (q.image) {
                    const img = document.createElement('img');
                    img.src = q.image;
                    img.alt = `${t('ui.question', 'Câu hỏi')} ${idx + 1}`;
                    img.loading = 'lazy';
                    media.appendChild(img);
                }
                li.appendChild(media);
            }

            if (q.text) {
                const pre = document.createElement('pre');
                pre.className = 'lesson-quiz__reading';
                pre.textContent = t('lesson.loading_reading', 'Đang tải đoạn đọc...');
                li.appendChild(pre);
                fetch(q.text)
                    .then(r => (r.ok ? r.text() : Promise.reject()))
                    .then(txt => { pre.textContent = txt; })
                    .catch(() => { pre.hidden = true; });
            }

            const prompt = document.createElement('p');
            prompt.className = 'lesson-quiz__prompt';
            prompt.lang = 'en';

            if (q.type === 'fill-in-the-blank') {
                const parts = String(q.question || '').split('<blank>');
                if (parts.length > 1) {
                    parts.forEach((part, partIdx) => {
                        if (part) prompt.appendChild(document.createTextNode(part));
                        if (partIdx < parts.length - 1) {
                            const input = document.createElement('input');
                            input.type = 'text';
                            input.className = 'lesson-quiz__blank';
                            input.autocomplete = 'off';
                            input.dataset.blankIndex = String(partIdx);
                            input.setAttribute('aria-label', `${t('ui.question', 'Câu hỏi')} ${idx + 1} (${partIdx + 1})`);
                            prompt.appendChild(input);
                        }
                    });
                    li.appendChild(prompt);
                } else {
                    prompt.textContent = q.question;
                    li.appendChild(prompt);
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'lesson-quiz__blank';
                    input.autocomplete = 'off';
                    input.dataset.blankIndex = '0';
                    input.setAttribute('aria-label', `${t('ui.question', 'Câu hỏi')} ${idx + 1}`);
                    li.appendChild(input);
                }
            } else {
                prompt.textContent = q.question;
                li.appendChild(prompt);

                const optionsWrap = document.createElement('div');
                optionsWrap.className = 'lesson-quiz__options';
                const inputType = q.type === 'multiple-choice' ? 'checkbox' : 'radio';
                const choices = q.type === 'true-false'
                    ? [
                        { value: 'true', label: t('lesson.tf_true', 'Đúng (True)') },
                        { value: 'false', label: t('lesson.tf_false', 'Sai (False)') }
                    ]
                    : (shouldShuffleA ? shuffleCopy(q.options || []) : (q.options || [])).map(opt => ({ value: opt, label: opt }));

                choices.forEach(choice => {
                    const label = document.createElement('label');
                    label.className = 'lesson-quiz__option';
                    const input = document.createElement('input');
                    input.type = inputType;
                    input.name = `quiz-q-${q.id}`;
                    input.value = choice.value;
                    const text = document.createElement('span');
                    text.textContent = choice.label;
                    label.append(input, text);
                    optionsWrap.appendChild(label);
                });
                li.appendChild(optionsWrap);
            }

            const feedback = document.createElement('div');
            feedback.className = 'lesson-quiz__instant-feedback';
            feedback.dataset.instantFeedback = '';
            feedback.hidden = true;
            feedback.setAttribute('aria-live', 'polite');
            li.appendChild(feedback);

            return li;
        }));
        if (restoreDraft) restoreQuizDraft();
        updateGameStep();
    }

    function collectQuizAnswers() {
        return renderedQuizQuestions.map(q => {
            const itemEl = page.querySelector(`.lesson-quiz__item[data-question-id="${CSS.escape(q.id)}"]`);
            if (!itemEl) return { questionId: q.id, answer: [] };
            if (q.type === 'fill-in-the-blank') {
                const blanks = [...itemEl.querySelectorAll('.lesson-quiz__blank')];
                return { questionId: q.id, answer: blanks.map(input => input.value.trim()) };
            }
            const checked = [...itemEl.querySelectorAll('input:checked')].map(input => input.value);
            return { questionId: q.id, answer: checked };
        });
    }

    function renderQuizResult(submission) {
        const formEl = $('[data-quiz-form]');
        const resultEl = $('[data-quiz-result]');
        const scoreCard = resultEl?.querySelector('.lesson-quiz__score-card');
        const scoreEl = $('[data-quiz-score]');
        const titleEl = $('[data-quiz-result-title]');
        const metaEl = $('[data-quiz-result-meta]');
        const feedbackEl = $('[data-quiz-feedback]');
        if (!formEl || !resultEl || !feedbackEl) return;

        const attempt = submission.attempt;
        const subtitle = $('[data-quiz-subtitle]');
        if (subtitle) subtitle.textContent = t('lesson.quiz_subtitle', 'Hoàn thành từ 60% số câu trở lên để mở khóa bài tiếp theo.');
        const passed = attempt.score >= 60;
        try { sessionStorage.setItem(`${draftKey(currentLesson.lessonId)}:result`, JSON.stringify({ quizSignature: quizSignature(), submission })); } catch { /* Result is still visible for this page. */ }
        formEl.hidden = true;
        resultEl.hidden = false;
        try { sessionStorage.removeItem(draftKey(currentLesson.lessonId)); } catch { /* Ignore unavailable storage. */ }

        scoreCard?.classList.toggle('is-pass', passed);
        if (scoreEl) scoreEl.textContent = `${attempt.score}%`;
        if (titleEl) {
            titleEl.textContent = passed
                ? t('lesson.quiz_pass_title', 'Chúc mừng! Bạn đã đạt bài kiểm tra')
                : t('lesson.quiz_fail_title', 'Chưa đạt — hãy thử lại nhé');
        }
        if (metaEl) {
            metaEl.textContent = `${attempt.correctCount}/${attempt.totalCount} ${t('lesson.quiz_correct_unit', 'câu đúng')} · +${attempt.xpAwarded} XP`;
        }

        const qPromptMap = new Map(renderedQuizQuestions.map(q => [q.id, q.question]));
        feedbackEl.replaceChildren(...(submission.questions || []).map((res, idx) => {
            const li = document.createElement('li');
            li.className = `lesson-quiz__fb-item ${res.isCorrect ? 'is-correct' : 'is-wrong'}`;

            const head = document.createElement('div');
            head.className = 'lesson-quiz__fb-head';
            const title = document.createElement('span');
            title.textContent = `${String(idx + 1).padStart(2, '0')}. ${qPromptMap.get(res.questionId) || ''}`;
            const badge = document.createElement('span');
            badge.textContent = res.isCorrect
                ? t('lesson.fb_correct', '✓ Chính xác')
                : t('lesson.fb_wrong', '✕ Chưa đúng');
            head.append(title, badge);
            li.appendChild(head);

            const yourAns = document.createElement('p');
            yourAns.textContent = `${t('lesson.fb_your_answer', 'Bạn chọn')}: ${(res.userAnswer && res.userAnswer.length) ? res.userAnswer.join(', ') : t('lesson.fb_empty', '(bỏ trống)')}`;
            li.appendChild(yourAns);

            if (!res.isCorrect && res.correctAnswer?.length) {
                const rightAns = document.createElement('p');
                rightAns.textContent = `${t('lesson.fb_correct_answer', 'Đáp án đúng')}: ${res.correctAnswer.join(', ')}`;
                li.appendChild(rightAns);
            }
            if (res.translation) {
                const trans = document.createElement('p');
                trans.textContent = `${t('lesson.fb_translation', 'Dịch')}: ${res.translation}`;
                li.appendChild(trans);
            }
            if (res.explanation) {
                const exp = document.createElement('p');
                exp.textContent = `${t('lesson.fb_explanation', 'Giải thích')}: ${res.explanation}`;
                li.appendChild(exp);
            }
            return li;
        }));

        if (attempt.progress) {
            lessonProgress = attempt.progress;
            if (Array.isArray(attempt.progress.completedContentIds)) {
                completedContentIds = new Set(attempt.progress.completedContentIds);
                syncContentButtons();
            }
            renderProgressBadge();
        }
    }

    function render(lesson) {
        lesson.contents = lesson.contents || [];
        lesson.quiz = lesson.quiz || [];
        currentLesson = lesson;
        lessonProgress = null;
        completedContentIds = new Set();
        renderHeader(lesson);
        $('[data-lesson-items]').replaceChildren(...lesson.contents.map(renderItem));
        $('[data-lesson-empty]').hidden = lesson.contents.length > 0;
        renderQuizQuestions(lesson);
        syncContentButtons();
        renderProgressBadge();
    }

    // ---------- Audio: một trình phát dùng chung, bấm lại để dừng ----------
    // File ghi âm (item.audio) ưu tiên; mục không có file đọc bằng Web Speech API (speechSynthesis).
    const player = new Audio();
    let playingButton = null;

    function resetAudioButton() {
        playingButton?.setAttribute('aria-pressed', 'false');
        playingButton = null;
    }

    function stopAll() {
        player.pause();
        speech?.cancel();
        resetAudioButton();
    }

    function audioError(button) {
        if (playingButton === button) resetAudioButton();
        window.AppToast?.error(t('lesson.audio_error', 'Không phát được âm thanh của mục này.'));
    }

    // Giọng tiếng Anh: ưu tiên Anh-Mỹ, không có thì giọng tiếng Anh bất kỳ (danh sách giọng tải không đồng bộ)
    function englishVoice() {
        const voices = speech.getVoices().filter(voice => /^en[-_]/i.test(voice.lang));
        return voices.find(voice => /^en[-_]US/i.test(voice.lang)) || voices[0] || null;
    }

    function speak(button, text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.voice = englishVoice();
        utterance.rate = 0.9;
        utterance.onend = () => { if (playingButton === button) resetAudioButton(); };
        utterance.onerror = event => {
            if (event.error === 'canceled' || event.error === 'interrupted') return; // bị ngắt do bấm sang mục khác
            audioError(button);
        };
        speech.speak(utterance);
    }

    player.addEventListener('ended', resetAudioButton);

    page.addEventListener('click', async event => {
        const completeBtn = event.target.closest('[data-field="complete-btn"]');
        if (completeBtn && currentLesson && completeBtn.dataset.contentId) {
            const contentId = completeBtn.dataset.contentId;
            if (completedContentIds.has(contentId)) return;
            completeBtn.disabled = true;
            try {
                const updated = await window.AppApi.post(
                    `/api/progress/lessons/${encodeURIComponent(currentLesson.lessonId)}/contents/${encodeURIComponent(contentId)}/complete`
                );
                if (updated && Array.isArray(updated.completedContentIds)) {
                    lessonProgress = updated;
                    completedContentIds = new Set(updated.completedContentIds);
                    syncContentButtons();
                    renderProgressBadge();
                    window.AppToast?.success(t('lesson.content_saved', 'Đã ghi nhận mục đã học (+5 XP).'));
                }
            } catch (error) {
                if (error.status !== 401) {
                    window.AppToast?.error(error.message || t('lesson.save_error', 'Không lưu được tiến độ.'));
                }
            } finally {
                completeBtn.disabled = false;
            }
            return;
        }

        const button = event.target.closest('[data-field="audio"]');
        if (!button) return;
        const wasPlaying = playingButton === button;
        stopAll();
        if (wasPlaying) return;

        playingButton = button;
        button.setAttribute('aria-pressed', 'true');
        if (button.dataset.src) {
            player.src = button.dataset.src;
            player.play().catch(error => {
                if (error?.name === 'AbortError') return; // bị ngắt do bấm sang mục khác
                audioError(button);
            });
        } else {
            speak(button, button.dataset.speak);
        }
    });

    // Rời trang thì dừng giọng đọc (speechSynthesis không tự dừng khi chuyển trang trên một số trình duyệt)
    window.addEventListener('pagehide', stopAll);

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
            const nextLink = $('[data-lesson-next]');
            const nextLesson = lessons[index + 1];
            setPagerLink(nextLink, nextLesson);
            if (nextLesson && nextLink) {
                if (nextLesson.isLocked) {
                    nextLink.setAttribute('aria-disabled', 'true');
                    nextLink.title = t('lesson.next_locked', 'Hoàn thành bài hiện tại để mở bài tiếp theo.');
                    nextLink.classList.add('is-locked');
                } else {
                    nextLink.removeAttribute('aria-disabled');
                    nextLink.removeAttribute('title');
                    nextLink.classList.remove('is-locked');
                }
            }
        } catch {
            // Không có danh sách thì ẩn điều hướng, nội dung bài vẫn dùng được
        }
    }

    async function loadLessonProgress(id) {
        try {
            const progress = await window.AppApi.get(`/api/progress/lessons/${encodeURIComponent(id)}`);
            if (!progress || !Array.isArray(progress.completedContentIds)) return;
            lessonProgress = progress;
            completedContentIds = new Set(progress.completedContentIds);
            syncContentButtons();
            renderProgressBadge();
            restoreLatestQuizState(progress);
        } catch {
            // Bỏ qua nếu không tải được tiến độ; nội dung bài vẫn hiển thị bình thường
        }
    }

    function restoreLatestQuizState(progress) {
        if (forceQuizRetry || !currentLesson || !currentLesson.quiz.length || progress.quizAttempts < 1 || !Number.isInteger(progress.lastQuizScore)) return;
        const resultLink = $('[data-quiz-result-link]');
        try {
            // A resumed in-progress attempt takes precedence over a previously submitted result.
            if (sessionStorage.getItem(draftKey(currentLesson.lessonId))) return;
            const saved = JSON.parse(sessionStorage.getItem(`${draftKey(currentLesson.lessonId)}:result`) || 'null');
            if (saved?.quizSignature === quizSignature()
                && saved.submission?.attempt?.score === progress.lastQuizScore
                && saved.submission.attempt?.progress?.quizAttempts === progress.quizAttempts
                && Array.isArray(saved.submission.questions)) {
                renderQuizResult(saved.submission);
                if (resultLink && window.QuizResult) {
                    resultLink.href = window.QuizResult.resultUrl(currentLesson.lessonId);
                    resultLink.hidden = false;
                }
                return;
            }
        } catch { /* Use the server progress summary if the cached result is unavailable. */ }
        const form = $('[data-quiz-form]');
        const result = $('[data-quiz-result]');
        if (!form || !result) return;
        form.hidden = true;
        result.hidden = false;
        if (resultLink && window.QuizResult) {
            resultLink.href = window.QuizResult.resultUrl(currentLesson.lessonId);
            resultLink.hidden = false;
        }
        const lastScore = progress.lastQuizScore ?? 0;
        const score = $('[data-quiz-score]');
        const title = $('[data-quiz-result-title]');
        const meta = $('[data-quiz-result-meta]');
        result.querySelector('.lesson-quiz__score-card')?.classList.toggle('is-pass', lastScore >= 60);
        if (score) score.textContent = `${lastScore}%`;
        if (title) title.textContent = lastScore >= 60
            ? t('lesson.quiz_pass_title', 'Chúc mừng! Bạn đã đạt bài kiểm tra')
            : t('lesson.quiz_fail_title', 'Chưa đạt — hãy thử lại nhé');
        if (meta) meta.textContent = `${t('lesson.restored_attempt', 'Đã khôi phục kết quả gần nhất')} · ${progress.quizAttempts} ${t('lesson.attempts', 'lần làm')}`;
        const retry = $('[data-action="retry-quiz"]');
        if (retry) retry.hidden = false;
        const subtitle = $('[data-quiz-subtitle]');
        if (subtitle) subtitle.textContent = t('lesson.restored_feedback_note', 'Phản hồi chi tiết từng câu chỉ hiển thị ngay sau khi nộp bài.');
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
            try {
                const { data } = await window.sb?.auth.getSession();
                userScope = data?.session?.user?.id || 'anonymous';
            } catch { /* Local development can run without an authenticated Supabase session. */ }
            const lesson = await window.AppApi.get(`/api/lessons/${encodeURIComponent(lessonId)}`);
            if (forceQuizRetry) {
                try {
                    sessionStorage.removeItem(draftKey(lesson.lessonId));
                    const cleanUrl = new URL(window.location.href);
                    if (cleanUrl.searchParams.has('retry')) {
                        cleanUrl.searchParams.delete('retry');
                        window.history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
                    }
                } catch { /* Ignore unavailable history or storage. */ }
            }
            render(lesson);
            show('ready');
            loadPager(lesson.lessonId);
            loadLessonProgress(lesson.lessonId);
            // Ghi nhận đã mở bài; lỗi ở đây không ảnh hưởng việc học
            window.AppApi.post(`/api/progress/lessons/${encodeURIComponent(lesson.lessonId)}/open`).catch(() => {});

            if (openQuizOnLoad) {
                $('[data-lesson-quiz-section]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            if (error.status === 401) return; // AppApi đã chuyển sang trang đăng nhập
            if (error.status === 404 || error.status === 400) showMessage('not_found');
            else if (error.status === 403) showMessage(error.body?.code === 'lesson_locked' ? 'locked' : 'inactive');
            else showMessage(error.status === 0 ? 'network' : 'error');
        }
    }

    $('[data-quiz-form]')?.addEventListener('submit', async event => {
        event.preventDefault();
        if (!currentLesson || renderedQuizQuestions.length === 0) return;
        if (activeQuestionIndex < renderedQuizQuestions.length - 1) {
            moveQuestion(1);
            return;
        }
        if (!isCurrentAnswerChecked()) {
            await checkCurrentAnswer();
            return;
        }
        const submitBtn = $('[data-action="submit-quiz"]');
        if (submitBtn) submitBtn.disabled = true;
        const form = $('[data-quiz-form]');
        if (form) form.querySelectorAll('input').forEach(input => { input.disabled = true; });
        try {
            const answers = collectQuizAnswers();
            const elapsedMs = quizStartedAt > 0 ? Math.max(0, Date.now() - quizStartedAt) : null;
            const durationSeconds = elapsedMs !== null ? Math.min(86400, Math.round(elapsedMs / 1000)) : null;
            const payload = durationSeconds === null ? { answers } : { answers, durationSeconds };
            const submission = await window.AppApi.post(
                `/api/progress/lessons/${encodeURIComponent(currentLesson.lessonId)}/quiz`,
                payload
            );
            forceQuizRetry = false;
            renderQuizResult(submission);
            await linkResultPage(currentLesson.lessonId, submission, elapsedMs);
            loadPager(currentLesson.lessonId);
            if (submission.attempt?.xpAwarded > 0) {
                window.AppToast?.success(`+${submission.attempt.xpAwarded} XP!`);
            }
        } catch (error) {
            if (error.status !== 401) {
                window.AppToast?.error(error.message || t('lesson.quiz_submit_error', 'Không nộp được bài kiểm tra.'));
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            const activeForm = $('[data-quiz-form]');
            if (activeForm && !activeForm.hidden) activeForm.querySelectorAll('input').forEach(input => { input.disabled = false; });
        }
    });

    // Lưu kết quả cho trang /Result/{lessonId} (xem lại chi tiết, lọc câu sai); đóng tab thì trang đó đọc lại từ DB.
    async function linkResultPage(lessonId, submission, durationMs = null) {
        const link = $('[data-quiz-result-link]');
        if (!link || !window.QuizResult) return;
        const resolvedDurationMs = durationMs ?? (quizStartedAt ? Math.max(0, Date.now() - quizStartedAt) : null);
        await window.QuizResult.save(lessonId, submission, { durationMs: resolvedDurationMs });
        link.href = window.QuizResult.resultUrl(lessonId);
        link.hidden = false;
    }

    $('[data-action="retry-quiz"]')?.addEventListener('click', async () => {
        if (!currentLesson) return;
        try {
            const latestQuiz = await window.AppApi.get(`/api/lessons/${encodeURIComponent(currentLesson.lessonId)}/quiz`);
            if (Array.isArray(latestQuiz)) {
                currentLesson.quiz = latestQuiz;
            }
        } catch {
            // Giữ danh sách câu hỏi hiện có nếu lỗi mạng
        }
        const form = $('[data-quiz-form]');
        const result = $('[data-quiz-result]');
        if (result) result.hidden = true;
        if (form) form.hidden = false;
        if (form) form.querySelectorAll('input').forEach(input => { input.disabled = false; });
        try { sessionStorage.removeItem(draftKey(currentLesson.lessonId)); } catch { /* Ignore unavailable storage. */ }
        renderQuizQuestions(currentLesson, false);
    });

    $('[data-action="check-answer"]')?.addEventListener('click', checkCurrentAnswer);
    $('[data-action="previous-question"]')?.addEventListener('click', () => moveQuestion(-1));
    $('[data-action="next-question"]')?.addEventListener('click', () => moveQuestion(1));
    $('[data-quiz-form]')?.addEventListener('input', () => {
        clearStaleCheck();
        saveQuizDraft();
        updateGameStep();
    });
    $('[data-quiz-form]')?.addEventListener('change', () => {
        clearStaleCheck();
        saveQuizDraft();
        updateGameStep();
    });
    $('[data-lesson-next]')?.addEventListener('click', event => {
        if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });

    $('[data-action="complete-lesson"]')?.addEventListener('click', async () => {
        if (!currentLesson) return;
        const btn = $('[data-action="complete-lesson"]');
        if (btn) btn.disabled = true;
        try {
            const updated = await window.AppApi.post(`/api/progress/lessons/${encodeURIComponent(currentLesson.lessonId)}/complete`);
            if (updated) {
                lessonProgress = updated;
                renderProgressBadge();
                updateCompleteLessonWrap();
                loadPager(currentLesson.lessonId);
                window.AppToast?.success(t('lesson.completed_toast', 'Đã hoàn thành bài học (+20 XP)!'));
            }
        } catch (error) {
            if (error.status !== 401) {
                window.AppToast?.error(error.message || t('lesson.complete_error', 'Chưa thể hoàn thành bài học.'));
            }
            updateCompleteLessonWrap();
        }
    });

    $('[data-action="retry"]').addEventListener('click', load);
    load();
});
