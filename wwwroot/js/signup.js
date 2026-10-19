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
            passwordToggle.setAttribute('aria-pressed', String(isPassword));
            passwordToggle.setAttribute('data-i18n-aria-label', isPassword ? 'ui.hide_password' : 'ui.show_password');
            passwordToggle.setAttribute('data-i18n-title', isPassword ? 'ui.hide_password' : 'ui.show_password');
        });
    }

    const getPasswordRules = (value) => [
        { valid: Array.from(value).length >= 16, message: 'Mật khẩu phải có ít nhất 16 ký tự.' },
        { valid: /[A-Z]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ hoa.' },
        { valid: /[a-z]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ thường.' },
        { valid: /[0-9]/.test(value), message: 'Mật khẩu phải có ít nhất một chữ số.' },
        { valid: /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(value), message: 'Mật khẩu phải có ít nhất một ký tự đặc biệt.' },
        { valid: /^[A-Za-z0-9\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+$/.test(value), message: 'Mật khẩu chỉ được chứa chữ hoa, chữ thường, chữ số và ký tự đặc biệt.' }
    ];

    const updateStrength = () => {
        if (!password || !strength || !strengthText || !strengthBar) return;

        const value = password.value;
        const score = getPasswordRules(value).filter((rule) => rule.valid).length;
        const strengthState = score === 6 ? 'strong' : score >= 4 ? 'medium' : 'weak';
        const width = score * 100 / 6;

        strength.dataset.strength = strengthState;
        strengthBar.style.width = `${width}%`;
        AppI18n.setText(strengthText, score === 0
            ? 'ui.strength_no_password_yet'
            : score >= 3
                ? 'ui.strength_good'
                : 'ui.strength_weak_add_uppercase_letters_numbers_or_symbols');
    };

    password?.addEventListener('input', updateStrength);
    updateStrength();

    form.querySelectorAll('input').forEach((input) => {
        input.addEventListener('blur', () => {
            setFieldErrors(input);
        });
        input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
            if (input.getAttribute('aria-invalid') === 'true') setFieldErrors(input);
        });
    });

    function setFieldError(input) {
        const label = input.closest('label');
        if (!label) return;

        const errorId = `${input.id}-error`;
        const existingError = document.getElementById(errorId);
        const isInvalid = !input.checkValidity();

        label.classList.toggle('has-error', isInvalid);
        input.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
        input.setAttribute('aria-describedby', isInvalid ? errorId : '');

        if (isInvalid && !existingError) {
            const error = document.createElement('small');
            error.className = 'field-error';
            error.id = errorId;
            AppI18n.setText(error, input.validity.valueMissing ? 'validation.required' : input.validity.typeMismatch ? 'validation.email' : 'validation.short');
            label.append(error);
        } else if (!isInvalid && existingError) {
            existingError.remove();
        } else if (isInvalid && existingError) {
            AppI18n.setText(existingError, input.validity.valueMissing ? 'validation.required' : input.validity.typeMismatch ? 'validation.email' : 'validation.short');
        }

    form.addEventListener('submit', (event) => {
        if (!form.checkValidity()) {
            event.preventDefault();
            form.querySelectorAll('input').forEach((input) => {
                setFieldError(input);
            });
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
        if (event.key === 'Enter' && !event.target.closest('button')) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
