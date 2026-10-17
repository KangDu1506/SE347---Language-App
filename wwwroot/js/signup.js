document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    const form = document.querySelector('.account-form');
    if (!form) return;

    const password = document.querySelector('#password');
    const passwordToggle = document.querySelector('#signupPasswordToggle');
    const strength = document.querySelector('#passwordStrength');
    const strengthText = strength?.querySelector('.password-strength__text');
    const strengthBar = strength?.querySelector('span');

    if (password && passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const isPassword = password.type === 'password';
            password.type = isPassword ? 'text' : 'password';
            passwordToggle.textContent = isPassword ? 'Ẩn' : 'Hiện';
            passwordToggle.setAttribute('aria-label', isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        });
    }

    const getPasswordRules = (value) => [
        { valid: Array.from(value).length >= 8, message: 'Mật khẩu phải có ít nhất 8 ký tự.' },
        { valid: /[A-Z]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ hoa.' },
        { valid: /[a-z]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ thường.' },
        { valid: /[0-9]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ số.' },
        { valid: /[^A-Za-z0-9]/.test(value), message: 'Mật khẩu phải có ít nhất một ký tự đặc biệt.' }
    ];

    const updateStrength = () => {
        if (!password || !strength || !strengthText || !strengthBar) return;

        const value = password.value;
        const score = getPasswordRules(value).filter((rule) => rule.valid).length;
        const strengthState = score === 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
        const width = score * 20;

        strength.dataset.strength = strengthState;
        strengthBar.style.width = `${width}%`;
        strengthText.textContent = score === 0
            ? 'Độ mạnh: Chưa có mật khẩu'
            : score === 5
                ? 'Độ mạnh: Mạnh'
                : score >= 3
                    ? 'Độ mạnh: Trung bình'
                    : 'Độ mạnh: Yếu';
    };

    password?.addEventListener('input', updateStrength);
    updateStrength();

    function getFieldErrors(input) {
        const value = input.value.trim();
        const errors = [];

        if (input.type === 'checkbox') {
            if (input.required && !input.checked) errors.push('Bạn cần đồng ý với Điều khoản sử dụng.');
            return errors;
        }

        if (!value && input.required) errors.push('Vui lòng nhập thông tin này.');

        if (input.id === 'fullName' && value) {
            const normalizedName = value.normalize('NFC');
            const words = normalizedName.split(/[ '-]+/);
            if (!/^[\p{L}]+(?:[ '-][\p{L}]+)*$/u.test(normalizedName)) {
                errors.push('Họ và tên chỉ được chứa chữ cái, dấu cách, dấu nháy hoặc gạch nối.');
            }
            if (!words.every((word) => /^\p{Lu}\p{Ll}*$/u.test(word))) {
                errors.push('Hãy viết hoa chữ cái đầu của mỗi từ trong họ và tên.');
            }
        }

        if (input.id === 'username' && value) {
            const length = Array.from(value).length;
            if (length < 6) errors.push('Tên đăng nhập phải có ít nhất 6 ký tự.');
            if (length > 32) errors.push('Tên đăng nhập không được vượt quá 32 ký tự.');
        }

        if (input.type === 'email' && value && input.validity.typeMismatch) {
            errors.push('Email không đúng định dạng, ví dụ: ten@example.com.');
        }

        if (input.id === 'password' && value) {
            errors.push(...getPasswordRules(value).filter((rule) => !rule.valid).map((rule) => rule.message));
        }

        return errors;
    }

    function setFieldErrors(input, errors = getFieldErrors(input)) {
        const label = input.closest('label');
        if (!label) return errors.length === 0;

        const errorPrefix = `${input.id}-error`;
        label.querySelectorAll(`[id^="${errorPrefix}"]`).forEach((error) => error.remove());
        label.classList.toggle('has-error', errors.length > 0);
        input.setAttribute('aria-invalid', errors.length > 0 ? 'true' : 'false');

        if (errors.length > 0) {
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
    }

    form.querySelectorAll('input').forEach((input) => {
        input.addEventListener('blur', () => {
            setFieldErrors(input);
        });
        input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
            if (input.getAttribute('aria-invalid') === 'true') setFieldErrors(input);
        });
    });

    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const allFieldsValid = [...form.querySelectorAll('input')]
            .map((input) => setFieldErrors(input))
            .every(Boolean);
        if (!allFieldsValid) {
            return;
        }

        message.remove();
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton?.textContent;
        if (!window.sb) {
            message.textContent = 'Không kết nối được dịch vụ đăng ký. Vui lòng thử lại sau.';
            form.before(message);
            return;
        }

        const formData = new FormData(form);
        const email = String(formData.get('email')).trim().toLowerCase();
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Đang gửi mã...';
        }

        const { data, error } = await window.sb.auth.signUp({
            email,
            password: String(formData.get('password')),
            options: {
                data: {
                    username: String(formData.get('username')).trim().toLowerCase(),
                    display_name: String(formData.get('fullName')).trim()
                }
            }
        });

        if (error || !data.user) {
            message.textContent = error?.status === 429
                ? 'Bạn yêu cầu quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.'
                : error?.message || 'Không tạo được tài khoản. Vui lòng kiểm tra lại thông tin.';
            form.before(message);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
            return;
        }

        sessionStorage.setItem('pendingSignupEmail', email);
        window.location.assign('/Account/Authentication?mode=signup');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
