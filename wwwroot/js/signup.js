document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    const form = document.querySelector('.account-form');
    if (!form) return;

    const password = document.querySelector('#password');
    const passwordToggle = document.querySelector('#signupPasswordToggle');
    const strength = document.querySelector('#passwordStrength');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    const completion = window.FormCompletion.attach(form);
    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    if (new URLSearchParams(window.location.search).get('changeEmail') === '1') {
        const draft = sessionStorage.getItem('pendingSignupFormDraft');
        if (draft) {
            try {
                const values = JSON.parse(draft);
                form.querySelector('#fullName').value = values.fullName || '';
                form.querySelector('#username').value = values.username || '';
                form.querySelector('#email').value = values.email || sessionStorage.getItem('pendingSignupEmail') || '';
                password.value = values.password || '';
                form.querySelector('#terms').checked = Boolean(values.terms);
                completion.refresh();
            } catch (error) {
                console.error('Could not restore the saved sign-up form.', error);
                sessionStorage.removeItem('pendingSignupFormDraft');
            }
        }
    } else {
        sessionStorage.removeItem('pendingSignupFormDraft');
    }

    if (password && passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const isPassword = password.type === 'password';
            password.type = isPassword ? 'text' : 'password';
            passwordToggle.setAttribute('aria-pressed', String(isPassword));
            passwordToggle.setAttribute('data-i18n-aria-label', isPassword ? 'ui.hide_password' : 'ui.show_password');
            passwordToggle.setAttribute('data-i18n-title', isPassword ? 'ui.hide_password' : 'ui.show_password');
        });
    }

    window.PasswordStrength.attach(password, strength);

    const usernameInput = form.querySelector('#username');
    let lastCheckedUsername = '';
    let lastUsernameAvailable = null;

    const showFieldCustomError = (input, key, fallbackText) => {
        const label = input.closest('label');
        if (!label) return;
        const errorId = `${input.id}-error`;
        let error = document.getElementById(errorId);
        label.classList.add('has-error');
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', errorId);
        if (!error) {
            error = document.createElement('small');
            error.className = 'field-error';
            error.id = errorId;
            label.append(error);
        }
        error.textContent = fallbackText;
        AppI18n.setText(error, key);
    };

    const checkUsernameAvailability = async (rawValue) => {
        const normalized = String(rawValue || '').trim().toLowerCase();
        if (normalized.length < 3) return null;
        if (normalized === lastCheckedUsername && lastUsernameAvailable !== null) {
            return lastUsernameAvailable;
        }
        try {
            const response = await fetch(`/api/users/username-available?username=${encodeURIComponent(normalized)}`);
            if (!response.ok) return null;
            const body = await response.json();
            if (typeof body?.available !== 'boolean') return null;
            lastCheckedUsername = normalized;
            lastUsernameAvailable = body.available;
            return body.available;
        } catch {
            return null;
        }
    };

    form.querySelectorAll('input').forEach((input) => {
        input.addEventListener('blur', async () => {
            setFieldError(input);
            if (input === usernameInput && input.checkValidity()) {
                const available = await checkUsernameAvailability(input.value);
                if (available === false && input === usernameInput) {
                    input.setCustomValidity('unavailable');
                    showFieldCustomError(input, 'validation.username_unavailable', 'Tên đăng nhập đã được sử dụng hoặc không hợp lệ.');
                }
            }
        });
        input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
            if (input === usernameInput) {
                input.setCustomValidity('');
                lastCheckedUsername = '';
                lastUsernameAvailable = null;
            }
            if (input.getAttribute('aria-invalid') === 'true') setFieldError(input);
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

        const key = input.validity.customError
            ? 'validation.username_unavailable'
            : input.validity.valueMissing
                ? 'validation.required'
                : input.validity.typeMismatch
                    ? 'validation.email'
                    : 'validation.short';

        if (isInvalid && !existingError) {
            const error = document.createElement('small');
            error.className = 'field-error';
            error.id = errorId;
            AppI18n.setText(error, key);
            label.append(error);
        } else if (!isInvalid && existingError) {
            existingError.remove();
        } else if (isInvalid && existingError) {
            AppI18n.setText(existingError, key);
        }
    }

    const saveFormDraft = () => {
        sessionStorage.setItem('pendingSignupFormDraft', JSON.stringify({
            fullName: form.querySelector('#fullName').value,
            username: form.querySelector('#username').value,
            email: form.querySelector('#email').value,
            password: password.value,
            terms: form.querySelector('#terms').checked
        }));
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.querySelectorAll('input').forEach((input) => {
                setFieldError(input);
            });
            return;
        }

        const formData = new FormData(form);
        const usernameValue = String(formData.get('username')).trim().toLowerCase();
        const available = await checkUsernameAvailability(usernameValue);
        if (available === false) {
            usernameInput.setCustomValidity('unavailable');
            showFieldCustomError(usernameInput, 'validation.username_unavailable', 'Tên đăng nhập đã được sử dụng hoặc không hợp lệ.');
            usernameInput.focus();
            return;
        }

        if (!window.sb) {
            message.textContent = window.authUi.localize('Không kết nối được dịch vụ đăng ký. Vui lòng thử lại sau.');
            form.before(message);
            return;
        }

        const email = String(formData.get('email')).trim().toLowerCase();
        saveFormDraft();
        sessionStorage.setItem('pendingSignupEmail', email);
        completion.setBusy(true);
        submitButton.textContent = window.authUi.localize('Đang gửi mã...');

        const { data, error } = await window.sb.auth.signUp({
            email,
            password: String(formData.get('password')),
            options: {
                data: {
                    username: usernameValue,
                    display_name: String(formData.get('fullName')).trim()
                }
            }
        });

        if (error || !data.user) {
            sessionStorage.removeItem('pendingSignupEmail');
            message.textContent = window.authUi.localize(error?.status === 429
                ? 'Bạn yêu cầu quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.'
                : error?.message || 'Không tạo được tài khoản. Vui lòng kiểm tra lại thông tin.');
            form.before(message);
            completion.setBusy(false);
            submitButton.textContent = originalButtonText;
            return;
        }

        sessionStorage.setItem('pendingSignupEmail', data.user.email || email);
        window.location.assign('/Account/Authentication?mode=signup');
    });

    form.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.target.closest('button')) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
});
