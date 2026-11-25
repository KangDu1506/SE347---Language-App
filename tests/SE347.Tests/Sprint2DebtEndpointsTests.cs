using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SE347.Data;
using SE347.DTOs.Lesson;
using SE347.DTOs.Progress;
using SE347.Models;
using SE347.Services;

namespace SE347.Tests
{
    /// <summary>
    /// S3-19: cờ isLocked / progressStatus ở GET /api/lessons và GET /api/progress/lessons/{id}/quiz/latest.
    /// </summary>
    public class Sprint2DebtEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly LessonApiFactory _factory;

        public Sprint2DebtEndpointsTests(LessonApiFactory factory)
        {
            _factory = factory;
        }

        private ILessonService Lessons => _factory.Services.GetRequiredService<ILessonService>();

        private IReadOnlyList<string> MainLessonIds => Lessons.GetLearningPaths().Single().Nodes
            .Where(n => !n.IsBranch).OrderBy(n => n.Column).Select(n => n.LessonId).ToList();

        private string QuizLessonId => MainLessonIds.First(id => Lessons.GetQuizQuestions(id)!.Count > 0);

        private async Task<List<LessonListItemDto>> GetLessonsAsync(HttpClient client) =>
            (await client.GetFromJsonAsync<List<LessonListItemDto>>("/api/lessons", Json))!;

