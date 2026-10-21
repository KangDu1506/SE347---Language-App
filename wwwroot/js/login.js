document.addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(window.location.search).get('logout') === '1') {
        window.sb?.auth.signOut();
    }

    const form = document.querySelector('.login-card form');
    const password = document.querySelector('#password');
    const passwordToggle = document.querySelector('#passwordToggle');
    const message = document.createElement('p');
    message.className = 'login-message';
    message.setAttribute('role', 'alert');

    if (!form) return;
    const completion = window.FormCompletion.attach(form);

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

        const identifier = username.value.trim().toLowerCase();

        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        completion.setBusy(true);
        submitButton.textContent = window.authUi.localize('Đang đăng nhập...');

        const { error } = identifier.includes('@')
            ? await window.sb.auth.signInWithPassword({ email: identifier, password: password.value })
            : await signInWithUsername(identifier, password.value);

        if (error) {
            if (error.code === 'email_not_confirmed') {
                message.textContent = window.authUi.localize('Email chưa được xác thực. Vui lòng kiểm tra hộp thư.');
            } else if (error.status === 429) {
                message.textContent = window.authUi.localize('Bạn yêu cầu quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.');
            } else {
                AppI18n.setText(message, 'ui.incorrect_email_username_or_password');
            }
            form.before(message);
            completion.setBusy(false);
            submitButton.textContent = originalButtonText;
            return;
        }

        window.location.assign('/Index');
    });

    // Supabase chỉ đăng nhập bằng email: backend tra email theo username và trả về phiên,
    // trình duyệt không bao giờ thấy email. Trả lỗi cùng dạng { error } như supabase-js.
    async function signInWithUsername(usernameValue, passwordValue) {
        try {
            const response = await fetch('/api/auth/login-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameValue, password: passwordValue })
            });
            const body = await response.json().catch(() => ({}));

            if (!response.ok) {
                return { error: { code: body.error, status: response.status } };
            }

            return await window.sb.auth.setSession({
                access_token: body.accessToken,
                refresh_token: body.refreshToken
            });
        } catch (error) {
            return { error };
        }
    }

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.target.closest('button')) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
