using System.Text.Json;
using SE347.DTOs.Lesson;

namespace SE347.Services
{
    /// <summary>
    /// Service Singleton đọc và cache toàn bộ bài học từ Storage/LessonTemplate lúc khởi động
    /// (bài lẻ và bài trong folder lộ trình, xem <see cref="LessonTemplateLayout"/>); sửa JSON thì phải restart app.
    /// Không trả dữ liệu hard-code và xử lý rõ ràng các trường hợp thiếu file, JSON lỗi.
    /// Đường dẫn image/audio/text trong JSON được đổi thành URL GET /api/lessons/{lessonId}/assets/...
    /// </summary>
    public class LessonService : ILessonService
    {
        private static readonly JsonSerializerOptions ReadOptions = new()
        {
            AllowTrailingCommas = false,
            PropertyNameCaseInsensitive = true
        };

        /// <summary>Đuôi file được phép tải qua API assets (khớp pattern trong schema), không bao giờ là .json.</summary>
        private static readonly HashSet<string> AssetExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".mp3", ".m4a", ".ogg", ".wav", ".webp", ".png", ".jpg", ".jpeg", ".svg", ".txt"
        };

        private readonly string _root;
        private readonly ILogger<LessonService> _logger;
        private readonly Dictionary<string, CachedLesson> _lessons = new(StringComparer.Ordinal);
        private readonly Dictionary<string, IReadOnlyList<string>> _prerequisites = new(StringComparer.Ordinal);

