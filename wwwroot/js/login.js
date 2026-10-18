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
        banner.textContent = 'Email đã được xác thực. Bạn có thể đăng nhập.';
        form.before(banner);
    }

    if (sessionStorage.getItem('passwordResetDone')) {
        sessionStorage.removeItem('passwordResetDone');
        const banner = document.createElement('p');
        banner.className = 'auth-banner';
        banner.setAttribute('role', 'status');
        banner.textContent = 'Đổi mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.';
        form.before(banner);
    }

    if (password && passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const isPassword = password.type === 'password';
            password.type = isPassword ? 'text' : 'password';
            passwordToggle.textContent = isPassword ? 'Ẩn' : 'Hiện';
            passwordToggle.setAttribute('aria-label', isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        });
    }

    form.addEventListener('submit', async (event) => {
        const username = document.querySelector('#username');
        const password = document.querySelector('#password');

        if (!username.value.trim() || !password.value) {
            event.preventDefault();
            message.textContent = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.';
            form.before(message);
            return;
        }

        event.preventDefault();
        if (!window.sb) {
            message.textContent = 'Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại sau.';
            form.before(message);
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        const { data, error } = await window.sb.auth.signInWithPassword({
            email: username.value.trim().toLowerCase(),
            password: password.value
        });

        if (error || !data.session) {
            message.textContent = error?.message?.toLowerCase().includes('not confirmed')
                ? 'Email chưa được xác thực. Vui lòng nhập mã đã gửi tới email.'
                : 'Email hoặc mật khẩu không đúng.';
            form.before(message);
            if (submitButton) submitButton.disabled = false;
            return;
        }

        document.cookie = 'userToken=authenticated; path=/; SameSite=Lax';
        window.location.assign('/Index');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
