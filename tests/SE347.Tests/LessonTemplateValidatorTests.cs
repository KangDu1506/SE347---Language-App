using System.Text.Json.Nodes;
using SE347.Services;

namespace SE347.Tests
{
    /// <summary>
    /// LessonTemplateValidator trên bản sao Storage/LessonTemplate (không sửa dữ liệu thật).
    /// shortcut: JsonSchema.FromFile đăng ký schema theo $id cho cả process nên chỉ tạo được 1 validator mỗi lần chạy test;
    /// thêm test validator thì gom vào đây hoặc dùng SchemaRegistry riêng. Dữ liệu thật đã được kiểm bằng validate-lessons trong CI.
    /// </summary>
    public class LessonTemplateValidatorTests : IDisposable
    {
        private readonly string _root = Path.Combine(Path.GetTempPath(), $"lesson-template-{Guid.NewGuid():N}");

        public LessonTemplateValidatorTests()
        {
            CopyDirectory(Path.Combine(RepoRoot(), "Storage", "LessonTemplate"), _root);
        }

        public void Dispose() => Directory.Delete(_root, recursive: true);

        [Fact]
        public void PrerequisiteCycle_IsReported()
        {
            var file = Directory.EnumerateFiles(_root, LessonTemplateLayout.LearningPathFile, SearchOption.AllDirectories).First();
            var path = JsonNode.Parse(File.ReadAllText(file))!;
            var lessons = path["lessons"]!.AsArray()
                .Concat((path["branches"]?.AsArray() ?? []).SelectMany(b => b!["lessons"]!.AsArray()))
                .Select(l => l!)
                .ToList();

            // Bài X cần P: thêm X vào prerequisites của P để tạo vòng X -> P -> X
            var lesson = lessons.First(l => l["prerequisites"]?.AsArray().Count > 0);
            var lessonId = lesson["lessonId"]!.GetValue<string>();
            var prerequisiteId = lesson["prerequisites"]![0]!.GetValue<string>();
            var prerequisite = lessons.First(l => l["lessonId"]!.GetValue<string>() == prerequisiteId);
            prerequisite["prerequisites"] = new JsonArray(lessonId);
            File.WriteAllText(file, path.ToJsonString());

            var errors = new LessonTemplateValidator(_root).ValidateAll();

            Assert.Contains(errors, e => e.Message.Contains($"\"{lessonId}\" nằm trong vòng prerequisite"));
            Assert.Contains(errors, e => e.Message.Contains($"\"{prerequisiteId}\" nằm trong vòng prerequisite"));
        }

        private static string RepoRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "SE347.csproj")))
            {
                dir = dir.Parent;
            }

            return dir?.FullName ?? throw new InvalidOperationException("Không tìm thấy SE347.csproj.");
        }

        private static void CopyDirectory(string source, string target)
        {
            foreach (var directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
            {
                Directory.CreateDirectory(directory.Replace(source, target));
            }

            Directory.CreateDirectory(target);
            foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
            {
                File.Copy(file, file.Replace(source, target));
            }
        }
    }
}
