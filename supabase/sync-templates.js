#!/usr/bin/env node
/**
 * Đồng bộ toàn bộ template bài học, lộ trình và quiz trong Storage/LessonTemplate
 * (và Storage/QuizTemplate nếu có) lên Supabase DB thông qua REST API (/rest/v1/*).
 *
 * Đặc tính:
 * - Tự chạy không cần cài thêm npm package (dùng Node built-in fs/path/crypto/fetch).
 * - Chống trùng lặp (idempotent) khi chạy nhiều lần:
 *     + Dùng deterministic UUID (SHA-256) cho quizzes và questions theo khóa tự nhiên.
 *     + Dùng UPSERT (on_conflict + Prefer: resolution=merge-duplicates).
 *     + Khử trùng ngay trong batch trước khi gửi để tránh lỗi Postgres 21000.
 *     + Dọn các liên kết thừa (quiz_questions / lesson_prerequisites) nếu JSON bỏ bớt.
 * - Tự đọc cấu hình Supabase:Url & Supabase:SecretKey theo thứ tự:
 *     1) Biến môi trường (Supabase__Url / SUPABASE_URL, Supabase__SecretKey / SUPABASE_SECRET_KEY)
 *     2) File .env ở thư mục gốc repo
 *     3) appsettings.Development.json / appsettings.json
 *     4) dotnet user-secrets (đọc UserSecretsId từ SE347.csproj)
 *
 * Cách chạy:
 *   node supabase/sync-templates.js --dry-run   # Kiểm tra dữ liệu & xem số bản ghi sẽ đẩy (không gọi API)
 *   node supabase/sync-templates.js             # Đẩy / cập nhật dữ liệu lên Supabase DB
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LESSON_TEMPLATE_DIR = path.join(ROOT_DIR, 'Storage', 'LessonTemplate');
const QUIZ_TEMPLATE_DIR = path.join(ROOT_DIR, 'Storage', 'QuizTemplate');
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONTENT_ID_REGEX = /^[a-zA-Z0-9]+([_-][a-zA-Z0-9]+)*$/;
const CATEGORIES = new Set(['vocabulary', 'grammar', 'listening', 'speaking']);
const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const QUESTION_TYPES = new Set(['fill-in-the-blank', 'multiple-choice', 'single-choice', 'true-false']);
const BATCH_SIZE = 100;

/**
 * Tạo UUID cố định (RFC 4122 v5 layout dựa trên SHA-256) từ chuỗi khóa tự nhiên.
 * Chạy lại bao nhiêu lần cùng một key cũng cho ra đúng một UUID -> chống trùng tuyệt đối.
 */
function deterministicUuid(key) {
    const hash = crypto.createHash('sha256').update(key, 'utf8').digest();
    const bytes = Buffer.from(hash.subarray(0, 16));
    bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
}

function resolveSafeChild(baseDir, relativePath) {
    if (!relativePath || typeof relativePath !== 'string') return null;
    const resolved = path.resolve(baseDir, relativePath);
    const baseWithSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
    if (!resolved.startsWith(baseWithSep)) {
        throw new Error(`Đường dẫn vượt ra ngoài thư mục bài học: "${relativePath}" trong ${baseDir}`);
    }
    return resolved;
}

function parseDotEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const out = {};
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

function readUserSecretsConfig() {
    const csprojPath = path.join(ROOT_DIR, 'SE347.csproj');
    if (!fs.existsSync(csprojPath)) return {};
    const csproj = fs.readFileSync(csprojPath, 'utf8');
    const match = csproj.match(/<UserSecretsId>\s*([^<\s]+)\s*<\/UserSecretsId>/i);
    if (!match) return {};

    const secretId = match[1];
    const candidates = process.platform === 'win32'
        ? [path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'UserSecrets', secretId, 'secrets.json')]
        : [path.join(os.homedir(), '.microsoft', 'usersecrets', secretId, 'secrets.json')];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            try {
                return readJson(candidate);
            } catch {
                return {};
            }
        }
    }
    return {};
}

