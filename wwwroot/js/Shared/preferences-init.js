// Run before stylesheets so a saved dark theme is applied before the first paint.
(() => {
    const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
    document.documentElement.dataset.theme = read('se347.theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.lang = read('se347.language') === 'en' ? 'en' : 'vi';
})();
