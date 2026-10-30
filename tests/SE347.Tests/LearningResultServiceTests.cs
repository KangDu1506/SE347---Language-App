using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SE347.DTOs.Lesson;
using SE347.DTOs.Progress;
using SE347.Services;
using Xunit;

namespace SE347.Tests;

/// <summary>Chấm bài quiz (LearningResultService.Grade): chuẩn hóa đáp án, câu bỏ trống, bài làm không hợp lệ.</summary>
public sealed class QuizGradingTests
{
    private static readonly List<LessonQuizQuestionDto> Quiz =
    [
        Question("1", LessonQuizQuestionType.FillInTheBlank, "Throw"),
        Question("2", LessonQuizQuestionType.SingleChoice, "at night"),
        Question("3", LessonQuizQuestionType.TrueFalse, "true"),
        Question("4", LessonQuizQuestionType.MultipleChoice, "a", "b"),
        Question("5", LessonQuizQuestionType.FillInTheBlank, "don't", "go"),
    ];

    [Fact]
    public void CorrectAnswers_IgnoreCaseExtraSpacesCurlyQuotesAndChoiceOrder()
    {
        var error = LearningResultService.Grade(Quiz,
            [Answer("1", " throw "), Answer("2", "At  Night"), Answer("3", "TRUE"), Answer("4", "B", "a"), Answer("5", "don’t", "go")],
            out var results);

        Assert.Null(error);
        Assert.All(results, r => Assert.True(r.IsCorrect));
        Assert.Equal(["1", "2", "3", "4", "5"], results.Select(r => r.QuestionId));
    }

    [Fact]
    public void WrongAndUnansweredQuestions_AreIncorrect()
    {
        var error = LearningResultService.Grade(Quiz, [Answer("1", "catch"), Answer("4", "a"), Answer("5", "go", "don't")], out var results);

        Assert.Null(error);
        Assert.Equal(5, results.Count);
        Assert.All(results, r => Assert.False(r.IsCorrect));
        Assert.Empty(results[1].UserAnswer);
        Assert.Equal(["at night"], results[1].CorrectAnswer);
    }

    [Fact]
    public void MultipleChoice_DuplicateOrExtraOptions_AreIncorrect()
    {
        LearningResultService.Grade(Quiz, [Answer("4", "a", "a", "b")], out var duplicate);
        LearningResultService.Grade(Quiz, [Answer("4", "a", "b", "c")], out var extra);

        Assert.False(duplicate[3].IsCorrect);
        Assert.False(extra[3].IsCorrect);
    }

    [Fact]
    public void NullAnswerList_CountsAsUnanswered()
    {
        Assert.Null(LearningResultService.Grade(Quiz, [new QuizAnswerDto("1", null)], out var results));
        Assert.False(results[0].IsCorrect);
    }

    [Theory]
    [InlineData("99")]
    [InlineData("")]
    public void UnknownOrMissingQuestionId_IsRejected(string questionId) =>
        Assert.NotNull(LearningResultService.Grade(Quiz, [Answer(questionId, "x")], out _));

    [Fact]
    public void InvalidSubmissions_AreRejected()
    {
        Assert.NotNull(LearningResultService.Grade(Quiz, null, out _));
        Assert.NotNull(LearningResultService.Grade(Quiz, [Answer("1", "x"), Answer(" 1", "y")], out _));
        Assert.NotNull(LearningResultService.Grade(Quiz, [Answer("1", new string('x', 201))], out _));
        Assert.NotNull(LearningResultService.Grade(Quiz, [Answer("1", Enumerable.Repeat("x", 21).ToArray())], out _));
    }

