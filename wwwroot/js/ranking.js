// Bảng xếp hạng tổng (SCRUM-95). Markup: Pages/Ranking.cshtml, style: wwwroot/css/Ranking.css.
// Dữ liệu: GET /api/rankings?period=week|month|all&limit=50 và GET /api/users/{username}
// (contract ở docs/frontend/API_CLIENT.md, mục SCRUM-94).
(() => {
    const PERIODS = ['week', 'month', 'all'];
    const LIMIT = 50;

    const $ = selector => document.querySelector(selector);
    const page = $('.ranking-page');
    if (!page) return;

    const tabBar = $('[data-ranking-tabs]');
    const pill = tabBar.querySelector('.ranking-tabs__pill');
    const tabs = Array.from(tabBar.querySelectorAll('[role="tab"]'));
    const panel = $('[data-ranking-panel]');
    const skeleton = $('[data-ranking-skeleton]');
    const statusEl = $('[data-ranking-status]');
    const list = $('[data-ranking-list]');
    const emptyEl = $('[data-ranking-empty]');
    const errorEl = $('[data-ranking-error]');
    const errorMessage = $('[data-ranking-error-message]');
    const retryBtn = $('[data-ranking-retry]');
    const sinceEl = $('[data-ranking-since]');
    const privateBanner = $('[data-ranking-private]');
    const me = {
        root: $('[data-ranking-me]'),
        avatar: $('[data-ranking-me-avatar]'),
        period: $('[data-ranking-me-period]'),
        rank: $('[data-ranking-me-rank]'),
        xp: $('[data-ranking-me-xp]')
    };

    const t = (key, fallback) => window.AppI18n?.t(key, fallback) || fallback;
    const locale = () => (window.AppI18n?.language === 'en' ? 'en-US' : 'vi-VN');
    const formatNumber = value => new Intl.NumberFormat(locale()).format(Number(value) || 0);
    const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Cache theo kỳ: { status: 'loading' | 'ready' | 'error', data, error, promise }
    const cache = new Map();
    let activePeriod = 'week';

    // ---------- Avatar ----------
    function paintAvatar(target, person) {
        const badge = window.AppUserBadge;
        if (badge?.renderAvatar) {
            badge.renderAvatar(target, {
                displayName: person.displayName,
                username: person.username,
                avatarPath: person.avatarPath,
                imgClass: 'ranking-avatar-img',
                alt: ''
            });
            return;
        }
        const name = String(person.displayName || person.username || '?').trim();
        target.textContent = name.slice(0, 2).toUpperCase();
    }

    // Màu nền avatar khi chưa có ảnh: chọn ổn định theo username trong bảng mảng màu sticker
    const AVATAR_TONES = ['sand', 'mint', 'pink', 'orange', 'purple'];
    function toneFor(username) {
        let hash = 0;
        for (const ch of String(username || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        return AVATAR_TONES[hash % AVATAR_TONES.length];
    }

    // ---------- Nhãn theo kỳ ----------
    const periodLabel = period => ({
        week: t('ui.this_week', 'Tuần này'),
        month: t('ui.this_month', 'Tháng này'),
        all: t('ui.all', 'Tất cả')
    }[period]);

    const xpLabel = period => ({
        week: t('ranking.xp_week', 'XP tuần này'),
        month: t('ranking.xp_month', 'XP tháng này'),
        all: t('ranking.xp_all', 'Tổng XP')
    }[period]);

    function sinceText(data) {
        if (!data?.periodStart) return t('ranking.since_all', 'Tính trên tổng XP từ trước đến nay');
        const [y, m, d] = data.periodStart.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const formatted = new Intl.DateTimeFormat(locale(), { weekday: data.period === 'week' ? 'long' : undefined, day: 'numeric', month: 'numeric' }).format(date);
        return t('ranking.since', 'Tính từ {date}').replace('{date}', formatted);
    }

    // ---------- Tabs ----------
    function movePill(tab, animate) {
        if (!pill || !tab) return;
        const apply = () => {
            pill.style.transform = `translateX(${tab.offsetLeft}px)`;
            pill.style.width = `${tab.offsetWidth}px`;
        };
        if (animate && !reduceMotion()) {
            apply();
            return;
        }
        const previous = pill.style.transition;
        pill.style.transition = 'none';
        apply();
        void pill.offsetWidth;
        pill.style.transition = previous;
    }

    function selectTab(tab, { focus = false } = {}) {
        const period = tab.dataset.period;
        tabs.forEach(item => {
            const selected = item === tab;
            item.setAttribute('aria-selected', String(selected));
            item.tabIndex = selected ? 0 : -1;
        });
        panel.setAttribute('aria-labelledby', tab.id);
        movePill(tab, true);
        if (focus) tab.focus();
        if (period === activePeriod && cache.get(period)?.status !== 'error') return;
        activePeriod = period;
        try { sessionStorage.setItem('wordfox.rankingPeriod', period); } catch { /* bỏ qua */ }
        load(period);
    }

    tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab)));

    tabBar.addEventListener('keydown', event => {
        const index = tabs.indexOf(document.activeElement);
        if (index < 0) return;
        let next = null;
        if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
        else if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (event.key === 'Home') next = tabs[0];
        else if (event.key === 'End') next = tabs[tabs.length - 1];
        if (!next) return;
        event.preventDefault();
        selectTab(next, { focus: true });
    });

    const activeTab = () => tabs.find(tab => tab.dataset.period === activePeriod) || tabs[0];
    window.addEventListener('resize', () => movePill(activeTab(), false));

    // ---------- Tải dữ liệu ----------
    function load(period, { force = false } = {}) {
        const entry = cache.get(period);
        if (!force && entry && entry.status !== 'error') {
            if (entry.status === 'ready') render(period);
            else showLoading();
            return entry.promise;
        }

        showLoading();
        const promise = window.AppApi.get(`/api/rankings?period=${encodeURIComponent(period)}&limit=${LIMIT}`)
            .then(data => {
                cache.set(period, { status: 'ready', data });
            })
            .catch(error => {
                cache.set(period, { status: 'error', error });
            })
            .finally(() => {
                // Bỏ qua response của tab cũ khi người dùng đã chuyển tab khác
                if (period === activePeriod) render(period);
            });
        cache.set(period, { status: 'loading', promise });
        return promise;
    }

    function setPanelState(state) {
        panel.dataset.state = state;
        panel.setAttribute('aria-busy', String(state === 'loading'));
        skeleton.hidden = state !== 'loading';
        list.hidden = state !== 'ready';
        emptyEl.hidden = state !== 'empty';
        errorEl.hidden = state !== 'error';
    }

    function showLoading() {
        setPanelState('loading');
        statusEl.textContent = t('ranking.loading', 'Đang tải bảng xếp hạng...');
        me.root.dataset.state = 'loading';
    }

    function render(period) {
        const entry = cache.get(period);
        if (!entry || entry.status === 'loading') {
            showLoading();
            return;
        }
        if (entry.status === 'error') {
            renderError(entry.error);
            return;
        }

        const data = entry.data || {};
        const entries = Array.isArray(data.entries) ? data.entries : [];
        renderMe(data.currentUser, period);
        sinceEl.textContent = sinceText(data);

        if (entries.length === 0) {
            list.replaceChildren();
            setPanelState('empty');
            statusEl.textContent = t('ranking.empty_title', 'Chưa ai ghi XP trong kỳ này');
            return;
        }

        renderList(entries, period);
        setPanelState('ready');
        statusEl.textContent = t('ranking.loaded', 'Đã tải {count} người học').replace('{count}', formatNumber(entries.length));
        if (!reduceMotion()) {
            list.classList.remove('is-entering');
            void list.offsetWidth;
            list.classList.add('is-entering');
        }
    }

    function renderList(entries, period) {
        const topXp = Math.max(1, ...entries.map(item => Number(item.xp) || 0));
        const fragment = document.createDocumentFragment();

        entries.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            li.style.setProperty('--i', String(Math.min(index, 10)));

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ranking-row';
            if (item.isCurrentUser) button.classList.add('ranking-row--you');
            if (item.rank <= 3) button.classList.add(`ranking-row--top${item.rank}`);
            button.dataset.username = item.username;
            button.dataset.rank = String(item.rank);
            button.dataset.xp = String(item.xp);
            button.setAttribute('aria-label', t('ranking.row_label', 'Hạng {rank}: {name}, {xp} XP. Xem hồ sơ')
                .replace('{rank}', item.rank)
                .replace('{name}', item.displayName || item.username)
                .replace('{xp}', formatNumber(item.xp)));

            const rank = document.createElement('span');
            rank.className = 'ranking-row__rank';
            rank.textContent = String(item.rank);

            const avatar = document.createElement('span');
            avatar.className = `ranking-avatar ranking-avatar--${toneFor(item.username)}`;
            paintAvatar(avatar, item);

            const who = document.createElement('span');
            who.className = 'ranking-row__who';
            const name = document.createElement('span');
            name.className = 'ranking-row__name';
            name.textContent = item.displayName || item.username;
            who.append(name);
            if (item.isCurrentUser) {
                const you = document.createElement('span');
                you.className = 'tag ranking-row__you';
                you.dataset.i18n = 'ui.you';
                you.textContent = t('ui.you', 'Bạn');
                who.append(you);
            }
            const handle = document.createElement('span');
            handle.className = 'ranking-row__handle';
            handle.textContent = `@${item.username}`;
            who.append(handle);

            const bar = document.createElement('span');
            bar.className = 'ranking-row__bar';
            const fill = document.createElement('i');
            const ratio = Math.max(0, Math.min(1, (Number(item.xp) || 0) / topXp));
            fill.style.setProperty('--ratio', ratio.toFixed(4));
            bar.append(fill);

            const xp = document.createElement('span');
            xp.className = 'ranking-row__xp';
            const xpValue = document.createElement('b');
            xpValue.textContent = formatNumber(item.xp);
            const xpUnit = document.createElement('small');
            xpUnit.textContent = 'XP';
            xp.append(xpValue, xpUnit);

            button.append(rank, avatar, who, bar, xp);
            button.addEventListener('click', () => openProfile(button, item, period));
            li.append(button);
            fragment.append(li);
        });

        list.replaceChildren(fragment);
    }

    function renderMe(currentUser, period) {
        me.root.dataset.state = 'ready';
        me.period.textContent = `· ${periodLabel(period)}`;
        if (!currentUser) {
            me.rank.textContent = '—';
            me.xp.textContent = '';
            privateBanner.hidden = true;
            return;
        }

        me.avatar.className = `ranking-me__avatar ranking-avatar ranking-avatar--${toneFor(currentUser.username)}`;
        paintAvatar(me.avatar, currentUser);

        if (currentUser.rank == null) {
            me.root.dataset.unranked = 'true';
            me.rank.textContent = t('ranking.unranked', 'Chưa có hạng');
        } else {
            delete me.root.dataset.unranked;
            me.rank.textContent = `#${formatNumber(currentUser.rank)}`;
        }

        const xpText = `${formatNumber(currentUser.xp)} ${xpLabel(period)}`;
        me.xp.textContent = currentUser.rank == null && !(Number(currentUser.xp) > 0)
            ? t('ranking.unranked_hint', 'Ghi XP trong kỳ này để có hạng.')
            : xpText;

        privateBanner.hidden = String(currentUser.profileVisibility).toLowerCase() !== 'private';
    }

    function renderError(error) {
        setPanelState('error');
        me.root.dataset.state = 'error';
        me.rank.textContent = '—';
        me.xp.textContent = '';
        const status = error?.status;
        let key = 'ranking.error_server';
        let fallback = 'Máy chủ đang gặp sự cố. Bạn thử lại sau ít phút nhé.';
        if (status === 0) {
            key = 'ranking.error_network';
            fallback = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
        } else if (status === 404) {
            key = 'ranking.error_no_profile';
            fallback = 'Tài khoản chưa có hồ sơ. Hãy mở trang Hồ sơ để hoàn tất rồi quay lại.';
        }
        errorMessage.textContent = t(key, fallback);
        statusEl.textContent = t('ranking.error_title', 'Chưa tải được bảng xếp hạng');
    }

    retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.setAttribute('aria-busy', 'true');
        await load(activePeriod, { force: true });
        retryBtn.disabled = false;
        retryBtn.removeAttribute('aria-busy');
        if (cache.get(activePeriod)?.status === 'ready') panel.focus({ preventScroll: true });
    });

    // ---------- Modal hồ sơ công khai ----------
    const dialog = $('[data-ranking-profile]');
    const card = $('[data-ranking-profile-card]');
    const closeBtn = $('[data-ranking-profile-close]');
    const profile = {
        avatar: $('[data-ranking-profile-avatar]'),
        name: $('[data-ranking-profile-name]'),
        username: $('[data-ranking-profile-username]'),
        rank: $('[data-ranking-profile-rank]'),
        xpLabel: $('[data-ranking-profile-xp-label]'),
        xp: $('[data-ranking-profile-xp]'),
        bio: $('[data-ranking-profile-bio]')
    };
    const profileCache = new Map();
    let returnFocusTo = null;
    let profileRequest = 0;
    let closeTimer = 0;

    const closeMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur')) || 150;

    function setBio(state, text) {
        profile.bio.dataset.state = state;
        profile.bio.replaceChildren();
        if (state === 'loading') {
            const line = document.createElement('span');
            line.className = 'ranking-profile__bio-skeleton';
            const line2 = line.cloneNode();
            profile.bio.append(line, line2);
            profile.bio.setAttribute('aria-busy', 'true');
            return;
        }
        profile.bio.removeAttribute('aria-busy');
        const p = document.createElement('p');
        p.textContent = text;
        profile.bio.append(p);
        if (state === 'error') {
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'btn btn--sm';
            retry.dataset.i18n = 'dash.retry';
            retry.textContent = t('dash.retry', 'Thử lại');
            retry.addEventListener('click', () => fetchProfile(dialog.dataset.username, true));
            profile.bio.append(retry);
        }
    }

    function fillProfile(person) {
        profile.name.textContent = person.displayName || person.username;
        profile.username.textContent = `@${person.username}`;
        profile.avatar.className = `ranking-profile__avatar ranking-avatar ranking-avatar--${toneFor(person.username)}`;
        paintAvatar(profile.avatar, person);
    }

    async function fetchProfile(username, force = false) {
        const requestId = ++profileRequest;
        if (!force && profileCache.has(username)) {
            showProfileResult(profileCache.get(username));
            return;
        }
        setBio('loading');
        let result;
        try {
            const data = await window.AppApi.get(`/api/users/${encodeURIComponent(username)}`);
            result = { status: 'ready', data };
            profileCache.set(username, result);
        } catch (error) {
            if (error?.status === 401) return;
            result = { status: error?.status === 404 ? 'private' : 'error', status_code: error?.status };
            if (result.status === 'private') profileCache.set(username, result);
        }
        // Bỏ qua response cũ nếu người dùng đã mở hồ sơ khác
        if (requestId !== profileRequest || dialog.dataset.username !== username) return;
        showProfileResult(result);
    }

    function showProfileResult(result) {
        if (result.status === 'ready') {
            fillProfile(result.data);
            const bio = String(result.data.bio || '').trim();
            setBio(bio ? 'ready' : 'empty', bio || t('ranking.profile_no_bio', 'Người học này chưa viết giới thiệu.'));
        } else if (result.status === 'private') {
            setBio('private', t('ranking.profile_private', 'Hồ sơ này vừa chuyển sang riêng tư hoặc không còn tồn tại.'));
        } else {
            setBio('error', result.status_code === 0
                ? t('ranking.error_network', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
                : t('ranking.profile_error', 'Chưa tải được hồ sơ.'));
        }
    }

    function openProfile(trigger, item, period) {
        returnFocusTo = trigger;
        window.clearTimeout(closeTimer);
        card.classList.remove('is-closing');
        dialog.dataset.username = item.username;
        dialog.dataset.period = period;

        // Hiện ngay phần đã biết từ bảng xếp hạng, phần giới thiệu nạp sau
        fillProfile(item);
        profile.rank.textContent = `#${formatNumber(item.rank)}`;
        profile.xpLabel.textContent = xpLabel(period);
        profile.xp.textContent = formatNumber(item.xp);

        if (!dialog.open) dialog.showModal();
        document.body.classList.add('has-ranking-modal');
        requestAnimationFrame(() => {
            card.classList.add('is-open');
            dialog.classList.add('is-open');
        });
        closeBtn.focus({ preventScroll: true });
        fetchProfile(item.username);
    }

    function closeProfile() {
        if (!dialog.open) return;
        profileRequest++;
        card.classList.remove('is-open');
        dialog.classList.remove('is-open');
        const username = dialog.dataset.username || '';
        const finish = () => {
            card.classList.remove('is-closing');
            if (dialog.open) dialog.close();
            document.body.classList.remove('has-ranking-modal');
            delete dialog.dataset.username;
            // Dòng cũ có thể đã bị render lại (đổi ngôn ngữ), khi đó tìm dòng mới cùng username
            const target = returnFocusTo && document.contains(returnFocusTo)
                ? returnFocusTo
                : list.querySelector(`[data-username="${CSS.escape(username)}"]`);
            target?.focus({ preventScroll: true });
            returnFocusTo = null;
        };
        if (reduceMotion()) {
            finish();
            return;
        }
        card.classList.add('is-closing');
        closeTimer = window.setTimeout(finish, closeMs());
    }

    closeBtn.addEventListener('click', closeProfile);

    // Esc: chặn cancel mặc định để chạy hiệu ứng đóng rồi mới close()
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        closeProfile();
    });

    // Bấm ra vùng nền (chính thẻ dialog, ngoài thẻ hồ sơ) thì đóng
    dialog.addEventListener('click', event => {
        if (event.target === dialog) closeProfile();
    });

    // Khóa focus trong modal (showModal đã làm nền inert, thêm vòng Tab để không thoát ra thanh trình duyệt)
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const focusables = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
            .filter(el => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    // ---------- Ngôn ngữ ----------
    window.addEventListener('app:languagechange', () => {
        movePill(activeTab(), false);
        if (cache.get(activePeriod)?.status !== 'loading') render(activePeriod);
        if (dialog.open && dialog.dataset.username) {
            const cached = profileCache.get(dialog.dataset.username);
            if (cached) showProfileResult(cached);
            profile.xpLabel.textContent = xpLabel(dialog.dataset.period);
        }
    });

    // ---------- Khởi động ----------
    let initial = 'week';
    try {
        const saved = sessionStorage.getItem('wordfox.rankingPeriod');
        if (PERIODS.includes(saved)) initial = saved;
    } catch { /* bỏ qua */ }
    activePeriod = initial;
    const initialTab = activeTab();
    tabs.forEach(tab => {
        const selected = tab === initialTab;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', initialTab.id);

    requestAnimationFrame(() => movePill(initialTab, false));
    document.fonts?.ready.then(() => movePill(activeTab(), false));
    window.AppI18n?.ready?.then(() => movePill(activeTab(), false));

    document.body.classList.add('page-ready');
    load(initial);
})();
