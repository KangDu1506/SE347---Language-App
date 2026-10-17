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
            AppI18n.setText(error, input.validity.valueMissing ? 'validation.required' : input.validity.typeMismatch ? 'validation.email' : 'validation.short');
            label.append(error);
        } else if (!isInvalid && existingError) {
            existingError.remove();
        } else if (isInvalid && existingError) {
            AppI18n.setText(existingError, input.validity.valueMissing ? 'validation.required' : input.validity.typeMismatch ? 'validation.email' : 'validation.short');
        }
    }

    form.addEventListener('submit', (event) => {
        if (!form.checkValidity()) {
            event.preventDefault();
            form.querySelectorAll('input').forEach((input) => {
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
        if (event.key === 'Enter' && !event.target.closest('button')) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
