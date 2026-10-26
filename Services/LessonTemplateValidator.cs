using System.Text.Json;
using System.Text.RegularExpressions;
using Json.Schema;
using SE347.DTOs.Lesson;

namespace SE347.Services
{
    /// <summary>
    /// Một lỗi dữ liệu bài học. File tương đối với Storage/LessonTemplate (vd "present-simple-tense/quiz.json"),
    /// Field là JSON Pointer tới trường sai (vd "/2/answer"; "" là cả file).
    /// </summary>
    public record LessonValidationError(string File, string Field, string Message)
    {
        public override string ToString() =>
            string.IsNullOrEmpty(Field) ? $"{File}: {Message}" : $"{File} → {Field}: {Message}";
    }

    /// <summary>
    /// Kiểm tra toàn bộ bài học và lộ trình trong Storage/LessonTemplate theo các file schema trong schemas/,
    /// sau đó kiểm tra các luật schema không diễn tả được (id trùng, đáp án nằm ngoài options,
    /// số &lt;blank&gt; khác số đáp án, file audio/ảnh không tồn tại, LessonId trùng giữa các lộ trình,
    /// bài trong LearningPath.json không có folder...). Cách sắp folder: <see cref="LessonTemplateLayout"/>.
    /// Chạy: <c>dotnet run -- validate-lessons</c>.
    /// </summary>
    public class LessonTemplateValidator
    {
        public const string SchemasFolder = LessonTemplateLayout.SchemasFolder;
        public const string ConfigFile = LessonTemplateLayout.ConfigFile;

        private static readonly JsonSerializerOptions ReadOptions = new() { AllowTrailingCommas = false };

        private readonly string _root;
        private readonly JsonSchema _configSchema;
        private readonly JsonSchema _contentSchema;
        private readonly JsonSchema _quizSchema;
        private readonly JsonSchema _learningPathSchema;

        public LessonTemplateValidator(string lessonTemplateRoot)
        {
            _root = Path.GetFullPath(lessonTemplateRoot);
            var schemas = Path.Combine(_root, SchemasFolder);
            _configSchema = JsonSchema.FromFile(Path.Combine(schemas, "LessonConfig.schema.json"));
            _contentSchema = JsonSchema.FromFile(Path.Combine(schemas, "LessonContent.schema.json"));
            _quizSchema = JsonSchema.FromFile(Path.Combine(schemas, "QuizContent.schema.json"));
            _learningPathSchema = JsonSchema.FromFile(Path.Combine(schemas, "LearningPath.schema.json"));
        }

        /// <summary>Folder bài học tương đối với LessonTemplate (vd "ProgressiveLearning-A/simple-greetings-1"), sắp theo tên.</summary>
        public IEnumerable<string> LessonFolders() => LessonTemplateLayout.LessonFolders(_root);

        /// <summary>Folder lộ trình (có LearningPath.json), sắp theo tên.</summary>
        public IEnumerable<string> LearningPathFolders() => LessonTemplateLayout.LearningPathFolders(_root);

        public IReadOnlyList<LessonValidationError> ValidateAll()
        {
            var lessonFolders = LessonFolders().ToList();
            var errors = lessonFolders.SelectMany(ValidateLesson).ToList();

            // Tiến độ chỉ lưu lesson_id nên LessonId phải duy nhất giữa bài lẻ và mọi lộ trình.
            foreach (var group in lessonFolders.GroupBy(Path.GetFileName).Where(g => g.Count() > 1))
            {
                errors.Add(new(group.Key!, "", $"LessonId bị trùng ở các folder: {string.Join(", ", group)}."));
            }

            var pathIds = new Dictionary<string, string>();
            foreach (var pathFolder in LearningPathFolders())
            {
                var path = ValidateLearningPath(pathFolder, errors);
                if (path is not null && !pathIds.TryAdd(path.Id, pathFolder))
                {
                    errors.Add(new($"{pathFolder}/{LessonTemplateLayout.LearningPathFile}", "/id",
                        $"id lộ trình \"{path.Id}\" bị trùng với {pathIds[path.Id]}."));
                }
            }

            return errors;
        }

