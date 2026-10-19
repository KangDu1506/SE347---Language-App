document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('.account-form');
    if (!form) return;

    const emailInput = form.querySelector('#resetEmail');
    const submitButton = form.querySelector('button[type="submit"]');

    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    const showMessage = (text) => {
        message.textContent = window.authUi.localize(text);
        form.after(message);
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.remove();

        if (!form.checkValidity()) {
            showMessage('Vui lòng nhập email hợp lệ.');
            return;
        }

        if (!window.sb) {
            showMessage('Không kết nối được máy chủ xác thực. Vui lòng thử lại sau.');
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
                ? 'Bạn yêu cầu quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.'
                : 'Không gửi được mã xác thực. Vui lòng thử lại sau.');
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