function readNestedConfig(obj, colonKey) {
    if (!obj || typeof obj !== 'object') return undefined;
    if (typeof obj[colonKey] === 'string' && obj[colonKey].trim()) {
        return obj[colonKey].trim();
    }
    const parts = colonKey.split(':');
    let cur = obj;
    for (const part of parts) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = cur[part];
    }
    return typeof cur === 'string' && cur.trim() ? cur.trim() : undefined;
}

function loadSupabaseCredentials() {
    const dotEnv = parseDotEnv(path.join(ROOT_DIR, '.env'));
    const appSettings = fs.existsSync(path.join(ROOT_DIR, 'appsettings.json'))
        ? readJson(path.join(ROOT_DIR, 'appsettings.json'))
        : {};
    const devSettings = fs.existsSync(path.join(ROOT_DIR, 'appsettings.Development.json'))
        ? readJson(path.join(ROOT_DIR, 'appsettings.Development.json'))
        : {};
    const userSecrets = readUserSecretsConfig();

    const pick = (envKeys, colonKey) => {
        for (const k of envKeys) {
            if (process.env[k] && process.env[k].trim()) return process.env[k].trim();
        }
        for (const k of envKeys) {
            if (dotEnv[k] && dotEnv[k].trim()) return dotEnv[k].trim();
        }
        return (
            readNestedConfig(userSecrets, colonKey)
            || readNestedConfig(devSettings, colonKey)
            || readNestedConfig(appSettings, colonKey)
        );
    };

    const url = pick(['Supabase__Url', 'SUPABASE_URL'], 'Supabase:Url')?.replace(/\/+$/, '');
    const secretKey = pick(['Supabase__SecretKey', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], 'Supabase:SecretKey');

    return { url, secretKey };
}

function normalizeQuizQuestion(q, contextLabel) {
    if (!q || !q.id || !QUESTION_TYPES.has(q.type)) {
        throw new Error(`Câu hỏi không hợp lệ tại ${contextLabel}: ${JSON.stringify(q)}`);
    }
    if (!Array.isArray(q.answer) || q.answer.length === 0) {
        throw new Error(`Thiếu đáp án tại ${contextLabel} câu #${q.id}`);
    }

    let options = null;
    if (q.type === 'single-choice' || q.type === 'multiple-choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
            throw new Error(`Câu ${q.type} cần >= 2 lựa chọn tại ${contextLabel} câu #${q.id}`);
        }
        options = q.options;
    } else if (q.type === 'true-false') {
        if (q.answer.length !== 1 || !['true', 'false'].includes(q.answer[0])) {
            throw new Error(`Câu true-false chỉ nhận answer ["true"] hoặc ["false"] tại ${contextLabel} câu #${q.id}`);
        }
        options = null; // Khớp constraint ck_questions_options_by_type
    } else if (Array.isArray(q.options)) {
        options = q.options;
    }

    if (q.type === 'single-choice' && q.answer.length !== 1) {
        throw new Error(`Câu single-choice chỉ nhận 1 đáp án tại ${contextLabel} câu #${q.id}`);
    }

    return {
        questionKey: String(q.id),
        question_type: q.type,
        prompt: String(q.question),
        options,
        correct_answers: q.answer.map(String),
        explanation: String(q.explanation || ''),
        translation: String(q.translation || ''),
        audio_path: q.audio || null,
        image_path: q.image || null,
        text_path: q.text || null
    };
}

/**
 * Đọc toàn bộ template từ Storage/LessonTemplate (và Storage/QuizTemplate nếu tồn tại),
 * trả về các mảng bản ghi đã khử trùng theo khóa chính/khóa xung đột.
 */
