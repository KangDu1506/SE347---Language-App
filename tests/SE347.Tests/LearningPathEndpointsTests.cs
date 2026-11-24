using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using SE347.DTOs.Lesson;
using SE347.Models;
using SE347.Services;

namespace SE347.Tests
{
    /// <summary>
    /// S3-25: /api/learning-paths, /api/learning-paths/{id}/board, /api/lessons/recommendations
    /// và quy tắc khóa tuần tự mạch chính, trên lộ trình thật trong Storage/LessonTemplate/ProgressiveLearning-A.
    /// </summary>
    public class LearningPathEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private const string PathId = "english-foundations-and-everyday-communication";
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly LessonApiFactory _factory;

        public LearningPathEndpointsTests(LessonApiFactory factory)
        {
            _factory = factory;
        }

        private ILessonService Lessons => _factory.Services.GetRequiredService<ILessonService>();

        private LearningPathLayout Path => Lessons.GetLearningPaths().Single(p => p.Id == PathId);

        private IReadOnlyList<LearningPathLayoutNode> MainLessons => Path.Nodes.Where(n => !n.IsBranch).OrderBy(n => n.Column).ToList();

        private async Task<LearningPathBoardDto> GetBoardAsync(HttpClient client) =>
            (await client.GetFromJsonAsync<LearningPathBoardDto>($"/api/learning-paths/{PathId}/board", Json))!;

        private async Task<List<LessonRecommendationDto>> GetRecommendationsAsync(HttpClient client, string query = "") =>
            (await client.GetFromJsonAsync<List<LessonRecommendationDto>>($"/api/lessons/recommendations{query}", Json))!;

        // ── Bố cục & quy tắc khóa ───────────────────────────────────

        [Fact]
        public void Layout_MainPathIsSequential_AndBranchesKeepStudyBoardPositions()
        {
            var main = MainLessons;
            Assert.Equal(21, main.Count);
            Assert.All(main, n => Assert.Equal(1, n.Row));
            Assert.Empty(main[0].Prerequisites);
            for (var i = 1; i < main.Count; i++)
            {
                Assert.Equal(i + 1, main[i].Column);
                Assert.Contains(main[i - 1].LessonId, main[i].Prerequisites);
            }

            // Trước đây hard-code trong Pages/Study.cshtml (branchCoords)
            var expected = new Dictionary<string, (int Column, int Row)>
            {
                ["ordinal-numbers"] = (4, 0),
                ["time"] = (5, 0),
                ["basic-foods-and-drinks-2"] = (7, 2),
                ["locations-and-destinations-2"] = (8, 0),
                ["occupations-2"] = (9, 2),
            };
            var branches = Path.Nodes.Where(n => n.IsBranch).ToDictionary(n => n.LessonId);
            Assert.Equal(expected.Keys.Order(), branches.Keys.Order());
            foreach (var (lessonId, (column, row)) in expected)
            {
                Assert.Equal(column, branches[lessonId].Column);
                Assert.Equal(row, branches[lessonId].Row);
            }

            Assert.Equal(["cardinal-numbers"], branches["ordinal-numbers"].Prerequisites);
        }

