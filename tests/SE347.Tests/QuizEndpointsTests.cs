using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SE347.DTOs.Quiz;
using SE347.Models;

namespace SE347.Tests
{
    /// <summary>
    /// S3-07: GET /api/quizzes, /api/quizzes/{idOrSlug}, /api/quizzes/{idOrSlug}/ranking.
    /// Các test dùng chung 1 DB InMemory nên mỗi test gắn một tag riêng vào tiêu đề đề thi
    /// và lọc danh sách bằng q = tag để không thấy dữ liệu của test khác.
    /// </summary>
    public class QuizEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private static readonly DateTimeOffset BaseTime = new(2026, 11, 1, 8, 0, 0, TimeSpan.Zero);

        private readonly LessonApiFactory _factory;

        public QuizEndpointsTests(LessonApiFactory factory)
        {
            _factory = factory;
        }

        private static string NewTag() => $"tag{Guid.NewGuid():N}"[..12];

        private async Task<Quiz> AddQuizAsync(string title, Guid? creatorId = null, string visibility = Quiz.VisibilityPublic,
            bool published = true, string scope = Quiz.ScopeStandalone, string? slug = null, string? category = null,
            string? level = null, string? topic = null, string description = "", DateTimeOffset? createdAt = null,
            int questionCount = 0, short passScore = 60)
        {
            var quiz = new Quiz
            {
                Id = Guid.NewGuid(),
                Title = title,
                Description = description,
                QuizScope = scope,
                LessonId = scope == Quiz.ScopeLesson ? "lesson-x" : null,
                CreatorId = scope == Quiz.ScopeLesson ? null : creatorId,
                Visibility = visibility,
                IsPublished = published,
                Slug = slug,
                Category = category,
                CefrLevel = level,
                Topic = topic,
                PassScore = passScore,
                CreatedAt = createdAt ?? BaseTime,
                UpdatedAt = createdAt ?? BaseTime,
            };

            await _factory.WithDbAsync(db =>
            {
                db.Quizzes.Add(quiz);
                for (var i = 1; i <= questionCount; i++)
                {
                    var question = new Question
                    {
                        Id = Guid.NewGuid(),
                        QuestionType = Question.TypeSingleChoice,
                        Prompt = $"SECRET-PROMPT-{i}",
                        Options = "[\"a\",\"b\"]",
                        CorrectAnswers = "[\"SECRET-ANSWER\"]",
                        Explanation = "SECRET-EXPLANATION",
                    };
                    db.Questions.Add(question);
                    db.QuizQuestions.Add(new QuizQuestion
                    {
                        QuizId = quiz.Id,
                        QuestionId = question.Id,
                        QuestionNo = i,
                        QuestionKey = $"q{i}",
                    });
                }
            });

            return quiz;
        }

        private async Task<long> AddAttemptAsync(Guid userId, Guid quizId, string status = UserQuizAttempt.StatusSubmitted,
            short score = 0, int? duration = 60, DateTimeOffset? submittedAt = null, DateTimeOffset? expiresAt = null)
        {
            var attempt = new UserQuizAttempt
            {
                UserId = userId,
                QuizId = quizId,
                AttemptType = UserQuizAttempt.TypeStandaloneQuiz,
                Status = status,
                Score = score,
                CorrectCount = (short)(score / 10),
                TotalCount = 10,
                StartedAt = BaseTime,
                ExpiresAt = expiresAt,
                SubmittedAt = status == UserQuizAttempt.StatusSubmitted ? submittedAt ?? BaseTime.AddMinutes(5) : null,
                DurationSeconds = status == UserQuizAttempt.StatusSubmitted ? duration : null,
            };
            await _factory.WithDbAsync(db => db.UserQuizAttempts.Add(attempt));
            return attempt.Id;
        }

