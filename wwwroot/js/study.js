document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    // ==========================================
    // 1. THƯ VIỆN: Mở/đóng nhóm chủ đề & Nút Expand/Collapse All
    // ==========================================
    const toggleAllBtn = document.getElementById('study-lib-toggle-all');
    const catToggles = Array.from(document.querySelectorAll('.study-cat__toggle'));

    function updateToggleAllButton() {
        if (!toggleAllBtn || catToggles.length === 0) return;
        const openCount = catToggles.filter(t => t.getAttribute('aria-expanded') === 'true').length;
        const iconSpan = toggleAllBtn.querySelector('.toggle-all__icon');
        const textSpan = toggleAllBtn.querySelector('.toggle-all__text');

        // Yêu cầu:
        // - Khi ko có bất kỳ mục nào mở -> expand all
        // - Khi có ít nhất 1 mục mở -> collapse all
        if (openCount > 0) {
            toggleAllBtn.setAttribute('data-state', 'collapse');
            if (iconSpan) iconSpan.textContent = '⊟';
            if (textSpan) {
                textSpan.textContent = window.AppI18n?.t('study.collapse_all', 'Thu gọn tất cả');
                textSpan.setAttribute('data-i18n', 'study.collapse_all');
            }
            const tip = window.AppI18n?.t('study.toggle_all_title', 'Thu gọn tất cả các danh mục');
            toggleAllBtn.setAttribute('title', tip);
            toggleAllBtn.setAttribute('data-i18n-title', 'study.toggle_all_title');
        } else {
            toggleAllBtn.setAttribute('data-state', 'expand');
            if (iconSpan) iconSpan.textContent = '⊞';
            if (textSpan) {
                textSpan.textContent = window.AppI18n?.t('study.expand_all', 'Mở tất cả');
                textSpan.setAttribute('data-i18n', 'study.expand_all');
            }
            const tip = window.AppI18n?.t('study.toggle_all_title', 'Mở rộng tất cả các danh mục');
            toggleAllBtn.setAttribute('title', tip);
            toggleAllBtn.setAttribute('data-i18n-title', 'study.toggle_all_title');
        }
    }

    catToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const open = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!open));
            const controlsId = toggle.getAttribute('aria-controls');
            if (controlsId) {
                const target = document.getElementById(controlsId);
                if (target) target.hidden = open;
            }
            updateToggleAllButton();
        });
    });

    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', () => {
            const state = toggleAllBtn.getAttribute('data-state') || 'collapse';
            const willExpand = state === 'expand';

            catToggles.forEach(toggle => {
                toggle.setAttribute('aria-expanded', String(willExpand));
                const controlsId = toggle.getAttribute('aria-controls');
                if (controlsId) {
                    const target = document.getElementById(controlsId);
                    if (target) target.hidden = !willExpand;
                }
            });

            updateToggleAllButton();
        });
    }

    // Khởi tạo trạng thái nút Expand / Collapse All theo các mục mở ban đầu
    updateToggleAllButton();

    // ==========================================
    // 2. CHỌN CHỦ ĐỀ & KÍCH HOẠT PANEL BÀI HỌC
    // ==========================================
    const topicButtons = document.querySelectorAll('.study-cat__list [data-topic]');
    function activateTopic(topicId) {
        if (!topicId) return;

        // Cập nhật trạng thái active trên tất cả button bài lớn
        document.querySelectorAll('[data-topic]').forEach(b => {
            if (b.dataset.topic === topicId) {
                b.setAttribute('aria-current', 'true');
            } else {
                b.removeAttribute('aria-current');
            }
        });

        // Chuyển panel nội dung
        document.querySelectorAll('[data-topic-panel]').forEach(panel => {
            const active = panel.dataset.topicPanel === topicId;
            panel.hidden = !active;
            if (active) {
                panel.classList.remove('is-swapping');
                void panel.offsetWidth;
                panel.classList.add('is-swapping');
            }
        });

        // Tự động mở danh mục chứa topic nếu đang đóng
        const origBtn = Array.from(document.querySelectorAll('.study-cat__list [data-topic]')).find(b => b.dataset.topic === topicId);
        if (origBtn) {
            const parentList = origBtn.closest('.study-cat__list');
            if (parentList && parentList.hidden) {
                parentList.hidden = false;
                const toggle = document.querySelector(`.study-cat__toggle[aria-controls="${parentList.id}"]`);
                if (toggle) toggle.setAttribute('aria-expanded', 'true');
                updateToggleAllButton();
            }
        }

        // Màn hình hẹp: cuộn xuống bảng bài học
        if (window.matchMedia('(max-width: 960px)').matches) {
            const topicEl = document.getElementById('study-topic');
            if (topicEl) {
                topicEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    topicButtons.forEach(button => {
        button.addEventListener('click', () => {
            activateTopic(button.dataset.topic);
        });
    });

    // ==========================================
    // 3. TÌM KIẾM TƯƠNG ĐỒNG BÀI HỌC (SEARCH)
    // ==========================================
    const searchInput = document.getElementById('study-search-input');
    const searchClearBtn = document.getElementById('study-search-clear');
    const searchSubmitBtn = document.getElementById('study-search-btn');
    const searchResults = document.getElementById('study-search-results');
    const searchMeta = document.getElementById('study-search-meta');
    const searchList = document.getElementById('study-search-list');
    const libCategories = document.getElementById('study-lib-categories');

    function normalizeStr(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .trim();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Thu thập danh sách bài lớn từ DOM
    const topicsData = Array.from(topicButtons).map(btn => {
        const id = btn.dataset.topic;
        const title = btn.dataset.topicTitle || btn.querySelector('span')?.textContent?.trim() || '';
        const cat = btn.dataset.category || '';
        const count = btn.dataset.count || btn.querySelector('small')?.textContent?.replace(/[^0-9]/g, '') || '';
        return {
            id,
            title,
            cat,
            count,
            normTitle: normalizeStr(title),
            normCat: normalizeStr(cat),
            element: btn
        };
    });

    function executeSearch(query) {
        const rawQuery = (query || '').trim();
        const normQuery = normalizeStr(rawQuery);

        if (!normQuery) {
            clearSearch();
            return;
        }

        if (searchClearBtn) searchClearBtn.hidden = false;

        // Ẩn danh mục phân cấp thể loại và nhóm nội dung
        if (libCategories) libCategories.hidden = true;
        if (toggleAllBtn) toggleAllBtn.style.display = 'none';

        // Hiện vùng kết quả tìm kiếm phẳng (chỉ bài lớn)
        if (searchResults) searchResults.hidden = false;

        // Lọc bài lớn tương đồng
        const matches = topicsData.filter(item => {
            return item.normTitle.includes(normQuery) || item.normCat.includes(normQuery);
        });

        if (searchMeta) {
            const foundPrefix = window.AppI18n?.t('study.search_found_prefix', 'Tìm thấy');
            const foundSuffix = window.AppI18n?.t('study.search_found_suffix', 'bài học cho');
            searchMeta.innerHTML = `<span class="study-search-count">${escapeHtml(foundPrefix)} <b>${matches.length}</b> ${escapeHtml(foundSuffix)} "${escapeHtml(rawQuery)}"</span>`;
        }

        if (searchList) {
            searchList.innerHTML = '';
            if (matches.length === 0) {
                const emptyTitle = window.AppI18n?.t('study.search_empty_title', 'Không tìm thấy bài học phù hợp');
                const emptyDesc = window.AppI18n?.t('study.search_empty_desc', 'Thử tìm từ khóa khác như "present", "greetings", "numbers", "coffee", "occupations"...');
                searchList.innerHTML = `
                    <div class="study-search-empty">
                        <svg class="empty-icon-svg" viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <p data-i18n="study.search_empty_title">${escapeHtml(emptyTitle)}</p>
                        <small data-i18n="study.search_empty_desc">${escapeHtml(emptyDesc)}</small>
                    </div>
                `;
                return;
            }

            matches.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'study-search-item';
                btn.dataset.topic = item.id;
                btn.setAttribute('aria-controls', 'study-topic');

                const isCurrent = item.element.getAttribute('aria-current') === 'true';
                if (isCurrent) btn.setAttribute('aria-current', 'true');

                const unitText = window.AppI18n?.t('study.lessons_unit', 'bài');
                btn.innerHTML = `
                    <div class="study-search-item__info">
                        <span class="study-search-item__title">${escapeHtml(item.title)}</span>
                        ${item.cat ? `<span class="study-search-item__cat">${escapeHtml(item.cat)}</span>` : ''}
                    </div>
                    <span class="study-search-item__count">${escapeHtml(item.count)} <span data-i18n="study.lessons_unit">${escapeHtml(unitText)}</span></span>
                `;

                btn.addEventListener('click', () => {
                    activateTopic(item.id);
                });

                searchList.appendChild(btn);
            });
        }
    }

    function updateClearButton() {
        if (!searchClearBtn) return;
        const hasText = Boolean(searchInput && searchInput.value.length > 0);
        searchClearBtn.hidden = !hasText;
    }

    function clearSearch() {
        if (searchInput) searchInput.value = '';
        if (searchClearBtn) searchClearBtn.hidden = true;
        if (searchResults) searchResults.hidden = true;
        if (libCategories) libCategories.hidden = false;
        if (toggleAllBtn) toggleAllBtn.style.display = '';
    }

    // Khởi tạo trạng thái nút xóa: chỉ hiển thị khi có nội dung
    updateClearButton();

    if (searchInput) {
        let debounceTimer = null;
        searchInput.addEventListener('input', () => {
            updateClearButton();
            const val = searchInput.value;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (val.trim()) {
                    executeSearch(val);
                } else {
                    clearSearch();
                }
            }, 150);
        });

        searchInput.addEventListener('change', updateClearButton);

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeSearch(searchInput.value);
            }
        });
    }

    if (searchSubmitBtn) {
        searchSubmitBtn.addEventListener('click', () => {
            executeSearch(searchInput ? searchInput.value : '');
        });
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            clearSearch();
            if (searchInput) searchInput.focus();
        });
    }

    // ==========================================
    // 2. BÀN CỜ ĐỒ THỊ LỘ TRÌNH (ĐƯỜNG NỐI BÉZIER KHÔNG MŨI TÊN)
    // ==========================================
    const viewport = document.getElementById('study-board-viewport');
    const canvas = document.getElementById('study-board-canvas');
    const svg = document.getElementById('study-board-svg');

    // Hàm vẽ các đường cong nối Bézier (không có đầu mũi tên)
    function drawConnectors() {
        if (!canvas || !svg) return;

        // Xóa các đường nối cũ
        const existingPaths = svg.querySelectorAll('.study-connector');
        existingPaths.forEach(p => p.remove());

        const canvasWidth = canvas.scrollWidth;
        const canvasHeight = canvas.scrollHeight;
        svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
        svg.style.width = canvasWidth + 'px';
        svg.style.height = canvasHeight + 'px';

        const nodes = canvas.querySelectorAll('.study-node');
        const nodeMap = new Map();

        nodes.forEach(node => {
            const id = node.dataset.nodeId;
            if (id) nodeMap.set(id, node);
        });

        nodes.forEach(targetNode => {
            const prereqRaw = targetNode.dataset.prereq;
            if (!prereqRaw) return;

            const prereqs = prereqRaw.split(',').map(s => s.trim()).filter(Boolean);
            const targetState = targetNode.classList.contains('study-node--done')
                ? 'done'
                : targetNode.classList.contains('study-node--current')
                    ? 'current'
                    : 'locked';

            prereqs.forEach(sourceId => {
                const sourceNode = nodeMap.get(sourceId);
                if (!sourceNode) return;

                // Tọa độ tương đối trong canvas: từ mép phải node trước sang mép trái node sau
                const x1 = sourceNode.offsetLeft + sourceNode.offsetWidth;
                const y1 = sourceNode.offsetTop + (sourceNode.offsetHeight / 2);

                const x2 = targetNode.offsetLeft;
                const y2 = targetNode.offsetTop + (targetNode.offsetHeight / 2);

                // Độ uốn cong Bézier mượt mà S-curve
                const deltaX = Math.max(38, (x2 - x1) * 0.48);
                const d = `M ${x1} ${y1} C ${x1 + deltaX} ${y1}, ${x2 - deltaX} ${y2}, ${x2} ${y2}`;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', d);

                let cls = 'study-connector';
                if (targetState === 'done') {
                    cls += ' is-active';
                } else if (targetState === 'current') {
                    cls += ' is-active is-current';
                }

                path.setAttribute('class', cls);
                // Không đặt marker-end để loại bỏ đầu mũi tên theo yêu cầu
                svg.appendChild(path);
            });
        });
    }

    // Cuộn tới bài học đang học
    function scrollToCurrent(smooth = true) {
        if (!viewport) return;
        const current = viewport.querySelector('.study-node--current') || viewport.querySelector('.study-node--done');
        if (current) {
            const targetLeft = current.offsetLeft - (viewport.clientWidth - current.offsetWidth) / 2;
            viewport.scrollTo({
                left: Math.max(0, targetLeft),
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    }

    // Khởi tạo đồ thị sau khi layout sẵn sàng
    drawConnectors();
    window.addEventListener('resize', drawConnectors);
    setTimeout(drawConnectors, 250);
    setTimeout(() => scrollToCurrent(false), 300);

    // ==========================================
    // 3. ĐIỀU KHIỂN CUỘN BÀN CỜ (BUTTONS & DRAG-TO-SCROLL)
    // ==========================================
    const btnLeft = document.getElementById('study-scroll-left');
    const btnRight = document.getElementById('study-scroll-right');
    const btnCurrent = document.getElementById('study-scroll-current');

    if (btnLeft && viewport) {
        btnLeft.addEventListener('click', () => {
            viewport.scrollBy({ left: -320, behavior: 'smooth' });
        });
    }

    if (btnRight && viewport) {
        btnRight.addEventListener('click', () => {
            viewport.scrollBy({ left: 320, behavior: 'smooth' });
        });
    }

    if (btnCurrent) {
        btnCurrent.addEventListener('click', () => {
            scrollToCurrent(true);
        });
    }

    // Kéo chuột để cuộn ngang (Drag-to-scroll)
    if (viewport) {
        let isDown = false;
        let startX = 0;
        let scrollStart = 0;
        let hasDragged = false;

        viewport.addEventListener('mousedown', (e) => {
            // Không chặn khi bấm vào link/button
            if (e.target.closest('a, button')) return;
            isDown = true;
            hasDragged = false;
            viewport.classList.add('is-dragging');
            startX = e.pageX - viewport.offsetLeft;
            scrollStart = viewport.scrollLeft;
        });

        window.addEventListener('mouseup', () => {
            if (!isDown) return;
            isDown = false;
            viewport.classList.remove('is-dragging');
        });

        viewport.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - viewport.offsetLeft;
            const dist = x - startX;
            if (Math.abs(dist) > 5) hasDragged = true;
            viewport.scrollLeft = scrollStart - (dist * 1.4);
        });

        // Bấm vào node để mở chi tiết bài học (nếu bài đã mở hoặc đang học)
        viewport.querySelectorAll('.study-node').forEach(node => {
            node.addEventListener('click', (e) => {
                if (hasDragged) return; // Nếu đang kéo chuột thì không kích hoạt click
                if (e.target.closest('a, button')) return; // Đã có nút riêng xử lý

                const isLocked = node.classList.contains('study-node--locked');
                const lessonId = node.dataset.nodeId;
                if (!isLocked && lessonId) {
                    window.location.href = `/LessonDetail?id=${encodeURIComponent(lessonId)}`;
                }
            });
        });
    }
});