function collectTemplates() {
    if (!fs.existsSync(LESSON_TEMPLATE_DIR)) {
        throw new Error(`Không tìm thấy thư mục ${LESSON_TEMPLATE_DIR}`);
    }

    const lessonsMap = new Map();
    const contentsMap = new Map();
    const pathsMap = new Map();
    const branchesMap = new Map();
    const pathItemsMap = new Map();
    const prereqsMap = new Map();
    const quizzesMap = new Map();
    const questionsMap = new Map();
    const quizQuestionsMap = new Map();

    const addLessonFolder = (folderPath, lessonId) => {
        if (!SLUG_REGEX.test(lessonId)) {
            throw new Error(`LessonId không đúng chuẩn kebab-case: "${lessonId}"`);
        }
        if (lessonsMap.has(lessonId)) {
            throw new Error(`Trùng LessonId "${lessonId}" tại ${folderPath}`);
        }

        const configPath = path.join(folderPath, 'config.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Thiếu config.json ở ${folderPath}`);
        }
        const config = readJson(configPath);

        if (!CATEGORIES.has(config.category)) {
            throw new Error(`Category không hợp lệ "${config.category}" trong ${configPath}`);
        }
        if (!CEFR_LEVELS.has(config.level)) {
            throw new Error(`CEFR level không hợp lệ "${config.level}" trong ${configPath}`);
        }

        lessonsMap.set(lessonId, {
            id: lessonId,
            name: String(config.name),
            description: String(config.description),
            category: config.category,
            topic: String(config.topic),
            cefr_level: config.level,
            sort_order: Number(config.order),
            estimated_minutes: Number(config['estimated-minutes']),
            image_path: config.image || null,
            content_settings: config['content-settings'] || {},
            quiz_settings: config['quiz-settings'] || {},
            is_published: true,
            version: 1
        });

        const contentFile = resolveSafeChild(folderPath, config.content || './content.json');
        if (!contentFile || !fs.existsSync(contentFile)) {
            throw new Error(`Thiếu file content của bài "${lessonId}": ${config.content}`);
        }
        const contentItems = readJson(contentFile);
        if (!Array.isArray(contentItems) || contentItems.length === 0) {
            throw new Error(`Content rỗng ở bài "${lessonId}"`);
        }

        contentItems.forEach((item, index) => {
            const contentId = String(item.id);
            if (!CONTENT_ID_REGEX.test(contentId)) {
                throw new Error(`Content id "${contentId}" không hợp lệ ở bài "${lessonId}"`);
            }
            contentsMap.set(`${lessonId}::${contentId}`, {
                lesson_id: lessonId,
                id: contentId,
                sort_order: index + 1,
                content: String(item.content),
                pronunciation_bre: item['pronunciation-bre'] || null,
                pronunciation_name: item['pronunciation-name'] || null,
                definition_en: String(item['definition-en']),
                definition_vi: String(item['definition-vi']),
                oxford_link: item['oxford-link'] || null,
                external_sources: Array.isArray(item['external-source']) ? item['external-source'] : [],
                image_path: item.image || null,
                audio_path: item.audio || null,
                examples: Array.isArray(item.examples) ? item.examples : [],
                synonyms: Array.isArray(item.synonyms) ? item.synonyms : [],
                antonyms: Array.isArray(item.antonyms) ? item.antonyms : [],
                is_active: true
            });
        });

        if (config.quiz) {
            const quizFile = resolveSafeChild(folderPath, config.quiz);
            if (!quizFile || !fs.existsSync(quizFile)) {
                throw new Error(`Thiếu file quiz của bài "${lessonId}": ${config.quiz}`);
            }
            const quizItems = readJson(quizFile);
            if (!Array.isArray(quizItems)) {
                throw new Error(`Quiz phải là mảng ở bài "${lessonId}"`);
            }

            const quizId = deterministicUuid(`se347:quiz:lesson:${lessonId}`);
            const quizSettings = config['quiz-settings'] || {};

            quizzesMap.set(quizId, {
                id: quizId,
                slug: `lesson-${lessonId}`,
                quiz_scope: 'lesson',
                lesson_id: lessonId,
                creator_id: null,
                title: String(config.name),
                description: String(config.description || ''),
                category: config.category,
                topic: String(config.topic),
                cefr_level: config.level,
                visibility: 'public',
                time_limit_seconds: null,
                pass_score: 60,
                xp_reward: 0,
                shuffle_questions: Boolean(quizSettings['shuffle-questions'] || quizSettings['randomize-questions']),
                shuffle_answers: quizSettings['shuffle-answers'] !== undefined ? Boolean(quizSettings['shuffle-answers']) : true,
                mix_with_lesson: Boolean(quizSettings['mix-with-lesson']),
                show_results_immediately: true,
                allow_retake: true,
                show_explanations: true,
                is_published: true,
                version: 1
            });

            quizItems.forEach((rawQuestion, idx) => {
                const normalized = normalizeQuizQuestion(rawQuestion, `lesson:${lessonId}`);
                const questionId = deterministicUuid(`se347:question:lesson:${lessonId}:${normalized.questionKey}`);

                questionsMap.set(questionId, {
                    id: questionId,
                    creator_id: null,
                    question_type: normalized.question_type,
                    prompt: normalized.prompt,
                    options: normalized.options,
                    correct_answers: normalized.correct_answers,
                    explanation: normalized.explanation,
                    translation: normalized.translation,
                    audio_path: normalized.audio_path,
                    image_path: normalized.image_path,
                    text_path: normalized.text_path,
                    cefr_level: config.level,
                    topic: String(config.topic),
                    is_public: false,
                    version: 1
                });

                quizQuestionsMap.set(`${quizId}::${questionId}`, {
                    quiz_id: quizId,
                    question_id: questionId,
                    question_no: idx + 1,
                    question_key: normalized.questionKey,
                    points: 1
                });
            });
        }
    };

    // 1. Duyệt Storage/LessonTemplate
    const topEntries = fs.readdirSync(LESSON_TEMPLATE_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== 'schemas')
        .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of topEntries) {
        const entryDir = path.join(LESSON_TEMPLATE_DIR, entry.name);
        const learningPathFile = path.join(entryDir, 'LearningPath.json');

        if (!fs.existsSync(learningPathFile)) {
            addLessonFolder(entryDir, entry.name);
            continue;
        }

        // Thư mục lộ trình
        const subFolders = fs.readdirSync(entryDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const sub of subFolders) {
            addLessonFolder(path.join(entryDir, sub.name), sub.name);
        }

        const lp = readJson(learningPathFile);
        const pathId = String(lp.id);
        pathsMap.set(pathId, {
            id: pathId,
            title: String(lp.title),
            description: String(lp.description),
            version: Number(lp.version || 1),
            is_published: true
        });

        const addPathLesson = (item, branchId) => {
            const lessonId = String(item.lessonId);
            if (!lessonsMap.has(lessonId)) {
                throw new Error(`LearningPath "${pathId}" trỏ tới lessonId không tồn tại: "${lessonId}"`);
            }
            pathItemsMap.set(`${pathId}::${item.itemId}`, {
                learning_path_id: pathId,
                item_id: String(item.itemId),
                lesson_id: lessonId,
                branch_id: branchId,
                sort_order: Number(item.order)
            });

            if (Array.isArray(item.prerequisites)) {
                for (const preId of item.prerequisites) {
                    if (!lessonsMap.has(preId)) {
                        throw new Error(`Prerequisite không tồn tại "${preId}" ở lesson "${lessonId}"`);
                    }
                    prereqsMap.set(`${pathId}::${lessonId}::${preId}`, {
                        learning_path_id: pathId,
                        lesson_id: lessonId,
                        prerequisite_lesson_id: String(preId)
                    });
                }
            }
        };

        for (const item of lp.lessons || []) {
            addPathLesson(item, null);
        }

        (lp.branches || []).forEach((branch, branchIdx) => {
            const branchId = String(branch.id);
            branchesMap.set(`${pathId}::${branchId}`, {
                learning_path_id: pathId,
                branch_id: branchId,
                item_id: String(branch.itemId),
                title: String(branch.title),
                is_required: branch.required !== undefined ? Boolean(branch.required) : true,
                after_lesson_id: branch.afterLessonId ? String(branch.afterLessonId) : null,
                sort_order: branchIdx + 1
            });

            for (const item of branch.lessons || []) {
                addPathLesson(item, branchId);
            }
        });
    }

    // 2. Duyệt Storage/QuizTemplate nếu có (standalone quizzes chuẩn QuizConfig.schema.json)
    if (fs.existsSync(QUIZ_TEMPLATE_DIR)) {
        const quizDirs = fs.readdirSync(QUIZ_TEMPLATE_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const dir of quizDirs) {
            const qDir = path.join(QUIZ_TEMPLATE_DIR, dir.name);
            const cfgPath = path.join(qDir, 'config.json');
            if (!fs.existsSync(cfgPath)) continue;

            const cfg = readJson(cfgPath);
            const slug = String(cfg.id || dir.name);
            const quizId = deterministicUuid(`se347:quiz:standalone:${slug}`);

            quizzesMap.set(quizId, {
                id: quizId,
                slug,
                quiz_scope: 'standalone',
                lesson_id: null,
                creator_id: null,
                title: String(cfg.title),
                description: String(cfg.description || ''),
                category: cfg.category && CATEGORIES.has(cfg.category) ? cfg.category : null,
                topic: cfg.topic || null,
                cefr_level: cfg.level && CEFR_LEVELS.has(cfg.level) ? cfg.level : null,
                visibility: 'public',
                time_limit_seconds: cfg['time-limit-seconds'] ? Number(cfg['time-limit-seconds']) : null,
                pass_score: 60,
                xp_reward: 0,
                shuffle_questions: Boolean(cfg['shuffle-questions']),
                shuffle_answers: Boolean(cfg['shuffle-answers']),
                mix_with_lesson: false,
                show_results_immediately: Boolean(cfg['show-results-immediately']),
                allow_retake: Boolean(cfg['allow-retake']),
                show_explanations: Boolean(cfg['show-explanations']),
                is_published: true,
                version: 1
            });

            const questionsFile = resolveSafeChild(qDir, cfg.questions || './questions.json');
            if (questionsFile && fs.existsSync(questionsFile)) {
                const rawList = readJson(questionsFile);
                if (!Array.isArray(rawList)) {
                    throw new Error(`Questions phải là mảng ở standalone quiz "${slug}"`);
                }
                rawList.forEach((rawQ, idx) => {
                    const normalized = normalizeQuizQuestion(rawQ, `standalone:${slug}`);
                    const questionId = deterministicUuid(`se347:question:standalone:${slug}:${normalized.questionKey}`);
                    questionsMap.set(questionId, {
                        id: questionId,
                        creator_id: null,
                        question_type: normalized.question_type,
                        prompt: normalized.prompt,
                        options: normalized.options,
                        correct_answers: normalized.correct_answers,
                        explanation: normalized.explanation,
                        translation: normalized.translation,
                        audio_path: normalized.audio_path,
                        image_path: normalized.image_path,
                        text_path: normalized.text_path,
                        cefr_level: cfg.level && CEFR_LEVELS.has(cfg.level) ? cfg.level : null,
                        topic: cfg.topic || null,
                        is_public: true,
                        version: 1
                    });
                    quizQuestionsMap.set(`${quizId}::${questionId}`, {
                        quiz_id: quizId,
                        question_id: questionId,
                        question_no: idx + 1,
                        question_key: normalized.questionKey,
                        points: 1
                    });
                });
            }
        }
    }

    return {
        lessons: Array.from(lessonsMap.values()),
        lessonContents: Array.from(contentsMap.values()),
        learningPaths: Array.from(pathsMap.values()),
        learningPathBranches: Array.from(branchesMap.values()),
        learningPathItems: Array.from(pathItemsMap.values()),
        lessonPrerequisites: Array.from(prereqsMap.values()),
        quizzes: Array.from(quizzesMap.values()),
        questions: Array.from(questionsMap.values()),
        quizQuestions: Array.from(quizQuestionsMap.values())
    };
}

