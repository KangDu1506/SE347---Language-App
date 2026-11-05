document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    // ==========================================
    // CÁC HÀM TIỆN ÍCH CHUẨN HÓA VÀ SO KHỚP CHUỖI
    // ==========================================
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

    const TOPIC_ALIASES = {
        'greetings': 'chao hoi greeting hello hi simple advanced loi chao',
        'numbers': 'so dem so thu tu cardinal ordinal time so đếm số thứ tự',
        'adjectives': 'tinh tu basic adjectives mieu ta tinh chat',
        'foods': 'do an thuc uong am thuc food drinks beverage com nuoc',
        'destinations': 'dia diem du lich locations destinations travel noi chon',
        'occupations': 'nghe nghiep cong viec jobs occupations career nghe',
        'verbs': 'dong tu verb action routine communication hanh dong',
        'time': 'thoi gian gio phut time hour clock',
        'tenses': 'thi ngu phap grammar present past hien tai qua khu',
        'speaking': 'giao tiep speaking noi phan xa',
        'grammar': 'ngu phap grammar cau truc',
        'listening': 'nghe hieu listening audio hoi thoai',
        'vocabulary': 'tu vung vocabulary tu moi'
    };

    function getAliases(text) {
        const norm = normalizeStr(text);
        let res = '';
        for (const [k, v] of Object.entries(TOPIC_ALIASES)) {
            if (norm.includes(k) || v.includes(norm)) {
                res += ' ' + v;
            }
        }
        return res;
    }

    // ==========================================
    // 1. BÀN CỜ ĐỒ THỊ LỘ TRÌNH (SVG CONNECTORS & VIEWPORT)
    // ==========================================
    const viewport = document.getElementById('study-board-viewport');
    const canvas = document.getElementById('study-board-canvas');
    const svg = document.getElementById('study-board-svg');

    // Thu thập danh sách Node trên Board để phục vụ tìm kiếm & làm mờ
    const boardNodes = Array.from(canvas ? canvas.querySelectorAll('.study-node') : []).map(nodeEl => {
        const id = nodeEl.dataset.nodeId || '';
        const level = (nodeEl.dataset.level || '').toUpperCase();
        const category = nodeEl.dataset.category || '';
        const topic = nodeEl.dataset.topic || '';
        const name = nodeEl.dataset.name || nodeEl.querySelector('.study-node__title')?.textContent?.trim() || '';
        const branch = nodeEl.dataset.branch || '';
        const state = nodeEl.classList.contains('study-node--done') ? 'done'
                    : nodeEl.classList.contains('study-node--current') ? 'current'
                    : 'locked';

        const aliasStr = getAliases(topic + ' ' + name + ' ' + category);

        return {
            id,
            level,
            state,
            element: nodeEl,
            col: parseInt(nodeEl.dataset.col || '0', 10),
            row: parseInt(nodeEl.dataset.row || '0', 10),
            normName: normalizeStr(name),
            normTopic: normalizeStr(topic),
            normBranch: normalizeStr(branch),
            normCategory: normalizeStr(category),
            searchBlob: [
                normalizeStr(name),
                normalizeStr(topic),
                normalizeStr(branch),
                normalizeStr(category),
                level.toLowerCase(),
                aliasStr,
                normalizeStr(id)
            ].join(' ')
        };
    });

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
                path.dataset.sourceId = sourceId;
                path.dataset.targetId = targetNode.dataset.nodeId || '';

                let cls = 'study-connector';
                if (targetState === 'done') {
                    cls += ' is-active';
                } else if (targetState === 'current') {
                    cls += ' is-active is-current';
                }

                path.setAttribute('class', cls);
                svg.appendChild(path);
            });
        });
    }

    // Cuộn mượt đến một node cụ thể trên Board và tạo nháy sáng định vị
    function scrollToNode(targetEl, smooth = true, pulse = true) {
        if (!viewport || !targetEl) return;
        const targetLeft = targetEl.offsetLeft - (viewport.clientWidth - targetEl.offsetWidth) / 2;
        viewport.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: smooth ? 'smooth' : 'auto'
        });

        if (pulse) {
            targetEl.classList.remove('study-node--target-pulse');
            void targetEl.offsetWidth;
            targetEl.classList.add('study-node--target-pulse');
            setTimeout(() => {
                targetEl.classList.remove('study-node--target-pulse');
            }, 1800);
        }
    }

    // Cuộn tới bài học đang học mặc định
    function scrollToCurrent(smooth = true) {
        if (!viewport) return;
        const current = viewport.querySelector('.study-node--current') || viewport.querySelector('.study-node--done');
        if (current) {
            scrollToNode(current, smooth, false);
        }
    }

    // Tự động nhảy đến thẻ thỏa yêu cầu tìm kiếm gần nhất
    function scrollToClosestMatchedNode(matchedList) {
        if (!viewport || !matchedList || matchedList.length === 0) return;

        // Ưu tiên 1: Thẻ đang học (current) nếu nó nằm trong danh sách khớp
        const currentMatched = matchedList.find(n => n.state === 'current');
        if (currentMatched) {
            scrollToNode(currentMatched.element, true, true);
            return;
        }

        // Ưu tiên 2: Thẻ khớp gần nhất với tâm nhìn hiện tại của viewport
        const currentCenter = viewport.scrollLeft + viewport.clientWidth / 2;
        let closest = matchedList[0];
        let minDiff = Infinity;

        matchedList.forEach(n => {
            const nodeCenter = n.element.offsetLeft + n.element.offsetWidth / 2;
            const diff = Math.abs(nodeCenter - currentCenter);
            if (diff < minDiff) {
                minDiff = diff;
                closest = n;
            }
        });

        if (closest) {
            scrollToNode(closest.element, true, true);
        }
    }

    // Khởi tạo đồ thị sau khi layout sẵn sàng
    drawConnectors();
    window.addEventListener('resize', drawConnectors);
    setTimeout(drawConnectors, 250);
    setTimeout(() => scrollToCurrent(false), 300);

    // ==========================================
    // 2. ĐIỀU KHIỂN CUỘN BÀN CỜ (BUTTONS & DRAG-TO-SCROLL)
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
                if (hasDragged) return;
                if (e.target.closest('a, button')) return;

                const isLocked = node.classList.contains('study-node--locked');
                const lessonId = node.dataset.nodeId;
                if (!isLocked && lessonId) {
                    window.location.href = `/Lesson/${encodeURIComponent(lessonId)}`;
                }
            });
        });
    }

    const categoryContainer = document.getElementById('study-lib-categories');
    const libraryState = document.getElementById('study-library-state');
    const retryButton = document.getElementById('study-library-retry');
    const libraryList = document.getElementById('study-library-list');
    const topicPanels = document.getElementById('study-topic-panels');
    const emptyState = document.querySelector('[data-library-empty]');
    let loadingLessons = false;

    const categoryInfo = {
        vocabulary: { id: 'vocab', key: 'ui.vocabulary', label: 'Từ vựng', icon: 'Aa' },
        grammar: { id: 'grammar', key: 'ui.grammar', label: 'Ngữ pháp', icon: 'G' },
        speaking: { id: 'speaking', key: 'study.cat_speaking', label: 'Giao tiếp', icon: 'Hi' },
        listening: { id: 'listening', key: 'ui.listening', label: 'Nghe hiểu', icon: '♪' }
    };

    function setLibraryState(state, message) {
        if (!libraryState || !categoryContainer) return;
        libraryState.hidden = !message;
        libraryState.textContent = message || '';
        libraryState.dataset.state = state;
        libraryState.setAttribute('role', state === 'error' ? 'alert' : 'status');
        categoryContainer.setAttribute('aria-busy', String(state === 'loading'));
        if (retryButton) retryButton.hidden = state !== 'error';
        if (libraryList && state !== 'ready') libraryList.hidden = true;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function topicSlug(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'topic';
    }

    function renderLibrary(lessons) {
        if (!libraryList || !topicPanels) return;
        libraryList.replaceChildren();
        topicPanels.replaceChildren();

        const categories = new Map();
        for (const lesson of lessons) {
            const categoryKey = String(lesson.category || 'other').toLowerCase();
            const topicName = lesson.topic || lesson.name || 'Other';
            if (!categories.has(categoryKey)) categories.set(categoryKey, new Map());
            const topics = categories.get(categoryKey);
            if (!topics.has(topicName)) topics.set(topicName, []);
            topics.get(topicName).push(lesson);
        }

        let topicIndex = 0;
        for (const [categoryKey, topics] of categories) {
            const info = categoryInfo[categoryKey] || {
                id: topicSlug(categoryKey), key: '', label: categoryKey, icon: '•'
            };
            const category = createElement('section', 'study-cat');
            const categoryToggle = createElement('button', 'study-cat__toggle');
            categoryToggle.type = 'button';
            categoryToggle.setAttribute('aria-expanded', 'false');
            const categoryListId = `study-cat-${info.id}`;
            categoryToggle.setAttribute('aria-controls', categoryListId);

            const icon = createElement('span', `study-cat__icon study-cat__icon--${info.id}`, info.icon);
            icon.setAttribute('aria-hidden', 'true');
            const label = createElement('span', '', info.label);
            if (info.key) label.dataset.i18n = info.key;
            const count = Array.from(topics.values()).reduce((total, items) => total + items.length, 0);
            const meta = createElement('span', 'study-cat__meta', String(count));
            const unit = createElement('span', '', window.AppI18n?.t('study.lessons_unit', 'bài') || 'bài');
            unit.dataset.i18n = 'study.lessons_unit';
            meta.append(' ', unit);
            categoryToggle.append(icon, label, meta);

            const categoryList = createElement('div', 'study-cat__list');
            categoryList.id = categoryListId;
            categoryList.hidden = true;

            for (const [topicName, topicLessons] of topics) {
                const topicId = `study-topic-${topicSlug(categoryKey)}-${topicSlug(topicName)}-${topicIndex++}`;
                const topicButton = createElement('button');
                topicButton.type = 'button';
                topicButton.dataset.topic = topicId;
                topicButton.dataset.topicTitle = topicName;
                topicButton.dataset.category = info.label;
                topicButton.dataset.group = topicName;
                topicButton.dataset.levels = [...new Set(topicLessons.map(item => item.level).filter(Boolean))].join(',');
                topicButton.dataset.lessons = topicLessons.map(item => item.name).join(' | ');
                topicButton.dataset.count = String(topicLessons.length);
                topicButton.setAttribute('aria-controls', 'study-topic');
                const topicTitle = createElement('span', '', topicName);
                const topicCount = createElement('small', '', String(topicLessons.length));
                const topicUnit = createElement('span', '', window.AppI18n?.t('study.lessons_unit', 'bài') || 'bài');
                topicUnit.dataset.i18n = 'study.lessons_unit';
                topicCount.append(' ', topicUnit);
                topicButton.append(topicTitle, topicCount);
                categoryList.appendChild(topicButton);

                const panel = createElement('div', 'study-topic__panel');
                panel.dataset.topicPanel = topicId;
                panel.hidden = topicPanels.childElementCount > 0;
                const panelHead = createElement('div', 'study-topic__head');
                const panelTitleBlock = createElement('div');
                const panelCategory = createElement('span', 'tag', info.label);
                if (info.key) panelCategory.dataset.i18n = info.key;
                panelTitleBlock.append(panelCategory, createElement('h2', '', topicName));
                const description = topicLessons.find(item => item.description)?.description;
                if (description) panelTitleBlock.appendChild(createElement('p', '', description));
                panelHead.appendChild(panelTitleBlock);

                const lessonList = createElement('ol', 'study-lessons');
                topicLessons.forEach((lesson, index) => {
                    const row = createElement('li', 'study-lesson', undefined);
                    row.dataset.lessonId = lesson.lessonId;
                    row.appendChild(createElement('span', 'study-lesson__no', String(index + 1)));
                    const detail = createElement('span');
                    detail.appendChild(createElement('b', '', lesson.name));
                    if (lesson.level) detail.appendChild(createElement('small', '', lesson.level));
                    const link = createElement('a', 'btn btn--sm btn--ink', window.AppI18n?.t('study.btn_start', 'Bắt đầu →') || 'Bắt đầu →');
                    link.href = `/Lesson/${encodeURIComponent(lesson.lessonId)}`;
                    link.dataset.i18n = 'study.btn_start';
                    row.append(detail, link);
                    lessonList.appendChild(row);
                });
                panel.append(panelHead, lessonList);
                topicPanels.appendChild(panel);
            }

            category.append(categoryToggle, categoryList);
            libraryList.appendChild(category);
        }

        const isEmpty = lessons.length === 0;
        const emptyMessage = window.AppI18n?.t('study.no_lessons', 'Chưa có bài học nào.') || 'Chưa có bài học nào.';
        if (emptyState) {
            emptyState.hidden = !isEmpty;
            if (isEmpty) emptyState.textContent = emptyMessage;
        }
        libraryList.hidden = lessons.length === 0;
        topicPanels.hidden = lessons.length === 0;
        window.AppI18n?.translate(libraryList);
        window.AppI18n?.translate(topicPanels);
        return { isEmpty, emptyMessage };
    }

    async function loadLibrary() {
        if (loadingLessons) return;
        loadingLessons = true;
        setLibraryState('loading', window.AppI18n?.t('study.loading_lessons', 'Đang tải danh sách bài học...') || 'Đang tải danh sách bài học...');
        if (topicPanels) {
            topicPanels.replaceChildren();
            topicPanels.hidden = true;
        }
        if (emptyState) emptyState.hidden = true;
        try {
            const lessons = await window.AppApi.get('/api/lessons');
            if (!Array.isArray(lessons)) throw new TypeError('Expected the lessons API to return an array.');
            const result = renderLibrary(lessons);
            setLibraryState(result.isEmpty ? 'empty' : 'ready', result.isEmpty ? result.emptyMessage : '');
            initializeLibraryInteractions();
        } catch (error) {
            if (topicPanels) topicPanels.hidden = true;
            const message = error?.status === 403
                ? (window.AppI18n?.t('study.profile_inactive', 'Tài khoản không thể tải danh sách bài học.') || 'Tài khoản không thể tải danh sách bài học.')
                : error?.status === 0
                    ? (window.AppI18n?.t('study.network_error', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.') || 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.')
                    : (window.AppI18n?.t('study.load_error', 'Không tải được danh sách bài học. Vui lòng thử lại.') || 'Không tải được danh sách bài học. Vui lòng thử lại.');
            setLibraryState('error', message);
        } finally {
            loadingLessons = false;
        }
    }

    if (retryButton) retryButton.addEventListener('click', loadLibrary);

    // ==========================================
    // 3. THƯ VIỆN: Mở/đóng nhóm chủ đề & Nút Expand/Collapse All
    // ==========================================
    function initializeLibraryInteractions() {
    const toggleAllBtn = document.getElementById('study-lib-toggle-all');
    const catToggles = Array.from(document.querySelectorAll('.study-cat__toggle'));

    function updateToggleAllButton() {
        if (!toggleAllBtn || catToggles.length === 0) return;
        const openCount = catToggles.filter(t => t.getAttribute('aria-expanded') === 'true').length;
        const iconSpan = toggleAllBtn.querySelector('.toggle-all__icon');
        const textSpan = toggleAllBtn.querySelector('.toggle-all__text');

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

    updateToggleAllButton();

    // ==========================================
    // 4. CHỌN CHỦ ĐỀ & KÍCH HOẠT PANEL BÀI HỌC
    // ==========================================
    const topicButtons = document.querySelectorAll('.study-cat__list [data-topic]');
    function activateTopic(topicId) {
        if (!topicId) return;

        document.querySelectorAll('[data-topic]').forEach(b => {
            if (b.dataset.topic === topicId) {
                b.setAttribute('aria-current', 'true');
            } else {
                b.removeAttribute('aria-current');
            }
        });

        document.querySelectorAll('[data-topic-panel]').forEach(panel => {
            const active = panel.dataset.topicPanel === topicId;
            panel.hidden = !active;
            if (active) {
                panel.classList.remove('is-swapping');
                void panel.offsetWidth;
                panel.classList.add('is-swapping');
            }
        });

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
    // 5. TÌM KIẾM THÔNG MINH (THEO LEVEL A1/A2, CHỦ ĐỀ CON, & LÀM MỜ BOARD)
    // ==========================================
    const searchInput = document.getElementById('study-search-input');
    const searchClearBtn = document.getElementById('study-search-clear');
    const searchSubmitBtn = document.getElementById('study-search-btn');
    const searchResults = document.getElementById('study-search-results');
    const searchMeta = document.getElementById('study-search-meta');
    const searchList = document.getElementById('study-search-list');
    const libCategories = document.getElementById('study-lib-categories');

    // Thu thập danh sách bài lớn từ DOM Thư viện
    const topicsData = Array.from(topicButtons).map(btn => {
        const id = btn.dataset.topic || '';
        const title = btn.dataset.topicTitle || btn.querySelector('span')?.textContent?.trim() || '';
        const cat = btn.dataset.category || '';
        const group = btn.dataset.group || '';
        const count = btn.dataset.count || btn.querySelector('small')?.textContent?.replace(/[^0-9]/g, '') || '';
        const levelsRaw = btn.dataset.levels || '';
        const levels = levelsRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const lessonsRaw = btn.dataset.lessons || '';

        const aliasStr = getAliases(title + ' ' + cat + ' ' + group);

        return {
            id,
            title,
            cat,
            group,
            count,
            levels,
            normTitle: normalizeStr(title),
            normCat: normalizeStr(cat),
            normGroup: normalizeStr(group),
            searchBlob: [
                normalizeStr(title),
                normalizeStr(cat),
                normalizeStr(group),
                normalizeStr(lessonsRaw),
                levels.map(l => l.toLowerCase()).join(' '),
                aliasStr,
                normalizeStr(id)
            ].join(' '),
            element: btn
        };
    });

    // So khớp tìm kiếm đa tiêu chí: Trình độ (A1, A2...) hoặc Từ khóa (Adjectives, Greetings...)
    function isItemMatch(rawQuery, normQuery, itemLevels, searchBlob) {
        if (!normQuery) return false;

        // 1. Kiểm tra tìm theo trình độ đề xuất (A1, A2, B1, B2, C1, C2)
        const levelMatch = rawQuery.match(/^(?:level\s*|trình\s*độ\s*)?([a-c][1-2])$/i);
        if (levelMatch) {
            const targetLevel = levelMatch[1].toUpperCase();
            if (Array.isArray(itemLevels) && itemLevels.includes(targetLevel)) return true;
            if (typeof itemLevels === 'string' && itemLevels.toUpperCase() === targetLevel) return true;
        }

        // 2. So khớp từ khóa chuỗi trong searchBlob
        const tokens = normQuery.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return false;
        return tokens.every(token => searchBlob.includes(token));
    }

    // Áp dụng hiệu ứng làm mờ / làm nổi bật trên Board (KHÔNG đổi trạng thái done/current/locked)
    function applyBoardFilter(rawQuery, normQuery) {
        if (!canvas) return;

        if (!normQuery) {
            // Xóa bộ lọc: khôi phục tất cả thẻ trên Board về trạng thái ban đầu
            boardNodes.forEach(n => {
                n.element.classList.remove('study-node--dimmed');
                n.element.classList.remove('study-node--matched');
                n.element.classList.remove('study-node--target-pulse');
            });
            if (svg) {
                svg.querySelectorAll('.study-connector').forEach(c => c.classList.remove('is-dimmed'));
            }
            return;
        }

        const matchedNodes = [];

        boardNodes.forEach(n => {
            const isMatched = isItemMatch(rawQuery, normQuery, n.level, n.searchBlob);
            if (isMatched) {
                n.element.classList.remove('study-node--dimmed');
                n.element.classList.add('study-node--matched');
                matchedNodes.push(n);
            } else {
                n.element.classList.add('study-node--dimmed');
                n.element.classList.remove('study-node--matched');
                n.element.classList.remove('study-node--target-pulse');
            }
        });

        // Làm mờ các đường nối khi cả 2 node nối đều không thỏa tìm kiếm
        if (svg) {
            const dimmedMap = new Map();
            boardNodes.forEach(n => dimmedMap.set(n.id, n.element.classList.contains('study-node--dimmed')));
            svg.querySelectorAll('.study-connector').forEach(c => {
                const sId = c.dataset.sourceId;
                const tId = c.dataset.targetId;
                if (sId && tId && dimmedMap.get(sId) && dimmedMap.get(tId)) {
                    c.classList.add('is-dimmed');
                } else {
                    c.classList.remove('is-dimmed');
                }
            });
        }

        // Tự động nhảy đến thẻ thỏa yêu cầu gần nhất trên Board
        if (matchedNodes.length > 0) {
            scrollToClosestMatchedNode(matchedNodes);
        }
    }

    function executeSearch(query) {
        const rawQuery = (query || '').trim();
        const normQuery = normalizeStr(rawQuery);

        if (!normQuery) {
            clearSearch();
            return;
        }

        if (searchClearBtn) searchClearBtn.hidden = false;

        // 1. Áp dụng hiệu ứng làm mờ trên Bàn cờ lộ trình & Tự động nhảy đến thẻ gần nhất
        applyBoardFilter(rawQuery, normQuery);

        // 2. Ẩn danh mục phân cấp thể loại và nhóm nội dung trong Thư viện
        if (libCategories) libCategories.hidden = true;
        if (toggleAllBtn) toggleAllBtn.style.display = 'none';

        // 3. Hiện vùng kết quả tìm kiếm phẳng trong Thư viện
        if (searchResults) searchResults.hidden = false;

        // Lọc bài lớn trong thư viện thỏa mãn yêu cầu
        const matches = topicsData.filter(item => {
            return isItemMatch(rawQuery, normQuery, item.levels, item.searchBlob);
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
                const emptyDesc = window.AppI18n?.t('study.search_empty_desc', 'Thử tìm từ khóa khác như "A1", "A2", "adjectives", "greetings", "numbers", "coffee"...');
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
                const levelsHtml = item.levels && item.levels.length > 0
                    ? item.levels.map(lvl => `<span class="study-search-item__level">${escapeHtml(lvl)}</span>`).join('')
                    : '';
                const groupHtml = item.group
                    ? `<span class="study-search-item__tag">${escapeHtml(item.group)}</span>`
                    : '';

                btn.innerHTML = `
                    <div class="study-search-item__info">
                        <span class="study-search-item__title">${escapeHtml(item.title)}</span>
                        <div class="study-search-item__meta-row">
                            ${levelsHtml}
                            ${groupHtml}
                            ${item.cat ? `<span class="study-search-item__cat">${escapeHtml(item.cat)}</span>` : ''}
                        </div>
                    </div>
                    <span class="study-search-item__count">${escapeHtml(item.count)} <span data-i18n="study.lessons_unit">${escapeHtml(unitText)}</span></span>
                `;

                btn.addEventListener('click', () => {
                    activateTopic(item.id);

                    // Nếu có node tương ứng trên board, cuộn tới node đó
                    const matchedNode = boardNodes.find(n => n.id.includes(item.id) || item.id.includes(n.id) || normalizeStr(n.normName).includes(item.normTitle));
                    if (matchedNode) {
                        scrollToNode(matchedNode.element, true, true);
                    }
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

        // Khôi phục tất cả node trên Board về độ sáng và trạng thái ban đầu
        applyBoardFilter('', '');
    }

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
            }, 180);
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
    }

    loadLibrary();
});
