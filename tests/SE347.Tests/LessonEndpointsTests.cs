using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using SE347.DTOs.Lesson;
using SE347.Models;
using SE347.Services;

namespace SE347.Tests
{
    /// <summary>
    /// /api/lessons, /api/lessons/{lessonId}, /api/lessons/{lessonId}/quiz trên dữ liệu thật trong Storage/LessonTemplate.
    /// </summary>
    public class LessonEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly LessonApiFactory _factory;

        public LessonEndpointsTests(LessonApiFactory factory)
        {
            _factory = factory;
        }

        private ILessonService Lessons => _factory.Services.GetRequiredService<ILessonService>();

        /// <summary>Một bài có prerequisites trong LearningPath.json (vd "ordinal-numbers" cần "cardinal-numbers").</summary>
        private (string LessonId, IReadOnlyList<string> Prerequisites) LockableLesson()
        {
            var lesson = Lessons.GetAll().First(l => Lessons.GetPrerequisites(l.LessonId).Count > 0);
            return (lesson.LessonId, Lessons.GetPrerequisites(lesson.LessonId));
        }

        // ── 401 ──────────────────────────────────────────────────────

        [Theory]
        [InlineData("/api/lessons")]
        [InlineData("/api/lessons?category=grammar&level=A1")]
        [InlineData("/api/lessons/present-simple-tense")]
        [InlineData("/api/lessons/present-simple-tense/quiz")]
        [InlineData("/api/lessons/does-not-exist")]
        public async Task Endpoints_WithoutLogin_Return401(string url)
        {
            var response = await _factory.CreateClientFor(null).GetAsync(url);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        // ── Danh sách + lọc ──────────────────────────────────────────

        [Fact]
        public async Task List_WithoutFilters_ReturnsAllLessons()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var lessons = await client.GetFromJsonAsync<List<LessonSummaryDto>>("/api/lessons", Json);

            Assert.NotNull(lessons);
            Assert.Equal(Lessons.GetAll().Select(l => l.LessonId), lessons.Select(l => l.LessonId));
        }

        [Theory]
        [InlineData("vocabulary")]
        [InlineData("grammar")]
        [InlineData("listening")]
        [InlineData("GRAMMAR")]
        public async Task List_FilterByCategory_ReturnsOnlyThatCategory(string category)
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var lessons = await client.GetFromJsonAsync<List<LessonSummaryDto>>($"/api/lessons?category={category}", Json);

