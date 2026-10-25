using System.Text.Json.Nodes;
using System.Text.Json;
using Json.Schema;
using Xunit;

namespace S2.BE.Tests;

/// <summary>
/// Validates the lesson files against the checked-in JSON Schemas. These tests do not
/// claim that the application validates files at runtime (there is no lesson loader yet).
/// </summary>
public sealed class LessonJsonSchemaTests
{
    private static readonly string TemplateRoot = Path.Combine(AppContext.BaseDirectory, "LessonTemplate");
    private static readonly string SampleRoot = Path.Combine(TemplateRoot, "Ambiguous, Vague, Equivocal, Obscure");

    [Fact]
    public void EveryLessonFileMatchesItsSchema()
    {
        var lessons = Directory.GetDirectories(TemplateRoot)
            .Where(path => Path.GetFileName(path) != "schemas")
            .ToArray();
        Assert.NotEmpty(lessons);

        foreach (var lesson in lessons)
        {
            foreach (var (file, schema) in new[]
            {
                ("config.json", "LessonConfig.schema.json"),
                ("content.json", "LessonContent.schema.json"),
                ("quiz.json", "LessonQuiz.schema.json")
            })
            {
                var path = Path.Combine(lesson, file);
                Assert.True(File.Exists(path), $"Missing lesson file: {path}");
                Assert.True(Valid(schema, JsonNode.Parse(File.ReadAllText(path))),
                    $"Invalid lesson file: {path} (schema: {schema})");
            }
        }
    }

    [Theory]
    [InlineData("LessonConfig.schema.json", "config.json")]
    [InlineData("LessonContent.schema.json", "content.json")]
    [InlineData("LessonQuiz.schema.json", "quiz.json")]
    public void ExistingFilesAreValidJson(string schema, string file)
    {
        foreach (var path in LessonFiles(file))
            Assert.True(Valid(schema, JsonNode.Parse(File.ReadAllText(path))), path);
    }

    [Theory]
    [InlineData("config.json")]
    [InlineData("content.json")]
    [InlineData("quiz.json")]
    public void NonJsonIsRejected(string file)
    {
        var raw = File.ReadAllText(Path.Combine(SampleRoot, file));
        Assert.ThrowsAny<JsonException>(() => JsonNode.Parse(raw + " garbage"));
    }

    [Theory]
    [InlineData("config.json", "LessonConfig.schema.json", "name")]
    [InlineData("content.json", "LessonContent.schema.json", "id")]
    [InlineData("quiz.json", "LessonQuiz.schema.json", "answer")]
    public void MissingRequiredFieldIsRejected(string file, string schema, string field)
    {
        var document = Sample(file);
        var item = file == "config.json" ? document.AsObject() : document.AsArray()[0]!.AsObject();
        item.Remove(field);
        Assert.False(Valid(schema, document));
    }

    [Theory]
    [InlineData("config.json", "LessonConfig.schema.json", "category")]
    [InlineData("content.json", "LessonContent.schema.json", "examples")]
    [InlineData("quiz.json", "LessonQuiz.schema.json", "answer")]
    public void WrongPropertyTypeIsRejected(string file, string schema, string field)
    {
        var document = Sample(file);
        var item = file == "config.json" ? document.AsObject() : document.AsArray()[0]!.AsObject();
        item[field] = 123;
        Assert.False(Valid(schema, document));
    }

    [Theory]
    [InlineData("config.json", "LessonConfig.schema.json")]
    [InlineData("content.json", "LessonContent.schema.json")]
    [InlineData("quiz.json", "LessonQuiz.schema.json")]
    public void UnexpectedPropertyIsRejected(string file, string schema)
    {
        var document = Sample(file);
        var item = file == "config.json" ? document.AsObject() : document.AsArray()[0]!.AsObject();
        item["unexpected"] = "unexpected";
        Assert.False(Valid(schema, document));
    }

    [Theory]
    [InlineData("LessonContent.schema.json")]
    [InlineData("LessonQuiz.schema.json")]
    public void EmptyArrayIsRejected(string schema) =>
        Assert.False(Valid(schema, new JsonArray()));

    [Theory]
    [InlineData("config.json", "LessonConfig.schema.json")]
    [InlineData("content.json", "LessonContent.schema.json")]
    [InlineData("quiz.json", "LessonQuiz.schema.json")]
    public void WrongDocumentShapeIsRejected(string file, string schema)
    {
        var wrongShape = file == "config.json" ? (JsonNode)new JsonArray() : new JsonObject();
        Assert.False(Valid(schema, wrongShape));
    }

    [Theory]
    [InlineData("content.json", "LessonContent.schema.json", "0")]
    [InlineData("content.json", "LessonContent.schema.json", "-1")]
    [InlineData("quiz.json", "LessonQuiz.schema.json", "0")]
    public void InvalidItemIdIsRejected(string file, string schema, string id)
    {
        var document = Sample(file);
        document.AsArray()[0]!["id"] = id;
        Assert.False(Valid(schema, document));
    }

    [Fact]
    public void InvalidQuizTypeIsRejected()
    {
        var document = Sample("quiz.json");
        document.AsArray()[0]!["type"] = "unsupported";
        Assert.False(Valid("LessonQuiz.schema.json", document));
    }

    [Theory]
    [InlineData("content.json", "LessonContent.schema.json", "examples")]
    [InlineData("quiz.json", "LessonQuiz.schema.json", "answer")]
    public void EmptyRequiredListIsRejected(string file, string schema, string field)
    {
        var document = Sample(file);
        document.AsArray()[0]![field] = new JsonArray();
        Assert.False(Valid(schema, document));
    }

    [Fact]
    public void EmptyQuizExplanationIsRejected()
    {
        var document = Sample("quiz.json");
        document.AsArray()[0]!["explanation"] = "";
        Assert.False(Valid("LessonQuiz.schema.json", document));
    }

    private static JsonNode Sample(string file) =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(SampleRoot, file)))!;

    private static IEnumerable<string> LessonFiles(string file) =>
        Directory.GetDirectories(TemplateRoot)
            .Where(path => Path.GetFileName(path) != "schemas")
            .Select(path => Path.Combine(path, file));

    private static bool Valid(string schema, JsonNode? document)
    {
        var text = File.ReadAllText(Path.Combine(TemplateRoot, "schemas", schema));
        return JsonSchema.FromText(text).Evaluate(document).IsValid;
    }
}
