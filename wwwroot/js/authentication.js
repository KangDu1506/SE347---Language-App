document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    const form = document.querySelector('.account-form');
    if (!form) return;

    const digitInputs = Array.from(form.querySelectorAll('.verification-inputs input'));
    const submitButton = form.querySelector('#verificationSubmit');

    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    const updateSubmitState = () => {
        if (submitButton) {
            submitButton.disabled = digitInputs.some(input => !input.value);
        }
    };

    const getCode = () => digitInputs.map(input => input.value).join('');

    const syncDisabledState = (activeIndex) => {
        digitInputs.forEach((input, idx) => {
            input.disabled = (idx !== activeIndex);
            input.classList.toggle(
                'verification-input--filled-disabled',
                input.disabled && Boolean(input.value)
            );
        });
        if (digitInputs[activeIndex]) {
            digitInputs[activeIndex].focus();
        }
    };

    const getFirstEmptyOrLastIndex = () => {
        const index = digitInputs.findIndex(input => !input.value);
        return index === -1 ? digitInputs.length - 1 : index;
    };

    digitInputs.forEach((input, index) => {
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('maxlength', '1');
        input.setAttribute('autocomplete', 'one-time-code');

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                e.preventDefault();
                if (input.value) {
                    input.value = '';
                    updateSubmitState();
                } else if (index > 0) {
                    const prevInput = digitInputs[index - 1];
                    prevInput.value = '';
                    updateSubmitState();
                    syncDisabledState(index - 1);
                }
                return;
            }

            const isControlKey = ['Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key);
            if (input.value && !isControlKey) {
                e.preventDefault();
            }
        });

        input.addEventListener('input', () => {
            const cleanValue = input.value.replace(/\D/g, '');
            input.value = cleanValue.slice(-1);

            updateSubmitState();

            if (input.value && index < digitInputs.length - 1) {
                syncDisabledState(index + 1);
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            const cleanCode = pastedData.replace(/\D/g, '').slice(0, digitInputs.length);

            if (!cleanCode) return;

            digitInputs.forEach((digitInput, idx) => {
                digitInput.value = cleanCode[idx] || '';
            });

            updateSubmitState();

            const nextIndex = cleanCode.length < digitInputs.length ? cleanCode.length : digitInputs.length - 1;
            syncDisabledState(nextIndex);
        });
    });

    const mode = new URLSearchParams(window.location.search).get('mode') || 'signup';
    form.action = `/Account/Authentication?mode=${encodeURIComponent(mode)}`;

    const showMessage = (text, isError = true) => {
        message.className = isError ? 'form-message' : 'auth-banner';
        message.setAttribute('role', isError ? 'alert' : 'status');
        AppI18n.setText(message, text);
        form.after(message);
    };

    const resetDigits = () => {
        digitInputs.forEach(input => { input.value = ''; });
        updateSubmitState();
        syncDisabledState(0);
    };

    // Quên mật khẩu: mã 6 số do Supabase gửi qua email (resetPasswordForEmail ở trang ForgetPassword).
    const resetEmail = sessionStorage.getItem('pendingPasswordReset');

    if (mode === 'forgot') {
        const emailLabel = document.querySelector('#verificationEmail');
        const changeEmailLink = document.querySelector('#changeEmailLink');
        const resendLink = document.querySelector('.verification-resend a');

        if (emailLabel && resetEmail) {
            const [name, domain] = resetEmail.split('@');
            emailLabel.textContent = `${name.slice(0, 1)}***@${domain}`;
        }
        changeEmailLink?.setAttribute('href', '/Account/ForgetPassword');

        resendLink?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!resetEmail || !window.sb) {
                window.location.assign('/Account/ForgetPassword');
                return;
            }

            const { error } = await window.sb.auth.resetPasswordForEmail(resetEmail);
            if (error) {
                showMessage(error.status === 429
                    ? 'ui.too_many_requests_please_wait_a_few_minutes_and_try_again'
                    : 'ui.unable_to_resend_the_code_please_try_again_later');
                return;
            }
            resetDigits();
            showMessage('ui.verification_code_resent_please_check_your_email', false);
        });
    }

    const verifyPasswordReset = async () => {
        const code = getCode();

        if (!resetEmail) {
            showMessage('ui.recovery_session_expired_please_enter_your_email_again');
            return false;
        }

        if (!/^\d{6}$/.test(code) || !window.sb) {
            showMessage('ui.the_verification_code_is_incorrect_or_expired');
            return false;
        }

        submitButton.disabled = true;

        // Mã đúng thì Supabase tạo phiên đăng nhập tạm để đổi mật khẩu ở trang ResetPassword.
        const { error } = await window.sb.auth.verifyOtp({ email: resetEmail, token: code, type: 'recovery' });

        if (error) {
            showMessage(error.status === 429
                ? 'ui.too_many_attempts_please_wait_a_few_minutes_and_try_again'
                : 'ui.the_verification_code_is_incorrect_or_expired');
            resetDigits();
            return false;
        }

        sessionStorage.removeItem('pendingPasswordReset');
        window.location.assign('/Account/ResetPassword');
        return true;
    };

    const verify = () => {
        if (mode === 'forgot') {
            return verifyPasswordReset();
        }

        const code = getCode();
        const pendingSignup = sessionStorage.getItem('pendingSignup');
        const pendingLogin = sessionStorage.getItem('pendingLogin');

        if (!/^\d{6}$/.test(code) || (!pendingSignup && !pendingLogin)) {
            AppI18n.setText(message, 'ui.invalid_verification_code_or_expired_registration_session');
            form.after(message);
            return false;
        }

        if (pendingSignup) {
            sessionStorage.setItem('registeredUser', pendingSignup);
            sessionStorage.removeItem('pendingSignup');
            window.location.assign('/Account/Login');
            return true;
        }

        sessionStorage.setItem('userToken', 'authenticated');
        sessionStorage.removeItem('pendingLogin');
        document.cookie = 'userToken=authenticated; path=/; SameSite=Lax';
        window.location.assign('/Index');
        return true;
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        verify();
    });

    updateSubmitState();
    syncDisabledState(getFirstEmptyOrLastIndex());
});
