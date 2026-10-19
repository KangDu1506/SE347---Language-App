(() => {
    const root = document.documentElement;
    const dictionaries = {};
    const originals = new WeakMap();
    let language = root.lang === 'en' ? 'en' : 'vi';
    let theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
    const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Session still works. */ } };
    const t = (key, fallback = '') => {
        const value = dictionaries[language]?.[key] ?? dictionaries.vi?.[key];
        return typeof value === 'string' ? value : fallback;
    };

    function apply(element) {
        // Vue-owned trees use the reactive adapter below, never DOM translation.
        if (element.closest('[data-i18n-vue]')) return;
        if (element.dataset.i18nText) {
            const node = Array.from(element.childNodes).find(node => node.nodeType === 3 && node.textContent.trim());
            if (node) {
                const value = t(element.dataset.i18nText, node.textContent.trim()) + ' ';
                if (node.textContent !== value) node.textContent = value;
            }
        }
        const key = element.dataset.i18n;
        if (key) {
            if (!originals.has(element)) originals.set(element, element.textContent);
            const translated = t(key);
            const value = translated ? translated + (element.dataset.i18nSuffix || '') : originals.get(element);
            if (element.textContent !== value) element.textContent = value;
        }
        for (const attribute of ['placeholder', 'title', 'aria-label', 'content']) {
            const key = element.getAttribute(`data-i18n-${attribute}`);
            if (key) {
                const value = t(key, element.getAttribute(attribute) || '');
                if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
            }
        }
    }
    const selector = '[data-i18n], [data-i18n-text], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-content]';
    function translate(container = document) {
        if (container.nodeType === 1 && container.matches(selector)) apply(container);
        container.querySelectorAll?.(selector).forEach(apply);
    }
    function syncControls() {
        document.querySelectorAll('[data-language-toggle]').forEach(el => {
            const key = language === 'vi' ? 'settings.switch_to_en' : 'settings.switch_to_vi';
            const label = t(key, language === 'vi' ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese');
            el.setAttribute('aria-label', label);
            el.title = label;
        });
        document.querySelectorAll('[data-theme-toggle]').forEach(el => { el.setAttribute('aria-pressed', String(theme === 'dark')); });
    }
    function setLanguage(value, persist = true) {
        if (!['vi', 'en'].includes(value)) return;
        language = value;
        root.lang = value;
        if (persist) write('se347.language', value);
        translate();
        syncControls();
        window.dispatchEvent(new CustomEvent('app:languagechange', { detail: { language } }));
    }
    function setTheme(value, persist = true) {
        if (!['light', 'dark'].includes(value)) return;
        theme = value;
        root.dataset.theme = value;
        if (persist) write('se347.theme', value);
        syncControls();
    }
    function setText(element, key) {
        if (!element.textContent.trim()) element.textContent = language === 'en' ? 'Please try again.' : 'Vui lòng thử lại.';
        element.dataset.i18n = key;
        apply(element);
    }
    const ready = Promise.all(['vi', 'en'].map(async locale => {
        try {
            const response = await fetch(`${root.dataset.appBase || '/'}assets/_lang/${locale}.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            dictionaries[locale] = await response.json();
        } catch { /* Keep the Razor fallback if dictionaries are unavailable. */ }
    })).then(() => { translate(); syncControls(); });
    window.AppI18n = {
        t, setText, translate, setLanguage, setTheme, ready,
        get language() { return language; },
        get theme() { return theme; },
        // Call from Vue setup(), mark the mount root data-i18n-vue.
        useVue(Vue) {
            const locale = Vue.ref(language);
            const revision = Vue.ref(0);
            const changed = () => { locale.value = language; revision.value++; };
            window.addEventListener('app:languagechange', changed);
            ready.then(changed);
            Vue.onUnmounted(() => window.removeEventListener('app:languagechange', changed));
            return { locale, t: (key, fallback) => { revision.value; return t(key, fallback); } };
        }
    };
    document.addEventListener('click', event => {
        if (event.target.closest('[data-language-toggle]')) setLanguage(language === 'vi' ? 'en' : 'vi');
        if (event.target.closest('[data-theme-toggle]')) setTheme(theme === 'dark' ? 'light' : 'dark');
        document.querySelectorAll('[data-preferences-menu][open]').forEach(menu => {
            if (!menu.contains(event.target)) menu.open = false;
        });
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('[data-preferences-menu][open]').forEach(menu => {
            menu.open = false;
            menu.querySelector('summary').focus();
        });
    });
    window.addEventListener('storage', event => {
        if (event.key === 'se347.language' || event.key === null) setLanguage(event.newValue === 'en' ? 'en' : 'vi', false);
        if (event.key === 'se347.theme' || event.key === null) setTheme(event.newValue === 'dark' ? 'dark' : 'light', false);
    });
    new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') apply(record.target);
            else record.addedNodes.forEach(node => { if (node.nodeType === 1) translate(node); });
        }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-i18n', 'data-i18n-text', 'data-i18n-placeholder', 'data-i18n-title', 'data-i18n-aria-label', 'data-i18n-content'] });
    translate();
    syncControls();
})();