        private static async Task<PagedResultDto<QuizListItemDto>> ListAsync(HttpClient client, string query)
        {
            var response = await client.GetAsync($"/api/quizzes?{query}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<PagedResultDto<QuizListItemDto>>(Json))!;
        }

        // ── Quyền truy cập ──────────────────────────────────────────

        [Theory]
        [InlineData("/api/quizzes")]
        [InlineData("/api/quizzes/some-quiz")]
        [InlineData("/api/quizzes/some-quiz/ranking")]
        public async Task Endpoints_RequireLogin(string url)
        {
            var response = await _factory.CreateClientFor(null).GetAsync(url);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Endpoints_InactiveProfile_Returns403()
        {
            var quiz = await AddQuizAsync(NewTag());
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync("suspended"));

            foreach (var url in new[] { "/api/quizzes", $"/api/quizzes/{quiz.Id}", $"/api/quizzes/{quiz.Id}/ranking" })
            {
                var response = await client.GetAsync(url);
                Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
                Assert.Contains("profile_inactive", await response.Content.ReadAsStringAsync());
            }
        }

        [Theory]
        [InlineData("scope=everything")]
        [InlineData("status=done")]
        [InlineData("category=math")]
        [InlineData("level=Z9")]
        [InlineData("page=0")]
        [InlineData("pageSize=0")]
        [InlineData("pageSize=51")]
        public async Task List_InvalidQuery_Returns400(string query)
        {
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());
            var response = await client.GetAsync($"/api/quizzes?{query}");
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        // ── GET /api/quizzes ────────────────────────────────────────

        [Fact]
        public async Task List_OnlyStandaloneQuizzesTheUserMaySee()
        {
            var tag = NewTag();
            var me = await _factory.CreateUserAsync();
            var other = await _factory.CreateUserAsync();

            await AddQuizAsync($"{tag} system");
            await AddQuizAsync($"{tag} community", other);
            await AddQuizAsync($"{tag} mine-private", me, Quiz.VisibilityPrivate);
            await AddQuizAsync($"{tag} mine-draft", me, published: false);
            await AddQuizAsync($"{tag} other-unlisted", other, Quiz.VisibilityUnlisted);
            await AddQuizAsync($"{tag} other-private", other, Quiz.VisibilityPrivate);
            await AddQuizAsync($"{tag} other-draft", other, published: false);
            await AddQuizAsync($"{tag} lesson", scope: Quiz.ScopeLesson);

            var page = await ListAsync(_factory.CreateClientFor(me), $"q={tag}");

            Assert.Equal(
                new[] { "community", "mine-draft", "mine-private", "system" },
                page.Items.Select(i => i.Title[(tag.Length + 1)..]).Order());
            Assert.Equal(4, page.Total);

            var sources = page.Items.ToDictionary(i => i.Title[(tag.Length + 1)..], i => i.Source);
            Assert.Equal(QuizSources.System, sources["system"]);
            Assert.Equal(QuizSources.Community, sources["community"]);
            Assert.Equal(QuizSources.Mine, sources["mine-private"]);
        }

        [Theory]
        [InlineData(QuizListScopes.System, new[] { "system" })]
        [InlineData(QuizListScopes.Public, new[] { "community" })]
        [InlineData(QuizListScopes.Mine, new[] { "mine-private", "mine-public" })]
        [InlineData(QuizListScopes.All, new[] { "community", "mine-private", "mine-public", "system" })]
        public async Task List_FiltersByScope(string scope, string[] expected)
        {
            var tag = NewTag();
            var me = await _factory.CreateUserAsync();
            var other = await _factory.CreateUserAsync();

            await AddQuizAsync($"{tag} system");
            await AddQuizAsync($"{tag} community", other);
            await AddQuizAsync($"{tag} mine-public", me);
            await AddQuizAsync($"{tag} mine-private", me, Quiz.VisibilityPrivate);

            var page = await ListAsync(_factory.CreateClientFor(me), $"q={tag}&scope={scope}");

            Assert.Equal(expected, page.Items.Select(i => i.Title[(tag.Length + 1)..]).Order());
        }

        [Fact]
        public async Task List_SearchesTitleDescriptionTopic_AndFiltersCategoryLevel()
        {
            var tag = NewTag();
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            await AddQuizAsync($"Daily {tag.ToUpperInvariant()} title", category: "grammar", level: "A1");
            await AddQuizAsync("Other", description: $"about {tag} here", category: "vocabulary", level: "A1");
            await AddQuizAsync("Third", topic: $"topic-{tag}", category: "grammar", level: "B1");
            await AddQuizAsync("Unrelated", category: "grammar", level: "A1");

            Assert.Equal(3, (await ListAsync(client, $"q={tag}")).Total);
            Assert.Equal(["Third"], (await ListAsync(client, $"q={tag}&level=b1")).Items.Select(i => i.Title));
            Assert.Equal(["Other"], (await ListAsync(client, $"q={tag}&category=Vocabulary")).Items.Select(i => i.Title));
            Assert.Single((await ListAsync(client, $"q={tag}&category=grammar&level=A1")).Items);
        }

        [Fact]
        public async Task List_PagesNewestFirst()
        {
            var tag = NewTag();
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());
            for (var i = 1; i <= 5; i++)
            {
                await AddQuizAsync($"{tag} {i}", createdAt: BaseTime.AddDays(i));
            }

            var page = await ListAsync(client, $"q={tag}&page=2&pageSize=2");

            Assert.Equal(5, page.Total);
            Assert.Equal(2, page.Page);
            Assert.Equal(2, page.PageSize);
            Assert.Equal([$"{tag} 3", $"{tag} 2"], page.Items.Select(i => i.Title));
        }

