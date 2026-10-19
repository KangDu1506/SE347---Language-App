document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('page-ready');

    const form = document.querySelector('.account-form');
    if (!form) return;

    const password = form.querySelector('#newPassword');
    const confirmPassword = form.querySelector('#confirmPassword');
    const passwordToggle = form.querySelector('#newPasswordToggle');
    const confirmPasswordToggle = form.querySelector('#confirmPasswordToggle');
    const strength = form.querySelector('#passwordStrength');
    const strengthText = strength?.querySelector('.password-strength__text');
    const strengthBar = strength?.querySelector('span');
    const submitButton = form.querySelector('button[type="submit"]');

    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    const showMessage = (text) => {
        AppI18n.setText(message, text);
        form.after(message);
    };

    passwordToggle?.addEventListener('click', () => {
        const isPassword = password.type === 'password';
        password.type = isPassword ? 'text' : 'password';
        confirmPassword.type = password.type;
        passwordToggle.setAttribute('aria-pressed', String(isPassword));
        passwordToggle.setAttribute('data-i18n-aria-label', isPassword ? 'ui.hide_password' : 'ui.show_password');
        passwordToggle.setAttribute('data-i18n-title', isPassword ? 'ui.hide_password' : 'ui.show_password');
    });
    password.addEventListener('blur', () => setFieldErrors(password));
    confirmPassword.addEventListener('blur', () => setFieldErrors(confirmPassword));
    updateStrength();

    // Chỉ vào được trang này sau khi nhập đúng mã khôi phục (verifyOtp tạo phiên tạm).
    const { data } = window.sb ? await window.sb.auth.getSession() : { data: {} };
    if (!data?.session) {
        submitButton.disabled = true;
        const expired = document.createElement('span');
        AppI18n.setText(expired, 'auth.recovery_expired');
        const recoveryLink = document.createElement('a');
        recoveryLink.href = '/Account/ForgetPassword';
        AppI18n.setText(recoveryLink, 'auth.resend_code');
        message.replaceChildren(expired, document.createTextNode(' '), recoveryLink);
        form.after(message);
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.remove();

        if (password.value.length < 8) {
            showMessage('ui.your_new_password_must_contain_at_least_8_characters');
            return;
        }

        if (password.value !== confirmPassword.value) {
            showMessage('ui.passwords_do_not_match');
            return;
        }

        submitButton.disabled = true;
        const { error } = await window.sb.auth.updateUser({ password: password.value });

        if (error) {
            submitButton.disabled = false;
            showMessage(error.code === 'same_password'
                ? 'ui.your_new_password_must_differ_from_the_old_one'
                : error.code === 'weak_password'
                    ? 'ui.password_is_too_weak_please_choose_a_different_one'
                    : 'ui.unable_to_change_password_please_try_again');
            return;
        }

        // Đăng xuất phiên khôi phục, người dùng đăng nhập lại bằng mật khẩu mới.
        await window.sb.auth.signOut();
        sessionStorage.setItem('passwordResetDone', '1');
        window.location.assign('/Account/Login');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.target.closest('button')) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