        private async Task SeedAsync(Action<ApplicationDbContext> change)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            change(db);
            await db.SaveChangesAsync();
        }

        // ── GET /api/lessons: isLocked & progressStatus ─────────────

        [Fact]
        public async Task LessonList_NewUser_MarksLockedLessonsAndNotStarted()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());
            var main = MainLessonIds;

            var lessons = (await GetLessonsAsync(client)).ToDictionary(l => l.LessonId);

            Assert.False(lessons[main[0]].IsLocked);
            Assert.True(lessons[main[1]].IsLocked);
            Assert.True(lessons["ordinal-numbers"].IsLocked);
            Assert.False(lessons["present-simple-tense"].IsLocked);
            Assert.All(lessons.Values, l => Assert.Equal(LessonProgressStatuses.NotStarted, l.ProgressStatus));
        }

        [Fact]
        public async Task LessonList_IsLocked_MatchesLessonDetailAccess_ForEveryLesson()
        {
            var main = MainLessonIds;
            var userId = await _factory.CreateUserAsync();
            await _factory.SetLessonStatusAsync(userId, main[0], UserLessonProgress.StatusCompleted);
            await _factory.SetLessonStatusAsync(userId, main[1], UserLessonProgress.StatusCompleted);
            await _factory.SetLessonStatusAsync(userId, main[2], UserLessonProgress.StatusCompleted);
            await _factory.SetLessonStatusAsync(userId, main[10], UserLessonProgress.StatusInProgress);
            var client = _factory.CreateClientFor(userId);

            var lessons = await GetLessonsAsync(client);

            Assert.Equal(Lessons.GetAll().Count, lessons.Count);
            foreach (var lesson in lessons)
            {
                var status = (await client.GetAsync($"/api/lessons/{lesson.LessonId}")).StatusCode;
                Assert.Equal(lesson.IsLocked ? HttpStatusCode.Forbidden : HttpStatusCode.OK, status);
            }

            var byId = lessons.ToDictionary(l => l.LessonId);
            Assert.Equal(LessonProgressStatuses.Completed, byId[main[0]].ProgressStatus);
            Assert.Equal(LessonProgressStatuses.InProgress, byId[main[10]].ProgressStatus);
            Assert.False(byId[main[3]].IsLocked);
            Assert.False(byId["ordinal-numbers"].IsLocked); // cardinal-numbers (main[2]) đã xong
        }

        [Fact]
        public async Task LessonList_FiltersStillApply()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var grammar = await client.GetFromJsonAsync<List<LessonListItemDto>>("/api/lessons?category=grammar", Json);

            Assert.NotEmpty(grammar!);
            Assert.All(grammar!, l => Assert.Equal("grammar", l.Category));
        }

        // ── GET /api/progress/lessons/{id}/quiz/latest ─────────────

        [Fact]
        public async Task LatestQuiz_NoAttempt_Returns404WithCode()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var response = await client.GetAsync($"/api/progress/lessons/{QuizLessonId}/quiz/latest");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("quiz_attempt_not_found", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        }

        [Fact]
        public async Task LatestQuiz_UnknownLesson_Returns404()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/progress/lessons/no-such-lesson/quiz/latest")).StatusCode);
        }

        [Fact]
        public async Task LatestQuiz_ReturnsNewestAttemptWithAnswers_InSubmissionShape()
        {
            var lessonId = QuizLessonId;
            var userId = await _factory.CreateUserAsync();
            var otherUser = await _factory.CreateUserAsync();
            await _factory.SetLessonStatusAsync(userId, lessonId, UserLessonProgress.StatusCompleted);
            await _factory.SetLessonStatusAsync(otherUser, lessonId, UserLessonProgress.StatusCompleted);

            await SeedAsync(db =>
            {
                db.UserQuizAttempts.Add(new UserQuizAttempt { UserId = userId, LessonId = lessonId, CorrectCount = 1, TotalCount = 2, Score = 50, SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(-5) });
                var newest = new UserQuizAttempt { UserId = userId, LessonId = lessonId, CorrectCount = 2, TotalCount = 2, Score = 100, XpAwarded = 20, SubmittedAt = DateTimeOffset.UtcNow };
                newest.Answers.Add(new UserQuizAttemptAnswer
                {
                    QuestionKey = "q1", IsCorrect = true, UserAnswer = """["am"]""",
                    QuestionSnapshot = """{"type":"single-choice","correctAnswer":["am"],"explanation":"I + am","translation":"Tôi là"}""",
                });
                newest.Answers.Add(new UserQuizAttemptAnswer
                {
                    QuestionKey = "q2", IsCorrect = true, UserAnswer = """["true"]""",
                    QuestionSnapshot = """{"type":"true-false","correctAnswer":["true"],"explanation":"","translation":""}""",
                });
                db.UserQuizAttempts.Add(newest);
                // Lần nộp của user khác không được trả về
                db.UserQuizAttempts.Add(new UserQuizAttempt { UserId = otherUser, LessonId = lessonId, CorrectCount = 0, TotalCount = 2, Score = 0, SubmittedAt = DateTimeOffset.UtcNow.AddMinutes(1) });
            });

            var result = await _factory.CreateClientFor(userId)
                .GetFromJsonAsync<QuizSubmissionResultDto>($"/api/progress/lessons/{lessonId}/quiz/latest", Json);

            Assert.Equal(100, result!.Attempt.Score);
            Assert.Equal(20, result.Attempt.XpAwarded);
            Assert.True(result.Attempt.LessonCompletedNow);
            Assert.Equal(lessonId, result.Attempt.Progress.LessonId);
            Assert.Equal(["q1", "q2"], result.Questions.Select(q => q.QuestionId));
            Assert.Equal(LessonQuizQuestionType.SingleChoice, result.Questions[0].Type);
            Assert.Equal(["am"], result.Questions[0].UserAnswer);
            Assert.Equal(["am"], result.Questions[0].CorrectAnswer);
            Assert.Equal("I + am", result.Questions[0].Explanation);
            Assert.Equal("Tôi là", result.Questions[0].Translation);
            Assert.Equal(LessonQuizQuestionType.TrueFalse, result.Questions[1].Type);
        }

        [Fact]
        public async Task LatestQuiz_AttemptSavedBeforeAnswerDetails_ReturnsSummaryWithEmptyQuestions()
        {
            var lessonId = QuizLessonId;
            var userId = await _factory.CreateUserAsync();
            await _factory.SetLessonStatusAsync(userId, lessonId, UserLessonProgress.StatusInProgress);
            await SeedAsync(db => db.UserQuizAttempts.Add(new UserQuizAttempt
            {
                UserId = userId, LessonId = lessonId, CorrectCount = 1, TotalCount = 5, Score = 20, SubmittedAt = DateTimeOffset.UtcNow,
            }));

            var result = await _factory.CreateClientFor(userId)
                .GetFromJsonAsync<QuizSubmissionResultDto>($"/api/progress/lessons/{lessonId}/quiz/latest", Json);

            Assert.Equal(20, result!.Attempt.Score);
            Assert.False(result.Attempt.LessonCompletedNow);
            Assert.Empty(result.Questions);
        }
    }
}