        [Fact]
        public async Task List_ReturnsMyLatestStatusAndBestScore_AndFiltersByStatus()
        {
            var tag = NewTag();
            var me = await _factory.CreateUserAsync();
            var other = await _factory.CreateUserAsync();
            var client = _factory.CreateClientFor(me);

            var fresh = await AddQuizAsync($"{tag} fresh", questionCount: 2);
            var done = await AddQuizAsync($"{tag} done");
            var doing = await AddQuizAsync($"{tag} doing");

            await AddAttemptAsync(me, done.Id, score: 70);
            await AddAttemptAsync(me, done.Id, score: 90);
            await AddAttemptAsync(me, doing.Id, score: 50);
            await AddAttemptAsync(me, doing.Id, UserQuizAttempt.StatusInProgress);
            await AddAttemptAsync(other, fresh.Id, score: 100);

            var items = (await ListAsync(client, $"q={tag}")).Items.ToDictionary(i => i.Id);

            Assert.Equal(QuizAttemptStates.None, items[fresh.Id].MyStatus);
            Assert.Null(items[fresh.Id].MyBestScore);
            Assert.Equal(2, items[fresh.Id].QuestionCount);
            Assert.Equal(QuizAttemptStates.Submitted, items[done.Id].MyStatus);
            Assert.Equal(90, items[done.Id].MyBestScore);
            Assert.Equal(QuizAttemptStates.InProgress, items[doing.Id].MyStatus);
            Assert.Equal(50, items[doing.Id].MyBestScore);

            Assert.Equal([fresh.Id], (await ListAsync(client, $"q={tag}&status=none")).Items.Select(i => i.Id));
            Assert.Equal([done.Id], (await ListAsync(client, $"q={tag}&status=submitted")).Items.Select(i => i.Id));
            Assert.Equal([doing.Id], (await ListAsync(client, $"q={tag}&status=in_progress")).Items.Select(i => i.Id));
        }

        // ── GET /api/quizzes/{idOrSlug} ─────────────────────────────

