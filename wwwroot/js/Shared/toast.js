// Toast dùng chung (SCRUM-29). Gọi được từ JS thường hoặc từ method của Vue:
//   AppToast.success('Đã lưu');
//   AppToast.error('Không kết nối được máy chủ', { duration: 6000 });
//   AppToast.show('Nội dung', { type: 'info', duration: 0 }); // duration 0 = không tự đóng
(function () {
    const MAX_VISIBLE = 3;
    const DEFAULT_DURATION = 4000;
    const TYPES = ['success', 'error', 'warning', 'info'];
    let region = null;

    function getRegion() {
        if (region && document.body.contains(region)) return region;
        region = document.createElement('div');
        region.className = 'toast-region';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-relevant', 'additions');
        document.body.appendChild(region);
        return region;
    }

    function dismiss(toast) {
        if (!toast || toast.classList.contains('is-leaving')) return;
        clearTimeout(toast._timer);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            toast.remove();
            return;
        }
        toast.classList.add('is-leaving');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }

    function startTimer(toast, duration) {
        if (duration > 0) toast._timer = setTimeout(() => dismiss(toast), duration);
    }

    function show(message, options = {}) {
        const type = TYPES.includes(options.type) ? options.type : 'info';
        const duration = Number.isFinite(options.duration) ? options.duration : DEFAULT_DURATION;
        const container = getRegion();

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        // Lỗi đọc ngay lập tức, các loại khác đọc theo hàng đợi của aria-live
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

        const text = document.createElement('span');
        text.className = 'toast__message';
        text.textContent = String(message);

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'toast__close';
        close.setAttribute('aria-label', 'Đóng thông báo');
        close.textContent = '×';
        close.addEventListener('click', () => dismiss(toast));

        toast.append(text, close);
        toast.addEventListener('mouseenter', () => clearTimeout(toast._timer));
        toast.addEventListener('mouseleave', () => startTimer(toast, duration));

        container.appendChild(toast);
        const visible = container.querySelectorAll('.toast:not(.is-leaving)');
        if (visible.length > MAX_VISIBLE) dismiss(visible[0]);

        startTimer(toast, duration);
        return { dismiss: () => dismiss(toast) };
    }

    window.AppToast = {
        show,
        success: (message, options) => show(message, { ...options, type: 'success' }),
        error: (message, options) => show(message, { ...options, type: 'error' }),
        warning: (message, options) => show(message, { ...options, type: 'warning' }),
        info: (message, options) => show(message, { ...options, type: 'info' })
    };
})();
