const protectedPage = document.querySelector('.home-page');

if (protectedPage) {
    protectedPage.hidden = true;

    if (!window.sb) {
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