            Assert.NotNull(lessons);
            Assert.NotEmpty(lessons);
            Assert.All(lessons, l => Assert.Equal(category, l.Category, ignoreCase: true));
            Assert.Equal(
                Lessons.GetAll().Count(l => l.Category.Equals(category, StringComparison.OrdinalIgnoreCase)),
                lessons.Count);
        }

        [Theory]
        [InlineData("A1")]
        [InlineData("a2")]
        [InlineData("B2")]
        public async Task List_FilterByLevel_ReturnsOnlyThatLevel(string level)
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var lessons = await client.GetFromJsonAsync<List<LessonSummaryDto>>($"/api/lessons?level={level}", Json);

            Assert.NotNull(lessons);
            Assert.NotEmpty(lessons);
            Assert.All(lessons, l => Assert.Equal(level, l.Level, ignoreCase: true));
            Assert.Equal(
                Lessons.GetAll().Count(l => l.Level.Equals(level, StringComparison.OrdinalIgnoreCase)),
                lessons.Count);
        }

        [Fact]
        public async Task List_FilterByCategoryAndLevel_AppliesBoth()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            // vocabulary có cả A1 và B2, A1 có cả vocabulary và grammar: kết quả phải là giao của hai bộ lọc
            var lessons = await client.GetFromJsonAsync<List<LessonSummaryDto>>("/api/lessons?category=vocabulary&level=A1", Json);

            Assert.NotNull(lessons);
            Assert.NotEmpty(lessons);
            Assert.All(lessons, l =>
            {
                Assert.Equal(LessonCategories.Vocabulary, l.Category);
                Assert.Equal("A1", l.Level);
            });
            var all = Lessons.GetAll();
            Assert.True(lessons.Count < all.Count(l => l.Category == LessonCategories.Vocabulary));
            Assert.True(lessons.Count < all.Count(l => l.Level == "A1"));
        }

        [Fact]
        public async Task List_FilterWithNoMatch_ReturnsEmptyList()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var lessons = await client.GetFromJsonAsync<List<LessonSummaryDto>>("/api/lessons?category=listening&level=C1", Json);

            Assert.NotNull(lessons);
            Assert.Empty(lessons);
        }

        [Theory]
        [InlineData("/api/lessons?category=reading")]
        [InlineData("/api/lessons?level=Z9")]
        public async Task List_InvalidFilter_Returns400(string url)
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var response = await client.GetAsync(url);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ── Chi tiết + 404 ───────────────────────────────────────────

        [Fact]
        public async Task Detail_ExistingLesson_ReturnsLessonWithPublicAssetUrls()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var lesson = await client.GetFromJsonAsync<LessonDetailResponseDto>("/api/lessons/at-the-coffee-shop", Json);

            Assert.NotNull(lesson);
            Assert.Equal("at-the-coffee-shop", lesson.LessonId);
            Assert.Equal(LessonCategories.Listening, lesson.Category);
            Assert.NotEmpty(lesson.Contents);
            Assert.NotEmpty(lesson.Quiz);

            var audio = lesson.Contents.Select(c => c.Audio).OfType<string>().First();
            Assert.StartsWith("/api/lessons/at-the-coffee-shop/assets/", audio);

            // URL public dùng được ngay (thẻ <audio> không gửi token)
            var file = await _factory.CreateClientFor(null).GetAsync(audio);
            Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        }

        [Theory]
        [InlineData("/api/lessons/does-not-exist")]
        [InlineData("/api/lessons/does-not-exist/quiz")]
        [InlineData("/api/lessons/schemas")]
        public async Task Detail_UnknownLesson_Returns404(string url)
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var response = await client.GetAsync(url);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Detail_InvalidLessonId_Returns400()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var response = await client.GetAsync("/api/lessons/Not_A_Slug");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ── Quiz ─────────────────────────────────────────────────────

        [Fact]
        public async Task Quiz_ReturnsQuestionsWithoutAnswers()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            using var body = JsonDocument.Parse(await client.GetStringAsync("/api/lessons/present-simple-tense/quiz"));

            var questions = body.RootElement.EnumerateArray().ToList();
            Assert.Equal(Lessons.GetQuizQuestions("present-simple-tense")!.Count, questions.Count);
            Assert.NotEmpty(questions);
            Assert.All(questions, AssertNoAnswerFields);
        }

        // ── 403 ──────────────────────────────────────────────────────

        [Theory]
        [InlineData("blocked")]
        [InlineData("deleted")]
        public async Task Endpoints_InactiveProfile_Return403(string status)
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync(status));

            foreach (var url in new[] { "/api/lessons", "/api/lessons/present-simple-tense", "/api/lessons/present-simple-tense/quiz" })
            {
                var response = await client.GetAsync(url);
                Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            }
        }

        [Fact]
        public async Task Endpoints_UserWithoutProfile_Return403()
        {
            var client = _factory.CreateClientFor(Guid.NewGuid());

            var response = await client.GetAsync("/api/lessons");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task LockedLesson_PrerequisiteNotStarted_Returns403()
        {
            var (lessonId, _) = LockableLesson();
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var detail = await client.GetAsync($"/api/lessons/{lessonId}");
            var quiz = await client.GetAsync($"/api/lessons/{lessonId}/quiz");

            Assert.Equal(HttpStatusCode.Forbidden, detail.StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, quiz.StatusCode);

            // Bài khóa vẫn có trong danh sách, chỉ bị chặn khi mở
            var lessons = await client.GetFromJsonAsync<List<LessonSummaryDto>>("/api/lessons", Json);
            Assert.Contains(lessons!, l => l.LessonId == lessonId);
        }

        [Fact]
        public async Task LockedLesson_PrerequisiteInProgress_Returns403()
        {
            var (lessonId, prerequisites) = LockableLesson();
            var userId = await _factory.CreateUserAsync();
            foreach (var prerequisite in prerequisites)
            {
                await _factory.SetLessonStatusAsync(userId, prerequisite, UserLessonProgress.StatusInProgress);
            }

            var response = await _factory.CreateClientFor(userId).GetAsync($"/api/lessons/{lessonId}");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task LockedLesson_PrerequisitesCompleted_Returns200()
        {
            var (lessonId, prerequisites) = LockableLesson();
            var userId = await _factory.CreateUserAsync();
            foreach (var prerequisite in prerequisites)
            {
                await _factory.SetLessonStatusAsync(userId, prerequisite, UserLessonProgress.StatusCompleted);
            }
            var client = _factory.CreateClientFor(userId);

            var detail = await client.GetAsync($"/api/lessons/{lessonId}");
            var quiz = await client.GetAsync($"/api/lessons/{lessonId}/quiz");

            Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
            Assert.Equal(HttpStatusCode.OK, quiz.StatusCode);
        }

        [Fact]
        public async Task LockedLesson_OtherUsersProgressDoesNotUnlock()
        {
            var (lessonId, prerequisites) = LockableLesson();
            var other = await _factory.CreateUserAsync();
            foreach (var prerequisite in prerequisites)
            {
                await _factory.SetLessonStatusAsync(other, prerequisite, UserLessonProgress.StatusCompleted);
            }

            var response = await _factory.CreateClientFor(await _factory.CreateUserAsync()).GetAsync($"/api/lessons/{lessonId}");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        // ── Không lộ đường dẫn nội bộ ────────────────────────────────

        [Fact]
        public async Task Responses_ContainNoInternalPaths()
        {
            var userId = await _factory.CreateUserAsync();
            var lessonIds = Lessons.GetAll().Select(l => l.LessonId).ToList();
            foreach (var lessonId in lessonIds)
            {
                await _factory.SetLessonStatusAsync(userId, lessonId, UserLessonProgress.StatusCompleted);
            }
            var client = _factory.CreateClientFor(userId);

            AssertNoInternalPaths(await client.GetStringAsync("/api/lessons"), lessonId: null);
            foreach (var lessonId in lessonIds)
            {
                AssertNoInternalPaths(await client.GetStringAsync($"/api/lessons/{lessonId}"), lessonId);

                var quiz = await client.GetStringAsync($"/api/lessons/{lessonId}/quiz");
                AssertNoInternalPaths(quiz, lessonId);

                using var doc = JsonDocument.Parse(quiz);
                Assert.All(doc.RootElement.EnumerateArray(), AssertNoAnswerFields);
            }
        }

        private static readonly string[] InternalPropertyNames =
        [
            "folder", "path", "filePath", "fullPath", "storageKey", "storagePath",
            "configPath", "contentPath", "quizPath", "content-settings",
        ];

        private static readonly Regex InternalValue = new(
            @"(\.json\b|LessonTemplate|Storage[/\\]|\\|^\.{1,2}/|^[A-Za-z]:[/\\]|^file:)",
            RegexOptions.IgnoreCase);

        private static readonly Regex UrlPath = new(@"^/[A-Za-z0-9._~%-]+(/[A-Za-z0-9._~%-]+)+$");

        private void AssertNoInternalPaths(string json, string? lessonId)
        {
            var contentRoot = _factory.Services.GetRequiredService<IWebHostEnvironment>().ContentRootPath.TrimEnd('/', '\\');
            var assetUrl = new Regex($"^/api/lessons/{(lessonId is null ? "[a-z0-9-]+" : Regex.Escape(lessonId))}/assets/");

            using var doc = JsonDocument.Parse(json);
            Walk(doc.RootElement);

            void Walk(JsonElement element)
            {
                switch (element.ValueKind)
                {
                    case JsonValueKind.Object:
                        foreach (var property in element.EnumerateObject())
                        {
                            Assert.DoesNotContain(property.Name, InternalPropertyNames, StringComparer.OrdinalIgnoreCase);
                            Walk(property.Value);
                        }
                        break;
                    case JsonValueKind.Array:
                        foreach (var item in element.EnumerateArray())
                        {
                            Walk(item);
                        }
                        break;
                    case JsonValueKind.String:
                        var value = element.GetString()!;
                        Assert.False(InternalValue.IsMatch(value), $"Giá trị giống đường dẫn nội bộ: {value}");
                        Assert.DoesNotContain(contentRoot, value, StringComparison.OrdinalIgnoreCase);

                        // Đường dẫn trên server chỉ được là URL assets public của chính bài đó
                        // (phiên âm IPA "/æmˈbɪɡ.ju.əs/" không có dạng đường dẫn nên bỏ qua)
                        if (UrlPath.IsMatch(value))
                        {
                            Assert.Matches(assetUrl, value);
                        }
                        break;
                }
            }
        }

        private static void AssertNoAnswerFields(JsonElement question)
        {
            foreach (var name in new[] { "answer", "answers", "explanation", "translation" })
            {
                Assert.False(question.TryGetProperty(name, out _), $"Câu hỏi quiz không được có trường '{name}'.");
            }
        }
    }
}