        public LessonService(IWebHostEnvironment environment, ILogger<LessonService> logger)
        {
            _logger = logger;
            _root = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "Storage", "LessonTemplate"));

            LoadAllLessons();
            LoadPrerequisites();
        }

        public IReadOnlyList<LessonSummaryDto> GetAll(string? category = null, string? level = null)
        {
            var query = _lessons.Values.Select(l => l.Summary);

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(s => s.Category.Equals(category.Trim(), StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(level))
            {
                query = query.Where(s => s.Level.Equals(level.Trim(), StringComparison.OrdinalIgnoreCase));
            }

            return query
                .OrderBy(s => GetCefrLevelOrder(s.Level))
                .ThenBy(s => s.Order)
                .ThenBy(s => s.LessonId, StringComparer.Ordinal)
                .ToList();
        }

        public LessonDetailResponseDto? GetDetail(string lessonId)
        {
            if (string.IsNullOrWhiteSpace(lessonId))
            {
                return null;
            }

            return _lessons.TryGetValue(lessonId, out var lesson) ? lesson.Detail : null;
        }

        public bool LessonExists(string lessonId)
        {
            if (string.IsNullOrWhiteSpace(lessonId))
            {
                return false;
            }

            return _lessons.ContainsKey(lessonId);
        }

        public bool ContentExists(string lessonId, string contentId)
        {
            if (string.IsNullOrWhiteSpace(lessonId) || string.IsNullOrWhiteSpace(contentId))
            {
                return false;
            }

            return _lessons.TryGetValue(lessonId, out var lesson) && lesson.ContentIds.Contains(contentId);
        }

        public IReadOnlyList<LessonQuizQuestionDto>? GetQuizQuestions(string lessonId)
        {
            if (string.IsNullOrWhiteSpace(lessonId))
            {
                return null;
            }

            return _lessons.TryGetValue(lessonId, out var lesson) ? lesson.QuizQuestions : null;
        }

        public IReadOnlyList<string> GetPrerequisites(string lessonId)
        {
            if (string.IsNullOrWhiteSpace(lessonId))
            {
                return [];
            }

            return _prerequisites.TryGetValue(lessonId, out var prerequisites) ? prerequisites : [];
        }

        public string? GetAssetPath(string lessonId, string assetPath)
        {
            if (string.IsNullOrWhiteSpace(lessonId) || string.IsNullOrWhiteSpace(assetPath)
                || !_lessons.TryGetValue(lessonId, out var lesson)
                || !AssetExtensions.Contains(Path.GetExtension(assetPath)))
            {
                return null;
            }

            var full = ResolveSafePath(lesson.Folder, assetPath);
            return full is not null && File.Exists(full) ? full : null;
        }

        private void LoadAllLessons()
        {
            if (!Directory.Exists(_root))
            {
                _logger.LogError("Thư mục lưu trữ bài học không tồn tại: {Root}", _root);
                return;
            }

            foreach (var relativeFolder in LessonTemplateLayout.LessonFolders(_root))
            {
                // GetFullPath đổi "/" trong relativeFolder sang dấu phân cách của OS (Windows) để ResolveSafePath so sánh đúng
                var folder = Path.GetFullPath(Path.Combine(_root, relativeFolder));
                var folderName = Path.GetFileName(relativeFolder);

                if (!LessonIds.IsValid(folderName))
                {
                    _logger.LogWarning("Bỏ qua thư mục '{Folder}' vì tên thư mục không đúng định dạng slug kebab-case.", relativeFolder);
                    continue;
                }

                if (_lessons.TryGetValue(folderName, out var existing))
                {
                    _logger.LogWarning("Bỏ qua thư mục '{Folder}' vì LessonId '{LessonId}' đã có ở '{Existing}'.",
                        relativeFolder, folderName, Path.GetRelativePath(_root, existing.Folder));
                    continue;
                }

                var configPath = Path.Combine(folder, LessonTemplateLayout.ConfigFile);
                if (!File.Exists(configPath))
                {
                    _logger.LogWarning("Bài học '{LessonId}' thiếu file '{ConfigFile}'. Bỏ qua bài học này.", folderName, LessonTemplateLayout.ConfigFile);
                    continue;
                }

                LessonConfigDto? config;
                try
                {
                    var configJson = File.ReadAllText(configPath);
                    config = JsonSerializer.Deserialize<LessonConfigDto>(configJson, ReadOptions);
                    if (config is null)
                    {
                        _logger.LogWarning("File config.json của bài học '{LessonId}' bị rỗng hoặc không thể giải mã. Bỏ qua.", folderName);
                        continue;
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Lỗi cú pháp JSON trong config.json của bài học '{LessonId}' (Dòng {Line}, Vị trí {Col}): {Message}. Bỏ qua.",
                        folderName, ex.LineNumber + 1, ex.BytePositionInLine + 1, ex.Message);
                    continue;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi không xác định khi đọc file config.json của bài học '{LessonId}'. Bỏ qua.", folderName);
                    continue;
                }

                var contentFullPath = ResolveSafePath(folder, config.Content);
                if (contentFullPath is null || !File.Exists(contentFullPath))
                {
                    _logger.LogWarning("Bài học '{LessonId}' không tìm thấy file nội dung tại '{ContentPath}'. Bỏ qua bài học này.", folderName, config.Content);
                    continue;
                }

                LessonContentDto? content;
                try
                {
                    var contentJson = File.ReadAllText(contentFullPath);
                    content = JsonSerializer.Deserialize<LessonContentDto>(contentJson, ReadOptions);
                    if (content is null)
                    {
                        _logger.LogWarning("File nội dung của bài học '{LessonId}' bị rỗng hoặc không hợp lệ. Bỏ qua.", folderName);
                        continue;
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Lỗi cú pháp JSON trong file nội dung của bài học '{LessonId}' (Dòng {Line}, Vị trí {Col}): {Message}. Bỏ qua.",
                        folderName, ex.LineNumber + 1, ex.BytePositionInLine + 1, ex.Message);
                    continue;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi không xác định khi đọc file nội dung của bài học '{LessonId}'. Bỏ qua.", folderName);
                    continue;
                }

                var quizQuestions = new List<LessonQuizQuestionDto>();
                if (!string.IsNullOrWhiteSpace(config.Quiz))
                {
                    var quizFullPath = ResolveSafePath(folder, config.Quiz);
                    if (quizFullPath is null || !File.Exists(quizFullPath))
                    {
                        _logger.LogWarning("Bài học '{LessonId}' không tìm thấy file quiz tại '{QuizPath}'. Bỏ qua bài học này.", folderName, config.Quiz);
                        continue;
                    }

                    try
                    {
                        var quizJson = File.ReadAllText(quizFullPath);
                        var parsedQuiz = JsonSerializer.Deserialize<List<LessonQuizQuestionDto>>(quizJson, ReadOptions);
                        if (parsedQuiz is null)
                        {
                            _logger.LogWarning("File quiz của bài học '{LessonId}' bị rỗng. Bỏ qua bài học này.", folderName);
                            continue;
                        }
                        quizQuestions = parsedQuiz;
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogWarning(ex, "Lỗi cú pháp JSON trong file quiz của bài học '{LessonId}' (Dòng {Line}, Vị trí {Col}): {Message}. Bỏ qua.",
                            folderName, ex.LineNumber + 1, ex.BytePositionInLine + 1, ex.Message);
                        continue;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi không xác định khi đọc file quiz của bài học '{LessonId}'. Bỏ qua.", folderName);
                        continue;
                    }
                }

                string? AssetUrl(string? path) => ToAssetUrl(folderName, path);

                var summary = new LessonSummaryDto(
                    LessonId: folderName,
                    Name: config.Name,
                    Description: config.Description,
                    Category: config.Category,
                    Topic: config.Topic,
                    Level: config.Level,
                    Order: config.Order,
                    EstimatedMinutes: config.EstimatedMinutes,
                    Image: AssetUrl(config.Image),
                    ContentCount: content.Count,
                    QuestionCount: quizQuestions.Count
                );

                var detail = new LessonDetailResponseDto(
                    LessonId: folderName,
                    Name: config.Name,
                    Description: config.Description,
                    Category: config.Category,
                    Topic: config.Topic,
                    Level: config.Level,
                    Order: config.Order,
                    EstimatedMinutes: config.EstimatedMinutes,
                    Image: AssetUrl(config.Image),
                    Contents: content.Select(item => item.WithAssetUrls(AssetUrl)).ToList(),
                    Quiz: quizQuestions.Select(q => QuizQuestionResponseDto.From(q, AssetUrl)).ToList(),
                    QuizSettings: config.QuizSettings ?? new LessonQuizSettingsDto()
                );

                var contentIds = content.Select(c => c.Id).ToHashSet(StringComparer.Ordinal);

                _lessons[folderName] = new CachedLesson(
                    LessonId: folderName,
                    Folder: folder,
                    Config: config,
                    Content: content,
                    QuizQuestions: quizQuestions,
                    Summary: summary,
                    Detail: detail,
                    ContentIds: contentIds
                );
            }

            _logger.LogInformation("Đã khởi tạo thành công {Count} bài học từ {Root}.", _lessons.Count, _root);
        }

        /// <summary>
        /// Đọc "prerequisites" của bài chính và bài trong nhánh ở mọi LearningPath.json.
        /// Chỉ giữ prerequisite trỏ tới bài đã nạp được; LearningPath.json lỗi thì bỏ qua cả lộ trình (bài vẫn mở được).
        /// </summary>
        private void LoadPrerequisites()
        {
            if (!Directory.Exists(_root))
            {
                return;
            }

            foreach (var pathFolder in LessonTemplateLayout.LearningPathFolders(_root))
            {
                LearningPathDto? path;
                try
                {
                    var json = File.ReadAllText(Path.Combine(_root, pathFolder, LessonTemplateLayout.LearningPathFile));
                    path = JsonSerializer.Deserialize<LearningPathDto>(json, ReadOptions);
                }
                catch (Exception ex) when (ex is JsonException or IOException)
                {
                    _logger.LogWarning(ex, "Không đọc được {File} của lộ trình '{PathFolder}'. Bỏ qua prerequisites của lộ trình này.",
                        LessonTemplateLayout.LearningPathFile, pathFolder);
                    continue;
                }

                if (path is null)
                {
                    continue;
                }

                foreach (var lesson in path.AllLessons())
                {
                    var prerequisites = lesson.Prerequisites.Where(_lessons.ContainsKey).Distinct(StringComparer.Ordinal).ToList();
                    if (_lessons.ContainsKey(lesson.LessonId) && prerequisites.Count > 0)
                    {
                        _prerequisites[lesson.LessonId] = prerequisites;
                    }
                }
            }
        }

        private static string? ResolveSafePath(string folder, string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath))
            {
                return null;
            }

            var full = Path.GetFullPath(Path.Combine(folder, relativePath));
            var folderWithSeparator = folder.EndsWith(Path.DirectorySeparatorChar)
                ? folder
                : folder + Path.DirectorySeparatorChar;

            if (!full.StartsWith(folderWithSeparator, StringComparison.Ordinal))
            {
                return null;
            }

            return full;
        }

        /// <summary>"./audio/1.m4a" → "/api/lessons/{lessonId}/assets/audio/1.m4a"; null giữ nguyên null.</summary>
        private static string? ToAssetUrl(string lessonId, string? relativePath) =>
            string.IsNullOrWhiteSpace(relativePath)
                ? null
                : $"/api/lessons/{lessonId}/assets/{(relativePath.StartsWith("./", StringComparison.Ordinal) ? relativePath[2..] : relativePath)}";

        private static int GetCefrLevelOrder(string? level)
        {
            if (string.IsNullOrWhiteSpace(level))
            {
                return int.MaxValue;
            }

            var index = Array.IndexOf(CefrLevels.All.ToArray(), level.Trim().ToUpperInvariant());
            return index >= 0 ? index : int.MaxValue;
        }

        private sealed record CachedLesson(
            string LessonId,
            string Folder,
            LessonConfigDto Config,
            LessonContentDto Content,
            List<LessonQuizQuestionDto> QuizQuestions,
            LessonSummaryDto Summary,
            LessonDetailResponseDto Detail,
            HashSet<string> ContentIds);
    }
}
