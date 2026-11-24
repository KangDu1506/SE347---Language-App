using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using SE347.Data;
using SE347.Models;

namespace SE347.Tests
{
    /// <summary>
    /// S3-01: entity quiz / attempt map đúng bảng và cột do supabase/migrations tạo,
    /// và lưu/đọc được qua EF (InMemory).
    /// </summary>
    public class QuizEntityMappingTests
    {
        private static readonly string RepoRoot = FindRepoRoot();

        /// <summary>Toàn bộ SQL trong supabase/migrations (EF không tạo bảng, chỉ map vào bảng có sẵn).</summary>
        private static readonly string MigrationsSql = string.Join("\n",
            Directory.GetFiles(Path.Combine(RepoRoot, "supabase", "migrations"), "*.sql")
                .OrderBy(f => f, StringComparer.Ordinal)
                .Select(File.ReadAllText));

        private static string FindRepoRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "SE347.csproj")))
            {
                dir = dir.Parent;
            }

            return dir?.FullName ?? throw new InvalidOperationException("Không tìm thấy thư mục chứa SE347.csproj.");
        }

        /// <summary>Model relational thật (Npgsql) để đọc tên bảng/cột; không mở kết nối DB.</summary>
        private static IModel RelationalModel()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql("Host=unused;Database=unused")
                .Options;
            using var db = new ApplicationDbContext(options);
            // Design-time model giữ đủ annotation (ExcludeFromMigrations, default SQL...)
            return db.GetService<IDesignTimeModel>().Model;
        }

        [Fact]
        public void EveryMappedColumn_ExistsInSupabaseMigrations()
        {
            var missing = new List<string>();

            foreach (var entity in RelationalModel().GetEntityTypes())
            {
                var table = entity.GetTableName()!;
                if (!Regex.IsMatch(MigrationsSql, $@"create table public\.{Regex.Escape(table)}\b", RegexOptions.IgnoreCase))
                {
                    missing.Add($"bảng {table}");
                    continue;
                }

                var store = StoreObjectIdentifier.Table(table, entity.GetSchema());
                foreach (var property in entity.GetProperties())
                {
                    var column = property.GetColumnName(store)!;
                    if (!Regex.IsMatch(MigrationsSql, $@"\b{Regex.Escape(column)}\b", RegexOptions.IgnoreCase))
                    {
                        missing.Add($"{table}.{column} ({entity.ClrType.Name}.{property.Name})");
                    }
                }
            }

            Assert.Empty(missing);
        }

        [Theory]
        [InlineData(typeof(Quiz), "quizzes")]
        [InlineData(typeof(Question), "questions")]
        [InlineData(typeof(QuizQuestion), "quiz_questions")]
        [InlineData(typeof(UserQuizAttemptAnswer), "user_quiz_attempt_answers")]
        [InlineData(typeof(UserQuizAttempt), "user_quiz_attempts")]
        public void QuizEntities_MapToSupabaseTables_ExcludedFromEfMigrations(Type clrType, string table)
        {
            var entity = RelationalModel().FindEntityType(clrType)!;

            Assert.Equal(table, entity.GetTableName());
            Assert.True(entity.IsTableExcludedFromMigrations());
        }

        [Theory]
        [InlineData(typeof(UserQuizAttempt), nameof(UserQuizAttempt.QuestionOrder))]
        [InlineData(typeof(UserQuizAttemptAnswer), nameof(UserQuizAttemptAnswer.UserAnswer))]
        [InlineData(typeof(UserQuizAttemptAnswer), nameof(UserQuizAttemptAnswer.QuestionSnapshot))]
        [InlineData(typeof(Question), nameof(Question.Options))]
        [InlineData(typeof(Question), nameof(Question.CorrectAnswers))]
        public void JsonColumns_UseJsonb(Type clrType, string property)
        {
            Assert.Equal("jsonb", RelationalModel().FindEntityType(clrType)!.FindProperty(property)!.GetColumnType());
        }

        [Fact]
        public void InProgressAttempt_SubmittedAtHasNoEfDefault()
        {
            // Nếu EF có default cho submitted_at, gán null sẽ bị bỏ qua và DB tự điền now() cho lượt đang làm.
            var property = RelationalModel().FindEntityType(typeof(UserQuizAttempt))!.FindProperty(nameof(UserQuizAttempt.SubmittedAt))!;

            Assert.True(property.IsNullable);
            Assert.Null(property.GetDefaultValueSql());
        }

        [Fact]
        public async Task StandaloneQuizAndAttempt_RoundTripThroughDbContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase($"quiz-mapping-{Guid.NewGuid()}")
                .Options;
            var userId = Guid.NewGuid();
            var quizId = Guid.NewGuid();
            var questionId = Guid.NewGuid();
            var startedAt = DateTimeOffset.UtcNow;

            await using (var db = new ApplicationDbContext(options))
            {
                var quiz = new Quiz { Id = quizId, Slug = "demo-quiz", Title = "Demo", CreatorId = userId, TimeLimitSeconds = 600 };
                quiz.Questions.Add(new QuizQuestion
                {
                    QuestionNo = 1,
                    QuestionKey = "q1",
                    Question = new Question
                    {
                        Id = questionId,
                        QuestionType = Question.TypeSingleChoice,
                        Prompt = "I ___ a student.",
                        Options = """["am","is"]""",
                        CorrectAnswers = """["am"]""",
                    },
                });
                db.Quizzes.Add(quiz);

                var attempt = new UserQuizAttempt
                {
                    UserId = userId,
                    QuizId = quizId,
                    AttemptType = UserQuizAttempt.TypeStandaloneQuiz,
                    Status = UserQuizAttempt.StatusInProgress,
                    TotalCount = 1,
                    StartedAt = startedAt,
                    ExpiresAt = startedAt.AddSeconds(600),
                    SubmittedAt = null,
                    QuestionOrder = """["q1"]""",
                };
                attempt.Answers.Add(new UserQuizAttemptAnswer { QuestionId = questionId, QuestionKey = "q1", UserAnswer = """["am"]""", IsCorrect = true });
                db.UserQuizAttempts.Add(attempt);

                await db.SaveChangesAsync();
            }

            await using (var db = new ApplicationDbContext(options))
            {
                var quiz = await db.Quizzes.Include(q => q.Questions).ThenInclude(qq => qq.Question).SingleAsync(q => q.Id == quizId);
                var link = Assert.Single(quiz.Questions);
                Assert.Equal("q1", link.QuestionKey);
                Assert.Equal("""["am"]""", link.Question.CorrectAnswers);
                Assert.Equal(Quiz.ScopeStandalone, quiz.QuizScope);
                Assert.True(quiz.AllowRetake);

                var attempt = await db.UserQuizAttempts.Include(a => a.Answers).SingleAsync(a => a.QuizId == quizId);
                Assert.Null(attempt.LessonId);
                Assert.Null(attempt.SubmittedAt);
                Assert.Equal(UserQuizAttempt.StatusInProgress, attempt.Status);
                Assert.Equal(startedAt.AddSeconds(600), attempt.ExpiresAt);
                var answer = Assert.Single(attempt.Answers);
                Assert.True(answer.IsCorrect);
                Assert.Equal("""["am"]""", answer.UserAnswer);
            }
        }
    }
}
