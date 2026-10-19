document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(window.location.search).get('logout') === '1') {
        sessionStorage.removeItem('userToken');
        document.cookie = 'userToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }

    const form = document.querySelector('.login-card form');
    const password = document.querySelector('#password');
    const passwordToggle = document.querySelector('#passwordToggle');
    const message = document.createElement('p');
    message.className = 'login-message';
    message.setAttribute('role', 'alert');

    if (!form) return;

    const verified = new URLSearchParams(window.location.search).get('verified') === '1';
    if (verified) {
        const banner = document.createElement('p');
        banner.className = 'auth-banner';
        banner.setAttribute('role', 'status');
        banner.textContent = window.authUi.localize('Email đã được xác thực. Bạn có thể đăng nhập.');
        form.before(banner);
    }

    if (sessionStorage.getItem('passwordResetDone')) {
        sessionStorage.removeItem('passwordResetDone');
        const banner = document.createElement('p');
        banner.className = 'auth-banner';
        banner.setAttribute('role', 'status');
        AppI18n.setText(banner, 'ui.password_changed_please_sign_in_with_your_new_password');
        form.before(banner);
    }

    if (password && passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const isPassword = password.type === 'password';
            password.type = isPassword ? 'text' : 'password';
            passwordToggle.setAttribute('aria-pressed', String(isPassword));
            passwordToggle.setAttribute('data-i18n-aria-label', isPassword ? 'ui.hide_password' : 'ui.show_password');
            passwordToggle.setAttribute('data-i18n-title', isPassword ? 'ui.hide_password' : 'ui.show_password');
        });
    }

    form.addEventListener('submit', async (event) => {
        const username = document.querySelector('#username');
        const password = document.querySelector('#password');

        if (!username.value.trim() || !password.value) {
            event.preventDefault();
            AppI18n.setText(message, 'ui.please_enter_your_username_and_password');
            form.before(message);
            return;
        }

        event.preventDefault();
        if (!window.sb) {
            message.textContent = window.authUi.localize('Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại sau.');
            form.before(message);
            return;
        }

        if (!matchesIdentifier || password.value !== registeredUser.password) {
            event.preventDefault();
            AppI18n.setText(message, 'ui.incorrect_email_username_or_password');
            form.before(message);
            if (submitButton) submitButton.disabled = false;
            return;
        }

        document.cookie = 'userToken=authenticated; path=/; SameSite=Lax';
        window.location.assign('/Index');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.target.closest('button')) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