        [Fact]
        public async Task NewUser_OnlyFirstMainLessonIsOpen()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());
            var main = MainLessons;

            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/lessons/{main[0].LessonId}")).StatusCode);
            var second = await client.GetAsync($"/api/lessons/{main[1].LessonId}");
            Assert.Equal(HttpStatusCode.Forbidden, second.StatusCode);
            Assert.Equal("lesson_locked", (await second.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());

            var board = await GetBoardAsync(client);
            Assert.Equal(BoardNodeStates.Current, board.Nodes.Single(n => n.LessonId == main[0].LessonId).State);
            Assert.All(board.Nodes.Where(n => n.LessonId != main[0].LessonId), n => Assert.Equal(BoardNodeStates.Locked, n.State));
            Assert.Equal(main[0].LessonId, board.CurrentLessonId);
            Assert.Equal(0, board.CompletedCount);
        }

        [Fact]
        public async Task CompletingMainLesson_UnlocksNextMainLesson()
        {
            var main = MainLessons;
            var userId = await _factory.CreateUserAsync();
            await _factory.SetLessonStatusAsync(userId, main[0].LessonId, UserLessonProgress.StatusCompleted);
            var client = _factory.CreateClientFor(userId);

            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/lessons/{main[1].LessonId}")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/lessons/{main[2].LessonId}")).StatusCode);

            var board = await GetBoardAsync(client);
            var first = board.Nodes.Single(n => n.LessonId == main[0].LessonId);
            Assert.Equal(BoardNodeStates.Done, first.State);
            Assert.Equal(LessonProgressStatuses.Completed, first.ProgressStatus);
            Assert.Equal(BoardNodeStates.Current, board.Nodes.Single(n => n.LessonId == main[1].LessonId).State);
            Assert.Equal(1, board.CompletedCount);
            Assert.Equal(main[1].LessonId, board.CurrentLessonId);
        }

        [Fact]
        public async Task LessonAlreadyOpened_StaysOpen_EvenIfPreviousLessonNotCompleted()
        {
            // User đã học vượt trước khi có quy tắc khóa tuần tự: không bị khóa lại giữa chừng
            var lessonId = MainLessons[9].LessonId;
            var userId = await _factory.CreateUserAsync();
            await _factory.SetLessonStatusAsync(userId, lessonId, UserLessonProgress.StatusInProgress);
            var client = _factory.CreateClientFor(userId);

            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/lessons/{lessonId}")).StatusCode);
            var node = (await GetBoardAsync(client)).Nodes.Single(n => n.LessonId == lessonId);
            Assert.Equal(BoardNodeStates.Current, node.State);
            Assert.Equal(LessonProgressStatuses.InProgress, node.ProgressStatus);
            Assert.Equal(lessonId, (await GetBoardAsync(client)).CurrentLessonId);
        }

        [Fact]
        public async Task BoardState_MatchesLessonApiAccess_ForEveryNode()
        {
            var main = MainLessons;
            var userId = await _factory.CreateUserAsync();
            foreach (var node in main.Take(4))
            {
                await _factory.SetLessonStatusAsync(userId, node.LessonId, UserLessonProgress.StatusCompleted);
            }
            var client = _factory.CreateClientFor(userId);

            foreach (var node in (await GetBoardAsync(client)).Nodes)
            {
                var status = (await client.GetAsync($"/api/lessons/{node.LessonId}")).StatusCode;
                Assert.Equal(node.State == BoardNodeStates.Locked ? HttpStatusCode.Forbidden : HttpStatusCode.OK, status);
            }
        }

        [Fact]
        public async Task Board_NodesCarryLessonInfoAndRealMaxXp()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());
            var board = await GetBoardAsync(client);

            Assert.Equal(Path.Nodes.Count, board.LessonCount);
            Assert.Equal(board.LessonCount, board.Nodes.Count);
            foreach (var node in board.Nodes)
            {
                var summary = Lessons.GetAll().Single(l => l.LessonId == node.LessonId);
                Assert.Equal(summary.Name, node.Name);
                var expectedXp = summary.ContentCount * ILearningResultService.XpPerContent
                    + (summary.QuestionCount > 0
                        ? summary.QuestionCount * ILearningResultService.XpPerCorrectAnswer
                        : ILearningResultService.XpLessonCompleted);
                Assert.Equal(expectedXp, node.MaxXp);
            }

            var branchNode = board.Nodes.Single(n => n.LessonId == "ordinal-numbers");
            Assert.True(branchNode.IsBranch);
            Assert.Equal("ordinal-numbers-and-time", branchNode.BranchId);
        }

        [Fact]
        public async Task Paths_ListsPathWithProgressCounts()
        {
            var userId = await _factory.CreateUserAsync();
            await _factory.SetLessonStatusAsync(userId, MainLessons[0].LessonId, UserLessonProgress.StatusCompleted);

            var paths = await _factory.CreateClientFor(userId).GetFromJsonAsync<List<LearningPathSummaryDto>>("/api/learning-paths", Json);

            var path = Assert.Single(paths!);
            Assert.Equal(PathId, path.Id);
            Assert.Equal(Path.Nodes.Count, path.LessonCount);
            Assert.Equal(1, path.CompletedCount);
            Assert.Equal(MainLessons[1].LessonId, path.CurrentLessonId);
        }

        [Fact]
        public async Task Board_UnknownPath_Returns404_AndInactiveProfile_Returns403()
        {
            var active = _factory.CreateClientFor(await _factory.CreateUserAsync());
            var blocked = _factory.CreateClientFor(await _factory.CreateUserAsync("blocked"));

            Assert.Equal(HttpStatusCode.NotFound, (await active.GetAsync("/api/learning-paths/no-such-path/board")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await blocked.GetAsync($"/api/learning-paths/{PathId}/board")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await blocked.GetAsync("/api/learning-paths")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await blocked.GetAsync("/api/lessons/recommendations")).StatusCode);
        }

        [Fact]
        public async Task LearningPathEndpoints_RequireLogin()
        {
            var anonymous = _factory.CreateClientFor(null);

            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/learning-paths")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/learning-paths/{PathId}/board")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/lessons/recommendations")).StatusCode);
        }

        // ── Gợi ý bài học ───────────────────────────────────────────

        [Fact]
        public async Task Recommendations_NewUser_StartsWithFirstPathLesson_AndNeverLockedOrCompleted()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var recommendations = await GetRecommendationsAsync(client, "?limit=10");

            Assert.Equal(MainLessons[0].LessonId, recommendations[0].Lesson.LessonId);
            Assert.Equal(RecommendationReasons.NextInPath, recommendations[0].Reason);
            Assert.Equal(PathId, recommendations[0].LearningPathId);
            Assert.Contains(recommendations, r => r.Reason == RecommendationReasons.OutsidePath && r.LearningPathId is null);
            Assert.Equal(recommendations.Count, recommendations.Select(r => r.Lesson.LessonId).Distinct().Count());
            foreach (var recommendation in recommendations)
            {
                Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/lessons/{recommendation.Lesson.LessonId}")).StatusCode);
            }
        }

        [Fact]
        public async Task Recommendations_InProgressFirst_CompletedExcluded_DefaultLimitThree()
        {
            var main = MainLessons;
            var userId = await _factory.CreateUserAsync();
            await _factory.SetLessonStatusAsync(userId, main[0].LessonId, UserLessonProgress.StatusCompleted);
            await _factory.SetLessonStatusAsync(userId, "present-simple-tense", UserLessonProgress.StatusInProgress);
            var client = _factory.CreateClientFor(userId);

            var recommendations = await GetRecommendationsAsync(client);

            Assert.Equal(3, recommendations.Count);
            Assert.Equal("present-simple-tense", recommendations[0].Lesson.LessonId);
            Assert.Equal(RecommendationReasons.Continue, recommendations[0].Reason);
            Assert.Equal(LessonProgressStatuses.InProgress, recommendations[0].ProgressStatus);
            Assert.Equal(main[1].LessonId, recommendations[1].Lesson.LessonId);
            Assert.DoesNotContain(recommendations, r => r.Lesson.LessonId == main[0].LessonId);
        }

        [Fact]
        public async Task Recommendations_OutsidePathScope_OnlyStandaloneLessons()
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            var recommendations = await GetRecommendationsAsync(client, "?scope=outside_path&limit=20");

            Assert.NotEmpty(recommendations);
            Assert.All(recommendations, r =>
            {
                Assert.Null(r.LearningPathId);
                Assert.Null(Lessons.GetLearningPathId(r.Lesson.LessonId));
                Assert.Equal(RecommendationReasons.OutsidePath, r.Reason);
            });
        }

        [Theory]
        [InlineData("?limit=0")]
        [InlineData("?limit=21")]
        [InlineData("?scope=everything")]
        public async Task Recommendations_InvalidQuery_Returns400(string query)
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/lessons/recommendations{query}")).StatusCode);
        }
    }
}