    [Fact]
    public void EveryQuizInStorage_GradesItsOwnAnswersAsCorrect()
    {
        var environment = new Mock<IWebHostEnvironment>();
        environment.Setup(e => e.ContentRootPath).Returns(RepositoryRoot());
        var lessons = new LessonService(environment.Object, NullLogger<LessonService>.Instance);

        var questionCount = 0;
        foreach (var lesson in lessons.GetAll())
        {
            var questions = lessons.GetQuizQuestions(lesson.LessonId)!;
            var answers = questions.Select(q => new QuizAnswerDto(q.Id, q.Answers.ToArray())).ToList();

            Assert.Null(LearningResultService.Grade(questions, answers, out var results));
            Assert.All(results, r => Assert.True(r.IsCorrect, $"{lesson.LessonId} câu {r.QuestionId}"));
            questionCount += questions.Count;
        }

        Assert.True(questionCount > 0);
    }

    private static LessonQuizQuestionDto Question(string id, LessonQuizQuestionType type, params string[] answers) =>
        new() { Id = id, Type = type, Question = "q", Answers = answers.ToList(), Explanation = "e", Translation = "t" };

    private static QuizAnswerDto Answer(string questionId, params string?[] answer) => new(questionId, answer);

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "SE347.csproj")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Không tìm thấy SE347.csproj.");
    }
}

/// <summary>Luật XP và điều kiện hoàn thành bài của LearningResultService (IProgressService được mock).</summary>
public sealed class LearningResultServiceTests
{
    [Theory]
    [InlineData("in_progress", 4, 40)] // 80%: đạt lần đầu, 10 XP mỗi câu đúng
    [InlineData("in_progress", 3, 30)] // 60%: đúng ngưỡng đạt
    [InlineData("in_progress", 2, 0)]  // 40%: chưa đạt
    [InlineData("completed", 5, 0)]    // làm lại bài đã hoàn thành
    public async Task SubmitQuiz_AwardsXpOnlyOnFirstPassingAttempt(string status, int correctCount, int expectedXp)
    {
        var progress = new Mock<IProgressService>();
        progress.Setup(p => p.GetLessonProgressAsync(It.IsAny<Guid>(), "l", default))
            .ReturnsAsync(ProgressResult<LessonProgressDto>.Ok(Progress(status)));
        progress.Setup(p => p.RecordQuizAttemptAsync(It.IsAny<Guid>(), "l", It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), default))
            .ReturnsAsync((Guid _, string _, int correct, int total, int xp, CancellationToken _) =>
                ProgressResult<QuizAttemptResultDto>.Ok(new QuizAttemptResultDto(1, (short)correct, (short)total, 0, xp, false, Progress(status))));

        var answers = Enumerable.Range(1, 5)
            .Select(i => new QuizAnswerDto(i.ToString(), [i <= correctCount ? "true" : "false"]))
            .ToList();
        var result = await new LearningResultService(Lessons(quizCount: 5).Object, progress.Object)
            .SubmitQuizAsync(Guid.NewGuid(), "l", answers);

