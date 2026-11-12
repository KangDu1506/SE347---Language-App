// Chuyển kết quả mini-game sang trang Kết quả (SCRUM-60). Hướng dẫn: docs/frontend/RESULT_UI.md
//
// Mini-game, sau khi POST /api/progress/lessons/{id}/quiz thành công:
//     await QuizResult.save(lessonId, response, { durationMs });
//     location.assign(QuizResult.resultUrl(lessonId));
//
// Lưu trong sessionStorage theo tài khoản + bài học: reload trang Kết quả vẫn còn,
// đóng tab thì mất, tài khoản khác cùng tab không đọc được.
(() => {
    const PREFIX = 'se347.quiz-result.v1:';
    const isArrayOfStrings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
    const isCount = value => Number.isInteger(value) && value >= 0;

    async function scope() {
        try {
            const id = (await window.sb?.auth.getSession())?.data?.session?.user?.id;
            return id ? `user:${id}` : 'local';
        } catch {
            return 'local';
        }
    }

    const key = (userScope, lessonId) => PREFIX + encodeURIComponent(userScope) + ':' + encodeURIComponent(lessonId);

    // Đúng shape QuizSubmissionResultDto (DTOs/Progress/LearningResultDtos.cs).
    function isSubmission(value) {
        const attempt = value?.attempt;
        if (!attempt || !isCount(attempt.correctCount) || !isCount(attempt.totalCount) || attempt.totalCount === 0
            || attempt.correctCount > attempt.totalCount || !isCount(attempt.score) || attempt.score > 100
            || !isCount(attempt.xpAwarded) || typeof attempt.lessonCompletedNow !== 'boolean') return false;
        return Array.isArray(value.questions) && value.questions.length === attempt.totalCount
            && value.questions.every(q => q && typeof q.questionId === 'string' && typeof q.isCorrect === 'boolean'
                && typeof q.type === 'string' && isArrayOfStrings(q.userAnswer) && isArrayOfStrings(q.correctAnswer)
                && (q.explanation == null || typeof q.explanation === 'string')
                && (q.translation == null || typeof q.translation === 'string'));
    }

    async function save(lessonId, submission, { durationMs = null } = {}) {
        if (!isSubmission(submission)) return false;
        const record = {
            lessonId,
            savedAt: Date.now(),
            durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs) : null,
            submission
        };
        try {
            sessionStorage.setItem(key(await scope(), lessonId), JSON.stringify(record));
            return true;
        } catch {
            return false;
        }
    }

    async function read(lessonId) {
        try {
            const record = JSON.parse(sessionStorage.getItem(key(await scope(), lessonId)) || 'null');
            return record?.lessonId === lessonId && isSubmission(record.submission) ? record : null;
        } catch {
            return null;
        }
    }

    window.QuizResult = {
        save,
        read,
        isSubmission,
        resultUrl: lessonId => `/Result/${encodeURIComponent(lessonId)}`
    };
})();