function buildAuthHeaders(secretKey, extra = {}) {
    const headers = {
        apikey: secretKey,
        'Content-Type': 'application/json',
        ...extra
    };
    // Key mới sb_secret_* KHÔNG được gửi kèm Authorization: Bearer vì Gateway sẽ parse nhầm JWT.
    // Chỉ key legacy service_role dạng JWT (bắt đầu bằng eyJ) mới gửi kèm Bearer.
    if (secretKey.startsWith('eyJ')) {
        headers.Authorization = `Bearer ${secretKey}`;
    }
    return headers;
}

async function postgrestRequest(url, secretKey, pathWithQuery, { method = 'GET', body, headers = {} } = {}) {
    const response = await fetch(`${url}/rest/v1/${pathWithQuery}`, {
        method,
        headers: buildAuthHeaders(secretKey, headers),
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Supabase REST ${method} ${pathWithQuery} -> HTTP ${response.status}: ${text}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

async function upsertBatch(url, secretKey, table, onConflict, rows) {
    if (rows.length === 0) return;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        await postgrestRequest(url, secretKey, `${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: chunk
        });
    }
}

async function syncQuizQuestions(url, secretKey, quizQuestions) {
    const targetByQuiz = new Map();
    for (const row of quizQuestions) {
        if (!targetByQuiz.has(row.quiz_id)) targetByQuiz.set(row.quiz_id, []);
        targetByQuiz.get(row.quiz_id).push(row);
    }

    for (const [quizId, targetRows] of targetByQuiz.entries()) {
        const existing = await postgrestRequest(
            url,
            secretKey,
            `quiz_questions?select=question_id,question_no,question_key,points&quiz_id=eq.${encodeURIComponent(quizId)}`
        ) || [];

        const existingMap = new Map(existing.map((r) => [r.question_id, r]));
        const targetIds = new Set(targetRows.map((r) => r.question_id));
        const staleIds = existing.map((r) => r.question_id).filter((id) => !targetIds.has(id));

        const hasOrderOrKeyConflict = targetRows.some((t) =>
            existing.some((e) =>
                e.question_id !== t.question_id
                && (e.question_no === t.question_no || e.question_key === t.question_key)
            )
        );

        if (hasOrderOrKeyConflict) {
            // Đổi thứ tự hoặc xóa/thay câu hỏi: xóa liên kết cũ của quiz này trước khi ghi lại để tránh đụng unique (quiz_id, question_no).
            // Không ảnh hưởng bảng questions hay lịch sử user_quiz_attempt_answers.
            await postgrestRequest(
                url,
                secretKey,
                `quiz_questions?quiz_id=eq.${encodeURIComponent(quizId)}`,
                { method: 'DELETE' }
            );
            await upsertBatch(url, secretKey, 'quiz_questions', 'quiz_id,question_id', targetRows);
            continue;
        }

        if (staleIds.length > 0) {
            await postgrestRequest(
                url,
                secretKey,
                `quiz_questions?quiz_id=eq.${encodeURIComponent(quizId)}&question_id=in.(${staleIds.join(',')})`,
                { method: 'DELETE' }
            );
        }

        const changedRows = targetRows.filter((t) => {
            const cur = existingMap.get(t.question_id);
            return !cur
                || cur.question_no !== t.question_no
                || cur.question_key !== t.question_key
                || cur.points !== t.points;
        });

        await upsertBatch(url, secretKey, 'quiz_questions', 'quiz_id,question_id', changedRows);
    }
}

async function pruneStalePrerequisites(url, secretKey, learningPaths, lessonPrerequisites) {
    const validByPath = new Map();
    for (const row of lessonPrerequisites) {
        if (!validByPath.has(row.learning_path_id)) validByPath.set(row.learning_path_id, new Set());
        validByPath.get(row.learning_path_id).add(`${row.lesson_id}::${row.prerequisite_lesson_id}`);
    }

    for (const lp of learningPaths) {
        const existing = await postgrestRequest(
            url,
            secretKey,
            `lesson_prerequisites?select=lesson_id,prerequisite_lesson_id&learning_path_id=eq.${encodeURIComponent(lp.id)}`
        );
        const validSet = validByPath.get(lp.id) || new Set();
        for (const row of existing || []) {
            if (!validSet.has(`${row.lesson_id}::${row.prerequisite_lesson_id}`)) {
                await postgrestRequest(
                    url,
                    secretKey,
                    `lesson_prerequisites?learning_path_id=eq.${encodeURIComponent(lp.id)}&lesson_id=eq.${encodeURIComponent(row.lesson_id)}&prerequisite_lesson_id=eq.${encodeURIComponent(row.prerequisite_lesson_id)}`,
                    { method: 'DELETE' }
                );
            }
        }
    }
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const data = collectTemplates();

    console.log('Đã đọc & kiểm tra template hợp lệ:');
    console.log(`  - lessons:                ${data.lessons.length}`);
    console.log(`  - lesson_contents:        ${data.lessonContents.length}`);
    console.log(`  - learning_paths:         ${data.learningPaths.length}`);
    console.log(`  - learning_path_branches: ${data.learningPathBranches.length}`);
    console.log(`  - learning_path_items:    ${data.learningPathItems.length}`);
    console.log(`  - lesson_prerequisites:   ${data.lessonPrerequisites.length}`);
    console.log(`  - quizzes:                ${data.quizzes.length}`);
    console.log(`  - questions:              ${data.questions.length}`);
    console.log(`  - quiz_questions:         ${data.quizQuestions.length}`);

    if (dryRun) {
        console.log('[DRY-RUN] Dừng trước khi gọi API Supabase.');
        return;
    }

    const { url, secretKey } = loadSupabaseCredentials();
    if (!url || !secretKey) {
        throw new Error(
            'Thiếu Supabase:Url hoặc Supabase:SecretKey. '
            + 'Hãy cấu hình qua biến môi trường (Supabase__Url, Supabase__SecretKey), file .env, hoặc `dotnet user-secrets`.'
        );
    }

    // Đẩy theo đúng thứ tự phụ thuộc khóa ngoại (upsert chống trùng)
    await upsertBatch(url, secretKey, 'lessons', 'id', data.lessons);
    await upsertBatch(url, secretKey, 'lesson_contents', 'lesson_id,id', data.lessonContents);
    await upsertBatch(url, secretKey, 'learning_paths', 'id', data.learningPaths);
    await upsertBatch(url, secretKey, 'learning_path_branches', 'learning_path_id,branch_id', data.learningPathBranches);
    await upsertBatch(url, secretKey, 'learning_path_items', 'learning_path_id,item_id', data.learningPathItems);
    await upsertBatch(url, secretKey, 'lesson_prerequisites', 'learning_path_id,lesson_id,prerequisite_lesson_id', data.lessonPrerequisites);
    await pruneStalePrerequisites(url, secretKey, data.learningPaths, data.lessonPrerequisites);

    await upsertBatch(url, secretKey, 'quizzes', 'id', data.quizzes);
    await upsertBatch(url, secretKey, 'questions', 'id', data.questions);
    await syncQuizQuestions(url, secretKey, data.quizQuestions);

    console.log('Đồng bộ template lên Supabase thành công (idempotent).');
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Đồng bộ thất bại:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { collectTemplates, deterministicUuid };
