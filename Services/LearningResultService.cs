using SE347.DTOs.Lesson;
using SE347.DTOs.Progress;
using SE347.Models;

namespace SE347.Services
{
    public class LearningResultService : ILearningResultService
    {
        /// <summary>Giới hạn kích thước bài làm để không phải chấm dữ liệu rác.</summary>
        private const int MaxAnswerParts = 20;
        private const int MaxAnswerLength = 200;

        private readonly ILessonService _lessons;
        private readonly IProgressService _progress;

        public LearningResultService(ILessonService lessons, IProgressService progress)
        {
            _lessons = lessons;
            _progress = progress;
        }

        public Task<ProgressResult<LessonProgressDto>> CompleteContentAsync(Guid userId, string lessonId, string contentId, CancellationToken cancellationToken = default)
        {
            var lesson = _lessons.GetDetail(lessonId);
            if (lesson is null)
            {
                return Task.FromResult(ProgressResult<LessonProgressDto>.Fail(ProgressError.LessonNotFound));
            }

            if (!_lessons.ContentExists(lessonId, contentId))
            {
                return Task.FromResult(ProgressResult<LessonProgressDto>.Fail(ProgressError.ContentNotFound));
            }

            var countsAsWord = string.Equals(lesson.Category, LessonCategories.Vocabulary, StringComparison.OrdinalIgnoreCase);
            return _progress.MarkContentCompletedAsync(userId, lessonId, contentId, ILearningResultService.XpPerContent, countsAsWord, cancellationToken);
        }

        public async Task<ProgressResult<QuizSubmissionResultDto>> SubmitQuizAsync(Guid userId, string lessonId, IReadOnlyList<QuizAnswerDto>? answers, CancellationToken cancellationToken = default)
        {
            var questions = _lessons.GetQuizQuestions(lessonId);
            if (questions is null)
            {
                return ProgressResult<QuizSubmissionResultDto>.Fail(ProgressError.LessonNotFound);
            }

            if (questions.Count == 0)
            {
                return ProgressResult<QuizSubmissionResultDto>.Fail(ProgressError.QuizNotFound);
            }

            var error = Grade(questions, answers, out var results);
            if (error is not null)
            {
                return ProgressResult<QuizSubmissionResultDto>.Fail(ProgressError.InvalidInput, error);
            }

            var current = await _progress.GetLessonProgressAsync(userId, lessonId, cancellationToken);
            if (current.Error != ProgressError.None)
            {
                return ProgressResult<QuizSubmissionResultDto>.Fail(current.Error, current.Detail);
            }

            // XP chỉ cộng ở lần đầu đạt điểm qua bài, làm lại bài đã hoàn thành không cộng thêm.
            // RecordQuizAttemptAsync kiểm lại dưới khóa hàng nên hai lần nộp song song không cùng được cộng.
            var correctCount = results.Count(r => r.IsCorrect);
            var passes = IProgressService.QuizScore(correctCount, questions.Count) >= IProgressService.QuizPassScore;
            var xp = passes && current.Value!.Status != UserLessonProgress.StatusCompleted
                ? correctCount * ILearningResultService.XpPerCorrectAnswer
                : 0;

            var attempt = await _progress.RecordQuizAttemptAsync(userId, lessonId, correctCount, questions.Count, xp, cancellationToken);
            return attempt.Error == ProgressError.None
                ? ProgressResult<QuizSubmissionResultDto>.Ok(new QuizSubmissionResultDto(attempt.Value!, results))
                : ProgressResult<QuizSubmissionResultDto>.Fail(attempt.Error, attempt.Detail);
        }

        public async Task<ProgressResult<LessonProgressDto>> CompleteLessonAsync(Guid userId, string lessonId, CancellationToken cancellationToken = default)
        {
            var lesson = _lessons.GetDetail(lessonId);
            if (lesson is null)
            {
                return ProgressResult<LessonProgressDto>.Fail(ProgressError.LessonNotFound);
            }

            if (lesson.Quiz.Count > 0)
            {
                return ProgressResult<LessonProgressDto>.Fail(ProgressError.QuizRequired);
            }

            var current = await _progress.GetLessonProgressAsync(userId, lessonId, cancellationToken);
            if (current.Error != ProgressError.None)
            {
                return current;
            }

            var completed = current.Value!.CompletedContentIds.ToHashSet(StringComparer.Ordinal);
            if (lesson.Contents.Any(c => !completed.Contains(c.Id)))
            {
                return ProgressResult<LessonProgressDto>.Fail(ProgressError.ContentsIncomplete);
            }

            return await _progress.MarkLessonCompletedAsync(userId, lessonId, ILearningResultService.XpLessonCompleted, cancellationToken);
        }

        /// <summary>
        /// Chấm bài làm theo thứ tự câu trong quiz.json. Trả mô tả lỗi nếu bài làm không hợp lệ, null nếu chấm xong.
        /// So sánh không phân biệt hoa thường, bỏ khoảng trắng thừa và coi dấu nháy cong (’) như nháy thẳng (').
        /// </summary>
        public static string? Grade(IReadOnlyList<LessonQuizQuestionDto> questions, IReadOnlyList<QuizAnswerDto>? answers, out List<QuizQuestionResultDto> results)
        {
            results = [];

            if (answers is null)
            {
                return "Thiếu danh sách answers.";
            }

            var byId = questions.ToDictionary(q => q.Id, StringComparer.Ordinal);
            var given = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);

            foreach (var answer in answers)
            {
                var questionId = answer?.QuestionId?.Trim();
                if (string.IsNullOrEmpty(questionId))
                {
                    return "Mỗi câu trả lời phải có questionId.";
                }

                if (!byId.ContainsKey(questionId))
                {
                    return $"Câu hỏi '{questionId}' không có trong bài.";
                }

                var parts = answer!.Answer ?? [];
                if (parts.Count > MaxAnswerParts || parts.Any(p => p?.Length > MaxAnswerLength))
                {
                    return $"Câu trả lời cho câu '{questionId}' quá dài.";
                }

                if (!given.TryAdd(questionId, parts.Select(p => p?.Trim() ?? string.Empty).ToList()))
                {
                    return $"Câu hỏi '{questionId}' được trả lời nhiều lần.";
                }
            }

            foreach (var question in questions)
            {
                var userAnswer = given.GetValueOrDefault(question.Id) ?? [];
                results.Add(new QuizQuestionResultDto(
                    question.Id,
                    question.Type,
                    IsCorrect(question, userAnswer),
                    userAnswer,
                    question.Answers,
                    question.Explanation ?? string.Empty,
                    question.Translation ?? string.Empty));
            }

            return null;
        }

        private static bool IsCorrect(LessonQuizQuestionDto question, IReadOnlyList<string> userAnswer)
        {
            var expected = question.Answers.Select(Normalize).ToList();
            var actual = userAnswer.Select(Normalize).ToList();

            return question.Type switch
            {
                // Chọn nhiều: đủ và đúng các lựa chọn, không phụ thuộc thứ tự, không lặp.
                LessonQuizQuestionType.MultipleChoice =>
                    actual.Distinct().Count() == actual.Count && actual.ToHashSet().SetEquals(expected),
                // Chọn một / đúng sai: 1 đáp án. Điền từ: mỗi chỗ trống một đáp án, đúng thứ tự.
                _ => actual.SequenceEqual(expected),
            };
        }

        private static string Normalize(string value) =>
            string.Join(' ', value.Replace('’', '\'').Replace('‘', '\'').Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
                .ToLowerInvariant();
    }
}