        [Fact]
        public async Task Detail_FindsByIdOrSlug_WithoutQuestionsOrAnswers()
        {
            var tag = NewTag();
            var creator = await _factory.CreateUserAsync();
            var quiz = await AddQuizAsync($"{tag} detail", creator, slug: $"{tag}-detail", questionCount: 3);
            var client = _factory.CreateClientFor(await _factory.CreateUserAsync());

            foreach (var key in new[] { quiz.Id.ToString(), $"{tag}-detail", $"{tag}-DETAIL" })
            {
                var response = await client.GetAsync($"/api/quizzes/{key}");
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);

                var raw = await response.Content.ReadAsStringAsync();
                Assert.DoesNotContain("SECRET", raw);
                using var json = JsonDocument.Parse(raw);
                Assert.False(json.RootElement.TryGetProperty("questions", out _));
                Assert.False(json.RootElement.TryGetProperty("correctAnswers", out _));

                var detail = JsonSerializer.Deserialize<QuizDetailDto>(raw, Json)!;
                Assert.Equal(quiz.Id, detail.Id);
                Assert.Equal(3, detail.QuestionCount);
                Assert.Equal(QuizSources.Community, detail.Source);
                Assert.Equal(creator, detail.Creator!.Id);
                Assert.False(detail.IsCreator);
            }
        }

        [Fact]
        public async Task Detail_RespectsVisibility()
        {
            var tag = NewTag();
            var me = await _factory.CreateUserAsync();
            var other = await _factory.CreateUserAsync();
            var client = _factory.CreateClientFor(me);

            var unlisted = await AddQuizAsync($"{tag} unlisted", other, Quiz.VisibilityUnlisted);
            var otherPrivate = await AddQuizAsync($"{tag} private", other, Quiz.VisibilityPrivate);
            var otherDraft = await AddQuizAsync($"{tag} draft", other, published: false);
            var minePrivateDraft = await AddQuizAsync($"{tag} mine", me, Quiz.VisibilityPrivate, published: false);
            var lessonQuiz = await AddQuizAsync($"{tag} lesson", scope: Quiz.ScopeLesson);

            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/quizzes/{unlisted.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/quizzes/{otherPrivate.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/quizzes/{otherDraft.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/quizzes/{lessonQuiz.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/quizzes/{otherPrivate.Id}/ranking")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/quizzes/no-such-quiz")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/quizzes/Not%20A%20Slug!")).StatusCode);

            var mine = await client.GetFromJsonAsync<QuizDetailDto>($"/api/quizzes/{minePrivateDraft.Id}", Json);
            Assert.True(mine!.IsCreator);
            Assert.Equal(QuizSources.Mine, mine.Source);
        }

        [Fact]
        public async Task Detail_ReturnsInProgressAttemptAndMySubmittedHistory()
        {
            var me = await _factory.CreateUserAsync();
            var other = await _factory.CreateUserAsync();
            var quiz = await AddQuizAsync(NewTag(), passScore: 80);

            var low = await AddAttemptAsync(me, quiz.Id, score: 60, submittedAt: BaseTime.AddDays(1));
            var high = await AddAttemptAsync(me, quiz.Id, score: 85, submittedAt: BaseTime.AddDays(2));
            var open = await AddAttemptAsync(me, quiz.Id, UserQuizAttempt.StatusInProgress, expiresAt: DateTimeOffset.UtcNow.AddMinutes(10));
            await AddAttemptAsync(me, quiz.Id, UserQuizAttempt.StatusAbandoned);
            await AddAttemptAsync(other, quiz.Id, score: 100);

            var detail = await _factory.CreateClientFor(me).GetFromJsonAsync<QuizDetailDto>($"/api/quizzes/{quiz.Id}", Json);

            Assert.Equal(open, detail!.InProgress!.AttemptId);
            Assert.InRange(detail.InProgress.RemainingSeconds!.Value, 590, 600);
            Assert.Equal([high, low], detail.AttemptsMe.Select(a => a.AttemptId));
            Assert.Equal([true, false], detail.AttemptsMe.Select(a => a.Passed));
        }

        [Fact]
        public async Task Detail_InProgressWithoutTimeLimit_HasNoRemainingSeconds_AndExpiredIsZero()
        {
            var me = await _factory.CreateUserAsync();
            var untimed = await AddQuizAsync(NewTag());
            var expired = await AddQuizAsync(NewTag());
            await AddAttemptAsync(me, untimed.Id, UserQuizAttempt.StatusInProgress);
            await AddAttemptAsync(me, expired.Id, UserQuizAttempt.StatusInProgress, expiresAt: DateTimeOffset.UtcNow.AddMinutes(-1));
            var client = _factory.CreateClientFor(me);

            var untimedDetail = await client.GetFromJsonAsync<QuizDetailDto>($"/api/quizzes/{untimed.Id}", Json);
            var expiredDetail = await client.GetFromJsonAsync<QuizDetailDto>($"/api/quizzes/{expired.Id}", Json);

            Assert.Null(untimedDetail!.InProgress!.RemainingSeconds);
            Assert.Equal(0, expiredDetail!.InProgress!.RemainingSeconds);
        }

        // ── GET /api/quizzes/{idOrSlug}/ranking ─────────────────────

        /// <summary>
        /// fast: 90đ/80s · early: 90đ/80s nộp sớm hơn · slow: 90đ/100s (lượt 80đ không tính) ·
        /// hidden: 100đ nhưng private · banned: 100đ nhưng suspended · drafting: chỉ có lượt in_progress.
        /// </summary>
        private async Task<(Quiz Quiz, Guid Early, Guid Fast, Guid Slow, Guid Hidden)> SeedRankingAsync()
        {
            var quiz = await AddQuizAsync(NewTag());
            var early = await _factory.CreateUserAsync(visibility: "public");
            var fast = await _factory.CreateUserAsync(visibility: "public");
            var slow = await _factory.CreateUserAsync(visibility: "public");
            var hidden = await _factory.CreateUserAsync();
            var banned = await _factory.CreateUserAsync("suspended", "public");
            var drafting = await _factory.CreateUserAsync(visibility: "public");

            await AddAttemptAsync(slow, quiz.Id, score: 80, duration: 30);
            await AddAttemptAsync(slow, quiz.Id, score: 90, duration: 100);
            await AddAttemptAsync(fast, quiz.Id, score: 90, duration: 80, submittedAt: BaseTime.AddHours(2));
            await AddAttemptAsync(early, quiz.Id, score: 90, duration: 80, submittedAt: BaseTime.AddHours(1));
            await AddAttemptAsync(hidden, quiz.Id, score: 100, duration: 10);
            await AddAttemptAsync(banned, quiz.Id, score: 100, duration: 10);
            await AddAttemptAsync(drafting, quiz.Id, UserQuizAttempt.StatusInProgress);

            return (quiz, early, fast, slow, hidden);
        }

        [Fact]
        public async Task Ranking_BestAttemptPerActivePublicUser_WithTieBreaks()
        {
            var (quiz, early, fast, slow, _) = await SeedRankingAsync();

            var ranking = await _factory.CreateClientFor(fast).GetFromJsonAsync<QuizRankingDto>($"/api/quizzes/{quiz.Id}/ranking", Json);

            Assert.Equal(3, ranking!.TotalParticipants);
            Assert.Equal([early, fast, slow], ranking.Items.Select(i => i.UserId));
            Assert.Equal([1, 2, 3], ranking.Items.Select(i => i.Rank));
            Assert.Equal(100, ranking.Items[2].DurationSeconds);
            Assert.Equal(2, ranking.CurrentUser.Rank);
            Assert.True(ranking.CurrentUser.IsPublic);
        }

        [Fact]
        public async Task Ranking_PrivateCurrentUser_GetsBestScoreButNoRank()
        {
            var (quiz, _, _, _, hidden) = await SeedRankingAsync();

            var ranking = await _factory.CreateClientFor(hidden).GetFromJsonAsync<QuizRankingDto>($"/api/quizzes/{quiz.Id}/ranking", Json);

            Assert.DoesNotContain(ranking!.Items, i => i.UserId == hidden);
            Assert.Null(ranking.CurrentUser.Rank);
            Assert.Equal(100, ranking.CurrentUser.BestScore);
            Assert.False(ranking.CurrentUser.IsPublic);
        }

        [Fact]
        public async Task Ranking_LimitCutsListButKeepsCurrentUserRank()
        {
            var (quiz, _, _, slow, _) = await SeedRankingAsync();
            var client = _factory.CreateClientFor(slow);

            var ranking = await client.GetFromJsonAsync<QuizRankingDto>($"/api/quizzes/{quiz.Id}/ranking?limit=1", Json);

            Assert.Single(ranking!.Items);
            Assert.Equal(3, ranking.TotalParticipants);
            Assert.Equal(3, ranking.CurrentUser.Rank);

            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/quizzes/{quiz.Id}/ranking?limit=0")).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/quizzes/{quiz.Id}/ranking?limit=101")).StatusCode);
        }

        [Fact]
        public async Task Ranking_UserWithoutAttempts_HasEmptyCurrentUser()
        {
            var (quiz, _, _, _, _) = await SeedRankingAsync();
            var newcomer = await _factory.CreateUserAsync(visibility: "public");

            var ranking = await _factory.CreateClientFor(newcomer).GetFromJsonAsync<QuizRankingDto>($"/api/quizzes/{quiz.Id}/ranking", Json);

            Assert.Null(ranking!.CurrentUser.Rank);
            Assert.Null(ranking.CurrentUser.BestScore);
            Assert.True(ranking.CurrentUser.IsPublic);
        }

        [Fact]
        public async Task Detail_IncludesTop3Ranking()
        {
            var (quiz, early, fast, slow, _) = await SeedRankingAsync();
            var extra = await _factory.CreateUserAsync(visibility: "public");
            await AddAttemptAsync(extra, quiz.Id, score: 10);

            var detail = await _factory.CreateClientFor(extra).GetFromJsonAsync<QuizDetailDto>($"/api/quizzes/{quiz.Id}", Json);

            Assert.Equal([early, fast, slow], detail!.Ranking.Items.Select(i => i.UserId));
            Assert.Equal(4, detail.Ranking.TotalParticipants);
            Assert.Equal(4, detail.Ranking.CurrentUser.Rank);
        }
    }
}
