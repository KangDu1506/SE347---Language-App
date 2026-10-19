(() => {
    const recommendations = [
        { key: 'uppercase', pattern: /[A-Z]/ },
        { key: 'lowercase', pattern: /[a-z]/ },
        { key: 'number', pattern: /[0-9]/ },
        { key: 'symbol', pattern: /[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/ }
    ];

    function attach(input, container) {
        const text = container?.querySelector('.password-strength__text');
        const bar = container?.querySelector('.password-strength__bar span');
        if (!input || !container || !text || !bar) return;

        const update = () => {
            const value = input.value;
            const meetsLength = Array.from(value).length >= 10;
            const metRecommendations = recommendations.filter(({ pattern }) => pattern.test(value));
            const score = Number(meetsLength) + metRecommendations.length;

            container.querySelectorAll('[data-password-suggestion]').forEach((item) => {
                const recommendation = recommendations.find(({ key }) => key === item.dataset.passwordSuggestion);
                item.hidden = Boolean(recommendation && recommendation.pattern.test(value));
            });

            container.dataset.strength = score === 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
            bar.style.width = `${score * 20}%`;
            AppI18n.setText(text, value.length === 0
                ? 'ui.strength_no_password_yet'
                : score >= 3
                    ? 'ui.strength_good'
                    : 'ui.strength_weak_add_uppercase_letters_numbers_or_symbols');
        };

        input.addEventListener('input', update);
        update();
    }

    window.PasswordStrength = { attach };
})();
