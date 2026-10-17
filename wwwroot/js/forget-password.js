document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.account-form');
    if (!form) return;

    const emailInput = form.querySelector('#resetEmail');
    const submitButton = form.querySelector('button[type="submit"]');

    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    const showMessage = (text) => {
        AppI18n.setText(message, text);
        form.after(message);
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.remove();

        if (!form.checkValidity()) {
            showMessage('validation.email');
            return;
        }

        if (!window.sb) {
            showMessage('ui.cannot_connect_to_the_authentication_server_please_try_again_later');
            return;
        }

        const email = emailInput.value.trim();
        submitButton.disabled = true;

        // Supabase gửi email chứa mã 6 số (template "Reset Password" dùng {{ .Token }}).
        // Email không tồn tại vẫn trả về thành công để không lộ email nào đã đăng ký.
        const { error } = await window.sb.auth.resetPasswordForEmail(email);

        submitButton.disabled = false;

        if (error) {
            showMessage(error.status === 429
                ? 'ui.too_many_requests_please_wait_a_few_minutes_and_try_again'
                : 'ui.unable_to_send_a_verification_code_please_try_again_later');
            return;
        }

        sessionStorage.setItem('pendingPasswordReset', email);
        window.location.assign('/Account/Authentication?mode=forgot');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
