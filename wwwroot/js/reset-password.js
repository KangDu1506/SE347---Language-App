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
        message.textContent = text;
        form.after(message);
    };

    const bindPasswordToggle = (input, toggle, visibleLabel) => {
        toggle?.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggle.textContent = isPassword ? 'Ẩn' : 'Hiện';
            toggle.setAttribute('aria-label', `${isPassword ? 'Ẩn' : 'Hiện'} ${visibleLabel}`);
        });
    };

    bindPasswordToggle(password, passwordToggle, 'mật khẩu mới');
    bindPasswordToggle(confirmPassword, confirmPasswordToggle, 'mật khẩu nhập lại');

    const getPasswordRules = (value) => [
        { valid: Array.from(value).length >= 8, message: 'Mật khẩu phải có ít nhất 8 ký tự.' },
        { valid: /[A-Z]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ hoa.' },
        { valid: /[a-z]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ thường.' },
        { valid: /[0-9]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ số.' },
        { valid: /[^A-Za-z0-9]/.test(value), message: 'Mật khẩu phải có ít nhất một ký tự đặc biệt.' }
    ];

    const updateStrength = () => {
        if (!strength || !strengthText || !strengthBar) return;

        const value = password.value;
        const score = getPasswordRules(value).filter((rule) => rule.valid).length;
        strength.dataset.strength = score === 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
        strengthBar.style.width = `${score * 20}%`;
        strengthText.textContent = score === 0
            ? 'Độ mạnh: Chưa có mật khẩu'
            : score === 5
                ? 'Độ mạnh: Mạnh'
                : score >= 3
                    ? 'Độ mạnh: Trung bình'
                    : 'Độ mạnh: Yếu';
    };

    const getFieldErrors = (input) => {
        const errors = [];
        if (!input.value) errors.push('Vui lòng nhập thông tin này.');

        if (input === password && input.value) {
            errors.push(...getPasswordRules(input.value).filter((rule) => !rule.valid).map((rule) => rule.message));
        }

        if (input === confirmPassword && input.value && input.value !== password.value) {
            errors.push('Mật khẩu nhập lại không khớp.');
        }

        return errors;
    };

    const setFieldErrors = (input) => {
        const label = input.closest('label');
        const errors = getFieldErrors(input);
        const errorPrefix = `${input.id}-error`;
        label.querySelectorAll(`[id^="${errorPrefix}"]`).forEach((error) => error.remove());
        label.classList.toggle('has-error', errors.length > 0);
        input.setAttribute('aria-invalid', errors.length > 0 ? 'true' : 'false');

        if (errors.length) {
            const errorIds = errors.map((errorMessage, index) => {
                const error = document.createElement('small');
                error.className = 'field-error';
                error.id = `${errorPrefix}-${index + 1}`;
                error.textContent = errorMessage;
                label.append(error);
                return error.id;
            });
            input.setAttribute('aria-describedby', errorIds.join(' '));
        } else {
            input.removeAttribute('aria-describedby');
        }

        return errors.length === 0;
    };

    password.addEventListener('input', () => {
        updateStrength();
        if (password.getAttribute('aria-invalid') === 'true') setFieldErrors(password);
        if (confirmPassword.value && confirmPassword.getAttribute('aria-invalid') === 'true') setFieldErrors(confirmPassword);
    });
    confirmPassword.addEventListener('input', () => {
        if (confirmPassword.getAttribute('aria-invalid') === 'true') setFieldErrors(confirmPassword);
    });
    password.addEventListener('blur', () => setFieldErrors(password));
    confirmPassword.addEventListener('blur', () => setFieldErrors(confirmPassword));
    updateStrength();

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

        const fieldsValid = [password, confirmPassword].map(setFieldErrors).every(Boolean);
        if (!fieldsValid) {
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
