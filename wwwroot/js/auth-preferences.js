(() => {
    const translations = {
        vi: {
            'preferences.theme': 'Giao diện',
            'preferences.language': 'English',
            'preferences.label': 'Tùy chọn hiển thị',
            'preferences.next.dark': 'Tối',
            'preferences.next.light': 'Sáng',
            'preferences.theme.dark': 'Chuyển sang giao diện tối',
            'preferences.theme.light': 'Chuyển sang giao diện sáng',
            'page.login': 'Đăng nhập',
            'login.sideTitle': 'Mỗi ngày một chút,<br>tiến bộ thật nhiều',
            'login.sideText': 'Tiếp tục hành trình học tiếng Anh của bạn.',
            'login.eyebrow': 'Chào mừng trở lại',
            'login.subtitle': 'Đăng nhập để tiếp tục hành trình học tập.',
            'login.email': 'Email',
            'login.password': 'Mật khẩu',
            'login.remember': 'Ghi nhớ đăng nhập',
            'login.forgot': 'Quên mật khẩu?',
            'login.submit': 'Đăng nhập',
            'login.or': 'Hoặc đăng nhập với',
            'login.google': 'Google',
            'login.noAccount': 'Chưa có tài khoản?',
            'login.signup': 'Đăng ký',
            'signup.page': 'Đăng ký',
            'signup.sideTitle': 'Bắt đầu hành trình',
            'signup.sideText': 'Tạo tài khoản để lưu tiến độ và học mọi lúc.',
            'signup.eyebrow': 'Bắt đầu hành trình',
            'signup.title': 'Tạo tài khoản',
            'signup.subtitle': 'Đăng ký để lưu tiến độ và học mọi lúc.',
            'signup.fullName': 'Họ và tên',
            'signup.username': 'Tên đăng nhập',
            'signup.email': 'Email',
            'signup.password': 'Mật khẩu',
            'signup.passwordPlaceholder': 'Tối thiểu 16 ký tự',
            'password.show': 'Hiện',
            'password.hide': 'Ẩn',
            'signup.strengthEmpty': 'Độ mạnh: Chưa có mật khẩu',
            'signup.strengthStrong': 'Độ mạnh: Mạnh',
            'signup.strengthMedium': 'Độ mạnh: Trung bình',
            'signup.strengthWeak': 'Độ mạnh: Yếu',
            'signup.terms': 'Tôi đồng ý với',
            'signup.termsLink': 'Điều khoản sử dụng',
            'signup.submit': 'Tạo tài khoản',
            'signup.haveAccount': 'Đã có tài khoản?',
            'signup.login': 'Đăng nhập',
            'auth.page': 'Xác thực tài khoản',
            'auth.sideTitle': 'Một bước nữa thôi',
            'auth.sideText': 'Xác thực để bảo vệ tài khoản và tiếp tục hành trình.',
            'auth.eyebrow': 'Bảo mật tài khoản',
            'auth.title': 'Kiểm tra email',
            'auth.instructions': 'Nhập mã 6 số đã gửi tới',
            'auth.changeEmail': 'Đổi email',
            'auth.code': 'Mã xác thực',
            'auth.keyboardHint': '(vui lòng tắt bộ gõ tiếng Việt để nhập)',
            'auth.codeGroup': 'Mã xác thực gồm 6 số',
            'auth.digit1': 'Số 1',
            'auth.digit2': 'Số 2',
            'auth.digit3': 'Số 3',
            'auth.digit4': 'Số 4',
            'auth.digit5': 'Số 5',
            'auth.digit6': 'Số 6',
            'auth.submit': 'Xác nhận',
            'auth.noCode': 'Chưa nhận được mã?',
            'auth.resend': 'Gửi lại',
            'auth.haveAccount': 'Đã có tài khoản?',
            'auth.login': 'Quay lại đăng nhập',
            'forgot.page': 'Quên mật khẩu',
            'forgot.sideTitle': 'Lấy lại quyền truy cập',
            'forgot.sideText': 'Chúng tôi sẽ giúp bạn trở lại việc học thật nhanh.',
            'forgot.eyebrow': 'Khôi phục tài khoản',
            'forgot.title': 'Quên mật khẩu?',
            'forgot.subtitle': 'Nhập email để nhận mã xác thực khôi phục tài khoản.',
            'forgot.email': 'Email',
            'forgot.submit': 'Gửi mã xác thực',
            'forgot.login': 'Quay lại đăng nhập'
        },
        en: {
            'preferences.theme': 'Theme',
            'preferences.language': 'Tiếng Việt',
            'preferences.label': 'Display preferences',
            'preferences.next.dark': 'Dark',
            'preferences.next.light': 'Light',
            'preferences.theme.dark': 'Switch to dark theme',
            'preferences.theme.light': 'Switch to light theme',
            'page.login': 'Sign in',
            'login.sideTitle': 'A little progress<br>every day',
            'login.sideText': 'Continue your English learning journey.',
            'login.eyebrow': 'Welcome back',
            'login.subtitle': 'Sign in to continue your learning journey.',
            'login.email': 'Email',
            'login.password': 'Password',
            'login.remember': 'Remember me',
            'login.forgot': 'Forgot password?',
            'login.submit': 'Sign in',
            'login.or': 'Or sign in with',
            'login.google': 'Google',
            'login.noAccount': "Don't have an account?",
            'login.signup': 'Sign up',
            'signup.page': 'Sign up',
            'signup.sideTitle': 'Start your journey',
            'signup.sideText': 'Create an account to save your progress and learn anywhere.',
            'signup.eyebrow': 'Start your journey',
            'signup.title': 'Create an account',
            'signup.subtitle': 'Sign up to save your progress and learn anywhere.',
            'signup.fullName': 'Full name',
            'signup.username': 'Username',
            'signup.email': 'Email',
            'signup.password': 'Password',
            'signup.passwordPlaceholder': 'At least 16 characters',
            'password.show': 'Show',
            'password.hide': 'Hide',
            'signup.strengthEmpty': 'Strength: No password',
            'signup.strengthStrong': 'Strength: Strong',
            'signup.strengthMedium': 'Strength: Medium',
            'signup.strengthWeak': 'Strength: Weak',
            'signup.terms': 'I agree to the',
            'signup.termsLink': 'Terms of Use',
            'signup.submit': 'Create account',
            'signup.haveAccount': 'Already have an account?',
            'signup.login': 'Sign in',
            'auth.page': 'Verify account',
            'auth.sideTitle': 'One more step',
            'auth.sideText': 'Verify your account to keep it secure and continue learning.',
            'auth.eyebrow': 'Account security',
            'auth.title': 'Check your email',
            'auth.instructions': 'Enter the 6-digit code sent to',
            'auth.changeEmail': 'Change email',
            'auth.code': 'Verification code',
            'auth.keyboardHint': '(please disable Vietnamese input to enter the code)',
            'auth.codeGroup': '6-digit verification code',
            'auth.digit1': 'Digit 1',
            'auth.digit2': 'Digit 2',
            'auth.digit3': 'Digit 3',
            'auth.digit4': 'Digit 4',
            'auth.digit5': 'Digit 5',
            'auth.digit6': 'Digit 6',
            'auth.submit': 'Verify',
            'auth.noCode': "Didn't receive the code?",
            'auth.resend': 'Resend',
            'auth.haveAccount': 'Already have an account?',
            'auth.login': 'Back to sign in',
            'forgot.page': 'Forgot password',
            'forgot.sideTitle': 'Recover your account',
            'forgot.sideText': "We'll help you get back to learning quickly.",
            'forgot.eyebrow': 'Account recovery',
            'forgot.title': 'Forgot password?',
            'forgot.subtitle': 'Enter your email to receive a recovery code.',
            'forgot.email': 'Email',
            'forgot.submit': 'Send verification code',
            'forgot.login': 'Back to sign in'
        }
    };
    const englishMessages = new Map([
        ['Email đã được xác thực. Bạn có thể đăng nhập.', 'Your email has been verified. You can now sign in.'],
        ['Đổi mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.', 'Password changed successfully. Please sign in with your new password.'],
        ['Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.', 'Please enter your email and password.'],
        ['Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại sau.', 'Could not connect to the sign-in service. Please try again later.'],
        ['Email chưa được xác thực. Vui lòng nhập mã đã gửi tới email.', 'Your email is not verified. Please enter the code sent to your email.'],
        ['Email hoặc mật khẩu không đúng.', 'Incorrect email or password.'],
        ['Vui lòng nhập email hợp lệ.', 'Please enter a valid email address.'],
        ['Không kết nối được máy chủ xác thực. Vui lòng thử lại sau.', 'Could not connect to the authentication server. Please try again later.'],
        ['Bạn yêu cầu quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.', 'Too many requests. Please wait a few minutes and try again.'],
        ['Không gửi được mã xác thực. Vui lòng thử lại sau.', 'Could not send the verification code. Please try again later.'],
        ['Bạn thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.', 'Too many attempts. Please wait a few minutes and try again.'],
        ['Không gửi lại được mã. Vui lòng thử lại sau.', 'Could not resend the code. Please try again later.'],
        ['Không gửi lại được mã. Vui lòng kiểm tra email và thử lại.', 'Could not resend the code. Please check your email and try again.'],
        ['Đã gửi lại mã xác thực, vui lòng kiểm tra email.', 'A new verification code was sent. Please check your email.'],
        ['Phiên khôi phục đã hết hạn. Vui lòng nhập lại email.', 'Your recovery session expired. Please enter your email again.'],
        ['Mã xác thực không đúng hoặc đã hết hạn.', 'The verification code is incorrect or has expired.'],
        ['Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại để nhận mã mới.', 'Your sign-up session expired. Please sign up again to get a new code.'],
        ['Mật khẩu phải có ít nhất 16 ký tự.', 'Password must be at least 16 characters.'],
        ['Mật khẩu phải có ít nhất một chữ hoa.', 'Password must contain at least one uppercase letter.'],
        ['Mật khẩu phải có ít nhất một chữ thường.', 'Password must contain at least one lowercase letter.'],
        ['Mật khẩu phải có ít nhất một chữ số.', 'Password must contain at least one number.'],
        ['Mật khẩu phải có ít nhất một ký tự đặc biệt.', 'Password must contain at least one special character.'],
        ['Mật khẩu chỉ được chứa chữ hoa, chữ thường, chữ số và ký tự đặc biệt.', 'Password may only contain letters, numbers, and special characters.'],
        ['Bạn cần đồng ý với Điều khoản sử dụng.', 'You must agree to the Terms of Use.'],
        ['Vui lòng nhập thông tin này.', 'This field is required.'],
        ['Họ và tên chỉ được chứa chữ cái, dấu cách, dấu nháy hoặc gạch nối.', 'Full name may only contain letters, spaces, apostrophes, or hyphens.'],
        ['Hãy viết hoa chữ cái đầu của mỗi từ trong họ và tên.', 'Capitalize the first letter of each word in your full name.'],
        ['Tên đăng nhập phải có ít nhất 6 ký tự.', 'Username must be at least 6 characters.'],
        ['Tên đăng nhập không được vượt quá 32 ký tự.', 'Username must be no more than 32 characters.'],
        ['Email không đúng định dạng, ví dụ: ten@example.com.', 'Enter a valid email, for example: name@example.com.'],
        ['Không kết nối được dịch vụ đăng ký. Vui lòng thử lại sau.', 'Could not connect to the sign-up service. Please try again later.'],
        ['Đang gửi mã...', 'Sending code...'],
        ['Không tạo được tài khoản. Vui lòng kiểm tra lại thông tin.', 'Could not create your account. Please check your information.']
    ]);

    let language = localStorage.getItem('se347-language') === 'en' ? 'en' : 'vi';
    const storedTheme = localStorage.getItem('se347-theme');

    function applyLanguage(nextLanguage) {
        language = nextLanguage;
        document.documentElement.lang = nextLanguage;
        document.querySelectorAll('[data-i18n]').forEach((element) => {
            const value = translations[nextLanguage][element.dataset.i18n];
            if (value !== undefined) element.innerHTML = value;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
            const value = translations[nextLanguage][element.dataset.i18nPlaceholder];
            if (value !== undefined) element.setAttribute('placeholder', value);
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
            const value = translations[nextLanguage][element.dataset.i18nAriaLabel];
            if (value !== undefined) element.setAttribute('aria-label', value);
        });
        document.querySelectorAll('[data-i18n-title]').forEach((element) => {
            const value = translations[nextLanguage][element.dataset.i18nTitle];
            if (value !== undefined) element.setAttribute('title', value);
        });
        document.querySelectorAll('[data-page-title]').forEach((element) => {
            const value = translations[nextLanguage][element.dataset.pageTitle];
            if (value !== undefined) element.textContent = value;
        });
        document.querySelectorAll('.password-toggle').forEach((button) => {
            const label = translations[nextLanguage][button.previousElementSibling.type === 'password' ? 'password.show' : 'password.hide'];
            button.textContent = label;
            button.setAttribute('aria-label', label);
        });
        const strength = document.querySelector('.password-strength');
        const strengthText = strength?.querySelector('.password-strength__text');
        if (strength && strengthText) {
            const key = strength.dataset.strength === 'strong'
                ? 'signup.strengthStrong'
                : strength.dataset.strength === 'medium'
                    ? 'signup.strengthMedium'
                    : 'signup.strengthWeak';
            strengthText.textContent = translations[nextLanguage][key];
        }
        localStorage.setItem('se347-language', nextLanguage);
        updateControls(nextLanguage);
    }

    function updateControls(currentLanguage) {
        const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        const themeButton = document.querySelector('[data-theme-toggle]');
        const languageButton = document.querySelector('[data-language-toggle]');
        if (themeButton) {
            themeButton.querySelector('[data-theme-label]').textContent = translations[currentLanguage][`preferences.next.${theme === 'dark' ? 'light' : 'dark'}`];
            themeButton.setAttribute('aria-label', translations[currentLanguage][`preferences.theme.${theme === 'dark' ? 'light' : 'dark'}`]);
            themeButton.querySelector('[data-theme-icon]').textContent = theme === 'dark' ? '☀' : '☾';
            themeButton.parentElement.setAttribute('aria-label', translations[currentLanguage]['preferences.label']);
        }
        if (languageButton) {
            languageButton.textContent = translations[currentLanguage]['preferences.language'];
            languageButton.setAttribute('aria-label', translations[currentLanguage]['preferences.language']);
        }
    }

    if (storedTheme) document.documentElement.dataset.theme = storedTheme;

    document.addEventListener('DOMContentLoaded', () => {
        applyLanguage(language);

        document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
            const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = nextTheme;
            localStorage.setItem('se347-theme', nextTheme);
            updateControls(language);
        });

        document.querySelector('[data-language-toggle]')?.addEventListener('click', () => {
            applyLanguage(language === 'vi' ? 'en' : 'vi');
        });
    });

    window.authUi = {
        translate(key) {
            return translations[localStorage.getItem('se347-language') === 'en' ? 'en' : 'vi'][key] || key;
        },
        localize(message) {
            return language === 'en' ? englishMessages.get(message) || message : message;
        }
    };
})();
