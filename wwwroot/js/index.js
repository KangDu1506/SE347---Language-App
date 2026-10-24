document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    // Thẻ "Từ của ngày": bấm hoặc Enter/Space để lật
    const word = document.getElementById('dash-word');
    if (word) {
        const flip = () => word.setAttribute('aria-pressed', String(word.classList.toggle('is-flipped')));
        word.addEventListener('click', flip);
        word.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            flip();
        });
    }

    // Lời chào dùng tên hiển thị lúc đăng ký (user_metadata.display_name), giữ "bạn" nếu chưa có
    const nameSlot = document.querySelector('[data-user-name]');
    if (nameSlot && window.sb) {
        window.sb.auth.getUser().then(({ data }) => {
            const meta = data?.user?.user_metadata || {};
            const name = String(meta.display_name || meta.full_name || '').trim();
            if (!name) return;
            // Tên gọi: lấy 2 chữ cuối của họ tên tiếng Việt ("Lê Văn Huy" -> "Văn Huy")
            const shortName = name.split(/\s+/).slice(-2).join(' ');
            nameSlot.removeAttribute('data-i18n');
            nameSlot.textContent = shortName;
        }).catch(() => { /* Giữ lời chào mặc định */ });
    }
});