        /// <param name="lessonFolder">Folder bài học tương đối với LessonTemplate, xem <see cref="LessonFolders"/>.</param>
        public IReadOnlyList<LessonValidationError> ValidateLesson(string lessonFolder)
        {
            var errors = new List<LessonValidationError>();
            var folder = Path.Combine(_root, lessonFolder);
            var lessonId = Path.GetFileName(lessonFolder);

            if (!LessonIds.IsValid(lessonId))
            {
                errors.Add(new(lessonFolder, "", "Tên folder phải là slug kebab-case (chỉ a-z, 0-9 và \"-\"), vd \"present-simple-tense\"."));
            }

            var config = Load<LessonConfigDto>(folder, ConfigFile, _configSchema, errors);
            if (config is null)
            {
                return errors;
            }

            CheckAsset(folder, ConfigFile, "/image", config.Image, errors);

            var contentFile = ResolveInside(folder, ConfigFile, "/content", config.Content, errors);
            var content = contentFile is null ? null : Load<LessonContentDto>(folder, contentFile, _contentSchema, errors);
            if (content is not null)
            {
                CheckUniqueIds(lessonFolder, contentFile!, content.Select(c => c.Id).ToList(), errors);
                for (var i = 0; i < content.Count; i++)
                {
                    CheckAsset(folder, contentFile!, $"/{i}/image", content[i].Image, errors);
                    CheckAsset(folder, contentFile!, $"/{i}/audio", content[i].Audio, errors);
                }

                if (config.Category == LessonCategories.Listening && content.Any(c => c.Audio is null))
                {
                    errors.Add(new(Rel(lessonFolder, contentFile!), "", "Bài listening: mọi mục nội dung phải có \"audio\"."));
                }
            }

            if (config.Quiz is not null)
            {
                var quizFile = ResolveInside(folder, ConfigFile, "/quiz", config.Quiz, errors);
                var quiz = quizFile is null ? null : Load<List<LessonQuizQuestionDto>>(folder, quizFile, _quizSchema, errors);
                if (quiz is not null)
                {
                    CheckUniqueIds(lessonFolder, quizFile!, quiz.Select(q => q.Id).ToList(), errors);
                    for (var i = 0; i < quiz.Count; i++)
                    {
                        CheckQuestion(lessonFolder, quizFile!, i, quiz[i], errors);
                        CheckAsset(folder, quizFile!, $"/{i}/audio", quiz[i].Audio, errors);
                    }
                }
            }

            return errors;
        }

