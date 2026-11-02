document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    const page = document.querySelector('.home-page.dash');
    if (!page) return;

    const views = {
        loading: page.querySelector('[data-dashboard-view="loading"]'),
        ready: page.querySelector('[data-dashboard-view="ready"]'),
        error: page.querySelector('[data-dashboard-view="error"]')
    };
    const summary = page.querySelector('[data-dashboard-summary]');
    const nameSlot = page.querySelector('[data-user-name]');
    const streakCard = page.querySelector('[data-dashboard-streak]');
    const retryButton = page.querySelector('[data-dashboard-retry]');
    const errorTitle = page.querySelector('[data-error-title]');
    const errorText = page.querySelector('[data-error-text]');
    const currentTag = page.querySelector('[data-current-tag]');
    const currentTitle = page.querySelector('[data-current-title]');
    const currentText = page.querySelector('[data-current-text]');
    const currentMeta = page.querySelector('[data-current-meta]');
    const currentDate = page.querySelector('[data-current-date]');
    const currentBar = page.querySelector('[data-current-bar]');
    const currentLink = page.querySelector('[data-current-link]');
    const completionBar = page.querySelector('[data-completion-bar]');
    const recommendationList = page.querySelector('[data-recommendations]');
    const recommendationEmpty = page.querySelector('[data-recs-empty]');

    const t = (key, fallback) => window.AppI18n?.t(key, fallback) || fallback;
    const format = (key, fallback, values) => Object.entries(values).reduce(
        (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
        t(key, fallback)
    );
    const locale = () => document.documentElement.lang === 'en' ? 'en' : 'vi';
    const number = value => new Intl.NumberFormat(locale()).format(value);
    const setText = (selector, value) => {
        const element = page.querySelector(selector);
        if (element) element.textContent = value;
    };

    const MESSAGES = {
        network: ['dash.error_title', 'Chưa tải được trang chủ', 'dash.network_text', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', true],
        inactive: ['dash.inactive_title', 'Tài khoản không hoạt động', 'dash.inactive_text', 'Tài khoản của bạn không hoạt động nên chưa thể tải tiến độ.', false],
        error: ['dash.error_title', 'Chưa tải được trang chủ', 'dash.error_text', 'Không tải được tiến độ học tập. Vui lòng thử lại.', true]
    };

    let currentUser = null;
    let requestVersion = 0;
    let lastData = null;
    let lastError = 'error';

    function setView(name) {
        page.dataset.dashboardState = name;
        page.setAttribute('aria-busy', String(name === 'loading'));
        Object.entries(views).forEach(([key, element]) => { element.hidden = key !== name; });
    }

    function setSummary(text) {
        if (summary) summary.textContent = text;
    }

    function renderName() {
        if (!nameSlot) return;
        nameSlot.removeAttribute('data-i18n');
        const meta = currentUser?.user_metadata || {};
        const fullName = String(meta.display_name || meta.full_name || '').trim();
        nameSlot.textContent = fullName
            ? fullName.split(/\s+/).slice(-2).join(' ')
            : t('dash.friend', 'bạn');
    }

    function showError(kind) {
        lastError = kind;
        const [titleKey, title, textKey, text, retryable] = MESSAGES[kind];
        errorTitle.textContent = t(titleKey, title);
        errorText.textContent = t(textKey, text);
        retryButton.hidden = !retryable;
        streakCard.hidden = true;
        page.dataset.dashboardMode = 'error';
        setSummary(t('dash.error_summary', 'Vui lòng thử lại sau.'));
        setView('error');
    }

    function dateText(value) {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }

    function setProgress(element, percent) {
        if (!element) return;
        element.querySelector('i').style.width = `${percent}%`;
        element.setAttribute('aria-valuenow', String(percent));
    }

    function renderCurrent(data) {
        const current = data.current;
        currentTag.removeAttribute('data-i18n');
        currentBar.hidden = true;
        currentDate.hidden = true;
        currentLink.hidden = false;

        if (current) {
            currentTag.textContent = t('dash.continue_tag', 'Bài đang học');
            currentTitle.textContent = current.name;
            currentText.textContent = current.description;
            currentMeta.textContent = current.contentCount > 0
                ? format('dash.continue_meta', '{topic} · {done}/{total} mục · {minutes} phút', {
                    topic: current.topic,
                    done: number(Math.min(current.completedContents, current.contentCount)),
                    total: number(current.contentCount),
                    minutes: number(current.estimatedMinutes)
                })
                : format('dash.continue_meta_no_content', '{topic} · {minutes} phút', {
                    topic: current.topic,
                    minutes: number(current.estimatedMinutes)
                });

            if (current.contentCount > 0) {
                currentBar.hidden = false;
                currentBar.setAttribute('aria-label', `${current.name}: ${current.contentPercent}%`);
                setProgress(currentBar, current.contentPercent);
            }

            const studied = dateText(current.lastStudiedAt);
            if (studied) {
                currentDate.textContent = format('dash.last_studied', 'Học lần cuối {date}', { date: studied });
                currentDate.hidden = false;
            }

            currentLink.href = `/Lesson/${encodeURIComponent(current.lessonId)}`;
            currentLink.textContent = t('dash.go_learn', 'Tiếp tục bài học →');
            return;
        }

        if (data.currentUnavailable) {
            currentTag.textContent = t('dash.continue_tag', 'Bài đang học');
            currentTitle.textContent = t('dash.current_unavailable_title', 'Bài đang học không còn khả dụng');
            currentText.textContent = t('dash.current_unavailable_text', 'Bài học trước không còn trong danh sách. Hãy chọn một bài khác.');
            currentMeta.textContent = '';
            currentLink.href = '/Study';
            currentLink.textContent = t('dash.choose_lesson', 'Chọn bài ở trang Học tập →');
            return;
        }

        if (data.mode === 'empty') {
            currentTag.textContent = t('dash.first_use_tag', 'Bắt đầu');
            currentTitle.textContent = t('dash.no_lessons_title', 'Chưa có bài học');
            currentText.textContent = t('dash.no_lessons_text', 'Hiện chưa có bài học nào trong thư viện.');
            currentMeta.textContent = '';
            currentLink.hidden = true;
            return;
        }

        currentTag.textContent = t('dash.first_use_tag', 'Bắt đầu');
        if (data.mode === 'first-use') {
            currentTitle.textContent = t('dash.first_use_title', 'Bạn chưa bắt đầu bài học nào');
            currentText.textContent = t('dash.first_use_text', 'Chọn một bài học thật để bắt đầu hành trình.');
        } else if (data.completion.completed === data.completion.total) {
            currentTitle.textContent = t('dash.all_done_title', 'Bạn đã hoàn thành tất cả bài học');
            currentText.textContent = t('dash.all_done_text', 'Xem lại bài cũ hoặc quay lại khi có bài học mới.');
        } else {
            currentTitle.textContent = t('dash.choose_title', 'Chọn bài học tiếp theo');
            currentText.textContent = t('dash.choose_text', 'Bạn chưa có bài đang học. Chọn một bài từ danh sách gợi ý.');
        }
        currentMeta.textContent = '';

        const next = data.recommendations[0];
        if (next && data.mode === 'first-use') {
            currentLink.href = `/Lesson/${encodeURIComponent(next.lessonId)}`;
            currentLink.textContent = t('dash.start_first', 'Bắt đầu bài đầu tiên →');
        } else {
            currentLink.href = '/Study';
            currentLink.textContent = t('dash.choose_lesson', 'Chọn bài ở trang Học tập →');
        }
    }

    function recommendationItem(lesson, index) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'dash-rec';
        link.href = `/Lesson/${encodeURIComponent(lesson.lessonId)}`;

        const order = document.createElement('span');
        order.className = 'dash-rec__no';
        order.textContent = String(index + 1).padStart(2, '0');

        const body = document.createElement('span');
        body.className = 'dash-rec__body';
        const name = document.createElement('b');
        name.textContent = lesson.name;
        const meta = document.createElement('small');
        const status = lesson.progressStatus === 'in_progress'
            ? ` · ${t('dash.rec_status_in_progress', 'Đang học')}`
            : '';
        meta.textContent = format('dash.rec_meta', '{topic} · {minutes} phút · {count} mục', {
            topic: lesson.topic,
            minutes: number(lesson.estimatedMinutes),
            count: number(lesson.contentCount)
        }) + status;
        body.append(name, meta);

        const level = document.createElement('span');
        level.className = 'dash-rec__level';
        level.textContent = lesson.level;

        const arrow = document.createElement('span');
        arrow.className = 'dash-rec__arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';

        link.append(order, body, level, arrow);
        item.append(link);
        return item;
    }

    function renderRecommendations(data) {
        recommendationList.replaceChildren(...data.recommendations.map(recommendationItem));
        recommendationEmpty.hidden = data.recommendations.length > 0;
        if (data.recommendations.length === 0) {
            recommendationEmpty.textContent = data.mode === 'empty'
                ? t('dash.recs_no_lessons', 'Chưa có bài học để gợi ý.')
                : data.completion.completed === data.completion.total
                    ? t('dash.recs_empty', 'Bạn đã hoàn thành tất cả bài học hiện có.')
                    : t('dash.recs_unavailable', 'Chưa có gợi ý khả dụng. Xem các bài học ở trang Học tập.');
        }
    }

    function render(data) {
        const { stats, completion } = data;

        setText('[data-stat="total-xp"]', number(stats.totalXp));
        setText('[data-stat="today-xp"]', format('dash.stat_xp_today', 'Hôm nay +{xp} XP', {
            xp: number(stats.todayXp)
        }));
        setText('[data-stat="lessons-completed"]', number(completion.completed));
        setText('[data-stat="completed-meta"]', format('dash.stat_completed_meta', 'trong tổng số {total} bài', {
            total: number(completion.total)
        }));
        setText('[data-stat="lessons-in-progress"]', number(stats.lessonsInProgress));
        setText('[data-stat="in-progress-meta"]', stats.lessonsInProgress > 0
            ? format('dash.stat_in_progress_meta', '{count} bài đã bắt đầu', {
                count: number(stats.lessonsInProgress)
            })
            : t('dash.stat_in_progress_meta_zero', 'Chưa có bài nào đang học'));
        setText('[data-completion-percent]', `${number(completion.percent)}%`);
        setText('[data-completion-meta]', completion.total > 0
            ? format('dash.stat_completion_meta', '{completed}/{total} bài đã hoàn thành', {
                completed: number(completion.completed),
                total: number(completion.total)
            })
            : t('dash.completion_empty', 'Chưa có bài học để tính tiến độ.'));

        completionBar.querySelector('i').style.width = `${completion.percent}%`;
        completionBar.setAttribute('aria-valuenow', String(completion.percent));

        setText('[data-stat="streak"]', number(stats.currentStreak));
        setText('[data-stat="longest-streak"]', format('dash.longest', 'Kỷ lục {days} ngày', {
            days: number(stats.longestStreak)
        }));
        streakCard.setAttribute('aria-label', format('dash.streak_label', 'Chuỗi {days} ngày', {
            days: number(stats.currentStreak)
        }));
        streakCard.hidden = false;

        if (data.mode === 'empty') {
            setSummary(t('dash.summary_no_lessons', 'Hiện chưa có bài học nào để hiển thị.'));
        } else if (data.mode === 'first-use') {
            setSummary(t('dash.summary_first_use', 'Bạn chưa bắt đầu bài học nào. Chọn một bài để bắt đầu.'));
        } else if (data.currentUnavailable) {
            setSummary(t('dash.summary_current_unavailable', 'Bài đang học không còn trong danh sách bài học.'));
        } else {
            setSummary(format('dash.summary_progress', '{completed}/{total} bài đã hoàn thành · {inProgress} bài đang học', {
                completed: number(completion.completed),
                total: number(completion.total),
                inProgress: number(stats.lessonsInProgress)
            }));
        }

        page.dataset.dashboardMode = data.mode;
        renderCurrent(data);
        renderRecommendations(data);
        setView('ready');
    }

    async function load() {
        const version = ++requestVersion;
        lastData = null;
        page.dataset.dashboardMode = 'loading';
        streakCard.hidden = true;
        setSummary(t('dash.loading', 'Đang tải tiến độ học tập…'));
        setView('loading');

        if (!window.AppApi || !window.DashboardData) {
            showError('error');
            return;
        }

        try {
            const data = await window.DashboardData.loadDashboard(window.AppApi, () => version === requestVersion);
            if (version !== requestVersion) return;
            if (!data) {
                showError('error');
                return;
            }
            lastData = data;
            render(data);
        } catch (error) {
            if (version !== requestVersion || error.status === 401) return;
            showError(error.status === 0
                ? 'network'
                : error.status === 403 && error.body?.code === 'profile_inactive'
                    ? 'inactive'
                    : 'error');
        }
    }

    retryButton.addEventListener('click', load);

    window.addEventListener('app:languagechange', () => {
        renderName();
        if (page.dataset.dashboardState === 'ready' && lastData) render(lastData);
        else if (page.dataset.dashboardState === 'loading') setSummary(t('dash.loading', 'Đang tải tiến độ học tập…'));
        else if (page.dataset.dashboardState === 'error') showError(lastError);
    });

    async function start() {
        if (!window.sb) return;
        try {
            const { data, error } = await window.sb.auth.getUser();
            if (error || !data?.user) return;
            currentUser = data.user;
            renderName();
        } catch {
            return;
        }

        window.sb.auth.onAuthStateChange?.((event, session) => {
            if (event === 'SIGNED_OUT') {
                requestVersion++;
                lastData = null;
                currentUser = null;
                views.ready.replaceChildren();
                streakCard.hidden = true;
                page.hidden = true;
                renderName();
                window.location.replace('/Account/Login');
                return;
            }

            const user = session?.user;
            if (!user) return;
            const changed = currentUser?.id !== user.id;
            currentUser = user;
            renderName();
            if (changed) load();
        });

        await load();
    }

    start();
});
