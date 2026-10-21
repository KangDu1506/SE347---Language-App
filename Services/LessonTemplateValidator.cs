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
    /// Kiểm tra toàn bộ bài học trong Storage/LessonTemplate theo 3 file schema trong schemas/,
    /// sau đó kiểm tra các luật schema không diễn tả được (id trùng, đáp án nằm ngoài options,
    /// số &lt;blank&gt; khác số đáp án, file audio/ảnh không tồn tại...).
    /// Chạy: <c>dotnet run -- validate-lessons</c>.
    /// </summary>
    public class LessonTemplateValidator
    {
        public const string SchemasFolder = "schemas";
        public const string ConfigFile = "config.json";

        private static readonly JsonSerializerOptions ReadOptions = new() { AllowTrailingCommas = false };

        private readonly string _root;
        private readonly JsonSchema _configSchema;
        private readonly JsonSchema _contentSchema;
        private readonly JsonSchema _quizSchema;

        public LessonTemplateValidator(string lessonTemplateRoot)
        {
            _root = Path.GetFullPath(lessonTemplateRoot);
            var schemas = Path.Combine(_root, SchemasFolder);
            _configSchema = JsonSchema.FromFile(Path.Combine(schemas, "LessonConfig.schema.json"));
            _contentSchema = JsonSchema.FromFile(Path.Combine(schemas, "LessonContent.schema.json"));
            _quizSchema = JsonSchema.FromFile(Path.Combine(schemas, "LessonQuiz.schema.json"));
        }

        /// <summary>Tên các folder bài học (trừ schemas/), sắp theo tên.</summary>
        public IEnumerable<string> LessonFolders() =>
            Directory.EnumerateDirectories(_root)
                .Select(Path.GetFileName)
                .OfType<string>()
                .Where(name => name != SchemasFolder)
                .Order(StringComparer.Ordinal);

        public IReadOnlyList<LessonValidationError> ValidateAll() =>
            LessonFolders().SelectMany(ValidateLesson).ToList();

        public IReadOnlyList<LessonValidationError> ValidateLesson(string lessonId)
        {
            var errors = new List<LessonValidationError>();
            var folder = Path.Combine(_root, lessonId);

            if (!LessonIds.IsValid(lessonId))
            {
                errors.Add(new(lessonId, "", "Tên folder phải là slug kebab-case (chỉ a-z, 0-9 và \"-\"), vd \"present-simple-tense\"."));
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
                CheckUniqueIds(lessonId, contentFile!, content.Select(c => c.Id).ToList(), errors);
                for (var i = 0; i < content.Count; i++)
                {
                    CheckAsset(folder, contentFile!, $"/{i}/image", content[i].Image, errors);
                    CheckAsset(folder, contentFile!, $"/{i}/audio", content[i].Audio, errors);
                }

                if (config.Category == LessonCategories.Listening && content.Any(c => c.Audio is null))
                {
                    errors.Add(new(Rel(lessonId, contentFile!), "", "Bài listening: mọi mục nội dung phải có \"audio\"."));
                }
            }

            if (config.Quiz is not null)
            {
                var quizFile = ResolveInside(folder, ConfigFile, "/quiz", config.Quiz, errors);
                var quiz = quizFile is null ? null : Load<List<LessonQuizQuestionDto>>(folder, quizFile, _quizSchema, errors);
                if (quiz is not null)
                {
                    CheckUniqueIds(lessonId, quizFile!, quiz.Select(q => q.Id).ToList(), errors);
                    for (var i = 0; i < quiz.Count; i++)
                    {
                        CheckQuestion(lessonId, quizFile!, i, quiz[i], errors);
                        CheckAsset(folder, quizFile!, $"/{i}/audio", quiz[i].Audio, errors);
                    }
                }
            }

            return errors;
        }

        /// <summary>Đọc file, kiểm tra cú pháp JSON + schema; trả null nếu file sai (lỗi đã ghi vào errors).</summary>
        private T? Load<T>(string folder, string relativePath, JsonSchema schema, List<LessonValidationError> errors) where T : class
        {
            var lessonId = Path.GetFileName(folder);
            var file = Rel(lessonId, relativePath);
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

        private static void CheckQuestion(string lessonId, string quizFile, int index, LessonQuizQuestionDto q, List<LessonValidationError> errors)
        {
            var file = Rel(lessonId, quizFile);

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

        private static void CheckUniqueIds(string lessonId, string relativePath, List<string> ids, List<LessonValidationError> errors)
        {
            for (var i = 0; i < ids.Count; i++)
            {
                if (ids.IndexOf(ids[i]) != i)
                {
                    errors.Add(new(Rel(lessonId, relativePath), $"/{i}/id", $"id \"{ids[i]}\" bị trùng."));
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
                errors.Add(new(Rel(Path.GetFileName(folder), relativePath), field, $"Không tìm thấy file \"{assetPath}\"."));
            }
        }

        /// <summary>Đường dẫn tương đối phải nằm trong folder bài học (chặn "./../").</summary>
        private static string? ResolveInside(string folder, string relativePath, string field, string path, List<LessonValidationError> errors)
        {
            var full = Path.GetFullPath(Path.Combine(folder, path));
            if (!full.StartsWith(folder + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            {
                errors.Add(new(Rel(Path.GetFileName(folder), relativePath), field, $"\"{path}\" nằm ngoài folder bài học."));
                return null;
            }

            return Path.GetRelativePath(folder, full);
        }

        private static string Rel(string lessonId, string relativePath) =>
            $"{lessonId}/{relativePath.Replace('\\', '/')}";
    }
}