        /// <summary>
        /// Kiểm tra LearningPath.json của một folder lộ trình: schema, mỗi bài khai báo có folder con tương ứng,
        /// mọi folder con đều được khai báo, itemId/lessonId/order không trùng, prerequisites/afterLessonId trỏ tới bài trong lộ trình.
        /// Trả null nếu file sai schema.
        /// </summary>
        private LearningPathDto? ValidateLearningPath(string pathFolder, List<LessonValidationError> errors)
        {
            var folder = Path.Combine(_root, pathFolder);
            var file = Rel(pathFolder, LessonTemplateLayout.LearningPathFile);
            var path = Load<LearningPathDto>(folder, LessonTemplateLayout.LearningPathFile, _learningPathSchema, errors);
            if (path is null)
            {
                return null;
            }

            var lists = path.Lessons.Select((lesson, i) => (Pointer: $"/lessons/{i}", Lesson: lesson))
                .Concat(path.Branches.SelectMany((branch, b) =>
                    branch.Lessons.Select((lesson, i) => (Pointer: $"/branches/{b}/lessons/{i}", Lesson: lesson))))
                .ToList();
            var lessonIds = lists.Select(x => x.Lesson.LessonId).ToHashSet();

            var itemIds = new HashSet<string>();
            foreach (var (pointer, itemId) in lists.Select(x => (x.Pointer, x.Lesson.ItemId))
                         .Concat(path.Branches.Select((branch, b) => ($"/branches/{b}", branch.ItemId))))
            {
                if (!itemIds.Add(itemId))
                {
                    errors.Add(new(file, $"{pointer}/itemId", $"itemId \"{itemId}\" bị trùng."));
                }
            }

            var declared = new HashSet<string>();
            foreach (var (pointer, lesson) in lists)
            {
                if (!declared.Add(lesson.LessonId))
                {
                    errors.Add(new(file, $"{pointer}/lessonId", $"Bài \"{lesson.LessonId}\" được khai báo nhiều lần."));
                }

                if (lesson.Folder != lesson.LessonId)
                {
                    errors.Add(new(file, $"{pointer}/folder", $"folder \"{lesson.Folder}\" phải trùng lessonId \"{lesson.LessonId}\"."));
                }
                else if (!File.Exists(Path.Combine(folder, lesson.Folder, ConfigFile)))
                {
                    errors.Add(new(file, $"{pointer}/folder", $"Không tìm thấy {pathFolder}/{lesson.Folder}/{ConfigFile}."));
                }

                for (var p = 0; p < lesson.Prerequisites.Count; p++)
                {
                    var prerequisite = lesson.Prerequisites[p];
                    if (prerequisite == lesson.LessonId || !lessonIds.Contains(prerequisite))
                    {
                        errors.Add(new(file, $"{pointer}/prerequisites/{p}",
                            $"prerequisite \"{prerequisite}\" không phải bài khác trong lộ trình."));
                    }
                }
            }

            CheckUniqueOrders(file, "/lessons", path.Lessons, errors);
            for (var b = 0; b < path.Branches.Count; b++)
            {
                var branch = path.Branches[b];
                CheckUniqueOrders(file, $"/branches/{b}/lessons", branch.Lessons, errors);
                if (branch.AfterLessonId is not null && path.Lessons.All(l => l.LessonId != branch.AfterLessonId))
                {
                    errors.Add(new(file, $"/branches/{b}/afterLessonId",
                        $"afterLessonId \"{branch.AfterLessonId}\" không phải bài chính của lộ trình."));
                }
            }

            foreach (var lessonFolder in Directory.EnumerateDirectories(folder).Select(Path.GetFileName).OfType<string>()
                         .Where(name => !declared.Contains(name)).Order(StringComparer.Ordinal))
            {
                errors.Add(new($"{pathFolder}/{lessonFolder}", "", $"Folder bài học không có trong {LessonTemplateLayout.LearningPathFile}."));
            }

            return path;
        }

        private static void CheckUniqueOrders(string file, string pointer, List<LearningPathLessonDto> lessons, List<LessonValidationError> errors)
        {
            for (var i = 0; i < lessons.Count; i++)
            {
                if (lessons.FindIndex(l => l.Order == lessons[i].Order) != i)
                {
                    errors.Add(new(file, $"{pointer}/{i}/order", $"order {lessons[i].Order} bị trùng."));
                }
            }
        }

        /// <summary>Đọc file, kiểm tra cú pháp JSON + schema; trả null nếu file sai (lỗi đã ghi vào errors).</summary>
        private T? Load<T>(string folder, string relativePath, JsonSchema schema, List<LessonValidationError> errors) where T : class
        {
            var file = Rel(Label(folder), relativePath);
            var fullPath = Path.Combine(folder, relativePath);

            if (!File.Exists(fullPath))
            {
                errors.Add(new(file, "", "Không tìm thấy file."));
                return null;
            }

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(File.ReadAllText(fullPath));
            }
            catch (JsonException ex)
            {
                errors.Add(new(file, "", $"JSON không hợp lệ (dòng {ex.LineNumber + 1}, cột {ex.BytePositionInLine + 1}): {ex.Message.Split(" LineNumber:")[0]}"));
                return null;
            }

            using (document)
            {
                var result = schema.Evaluate(document.RootElement, new EvaluationOptions
                {
                    OutputFormat = OutputFormat.List,
                    RequireFormatValidation = true,
                });

                if (!result.IsValid)
                {
                    errors.AddRange(SchemaErrors(file, result));
                    return null;
                }

                return document.RootElement.Deserialize<T>(ReadOptions);
            }
        }

        // Keyword chỉ gom lỗi của node con ("Some properties did not match..."), bỏ đi để khỏi lặp.
        private static readonly HashSet<string> AggregateKeywords = ["properties", "items", "allOf", "anyOf", "oneOf", "$ref", "then"];

        private static readonly Regex InsideIfOrNot = new("(^|/)(if|not)(/|$)", RegexOptions.Compiled);