        Assert.Equal(ProgressError.None, result.Error);
        Assert.Equal(expectedXp, result.Value!.Attempt.XpAwarded);
        progress.Verify(p => p.RecordQuizAttemptAsync(It.IsAny<Guid>(), "l", correctCount, 5, expectedXp, default));
    }

    [Fact]
    public async Task SubmitQuiz_LessonWithoutQuizOrUnknownLesson_Fails()
    {
        var service = new LearningResultService(Lessons(quizCount: 0).Object, Mock.Of<IProgressService>());

        Assert.Equal(ProgressError.QuizNotFound, (await service.SubmitQuizAsync(Guid.NewGuid(), "l", [])).Error);
        Assert.Equal(ProgressError.LessonNotFound, (await service.SubmitQuizAsync(Guid.NewGuid(), "missing", [])).Error);
    }

    [Fact]
    public async Task SubmitQuiz_InvalidAnswers_AreNotSaved()
    {
        var progress = new Mock<IProgressService>(MockBehavior.Strict);

        var result = await new LearningResultService(Lessons(quizCount: 3).Object, progress.Object)
            .SubmitQuizAsync(Guid.NewGuid(), "l", [new QuizAnswerDto("9", ["true"])]);

        Assert.Equal(ProgressError.InvalidInput, result.Error);
        Assert.Contains("'9'", result.Detail);
    }

    [Fact]
    public async Task CompleteLesson_RequiresNoQuizAndAllContents()
    {
        var progress = new Mock<IProgressService>();
        Assert.Equal(ProgressError.QuizRequired,
            (await new LearningResultService(Lessons(quizCount: 2).Object, progress.Object).CompleteLessonAsync(Guid.NewGuid(), "l")).Error);

        var service = new LearningResultService(Lessons(quizCount: 0).Object, progress.Object);
        progress.Setup(p => p.GetLessonProgressAsync(It.IsAny<Guid>(), "l", default))
            .ReturnsAsync(ProgressResult<LessonProgressDto>.Ok(Progress("in_progress", "1")));
        Assert.Equal(ProgressError.ContentsIncomplete, (await service.CompleteLessonAsync(Guid.NewGuid(), "l")).Error);

        progress.Setup(p => p.GetLessonProgressAsync(It.IsAny<Guid>(), "l", default))
            .ReturnsAsync(ProgressResult<LessonProgressDto>.Ok(Progress("in_progress", "1", "2")));
        progress.Setup(p => p.MarkLessonCompletedAsync(It.IsAny<Guid>(), "l", ILearningResultService.XpLessonCompleted, default))
            .ReturnsAsync(ProgressResult<LessonProgressDto>.Ok(Progress("completed", "1", "2")));
        Assert.Equal(ProgressError.None, (await service.CompleteLessonAsync(Guid.NewGuid(), "l")).Error);
    }

    [Fact]
    public async Task CompleteContent_CountsWordsOnlyForVocabularyLessons()
    {
        var progress = new Mock<IProgressService>();

        var vocabulary = new LearningResultService(Lessons(quizCount: 0).Object, progress.Object);
        Assert.Equal(ProgressError.ContentNotFound, (await vocabulary.CompleteContentAsync(Guid.NewGuid(), "l", "9")).Error);
        await vocabulary.CompleteContentAsync(Guid.NewGuid(), "l", "1");
        progress.Verify(p => p.MarkContentCompletedAsync(It.IsAny<Guid>(), "l", "1", ILearningResultService.XpPerContent, true, default));

        await new LearningResultService(Lessons(quizCount: 0, LessonCategories.Grammar).Object, progress.Object)
            .CompleteContentAsync(Guid.NewGuid(), "l", "1");
        progress.Verify(p => p.MarkContentCompletedAsync(It.IsAny<Guid>(), "l", "1", ILearningResultService.XpPerContent, false, default));
    }

    private static LessonProgressDto Progress(string status, params string[] completedContentIds) =>
        new("l", status, null, null, null, completedContentIds, 0, null, null, 0);

    /// <summary>Bài "l" có 2 mục nội dung ("1", "2") và quizCount câu true-false đáp án "true".</summary>
    private static Mock<ILessonService> Lessons(int quizCount, string category = LessonCategories.Vocabulary)
    {
        var contents = new List<LessonContentItemDto> { new() { Id = "1" }, new() { Id = "2" } };
        var quiz = Enumerable.Range(1, quizCount)
            .Select(i => new LessonQuizQuestionDto { Id = i.ToString(), Type = LessonQuizQuestionType.TrueFalse, Answers = ["true"] })
            .ToList();

        var lessons = new Mock<ILessonService>();
        lessons.Setup(x => x.GetDetail("l")).Returns(new LessonDetailResponseDto(
            "l", "name", "description", category, "topic", "A1", 1, 5, null, contents,
            quiz.Select(q => QuizQuestionResponseDto.From(q, path => path)).ToList(), new LessonQuizSettingsDto()));
        lessons.Setup(x => x.GetQuizQuestions("l")).Returns(quiz);
        lessons.Setup(x => x.ContentExists("l", "1")).Returns(true);
        return lessons;
    }
}
