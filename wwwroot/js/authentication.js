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

    const verify = () => {
        const code = getCode();
        const pendingSignup = sessionStorage.getItem('pendingSignup');
        const pendingLogin = sessionStorage.getItem('pendingLogin');
        const pendingPasswordReset = sessionStorage.getItem('pendingPasswordReset');

        if (!/^\d{6}$/.test(code) || (!pendingSignup && !pendingLogin && !pendingPasswordReset)) {
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

        if (pendingPasswordReset) {
            sessionStorage.removeItem('pendingPasswordReset');
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
