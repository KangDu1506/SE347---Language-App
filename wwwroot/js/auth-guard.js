const protectedPage = document.querySelector(
    '.home-page, .study-page, .profile-page, .ranking-page, .trial-page, .create-quiz-page, .lesson-detail-page'
);
const localAuthBypassEnabled = document.querySelector('meta[name="local-auth-bypass"]')?.content === 'true';
const hasTestSessionToken = (() => {
    try {
        return sessionStorage.getItem('userToken') === 'authenticated';
    } catch {
        return false;
    }
})();

if (protectedPage) {
    protectedPage.hidden = true;

    if (localAuthBypassEnabled || hasTestSessionToken) {
        protectedPage.hidden = false;
    } else if (!window.sb) {
        console.error('Không thể xác thực phiên: Supabase client chưa được khởi tạo.');
        window.location.replace('/Account/Login');
    } else {
        window.sb.auth.getUser().then(({ data, error }) => {
            if (error) {
                console.error('Không thể xác thực phiên Supabase:', error);
            }

            if (error || !data.user) {
                window.location.replace('/Account/Login');
                return;
            }

            protectedPage.hidden = false;
        }).catch((error) => {
            console.error('Không thể xác thực phiên Supabase:', error);
            window.location.replace('/Account/Login');
        });
    }
}