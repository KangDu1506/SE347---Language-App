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
        message.textContent = text;
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
                    ? 'Bạn yêu cầu quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.'
                    : 'Không gửi lại được mã. Vui lòng thử lại sau.');
                return;
            }
            resetDigits();
            showMessage('Đã gửi lại mã xác thực, vui lòng kiểm tra email.', false);
        });
    }

    const verifyPasswordReset = async () => {
        const code = getCode();

        if (!resetEmail) {
            showMessage('Phiên khôi phục đã hết hạn. Vui lòng nhập lại email.');
            return false;
        }

        if (!/^\d{6}$/.test(code) || !window.sb) {
            showMessage('Mã xác thực không đúng hoặc đã hết hạn.');
            return false;
        }

        submitButton.disabled = true;

        // Mã đúng thì Supabase tạo phiên đăng nhập tạm để đổi mật khẩu ở trang ResetPassword.
        const { error } = await window.sb.auth.verifyOtp({ email: resetEmail, token: code, type: 'recovery' });

        if (error) {
            showMessage(error.status === 429
                ? 'Bạn thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.'
                : 'Mã xác thực không đúng hoặc đã hết hạn.');
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
            message.textContent = 'Mã xác thực không đúng hoặc phiên đăng ký đã hết hạn.';
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
