document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    // Thư viện: mở/đóng nhóm chủ đề
    document.querySelectorAll('.study-cat__toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const open = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!open));
            document.getElementById(toggle.getAttribute('aria-controls')).hidden = open;
        });
    });

    // Chọn chủ đề: hiện bảng bài học tương ứng
    const topicButtons = document.querySelectorAll('[data-topic]');
    topicButtons.forEach(button => {
        button.addEventListener('click', () => {
            topicButtons.forEach(b => b.removeAttribute('aria-current'));
            button.setAttribute('aria-current', 'true');
            document.querySelectorAll('[data-topic-panel]').forEach(panel => {
                const active = panel.dataset.topicPanel === button.dataset.topic;
                panel.hidden = !active;
                if (active) {
                    panel.classList.remove('is-swapping');
                    void panel.offsetWidth;
                    panel.classList.add('is-swapping');
                }
            });
            // Màn hình hẹp: bảng bài học nằm dưới thư viện, cuộn tới để thấy kết quả
            if (window.matchMedia('(max-width: 960px)').matches) {
                document.getElementById('study-topic').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Bàn cờ: đưa ô đang học vào giữa (chỉ cuộn ngang, không kéo cả trang)
    const track = document.querySelector('.study-track');
    const current = track?.querySelector('.study-tile--current');
    if (track && current) {
        track.scrollLeft = current.offsetLeft - (track.clientWidth - current.offsetWidth) / 2;
    }
});
