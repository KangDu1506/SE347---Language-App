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

    const updateStrength = () => {
        if (!password || !strength || !strengthText || !strengthBar) return;

        const value = password.value;
        const score = [
            value.length >= 8,
            /[A-Z]/.test(value),
            /[0-9]/.test(value),
            /[^A-Za-z0-9]/.test(value)
        ].filter(Boolean).length;
        const strengthState = score >= 3 ? 'strong' : score >= 2 ? 'medium' : '';
        const width = score === 0 ? 0 : score === 1 ? 25 : score === 2 ? 50 : score === 3 ? 75 : 100;

        strength.dataset.strength = strengthState;
        strengthBar.style.width = `${width}%`;
        strengthText.textContent = score === 0
            ? 'Độ mạnh: Chưa có mật khẩu'
            : score >= 3
                ? 'Độ mạnh: Tốt'
                : 'Độ mạnh: Yếu. Thêm chữ hoa, số hoặc ký tự đặc biệt';
    };

    password?.addEventListener('input', updateStrength);
    updateStrength();

    form.querySelectorAll('input:not([type="checkbox"])').forEach((input) => {
        input.addEventListener('blur', () => {
            setFieldError(input);
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
            error.textContent = input.validationMessage;
            label.append(error);
        } else if (!isInvalid && existingError) {
            existingError.remove();
        } else if (isInvalid && existingError) {
            existingError.textContent = input.validationMessage;
        }
    }

    form.addEventListener('submit', (event) => {
        if (!form.checkValidity()) {
            event.preventDefault();
            form.querySelectorAll('input:not([type="checkbox"])').forEach((input) => {
                setFieldError(input);
            });
            return;
        }

        event.preventDefault();
        const formData = new FormData(form);
        sessionStorage.setItem('pendingSignup', JSON.stringify({
            fullName: formData.get('fullName'),
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password')
        }));
        window.location.assign('/Account/Authentication');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
