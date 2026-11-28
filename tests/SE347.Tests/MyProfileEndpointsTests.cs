using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SE347.Data;
using SE347.DTOs.Users;
using SE347.Models;

namespace SE347.Tests
{
    /// <summary>SCRUM-92: PATCH /api/users/me, avatar và tự vô hiệu hóa tài khoản.</summary>
    public class MyProfileEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

        private readonly LessonApiFactory _factory;

        public MyProfileEndpointsTests(LessonApiFactory factory)
        {
            _factory = factory;
        }

        // ── Quyền ───────────────────────────────────────────────────────

        [Theory]
        [InlineData("PATCH", "/api/users/me")]
        [InlineData("DELETE", "/api/users/me")]
        [InlineData("POST", "/api/users/me/avatar")]
        [InlineData("DELETE", "/api/users/me/avatar")]
        public async Task WithoutAuth_Returns401(string method, string url)
        {
            using var request = new HttpRequestMessage(new HttpMethod(method), url)
            {
                Content = JsonBody("""{ "displayName": "A" }"""),
            };

            var response = await _factory.CreateClientFor(null).SendAsync(request);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Theory]
        [InlineData("suspended")]
        [InlineData("deactivated")]
        public async Task InactiveUser_CannotEditProfileOrAvatar_Returns403(string status)
        {
            var userId = await SeedUserAsync(status: status);
            var client = _factory.CreateClientFor(userId);

            var patch = await PatchAsync(client, """{ "displayName": "Tên mới" }""");
            var upload = await client.PostAsync("/api/users/me/avatar", AvatarForm(Png(100)));
            var removeAvatar = await client.DeleteAsync("/api/users/me/avatar");

            Assert.Equal(HttpStatusCode.Forbidden, patch.StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, upload.StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, removeAvatar.StatusCode);
            Assert.Equal("profile_inactive", (await ReadJsonAsync(patch)).GetProperty("code").GetString());
            Assert.Equal("Test user", (await LoadAsync(userId)).Profile.DisplayName);
        }

        [Fact]
        public async Task Patch_MissingProfile_Returns404()
        {
            var response = await PatchAsync(_factory.CreateClientFor(Guid.NewGuid()), """{ "displayName": "A" }""");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        // ── PATCH: cập nhật từng phần ───────────────────────────────────

        [Fact]
        public async Task Patch_OnlyChangesFieldsThatWereSent()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "displayName": "  Minh Anh  ", "theme": "dark" }""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var dto = await response.Content.ReadFromJsonAsync<MyProfileDto>(Json);
            Assert.Equal("Minh Anh", dto!.DisplayName);
            Assert.Equal("dark", dto.Setting!.Theme);

