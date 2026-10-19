document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    const form = document.querySelector('.account-form');
    if (!form) return;

    const digitInputs = Array.from(form.querySelectorAll('.verification-inputs input'));
    const completion = window.FormCompletion.attach(form);

    const message = document.createElement('p');
    message.className = 'form-message';
    message.setAttribute('role', 'alert');

    const updateSubmitState = () => {
        completion.refresh();
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
    let signupEmail = sessionStorage.getItem('pendingSignupEmail') || '';
    try {
        const draft = JSON.parse(sessionStorage.getItem('pendingSignupFormDraft') || '{}');
        if (typeof draft.email === 'string' && draft.email.trim()) {
            signupEmail = draft.email.trim().toLowerCase();
            sessionStorage.setItem('pendingSignupEmail', signupEmail);
        }
    } catch (error) {
        console.error('Could not read the saved sign-up email.', error);
    }
    const maskEmail = (email) => {
        const separatorIndex = email.lastIndexOf('@');
        if (separatorIndex <= 0 || separatorIndex === email.length - 1) return email;
        return `${email.slice(0, 1)}***${email.slice(separatorIndex)}`;
    };

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

    const setupResendCooldown = (link, storageKey) => {
        if (!link) return null;

        let timer;
        let cooldownEnd = Number(sessionStorage.getItem(storageKey)) || 0;
        const render = () => {
            const seconds = Math.ceil((cooldownEnd - Date.now()) / 1000);
            if (seconds > 0) {
                const template = window.AppI18n.t('ui.resend_in_seconds', 'Gửi lại sau {seconds} giây');
                link.removeAttribute('data-i18n');
                link.textContent = template.replace('{seconds}', String(seconds));
                link.classList.add('verification-resend--disabled');
                link.setAttribute('aria-disabled', 'true');
                link.setAttribute('tabindex', '-1');
                return true;
            }

            clearInterval(timer);
            sessionStorage.removeItem(storageKey);
            link.classList.remove('verification-resend--disabled');
            link.removeAttribute('aria-disabled');
            link.removeAttribute('tabindex');
            link.setAttribute('data-i18n', 'ui.resend');
            window.AppI18n.translate(link);
            return false;
        };
        const start = () => {
            cooldownEnd = Date.now() + 60000;
            sessionStorage.setItem(storageKey, String(cooldownEnd));
            render();
            timer = setInterval(render, 250);
        };
        const setBusy = (busy) => {
            link.classList.toggle('verification-resend--disabled', busy);
            link.setAttribute('aria-disabled', String(busy));
            if (busy) link.setAttribute('tabindex', '-1');
            else if (cooldownEnd <= Date.now()) link.removeAttribute('tabindex');
        };

        if (cooldownEnd > Date.now()) {
            render();
            timer = setInterval(render, 250);
        } else {
            sessionStorage.removeItem(storageKey);
        }
        window.addEventListener('app:languagechange', render);
        window.AppI18n.ready.then(render);
        return { start, setBusy, isCoolingDown: () => cooldownEnd > Date.now() };
    };

    const resendCooldownKey = `verificationResendUntil:${mode}`;
    const resendLink = document.querySelector('.verification-resend a');
    const resendCooldown = setupResendCooldown(resendLink, resendCooldownKey);
    let resendInFlight = false;
    const resendCode = async (request, failureMessage) => {
        if (resendInFlight || resendCooldown?.isCoolingDown()) return;
        resendInFlight = true;
        resendCooldown?.setBusy(true);
        try {
            const { error } = await request();
            if (error) {
                showMessage(error.status === 429
                    ? 'ui.too_many_requests_please_wait_a_few_minutes_and_try_again'
                    : failureMessage);
                resendCooldown?.setBusy(false);
                return;
            }
            resetDigits();
            showMessage('ui.verification_code_resent_please_check_your_email', false);
            resendCooldown?.start();
        } catch (error) {
            console.error('Could not resend the verification code.', error);
            showMessage(failureMessage);
            resendCooldown?.setBusy(false);
        } finally {
            resendInFlight = false;
        }
    };

    // Quên mật khẩu: mã 6 số do Supabase gửi qua email (resetPasswordForEmail ở trang ForgetPassword).
    const resetEmail = sessionStorage.getItem('pendingPasswordReset');

    if (mode === 'forgot') {
        const emailLabel = document.querySelector('#verificationEmail');

        if (emailLabel && resetEmail) {
            emailLabel.textContent = maskEmail(resetEmail);
        }

        resendLink?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (resendCooldown?.isCoolingDown() || resendInFlight) return;
            if (!resetEmail || !window.sb) {
                window.location.assign('/Account/ForgetPassword');
                return;
            }
            await resendCode(
                () => window.sb.auth.resetPasswordForEmail(resetEmail),
                'ui.unable_to_resend_the_code_please_try_again_later'
            );
        });
    }

    if (mode === 'signup') {
        const emailLabel = document.querySelector('#verificationEmail');

        if (emailLabel && signupEmail) {
            emailLabel.textContent = maskEmail(signupEmail);
        }

        resendLink?.addEventListener('click', async (e) => {
            e.preventDefault();
            if (resendCooldown?.isCoolingDown() || resendInFlight) return;
            if (!signupEmail) {
                showMessage('ui.signup_email_missing_for_resend');
                return;
            }
            if (!window.sb) {
                showMessage('ui.cannot_connect_to_the_authentication_server_please_try_again_later');
                return;
            }

            await resendCode(
                () => window.sb.auth.resend({ type: 'signup', email: signupEmail }),
                'ui.unable_to_resend_the_code_please_try_again_later'
            );
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

        completion.setBusy(true);

        // Mã đúng thì Supabase tạo phiên đăng nhập tạm để đổi mật khẩu ở trang ResetPassword.
        const { error } = await window.sb.auth.verifyOtp({ email: resetEmail, token: code, type: 'recovery' });

        if (error) {
            showMessage(error.status === 429
                ? 'ui.too_many_attempts_please_wait_a_few_minutes_and_try_again'
                : 'ui.the_verification_code_is_incorrect_or_expired');
            resetDigits();
            completion.setBusy(false);
            return false;
        }

        sessionStorage.removeItem('pendingPasswordReset');
        window.location.assign('/Account/ResetPassword');
        return true;
    };

    const verifySignup = async () => {
        const code = getCode();
        const pendingSignup = sessionStorage.getItem('pendingSignup');
        const pendingLogin = sessionStorage.getItem('pendingLogin');

        if (!/^\d{6}$/.test(code) || (!pendingSignup && !pendingLogin)) {
            AppI18n.setText(message, 'ui.invalid_verification_code_or_expired_registration_session');
            form.after(message);
            return false;
        }

        completion.setBusy(true);
        const { error } = await window.sb.auth.verifyOtp({ email: signupEmail, token: code, type: 'signup' });
        if (error) {
            showMessage(error.status === 429
                ? 'Bạn thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.'
                : 'Mã xác thực không đúng hoặc đã hết hạn.');
            resetDigits();
            completion.setBusy(false);
            return false;
        }

        sessionStorage.removeItem('pendingSignupEmail');
        sessionStorage.removeItem('pendingSignupFormDraft');
        window.location.assign('/Account/Login?verified=1');
        return true;
    };

    const verify = () => {
        if (mode === 'forgot') {
            return verifyPasswordReset();
        }

        if (mode === 'signup') {
            return verifySignup();
        }

        window.location.assign('/Account/Login');
        return false;
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await verify();
    });

    updateSubmitState();
    syncDisabledState(getFirstEmptyOrLastIndex());
});
