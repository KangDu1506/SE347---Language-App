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

    if (password && passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const isPassword = password.type === 'password';
            password.type = isPassword ? 'text' : 'password';
            passwordToggle.textContent = isPassword ? 'Ẩn' : 'Hiện';
            passwordToggle.setAttribute('aria-label', isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        });
    }

    form.addEventListener('submit', (event) => {
        const username = document.querySelector('#username');
        const password = document.querySelector('#password');
        const registeredUser = JSON.parse(sessionStorage.getItem('registeredUser') || 'null');

        if (!username.value.trim() || !password.value) {
            event.preventDefault();
            message.textContent = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.';
            form.before(message);
            return;
        }

        const loginIdentifier = username.value.trim();
        const matchesIdentifier = registeredUser
            && (loginIdentifier === registeredUser.email || loginIdentifier === registeredUser.username);

        if (!matchesIdentifier || password.value !== registeredUser.password) {
            event.preventDefault();
            message.textContent = 'Email/tên đăng nhập hoặc mật khẩu không đúng.';
            form.before(message);
            return;
        }

        sessionStorage.setItem('pendingLogin', '1');
        window.location.assign('/Account/Authentication?mode=login');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
