document.addEventListener('DOMContentLoaded', () => {
    const logoutLink = document.querySelector('#siteLogout');
    if (!logoutLink) return;

    logoutLink.addEventListener('click', async (event) => {
        event.preventDefault();
        logoutLink.setAttribute('aria-disabled', 'true');
        logoutLink.textContent = 'Đang đăng xuất...';

        try {
            if (window.sb) await window.sb.auth.signOut();
        } finally {
            sessionStorage.removeItem('userToken');
            document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
            window.location.assign('/Index');
        }
    });
});