            var (profile, setting, learning) = await LoadAsync(userId);
            Assert.Equal("Minh Anh", profile.DisplayName);
            Assert.Equal("Giới thiệu cũ", profile.Bio);
            Assert.Equal("en", profile.UiLocale);
            Assert.Equal("Asia/Tokyo", profile.Timezone);
            Assert.Equal("public", profile.ProfileVisibility);
            Assert.Equal("dark", setting.Theme);
            Assert.Equal(30, setting.DailyGoalXp);
            Assert.False(setting.SoundEnabled);
            Assert.True(setting.ReminderEnabled);
            Assert.Equal(new TimeOnly(20, 15), setting.ReminderTime);
            Assert.Equal("work", learning.LearningReason);
        }

        [Fact]
        public async Task Patch_AllFields_SavesNormalizedValues()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), $$"""
                {
                    "displayName": "Trần Minh Anh",
                    "username": "  New.Name_{{userId.ToString("N")[..6]}}  ",
                    "bio": "  Học IELTS  ",
                    "uiLocale": "vi",
                    "timezone": "Asia/Ho_Chi_Minh",
                    "profileVisibility": "private",
                    "learningReason": "exam",
                    "theme": "light",
                    "dailyGoalXp": 50,
                    "soundEnabled": true,
                    "reminderEnabled": true,
                    "reminderTime": "07:30"
                }
                """);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var (profile, setting, learning) = await LoadAsync(userId);
            Assert.Equal($"new.name_{userId.ToString("N")[..6]}", profile.Username);
            Assert.Equal("Học IELTS", profile.Bio);
            Assert.Equal("vi", profile.UiLocale);
            Assert.Equal("Asia/Ho_Chi_Minh", profile.Timezone);
            Assert.Equal("private", profile.ProfileVisibility);
            Assert.Equal("exam", learning.LearningReason);
            Assert.Equal("light", setting.Theme);
            Assert.Equal(50, setting.DailyGoalXp);
            Assert.True(setting.SoundEnabled);
            Assert.Equal(new TimeOnly(7, 30), setting.ReminderTime);
        }

        [Theory]
        [InlineData("""{ "bio": null }""")]
        [InlineData("""{ "bio": "   " }""")]
        public async Task Patch_BioNullOrBlank_ClearsBio(string body)
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), body);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Null((await LoadAsync(userId)).Profile.Bio);
        }

        [Fact]
        public async Task Patch_LearningReasonNull_ClearsReason()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "learningReason": null }""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Null((await LoadAsync(userId)).Learning.LearningReason);
        }

        [Fact]
        public async Task Patch_EmptyBody_KeepsEverythingAndReturnsProfile()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), "{}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var dto = await response.Content.ReadFromJsonAsync<MyProfileDto>(Json);
            Assert.Equal("Test user", dto!.DisplayName);
            Assert.Equal("Giới thiệu cũ", dto.Bio);
        }

        [Fact]
        public async Task Patch_MissingSettingRows_AreInitializedThenUpdated()
        {
            var userId = await _factory.CreateUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "theme": "dark", "learningReason": "fun" }""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var (_, setting, learning) = await LoadAsync(userId);
            Assert.Equal("dark", setting.Theme);
            Assert.Equal("fun", learning.LearningReason);
        }

        // ── PATCH: validate ─────────────────────────────────────────────

        [Theory]
        [InlineData("""{ "displayName": "   " }""", "displayName")]
        [InlineData("""{ "displayName": null }""", "displayName")]
        [InlineData("""{ "username": "ab" }""", "username")]
        [InlineData("""{ "username": "_abc" }""", "username")]
        [InlineData("""{ "username": "abc." }""", "username")]
        [InlineData("""{ "username": "ab..cd" }""", "username")]
        [InlineData("""{ "username": "ab._cd" }""", "username")]
        [InlineData("""{ "username": "ab-cd" }""", "username")]
        [InlineData("""{ "username": "abcdefghijabcdefghijabcdefghijk" }""", "username")]
        [InlineData("""{ "username": null }""", "username")]
        [InlineData("""{ "uiLocale": "fr" }""", "uiLocale")]
        [InlineData("""{ "uiLocale": "VI" }""", "uiLocale")]
        [InlineData("""{ "timezone": "Mars/Olympus" }""", "timezone")]
        [InlineData("""{ "timezone": "" }""", "timezone")]
        [InlineData("""{ "timezone": "SE Asia Standard Time" }""", "timezone")]
        [InlineData("""{ "profileVisibility": "friends" }""", "profileVisibility")]
        [InlineData("""{ "theme": "blue" }""", "theme")]
        [InlineData("""{ "theme": null }""", "theme")]
        [InlineData("""{ "dailyGoalXp": 25 }""", "dailyGoalXp")]
        [InlineData("""{ "dailyGoalXp": null }""", "dailyGoalXp")]
        [InlineData("""{ "dailyGoalXp": "abc" }""", "dailyGoalXp")]
        [InlineData("""{ "soundEnabled": null }""", "soundEnabled")]
        [InlineData("""{ "learningReason": "money" }""", "learningReason")]
        [InlineData("""{ "reminderTime": "25:00" }""", "reminderTime")]
        [InlineData("""{ "status": "active" }""", "status")]
        [InlineData("""{ "role": "admin" }""", "role")]
        public async Task Patch_InvalidField_Returns400WithFieldName(string body, string field)
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), body);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var json = await ReadJsonAsync(response);
            Assert.Equal(field, json.GetProperty("field").GetString());
            Assert.False(string.IsNullOrEmpty(json.GetProperty("error").GetString()));

            var (profile, setting, _) = await LoadAsync(userId);
            Assert.Equal("Test user", profile.DisplayName);
            Assert.Equal("system", setting.Theme);
        }

        [Fact]
        public async Task Patch_BioLongerThan160_Returns400()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), JsonSerializer.Serialize(new { bio = new string('b', 161) }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("bio", (await ReadJsonAsync(response)).GetProperty("field").GetString());
        }

        [Fact]
        public async Task Patch_DisplayNameLongerThan80_Returns400()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), JsonSerializer.Serialize(new { displayName = new string('a', 81) }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("displayName", (await ReadJsonAsync(response)).GetProperty("field").GetString());
        }

        [Fact]
        public async Task Patch_InvalidRequestDoesNotSaveEarlierValidFields()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "displayName": "Tên mới", "theme": "blue" }""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("Test user", (await LoadAsync(userId)).Profile.DisplayName);
        }

        [Fact]
        public async Task Patch_DisplayNameCountsCharactersNotUtf16Units()
        {
            var userId = await SeedUserAsync();
            var eightyEmoji = string.Concat(Enumerable.Repeat("😀", 80));

            var response = await PatchAsync(_factory.CreateClientFor(userId), JsonSerializer.Serialize(new { displayName = eightyEmoji }));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task Patch_MalformedJson_Returns400()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), "{ \"displayName\": ");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.True((await ReadJsonAsync(response)).TryGetProperty("error", out _));
        }

        // ── Username ────────────────────────────────────────────────────

        [Fact]
        public async Task Patch_UsernameTakenByAnotherUser_Returns409()
        {
            var otherId = await SeedUserAsync();
            var other = (await LoadAsync(otherId)).Profile.Username;
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), $$"""{ "username": "{{other.ToUpperInvariant()}}" }""");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            var json = await ReadJsonAsync(response);
            Assert.Equal("username", json.GetProperty("field").GetString());
            Assert.Equal("username_taken", json.GetProperty("code").GetString());
        }

        [Theory]
        [InlineData("admin")]
        [InlineData("Support")]
        [InlineData("me")]
        [InlineData("undefined")]
        public async Task Patch_ReservedUsername_Returns400(string username)
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), $$"""{ "username": "{{username}}" }""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("username", (await ReadJsonAsync(response)).GetProperty("field").GetString());
        }

        [Fact]
        public async Task Patch_SameUsernameAsCurrent_IsNotAConflict()
        {
            var userId = await SeedUserAsync();
            var current = (await LoadAsync(userId)).Profile.Username;

            var response = await PatchAsync(_factory.CreateClientFor(userId), $$"""{ "username": " {{current.ToUpperInvariant()}} " }""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(current, (await LoadAsync(userId)).Profile.Username);
        }

        // ── Nhắc nhở ────────────────────────────────────────────────────

        [Fact]
        public async Task Patch_EnableReminderWithoutAnyTime_Returns400()
        {
            var userId = await SeedUserAsync(reminderEnabled: false, reminderTime: null);

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "reminderEnabled": true }""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("reminderTime", (await ReadJsonAsync(response)).GetProperty("field").GetString());
        }

        [Fact]
        public async Task Patch_EnableReminder_UsesStoredTime()
        {
            var userId = await SeedUserAsync(reminderEnabled: false, reminderTime: new TimeOnly(6, 0));

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "reminderEnabled": true }""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True((await LoadAsync(userId)).Setting.ReminderEnabled);
        }

        [Fact]
        public async Task Patch_ClearReminderTimeWhileEnabled_Returns400()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "reminderTime": null }""");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Patch_DisableReminderAndClearTime_IsAllowed()
        {
            var userId = await SeedUserAsync();

            var response = await PatchAsync(_factory.CreateClientFor(userId), """{ "reminderEnabled": false, "reminderTime": null }""");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var setting = (await LoadAsync(userId)).Setting;
            Assert.False(setting.ReminderEnabled);
            Assert.Null(setting.ReminderTime);
        }

        // ── Avatar ──────────────────────────────────────────────────────

        [Fact]
        public async Task UploadAvatar_Png_SavesPathWithoutBucketAndDeletesOldFile()
        {
            var userId = await SeedUserAsync(avatarPath: null);
            var client = _factory.CreateClientFor(userId);

            var first = await client.PostAsync("/api/users/me/avatar", AvatarForm(Png(1000)));
            var firstPath = (await LoadAsync(userId)).Profile.AvatarPath;
            var second = await client.PostAsync("/api/users/me/avatar", AvatarForm(Webp(500), "x.webp", "image/png"));
            var secondPath = (await LoadAsync(userId)).Profile.AvatarPath;

            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
            Assert.Equal(HttpStatusCode.OK, second.StatusCode);
            Assert.Matches($"^{userId}/[0-9a-f]{{32}}\\.png$", firstPath);
            Assert.Matches($"^{userId}/[0-9a-f]{{32}}\\.webp$", secondPath);
            Assert.Equal("image/webp", _factory.AvatarStorage.Files[secondPath!].ContentType);
            Assert.Contains(firstPath, _factory.AvatarStorage.Deleted);
            Assert.Equal(secondPath, (await second.Content.ReadFromJsonAsync<MyProfileDto>(Json))!.AvatarPath);
        }

        [Fact]
        public async Task UploadAvatar_Jpeg_ExactlyTwoMegabytes_IsAccepted()
        {
            var userId = await SeedUserAsync();
            var jpeg = new byte[2_097_152];
            jpeg[0] = 0xFF;
            jpeg[1] = 0xD8;
            jpeg[2] = 0xFF;

            var response = await _factory.CreateClientFor(userId).PostAsync("/api/users/me/avatar", AvatarForm(jpeg, "a.jpg", "image/jpeg"));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.EndsWith(".jpg", (await LoadAsync(userId)).Profile.AvatarPath);
        }

        [Fact]
        public async Task UploadAvatar_OldFileDeleteFails_RequestStillSucceeds()
        {
            var userId = await SeedUserAsync(avatarPath: null);
            var client = _factory.CreateClientFor(userId);
            await client.PostAsync("/api/users/me/avatar", AvatarForm(Png(100)));

            _factory.AvatarStorage.FailDeletes = true;
            try
            {
                var response = await client.PostAsync("/api/users/me/avatar", AvatarForm(Png(100)));

                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }
            finally
            {
                _factory.AvatarStorage.FailDeletes = false;
            }
        }

        [Fact]
        public async Task UploadAvatar_TooLarge_Returns400()
        {
            var userId = await SeedUserAsync();

            var response = await _factory.CreateClientFor(userId).PostAsync("/api/users/me/avatar", AvatarForm(Png(2_097_153)));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("file", (await ReadJsonAsync(response)).GetProperty("field").GetString());
            Assert.Equal($"{userId}/old.png", (await LoadAsync(userId)).Profile.AvatarPath);
        }

        [Theory]
        [InlineData("GIF89a-fake-image")]
        [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>")]
        [InlineData("plain text pretending to be png")]
        public async Task UploadAvatar_WrongFormat_Returns400EvenWithImageContentType(string content)
        {
            var userId = await SeedUserAsync();

            var response = await _factory.CreateClientFor(userId).PostAsync(
                "/api/users/me/avatar", AvatarForm(Encoding.UTF8.GetBytes(content), "a.png", "image/png"));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("file", (await ReadJsonAsync(response)).GetProperty("field").GetString());
        }

        [Fact]
        public async Task UploadAvatar_MissingFileField_Returns400()
        {
            var userId = await SeedUserAsync();
            using var form = new MultipartFormDataContent { { new ByteArrayContent(Png(10)), "avatar", "a.png" } };

            var response = await _factory.CreateClientFor(userId).PostAsync("/api/users/me/avatar", form);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task DeleteAvatar_ClearsPath_AndIsIdempotent()
        {
            var userId = await SeedUserAsync();
            var client = _factory.CreateClientFor(userId);

            var first = await client.DeleteAsync("/api/users/me/avatar");
            var second = await client.DeleteAsync("/api/users/me/avatar");

            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
            Assert.Equal(HttpStatusCode.OK, second.StatusCode);
            Assert.Null((await LoadAsync(userId)).Profile.AvatarPath);
            Assert.Contains($"{userId}/old.png", _factory.AvatarStorage.Deleted);
        }

        // ── Vô hiệu hóa tài khoản ──────────────────────────────────────

        [Fact]
        public async Task Deactivate_SetsStatusAndPrivate_AndIsIdempotent()
        {
            var userId = await SeedUserAsync();
            var client = _factory.CreateClientFor(userId);

            var first = await client.DeleteAsync("/api/users/me");
            var second = await client.DeleteAsync("/api/users/me");
            var patchAfter = await PatchAsync(client, """{ "displayName": "A" }""");

            Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, patchAfter.StatusCode);
            var profile = (await LoadAsync(userId)).Profile;
            Assert.Equal("deactivated", profile.Status);
            Assert.Equal("private", profile.ProfileVisibility);
            Assert.Null(profile.DeletedAt);
        }

        [Fact]
        public async Task Deactivate_SuspendedUser_Returns403()
        {
            var userId = await SeedUserAsync(status: "suspended");

            var response = await _factory.CreateClientFor(userId).DeleteAsync("/api/users/me");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("suspended", (await LoadAsync(userId)).Profile.Status);
        }

        // ── Helpers ─────────────────────────────────────────────────────

        private async Task<Guid> SeedUserAsync(
            string status = "active",
            bool reminderEnabled = true,
            TimeOnly? reminderTime = null,
            string? avatarPath = "old.png")
        {
            var userId = Guid.NewGuid();
            await _factory.WithDbAsync(db =>
            {
                db.Profiles.Add(new Profile
                {
                    Id = userId,
                    Username = $"u{userId:N}"[..20],
                    DisplayName = "Test user",
                    Bio = "Giới thiệu cũ",
                    AvatarPath = avatarPath is null ? null : $"{userId}/{avatarPath}",
                    UiLocale = "en",
                    Timezone = "Asia/Tokyo",
                    ProfileVisibility = "public",
                    Status = status,
                });
                db.UserSettings.Add(new UserSetting
                {
                    UserId = userId,
                    Theme = "system",
                    DailyGoalXp = 30,
                    SoundEnabled = false,
                    ReminderEnabled = reminderEnabled,
                    ReminderTime = reminderEnabled ? reminderTime ?? new TimeOnly(20, 15) : reminderTime,
                });
                db.UserLearningProfiles.Add(new UserLearningProfile { UserId = userId, LearningReason = "work" });
                db.UserStats.Add(new UserStat { UserId = userId });
            });
            return userId;
        }

        private async Task<(Profile Profile, UserSetting Setting, UserLearningProfile Learning)> LoadAsync(Guid userId)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var profile = await db.Profiles.AsNoTracking().SingleAsync(p => p.Id == userId);
            var setting = await db.UserSettings.AsNoTracking().SingleAsync(s => s.UserId == userId);
            var learning = await db.UserLearningProfiles.AsNoTracking().SingleAsync(l => l.UserId == userId);
            return (profile, setting, learning);
        }

        private static Task<HttpResponseMessage> PatchAsync(HttpClient client, string body) =>
            client.PatchAsync("/api/users/me", JsonBody(body));

        private static StringContent JsonBody(string body) => new(body, Encoding.UTF8, "application/json");

        private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        private static byte[] Png(int length)
        {
            var bytes = new byte[length];
            PngHeader.CopyTo(bytes, 0);
            return bytes;
        }

        private static byte[] Webp(int length)
        {
            var bytes = new byte[length];
            "RIFF"u8.CopyTo(bytes);
            "WEBP"u8.CopyTo(bytes.AsSpan(8));
            return bytes;
        }

        private static MultipartFormDataContent AvatarForm(byte[] content, string fileName = "avatar.png", string contentType = "image/png")
        {
            var file = new ByteArrayContent(content);
            file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            return new MultipartFormDataContent { { file, "file", fileName } };
        }
    }
}
