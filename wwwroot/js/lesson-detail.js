document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. PHÁT ÂM TỪ VỰNG / MẪU CÂU (TEXT-TO-SPEECH)
    // ==========================================
    const audioButtons = document.querySelectorAll('.detail-audio-btn');

    audioButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = btn.dataset.speech;
            if (!text) return;

            // Hiệu ứng nút khi bấm
            btn.style.transform = 'scale(1.25)';
            setTimeout(() => { btn.style.transform = ''; }, 200);

            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel(); // Hủy câu đang đọc trước đó
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'en-US';
                utterance.rate = 0.9; // Tốc độ tự nhiên, rõ ràng cho người học
                window.speechSynthesis.speak(utterance);
            }
        });
    });

    // ==========================================
    // 2. CHUYỂN ĐỔI CHẾ ĐỘ XEM (DANH SÁCH / THẺ HỌC)
    // ==========================================
    const btnList = document.getElementById('mode-list-view');
    const btnGrid = document.getElementById('mode-grid-view');
    const container = document.getElementById('detail-items-container');

    if (btnList && btnGrid && container) {
        btnList.addEventListener('click', () => {
            btnList.classList.add('is-active');
            btnGrid.classList.remove('is-active');
            container.classList.remove('is-grid-mode');
        });

        btnGrid.addEventListener('click', () => {
            btnGrid.classList.add('is-active');
            btnList.classList.remove('is-active');
            container.classList.add('is-grid-mode');
        });
    }

    // ==========================================
    // 3. NÚT LUYỆN FLASHCARD (CUỘN XUỐNG NỘI DUNG)
    // ==========================================
    const btnFlashcard = document.getElementById('btn-toggle-flashcards');
    if (btnFlashcard && container) {
        btnFlashcard.addEventListener('click', () => {
            // Chuyển sang chế độ Grid và cuộn tới
            if (btnGrid) btnGrid.click();
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
});
