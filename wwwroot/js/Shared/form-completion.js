(() => {
    function attach(form) {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
        if (!submitButton) throw new Error('Form completion requires a submit button.');

        let busy = false;

        const isComplete = () => Array.from(form.querySelectorAll('[required]')).every((input) => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                if (!input.checked) return false;
            } else if (input.value.length === 0 || (input.type !== 'password' && !input.value.trim())) {
                return false;
            }

            if (!input.validity.valid) return false;

            const matchSelector = input.dataset.matchInput;
            if (matchSelector && form.querySelector(matchSelector)?.value !== input.value) return false;
            return true;
        });

        const refresh = () => {
            submitButton.disabled = busy || !isComplete();
        };

        form.addEventListener('input', refresh);
        form.addEventListener('change', refresh);

        return {
            refresh,
            setBusy(value) {
                busy = value;
                refresh();
            }
        };
    }

    window.FormCompletion = { attach };
})();
