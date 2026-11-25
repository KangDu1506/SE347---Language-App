// Điều khiển menu nổi bên trái trên mobile (<= 760px) và hiển thị avatar + tên người dùng trên nút Hồ sơ.
// Tệp markup: Pages/Shared/_Header.cshtml.
(() => {
    const CACHE_KEY = 'wordfox.headerProfile';

    function getSupabaseUrl() {
        return (document.querySelector('meta[name="supabase-url"]')?.content || '').trim().replace(/\/+$/, '');
    }

    function initialsFrom(name, username, email) {
        const clean = String(name || username || email?.split('@')[0] || 'U').trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return clean.slice(0, 2).toUpperCase();
    }

    function resolveAvatarUrl(avatarPath, explicitSupabaseUrl) {
        const clean = String(avatarPath || '').trim();
        if (!clean) return null;
        if (/^https?:\/\//i.test(clean) || /^\/(?!\/)/.test(clean)) return clean;
        const base = explicitSupabaseUrl || getSupabaseUrl();
        if (!base) return null;
        const normalized = clean.replace(/^\/+/, '').replace(/^avatars\/+/, '');
        if (!normalized) return null;
        const encoded = normalized.split('/').map(encodeURIComponent).join('/');
        return `${base}/storage/v1/object/public/avatars/${encoded}`;
    }

    function resolveDisplayName(profile, authUser, fallback = '') {
        const meta = authUser?.user_metadata || {};
        const email = profile?.email || authUser?.email || '';
        const emailPrefix = email ? email.split('@')[0] : '';
        return String(
            profile?.displayName
            || profile?.username
            || meta.display_name
            || meta.full_name
            || meta.fullName
            || meta.username
            || emailPrefix
            || fallback
        ).trim();
    }

    function renderAvatar(targetEl, options = {}) {
        if (!targetEl) return;
        const {
            displayName = '',
            username = '',
            email = '',
            avatarPath = null,
            imgClass = 'header-profile__avatar-img',
            alt = '',
            supabaseUrl = ''
        } = options;
        const initials = initialsFrom(displayName, username, email);
        const url = resolveAvatarUrl(avatarPath, supabaseUrl);

        if (!url) {
            targetEl.textContent = initials;
            return;
        }

        const existingImg = targetEl.firstElementChild;
        if (existingImg?.tagName === 'IMG' && existingImg.dataset.avatarSrc === url) {
            existingImg.alt = alt;
            return;
        }

        const img = document.createElement('img');
        img.className = imgClass;
        img.alt = alt;
        img.src = url;
        img.dataset.avatarSrc = url;
        img.addEventListener('error', () => {
            targetEl.textContent = initials;
        }, { once: true });
        targetEl.replaceChildren(img);
    }

    function readCache() {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    function writeCache(data) {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {
            // Bỏ qua nếu trình duyệt chặn sessionStorage
        }
    }

    function clearCache() {
        try {
            sessionStorage.removeItem(CACHE_KEY);
        } catch {
            // Bỏ qua nếu trình duyệt chặn sessionStorage
        }
    }

    const header = document.querySelector('[data-site-header]');
    const avatarEl = header?.querySelector('[data-header-avatar]') || null;
    const nameEl = header?.querySelector('[data-header-name]') || null;
    let syncedFromPage = false;

    function resetHeaderBadge() {
        if (avatarEl) avatarEl.textContent = '--';
        if (nameEl) {
            nameEl.setAttribute('data-i18n', 'profile.default_name');
            nameEl.textContent = window.AppI18n?.t('profile.default_name', 'Người học') || 'Người học';
        }
    }

    function paintHeaderBadge(data) {
        if (!header || !data) return;
        const displayName = String(data.displayName || data.username || '').trim();
        renderAvatar(avatarEl, {
            displayName,
            username: data.username || '',
            email: data.email || '',
            avatarPath: data.avatarPath || null
        });
        if (nameEl) {
            if (displayName) {
                nameEl.removeAttribute('data-i18n');
                nameEl.textContent = displayName;
            } else {
                nameEl.setAttribute('data-i18n', 'profile.default_name');
                nameEl.textContent = window.AppI18n?.t('profile.default_name', 'Người học') || 'Người học';
            }
        }
    }

    function syncProfile(profile, authUser) {
        const meta = authUser?.user_metadata || {};
        const email = profile?.email || authUser?.email || '';
        const username = profile?.username || meta.username || '';
        const displayName = resolveDisplayName(profile, authUser);
        const avatarPath = profile?.avatarPath ?? null;
        const payload = {
            userId: profile?.id || authUser?.id || null,
            displayName,
            username,
            email,
            avatarPath
        };
        if (profile) syncedFromPage = true;
        paintHeaderBadge(payload);
        if (payload.userId || displayName || email) writeCache(payload);
    }

    window.AppUserBadge = {
        initialsFrom,
        resolveAvatarUrl,
        resolveDisplayName,
        renderAvatar,
        syncProfile,
        clearCache
    };

    const cached = readCache();
    if (cached && (cached.displayName || cached.username || cached.email)) {
        paintHeaderBadge(cached);
    }

    async function fetchAndSyncProfile(authUser) {
        try {
            const headers = { Accept: 'application/json' };
            if (window.sb) {
                const token = (await window.sb.auth.getSession())?.data?.session?.access_token;
                if (!token) return;
                headers.Authorization = `Bearer ${token}`;
            }
            const response = await fetch('/api/users/me', { headers });
            if (!response.ok) return;
            const profile = await response.json();
            if (authUser?.id && profile?.id && profile.id !== authUser.id) return;
            syncProfile(profile, authUser);
        } catch {
            // Giữ fallback từ cache hoặc user_metadata nếu không tải được hồ sơ
        }
    }

    async function initHeaderProfile() {
        if (!header || (!avatarEl && !nameEl)) return;
        const localAuthBypassEnabled = document.querySelector('meta[name="local-auth-bypass"]')?.content === 'true';

        if (!window.sb) {
            if (localAuthBypassEnabled && !syncedFromPage) {
                await fetchAndSyncProfile(null);
            }
            return;
        }

        let currentUser = null;
        try {
            const { data, error } = await window.sb.auth.getUser();
            if (error || !data?.user) {
                clearCache();
                resetHeaderBadge();
                return;
            }
            currentUser = data.user;
        } catch {
            return;
        }

        const latestCached = readCache();
        if (latestCached?.userId === currentUser.id) {
            paintHeaderBadge(latestCached);
        } else {
            clearCache();
            syncProfile(null, currentUser);
        }

        if (!syncedFromPage) {
            fetchAndSyncProfile(currentUser);
        }

        window.sb.auth.onAuthStateChange?.((event, session) => {
            if (event === 'SIGNED_OUT') {
                syncedFromPage = false;
                clearCache();
                resetHeaderBadge();
                return;
            }
            const nextUser = session?.user;
            if (!nextUser) return;
            if (currentUser?.id !== nextUser.id || event === 'USER_UPDATED') {
                currentUser = nextUser;
                syncedFromPage = false;
                syncProfile(null, nextUser);
                fetchAndSyncProfile(nextUser);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeaderProfile);
    } else {
        initHeaderProfile();
    }

    // ---------- Điều khiển menu nổi trên mobile ----------
    if (!header) return;

    const openBtn = header.querySelector('[data-drawer-open]');
    const closeBtn = header.querySelector('[data-drawer-close]');
    const backdrop = header.querySelector('[data-drawer-backdrop]');
    const drawer = header.querySelector('[data-site-drawer]');
    if (!openBtn || !closeBtn || !backdrop || !drawer) return;

    const desktopQuery = window.matchMedia('(min-width: 761px)');
    let closeTimer = 0;

    function syncDrawerA11y() {
        if (desktopQuery.matches) {
            drawer.removeAttribute('aria-hidden');
            drawer.removeAttribute('role');
            drawer.removeAttribute('aria-modal');
            return;
        }
        const isOpen = header.classList.contains('is-drawer-open');
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-hidden', String(!isOpen));
    }

    function finishClose() {
        window.clearTimeout(closeTimer);
        closeTimer = 0;
        header.classList.remove('is-drawer-closing');
    }

    function openDrawer() {
        if (desktopQuery.matches || header.classList.contains('is-drawer-open')) return;
        finishClose();
        header.classList.add('is-drawer-open');
        document.body.classList.add('has-drawer-open');
        openBtn.setAttribute('aria-expanded', 'true');
        backdrop.setAttribute('aria-hidden', 'false');
        syncDrawerA11y();
        window.requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
    }

    function closeDrawer(options = {}) {
        const { restoreFocus = false, immediate = false } = options;
        const wasOpen = header.classList.contains('is-drawer-open');
        if (!wasOpen && !header.classList.contains('is-drawer-closing')) return;

        drawer.querySelectorAll('[data-preferences-menu][open]').forEach(menu => {
            menu.open = false;
        });

        header.classList.remove('is-drawer-open');
        document.body.classList.remove('has-drawer-open');
        openBtn.setAttribute('aria-expanded', 'false');
        backdrop.setAttribute('aria-hidden', 'true');
        syncDrawerA11y();

        const reduceMotion = immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            finishClose();
        } else {
            header.classList.add('is-drawer-closing');
            window.clearTimeout(closeTimer);
            closeTimer = window.setTimeout(finishClose, 280);
        }

        if (restoreFocus) openBtn.focus({ preventScroll: true });
    }

    function getFocusableElements() {
        return Array.from(
            drawer.querySelectorAll('a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
        ).filter(el => el.offsetParent !== null);
    }

    openBtn.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', () => closeDrawer({ restoreFocus: true }));
    backdrop.addEventListener('click', () => closeDrawer({ restoreFocus: true }));

    drawer.addEventListener('transitionend', event => {
        if (event.target === drawer && event.propertyName === 'transform' && !header.classList.contains('is-drawer-open')) {
            finishClose();
        }
    });

    drawer.addEventListener('click', event => {
        if (event.target.closest('.site-nav__link, .site-header__logout')) {
            closeDrawer({ restoreFocus: false, immediate: true });
        }
    });

    // Chạy ở capture phase để i18n.js đóng popover tùy chọn trước nếu popover đang mở.
    document.addEventListener('keydown', event => {
        if (!header.classList.contains('is-drawer-open')) return;

        if (event.key === 'Escape') {
            if (drawer.querySelector('[data-preferences-menu][open]')) return;
            event.preventDefault();
            closeDrawer({ restoreFocus: true });
            return;
        }

        if (event.key === 'Tab') {
            const focusables = getFocusableElements();
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }, true);

    const onViewportChange = () => {
        if (desktopQuery.matches) closeDrawer({ restoreFocus: false, immediate: true });
        syncDrawerA11y();
    };
    if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', onViewportChange);
    } else if (typeof desktopQuery.addListener === 'function') {
        desktopQuery.addListener(onViewportChange);
    }

    syncDrawerA11y();
})();
