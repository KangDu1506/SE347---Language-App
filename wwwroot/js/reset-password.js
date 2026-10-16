document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('page-ready');

    const form = document.querySelector('.account-form');
    if (!form) return;

    const password = form.querySelector('#newPassword');
    const confirmPassword = form.querySelector('#confirmPassword');
    const passwordToggle = form.querySelector('#newPasswordToggle');
    const submitButton = form.querySelector('button[type="submit"]');

    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    const showMessage = (text) => {
        message.textContent = text;
        form.after(message);
    };

    passwordToggle?.addEventListener('click', () => {
        const isPassword = password.type === 'password';
        password.type = isPassword ? 'text' : 'password';
        confirmPassword.type = password.type;
        passwordToggle.textContent = isPassword ? 'Ẩn' : 'Hiện';
        passwordToggle.setAttribute('aria-label', isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    });

    // Chỉ vào được trang này sau khi nhập đúng mã khôi phục (verifyOtp tạo phiên tạm).
    const { data } = window.sb ? await window.sb.auth.getSession() : { data: {} };
    if (!data?.session) {
        submitButton.disabled = true;
        message.innerHTML = 'Phiên khôi phục đã hết hạn. <a href="/Account/ForgetPassword">Gửi lại mã xác thực</a>.';
        form.after(message);
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.remove();

        if (password.value.length < 8) {
            showMessage('Mật khẩu mới cần tối thiểu 8 ký tự.');
            return;
        }

        if (password.value !== confirmPassword.value) {
            showMessage('Mật khẩu nhập lại không khớp.');
            return;
        }

        submitButton.disabled = true;
        const { error } = await window.sb.auth.updateUser({ password: password.value });

        if (error) {
            submitButton.disabled = false;
            showMessage(error.code === 'same_password'
                ? 'Mật khẩu mới phải khác mật khẩu cũ.'
                : error.code === 'weak_password'
                    ? 'Mật khẩu quá yếu, vui lòng chọn mật khẩu khác.'
                    : 'Không đổi được mật khẩu. Vui lòng thử lại.');
            return;
        }

        // Đăng xuất phiên khôi phục, người dùng đăng nhập lại bằng mật khẩu mới.
        await window.sb.auth.signOut();
        sessionStorage.setItem('passwordResetDone', '1');
        window.location.assign('/Account/Login');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