        private static IEnumerable<LessonValidationError> SchemaErrors(string file, EvaluationResults result)
        {
            var nodes = (result.Details ?? []).Prepend(result);
            // Node nằm trong "if" / "not" fail là bình thường (điều kiện không khớp), không phải lỗi dữ liệu.
            return nodes
                .Where(node => node.Errors is { Count: > 0 })
                .Where(node => !InsideIfOrNot.IsMatch(node.EvaluationPath.ToString()))
                .SelectMany(node => node.Errors!
                    .Where(e => !AggregateKeywords.Contains(e.Key))
                    .Select(e => new LessonValidationError(file, node.InstanceLocation.ToString(), $"{e.Value} [{e.Key}]")))
                .Distinct();
        }

        private static void CheckQuestion(string lessonFolder, string quizFile, int index, LessonQuizQuestionDto q, List<LessonValidationError> errors)
        {
            var file = Rel(lessonFolder, quizFile);

            if (q.Type == LessonQuizQuestionType.FillInTheBlank)
            {
                var blanks = CountBlanks(q.Question);
                if (blanks != q.Answers.Count)
                {
                    errors.Add(new(file, $"/{index}/question",
                        $"Câu {q.Id}: có {blanks} chỗ {LessonQuizQuestionDto.BlankMarker} nhưng có {q.Answers.Count} đáp án."));
                }
            }

            if (q.Type is LessonQuizQuestionType.SingleChoice or LessonQuizQuestionType.MultipleChoice)
            {
                foreach (var answer in q.Answers.Where(a => !q.Options.Contains(a)))
                {
                    errors.Add(new(file, $"/{index}/answer", $"Câu {q.Id}: đáp án \"{answer}\" không có trong options."));
                }

                if (q.Answers.Distinct().Count() != q.Answers.Count)
                {
                    errors.Add(new(file, $"/{index}/answer", $"Câu {q.Id}: đáp án bị trùng."));
                }
            }
        }

        private static int CountBlanks(string question)
        {
            var count = 0;
            for (var at = question.IndexOf(LessonQuizQuestionDto.BlankMarker, StringComparison.Ordinal);
                 at >= 0;
                 at = question.IndexOf(LessonQuizQuestionDto.BlankMarker, at + 1, StringComparison.Ordinal))
            {
                count++;
            }

            return count;
        }

        private static void CheckUniqueIds(string lessonFolder, string relativePath, List<string> ids, List<LessonValidationError> errors)
        {
            for (var i = 0; i < ids.Count; i++)
            {
                if (ids.IndexOf(ids[i]) != i)
                {
                    errors.Add(new(Rel(lessonFolder, relativePath), $"/{i}/id", $"id \"{ids[i]}\" bị trùng."));
                }
            }
        }

        private void CheckAsset(string folder, string relativePath, string field, string? assetPath, List<LessonValidationError> errors)
        {
            if (assetPath is null)
            {
                return;
            }

            var resolved = ResolveInside(folder, relativePath, field, assetPath, errors);
            if (resolved is not null && !File.Exists(Path.Combine(folder, resolved)))
            {
                errors.Add(new(Rel(Label(folder), relativePath), field, $"Không tìm thấy file \"{assetPath}\"."));
            }
        }

        /// <summary>Đường dẫn tương đối phải nằm trong folder bài học (chặn "./../").</summary>
        private string? ResolveInside(string folder, string relativePath, string field, string path, List<LessonValidationError> errors)
        {
            var full = Path.GetFullPath(Path.Combine(folder, path));
            if (!full.StartsWith(folder + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            {
                errors.Add(new(Rel(Label(folder), relativePath), field, $"\"{path}\" nằm ngoài folder bài học."));
                return null;
            }

            return Path.GetRelativePath(folder, full);
        }

        /// <summary>Folder tương đối với LessonTemplate, dùng "/" (vd "ProgressiveLearning-A/time").</summary>
        private string Label(string folder) =>
            Path.GetRelativePath(_root, folder).Replace('\\', '/');

        private static string Rel(string folderLabel, string relativePath) =>
            $"{folderLabel}/{relativePath.Replace('\\', '/')}";
    }
}
