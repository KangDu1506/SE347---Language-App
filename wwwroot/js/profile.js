document.addEventListener('DOMContentLoaded', async () => {
    document.body.classList.add('page-ready');

    const page = document.querySelector('.profile-page');
    if (!page) return;

    const localAuthBypassEnabled = document.querySelector('meta[name="local-auth-bypass"]')?.content === 'true';
    const supabaseUrl = (document.querySelector('meta[name="supabase-url"]')?.content || '').trim().replace(/\/+$/, '');
    const t = (key, fallback) => window.AppI18n?.t(key, fallback) || fallback;
    const format = (key, fallback, values) => Object.entries(values).reduce(
        (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
        t(key, fallback)
    );
    const locale = () => (document.documentElement.lang === 'en' ? 'en' : 'vi');
    const numberFmt = value => new Intl.NumberFormat(locale()).format(value ?? 0);

    const avatarEl = page.querySelector('.profile-avatar');
    const roleBadgeEl = page.querySelector('#profile-role-badge');
    const visibilityBadgeEl = page.querySelector('#profile-visibility-badge');
    const levelBadgeEl = page.querySelector('#profile-level-badge');
    const statusBadgeEl = page.querySelector('#profile-status-badge');
    const titleEl = page.querySelector('#profile-title');
    const emailEl = page.querySelector('.profile-email');
    const bioEl = page.querySelector('#profile-bio');
    const metaEl = page.querySelector('#profile-meta');
    const joinedEl = page.querySelector('#profile-joined');
    const lastActiveEl = page.querySelector('#profile-last-active');

    const bannerEl = page.querySelector('#profile-status-banner');
    const bannerTextEl = page.querySelector('#profile-status-text');
    const retryBtnEl = page.querySelector('#profile-retry-btn');

    const statValues = page.querySelectorAll('.profile-stat strong');
    const streakSubEl = page.querySelector('#profile-streak-sub');
    const lessonsSubEl = page.querySelector('#profile-lessons-sub');
    const xpSubEl = page.querySelector('#profile-xp-sub');

    const progressValueEl = page.querySelector('.profile-progress-value');
    const progressTrackEl = page.querySelector('.profile-progress-track');
    const progressBarEl = progressTrackEl?.querySelector('span');
    const progressDescEl = page.querySelector('.profile-panel__description');
    const goalBlockEl = page.querySelector('#profile-goal-block');
    const goalValueEl = page.querySelector('#profile-goal-value');
    const goalTrackEl = page.querySelector('.profile-progress-track--goal');
    const goalBarEl = page.querySelector('#profile-goal-bar');

    const activityListEl = page.querySelector('.profile-activity-list');
    const detailListEl = page.querySelector('#profile-detail-list');
    const achievementsCountEl = page.querySelector('#profile-achievements-count');
    const achievementsListEl = page.querySelector('#profile-achievements-list');
    const editButtonEl = page.querySelector('.profile-edit-button');

    editButtonEl?.addEventListener('click', () => {
        window.AppToast?.info(t('profile.edit_unavailable', 'Tính năng chỉnh sửa hồ sơ đang được hoàn thiện.'));
    });

    let loadedState = null;
    let isLoading = false;

    function renderAvatar(displayName, username, email, avatarPath) {
        if (!avatarEl) return;
        if (window.AppUserBadge) {
            window.AppUserBadge.renderAvatar(avatarEl, {
                displayName,
                username,
                email,
                avatarPath,
                imgClass: 'profile-avatar__img',
                alt: displayName || username || '',
                supabaseUrl
            });
            return;
        }
        avatarEl.textContent = String(displayName || username || email?.split('@')[0] || 'U').trim().slice(0, 2).toUpperCase();
    }

    function parseDateValue(value) {
        if (!value) return null;
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [y, m, d] = value.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDate(value) {
        const date = parseDateValue(value);
        if (!date) return '';
        return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }

    function setFieldValue(name, text) {
        const el = detailListEl?.querySelector(`[data-profile-field="${name}"]`);
        if (el) el.textContent = text;
    }

    function renderProfile() {
        if (!loadedState) return;
        const { profile, authUser, userEmail, overview, lessons, profileError, progressError } = loadedState;
        const email = profile?.email || userEmail || '';
        const meta = authUser?.user_metadata || {};
        const fallbackName = meta.display_name || meta.full_name || meta.fullName || meta.username || (email ? email.split('@')[0] : '');
        const displayName = profile?.displayName || profile?.username || fallbackName || t('profile.default_name', 'Người học');

        renderAvatar(displayName, profile?.username || meta.username, email, profile?.avatarPath);
        if (profile) {
            window.AppUserBadge?.syncProfile(profile, authUser);
        }

        if (titleEl) {
            titleEl.removeAttribute('data-i18n');
            titleEl.textContent = displayName;
        }

        if (roleBadgeEl) {
            roleBadgeEl.removeAttribute('data-i18n');
            roleBadgeEl.textContent = profile?.role === 'admin'
                ? t('profile.role_admin', 'Quản trị viên')
                : t('ui.personal_account', 'Tài khoản cá nhân');
        }

        if (visibilityBadgeEl) {
            if (profile?.profileVisibility) {
                visibilityBadgeEl.hidden = false;
                visibilityBadgeEl.textContent = profile.profileVisibility === 'public'
                    ? t('profile.visibility_public', 'Công khai')
                    : t('profile.visibility_private', 'Riêng tư');
            } else {
                visibilityBadgeEl.hidden = true;
            }
        }

        if (levelBadgeEl) {
            const cefr = profile?.learningProfile?.cefrLevel;
            if (cefr) {
                levelBadgeEl.hidden = false;
                levelBadgeEl.textContent = `${t('profile.level_label', 'Trình độ')}: ${cefr}`;
            } else {
                levelBadgeEl.hidden = true;
            }
        }

        if (statusBadgeEl) {
            if (profile && profile.status && profile.status !== 'active') {
                statusBadgeEl.hidden = false;
                statusBadgeEl.textContent = profile.status === 'suspended'
                    ? t('profile.status_suspended', 'Tạm khóa')
                    : t('profile.status_deactivated', 'Đã vô hiệu hóa');
            } else {
                statusBadgeEl.hidden = true;
            }
        }

        if (emailEl) {
            emailEl.removeAttribute('data-i18n');
            const infoParts = [];
            if (profile?.username) infoParts.push(`@${profile.username}`);
            if (email) infoParts.push(email);
            emailEl.textContent = infoParts.length > 0
                ? infoParts.join(' · ')
                : t('profile.no_contact_info', 'Chưa có thông tin email.');
        }

        if (bioEl) {
            const cleanBio = (profile?.bio || '').trim();
            bioEl.hidden = false;
            bioEl.classList.toggle('is-empty', !cleanBio);
            bioEl.textContent = cleanBio || t('profile.bio_empty', 'Chưa cập nhật giới thiệu.');
        }

        const stats = overview?.stats || (profile ? {
            currentStreak: profile.stat?.currentStreak ?? 0,
            longestStreak: profile.stat?.longestStreak ?? 0,
            lastActivityDate: profile.stat?.lastActivityDate ?? null,
            totalXp: profile.stat?.totalXp ?? 0,
            todayXp: profile.activitySummary?.todayXp ?? 0,
            lessonsCompleted: profile.activitySummary?.lessonsCompleted ?? 0,
            lessonsInProgress: profile.activitySummary?.lessonsInProgress ?? 0
        } : null);

        const joinedDateStr = formatDate(profile?.createdAt || authUser?.created_at);
        const lastActiveStr = formatDate(stats?.lastActivityDate || profile?.stat?.lastActivityDate);
        if (metaEl) {
            if (joinedDateStr || profile) {
                metaEl.hidden = false;
                if (joinedEl) {
                    joinedEl.textContent = joinedDateStr
                        ? format('profile.joined_at', 'Tham gia: {date}', { date: joinedDateStr })
                        : '';
                }
                if (lastActiveEl) {
                    lastActiveEl.textContent = lastActiveStr
                        ? format('profile.last_activity_at', 'Học gần nhất: {date}', { date: lastActiveStr })
                        : t('profile.never_studied', 'Chưa ghi nhận buổi học');
                }
            } else {
                metaEl.hidden = true;
            }
        }

        if (bannerEl && bannerTextEl) {
            let bannerMsg = '';
            if (profileError) {
                bannerMsg = profileError.status === 404
                    ? t('profile.error_not_found', 'Không tìm thấy hồ sơ người dùng trên cơ sở dữ liệu.')
                    : t('profile.error_load', 'Không thể tải đầy đủ dữ liệu hồ sơ từ máy chủ.');
            } else if (profile?.status && profile.status !== 'active') {
                bannerMsg = t('profile.error_inactive', 'Tài khoản hiện đang ở trạng thái tạm ngưng nên một số chức năng học tập bị giới hạn.');
            } else if (progressError) {
                bannerMsg = t('profile.error_progress', 'Không thể tải đầy đủ tiến độ bài học lúc này.');
            }

            bannerEl.hidden = !bannerMsg;
            bannerTextEl.textContent = bannerMsg;
        }

        const catalog = Array.isArray(lessons) ? lessons : [];
        const hasOverviewLessons = Array.isArray(overview?.lessons);
        const progressLessons = hasOverviewLessons ? overview.lessons : [];
        const completedIds = new Set(progressLessons.filter(item => item.status === 'completed').map(item => item.lessonId));
        const inProgressIds = new Set(progressLessons.filter(item => item.status === 'in_progress').map(item => item.lessonId));
        const totalCount = catalog.length;
        const useCatalogMetrics = totalCount > 0 && hasOverviewLessons;
        const catalogCompletedCount = useCatalogMetrics
            ? catalog.filter(item => completedIds.has(item.lessonId)).length
            : (stats?.lessonsCompleted ?? profile?.activitySummary?.lessonsCompleted ?? 0);
        const totalCompletedCount = catalogCompletedCount;
        const inProgressCount = useCatalogMetrics
            ? catalog.filter(item => inProgressIds.has(item.lessonId)).length
            : (stats?.lessonsInProgress ?? profile?.activitySummary?.lessonsInProgress ?? 0);
        const totalWordsLearned = profile?.activitySummary?.totalWordsLearned ?? 0;
        const totalPracticeMinutes = Math.round((profile?.activitySummary?.totalPracticeSeconds ?? 0) / 60);
        const longestStreak = stats?.longestStreak ?? profile?.stat?.longestStreak ?? 0;
        const streakFreezes = profile?.stat?.streakFreezes ?? 0;
        const todayXp = stats?.todayXp ?? profile?.activitySummary?.todayXp ?? 0;

        if (statValues[0]) statValues[0].textContent = numberFmt(stats?.currentStreak ?? 0);
        if (statValues[1]) statValues[1].textContent = numberFmt(totalCompletedCount);
        if (statValues[2]) statValues[2].textContent = numberFmt(stats?.totalXp ?? 0);

        if (streakSubEl) {
            streakSubEl.textContent = format(
                'profile.streak_sub',
                'Kỷ lục: {longest} ngày · Đóng băng: {freezes}/2',
                { longest: numberFmt(longestStreak), freezes: numberFmt(streakFreezes) }
            );
        }
        if (lessonsSubEl) {
            lessonsSubEl.textContent = format(
                'profile.lessons_sub',
                'Đang học: {inProgress} · {words} từ đã học',
                { inProgress: numberFmt(inProgressCount), words: numberFmt(totalWordsLearned) }
            );
        }
        if (xpSubEl) {
            xpSubEl.textContent = format(
                'profile.xp_sub',
                'Hôm nay: +{todayXp} XP · {minutes} phút',
                { todayXp: numberFmt(todayXp), minutes: numberFmt(totalPracticeMinutes) }
            );
        }

        const percent = totalCount > 0
            ? Math.min(100, Math.round((catalogCompletedCount / totalCount) * 100))
            : 0;
        if (progressValueEl) progressValueEl.textContent = `${numberFmt(percent)}%`;
        if (progressTrackEl) progressTrackEl.setAttribute('aria-valuenow', String(percent));
        if (progressBarEl) progressBarEl.style.width = `${percent}%`;

        const dailyGoal = profile?.setting?.dailyGoalXp ?? 20;
        if (progressDescEl) {
            progressDescEl.removeAttribute('data-i18n');
            if (totalCount > 0) {
                progressDescEl.textContent = format(
                    'profile.progress_summary',
                    'Bạn đã hoàn thành {completed}/{total} bài học · Hôm nay đạt {todayXp}/{goalXp} XP mục tiêu.',
                    {
                        completed: numberFmt(catalogCompletedCount),
                        total: numberFmt(totalCount),
                        todayXp: numberFmt(todayXp),
                        goalXp: numberFmt(dailyGoal)
                    }
                );
            } else {
                progressDescEl.textContent = format(
                    'profile.progress_summary_no_catalog',
                    'Đã hoàn thành {completed} bài học · Hôm nay đạt {todayXp}/{goalXp} XP mục tiêu.',
                    {
                        completed: numberFmt(totalCompletedCount),
                        todayXp: numberFmt(todayXp),
                        goalXp: numberFmt(dailyGoal)
                    }
                );
            }
        }

        if (goalBlockEl && goalValueEl && goalTrackEl && goalBarEl) {
            goalBlockEl.hidden = !profile && !overview;
            const goalPercent = dailyGoal > 0 ? Math.min(100, Math.round((todayXp / dailyGoal) * 100)) : 0;
            goalValueEl.textContent = `${numberFmt(todayXp)} / ${numberFmt(dailyGoal)} XP`;
            goalTrackEl.setAttribute('aria-valuenow', String(goalPercent));
            goalBarEl.style.width = `${goalPercent}%`;
        }

        if (activityListEl) {
            const lessonById = new Map(catalog.map(item => [item.lessonId, item]));
            const recent = progressLessons.slice(0, 5);
            if (recent.length === 0) {
                const li = document.createElement('li');
                const span = document.createElement('span');
                const strong = document.createElement('strong');
                strong.textContent = t('profile.no_activity', 'Chưa có hoạt động học tập nào.');
                span.appendChild(strong);
                li.appendChild(span);
                activityListEl.replaceChildren(li);
            } else {
                activityListEl.replaceChildren(...recent.map(item => {
                    const metaItem = lessonById.get(item.lessonId);
                    const category = metaItem?.category || 'vocabulary';
                    const badgeClass = category === 'grammar'
                        ? 'profile-activity-icon--green'
                        : category === 'listening'
                            ? 'profile-activity-icon--orange'
                            : 'profile-activity-icon--blue';
                    const badgeText = category === 'grammar' ? 'G' : category === 'listening' ? '♪' : category === 'speaking' ? 'Hi' : 'V';

                    const li = document.createElement('li');
                    const icon = document.createElement('span');
                    icon.className = `profile-activity-icon ${badgeClass}`;
                    icon.setAttribute('aria-hidden', 'true');
                    icon.textContent = badgeText;

                    const body = document.createElement('span');
                    const titleLink = document.createElement('a');
                    titleLink.href = `/Lesson/${encodeURIComponent(item.lessonId)}`;
                    const strong = document.createElement('strong');
                    strong.textContent = metaItem?.name || item.lessonId;
                    titleLink.appendChild(strong);

                    const small = document.createElement('small');
                    const statusText = item.status === 'completed'
                        ? t('profile.activity_completed', 'Đã hoàn thành')
                        : t('profile.activity_in_progress', 'Đang học');
                    const scoreText = item.bestQuizScore !== null && item.bestQuizScore !== undefined
                        ? ` · ${t('lesson.best_score', 'Cao nhất')}: ${numberFmt(item.bestQuizScore)}%`
                        : '';
                    const dateStr = formatDate(item.lastStudiedAt);
                    small.textContent = `${statusText}${scoreText}${dateStr ? ` · ${dateStr}` : ''}`;
                    body.append(titleLink, small);

                    const xpBadge = document.createElement('b');
                    xpBadge.textContent = `+${numberFmt(item.xpEarned)} XP`;

                    li.append(icon, body, xpBadge);
                    return li;
                }));
            }
        }

        const reasonMap = {
            travel: t('profile.reason_travel', 'Du lịch'),
            work: t('profile.reason_work', 'Công việc'),
            school: t('profile.reason_school', 'Học tập'),
            exam: t('profile.reason_exam', 'Luyện thi'),
            fun: t('profile.reason_fun', 'Giải trí'),
            other: t('profile.reason_other', 'Khác')
        };

        const themeMap = {
            light: t('profile.theme_light', 'Sáng'),
            dark: t('profile.theme_dark', 'Tối'),
            system: t('profile.theme_system', 'Theo hệ thống')
        };

        setFieldValue('username', profile?.username ? `@${profile.username}` : '—');
        setFieldValue('email', email || '—');

        const cefr = profile?.learningProfile?.cefrLevel;
        const placementDate = formatDate(profile?.learningProfile?.placementCompletedAt);
        setFieldValue(
            'cefr',
            cefr
                ? (placementDate ? `${cefr} (${placementDate})` : cefr)
                : t('profile.level_unassigned', 'Chưa xếp trình độ')
        );

        const reason = profile?.learningProfile?.learningReason;
        setFieldValue(
            'reason',
            reason ? (reasonMap[reason] || reason) : t('profile.unselected', 'Chưa chọn')
        );

        setFieldValue(
            'dailyGoal',
            profile?.setting
                ? `${numberFmt(profile.setting.dailyGoalXp)} XP / ${t('profile.day_unit', 'ngày')}`
                : '—'
        );

        if (profile) {
            const uiLang = profile.uiLocale === 'en' ? 'English' : 'Tiếng Việt';
            setFieldValue('localeTimezone', `${uiLang} · ${profile.timezone}`);
            setFieldValue(
                'visibility',
                profile.profileVisibility === 'public'
                    ? t('profile.visibility_public', 'Công khai')
                    : t('profile.visibility_private', 'Riêng tư')
            );
        } else {
            setFieldValue('localeTimezone', '—');
            setFieldValue('visibility', '—');
        }

        if (profile?.setting) {
            const themeLabel = themeMap[profile.setting.theme] || profile.setting.theme;
            const soundLabel = profile.setting.soundEnabled
                ? t('profile.enabled', 'Bật')
                : t('profile.disabled', 'Tắt');
            setFieldValue('themeSound', `${themeLabel} · ${t('profile.sound_label', 'Âm thanh')}: ${soundLabel}`);

            const reminderTime = profile.setting.reminderTime
                ? String(profile.setting.reminderTime).slice(0, 5)
                : '';
            setFieldValue(
                'reminder',
                profile.setting.reminderEnabled
                    ? (reminderTime ? `${t('profile.enabled', 'Bật')} (${reminderTime})` : t('profile.enabled', 'Bật'))
                    : t('profile.disabled', 'Tắt')
            );
        } else {
            setFieldValue('themeSound', '—');
            setFieldValue('reminder', '—');
        }

        const achievements = Array.isArray(profile?.achievements) ? profile.achievements : [];
        if (achievementsCountEl) {
            achievementsCountEl.textContent = format('profile.achievements_count', '{count} huy hiệu', {
                count: numberFmt(achievements.length)
            });
        }
        if (achievementsListEl) {
            if (achievements.length === 0) {
                const li = document.createElement('li');
                li.className = 'profile-achievement-empty';
                li.textContent = t('profile.no_achievements', 'Chưa đạt huy hiệu nào.');
                achievementsListEl.replaceChildren(li);
            } else {
                const isEn = locale() === 'en';
                achievementsListEl.replaceChildren(...achievements.map(item => {
                    const li = document.createElement('li');
                    li.className = 'profile-achievement-item';

                    const body = document.createElement('div');
                    body.className = 'profile-achievement-item__body';
                    const strong = document.createElement('strong');
                    strong.textContent = isEn ? item.nameEn : item.nameVi;
                    const small = document.createElement('small');
                    const awarded = formatDate(item.awardedAt);
                    const desc = isEn ? item.descriptionEn : item.descriptionVi;
                    small.textContent = awarded ? `${desc} · ${awarded}` : desc;
                    body.append(strong, small);

                    const xpBadge = document.createElement('span');
                    xpBadge.className = 'profile-achievement-item__xp';
                    xpBadge.textContent = `+${numberFmt(item.xpReward)} XP`;

                    li.append(body, xpBadge);
                    return li;
                }));
            }
        }
    }

    async function loadProfileData() {
        if (isLoading || !window.AppApi) return;
        const session = (await window.sb?.auth.getSession())?.data?.session;
        if (!localAuthBypassEnabled && !session?.access_token) return;

        isLoading = true;
        if (retryBtnEl) retryBtnEl.disabled = true;

        try {
            const fetchProfileRequests = () => Promise.allSettled([
                window.sb?.auth.getUser() ?? Promise.resolve({ data: { user: null } }),
                window.AppApi.get('/api/users/me'),
                window.AppApi.get('/api/progress'),
                window.AppApi.get('/api/lessons')
            ]);

            let [userRes, profileRes, progressRes, lessonsRes] = await fetchProfileRequests();

            const missingRecord = (profileRes.status === 'rejected' && profileRes.reason?.status === 404)
                || (progressRes.status === 'rejected' && progressRes.reason?.status === 404);
            if (missingRecord) {
                try {
                    await window.AppApi.post('/api/progress/init');
                    [userRes, profileRes, progressRes, lessonsRes] = await fetchProfileRequests();
                } catch {
                    // Giữ lại lỗi gốc nếu tự khởi tạo không thành công
                }
            }

            const authUser = userRes.status === 'fulfilled' ? (userRes.value?.data?.user ?? null) : null;
            const userEmail = authUser?.email || '';
            const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
            const overview = progressRes.status === 'fulfilled' ? progressRes.value : null;
            const lessons = lessonsRes.status === 'fulfilled' ? lessonsRes.value : [];
            const profileError = profileRes.status === 'rejected' ? profileRes.reason : null;
            const progressError = progressRes.status === 'rejected' ? progressRes.reason : null;

            loadedState = {
                profile,
                authUser,
                userEmail,
                overview,
                lessons,
                profileError,
                progressError
            };

            await window.AppI18n?.ready;
            renderProfile();
        } finally {
            isLoading = false;
            if (retryBtnEl) retryBtnEl.disabled = false;
        }
    }

    retryBtnEl?.addEventListener('click', loadProfileData);
    window.addEventListener('app:languagechange', renderProfile);
    window.AppI18n?.ready?.then(() => {
        if (loadedState) renderProfile();
    });

    await loadProfileData();
});
