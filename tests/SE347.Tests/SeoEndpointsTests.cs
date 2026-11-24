using System.Net;
using System.Xml.Linq;
using Microsoft.Extensions.DependencyInjection;
using SE347.Services;

namespace SE347.Tests
{
    public class SeoEndpointsTests : IClassFixture<LessonApiFactory>
    {
        private readonly LessonApiFactory _factory;

        public SeoEndpointsTests(LessonApiFactory factory) => _factory = factory;

        [Fact]
        public async Task Sitemap_UsesRequestHost_AndIncludesTermsAndEveryLesson()
        {
            using var client = _factory.CreateClient();
            client.BaseAddress = new Uri("https://seo.example.test");

            using var response = await client.GetAsync("/sitemap.xml");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("application/xml", response.Content.Headers.ContentType?.MediaType);

            var xml = XDocument.Parse(await response.Content.ReadAsStringAsync());
            XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
            var locations = xml.Descendants(ns + "loc").Select(node => node.Value).ToArray();
            var lessons = _factory.Services.GetRequiredService<ILessonService>().GetAll();

            Assert.Contains("https://seo.example.test", locations);
            Assert.Contains("https://seo.example.test/Account/Terms", locations);
            Assert.Equal(lessons.Count + 2, locations.Length);
            Assert.All(lessons, lesson => Assert.Contains(
                $"https://seo.example.test/Lesson/{Uri.EscapeDataString(lesson.LessonId)}", locations));
            Assert.DoesNotContain(locations, location => location.Contains("azurewebsites.net", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public async Task Robots_UsesRequestHost_AndDeclaresSitemap()
        {
            using var client = _factory.CreateClient();
            client.BaseAddress = new Uri("https://seo.example.test");

            using var response = await client.GetAsync("/robots.txt");
            var robots = await response.Content.ReadAsStringAsync();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("text/plain", response.Content.Headers.ContentType?.MediaType);
            Assert.Contains("Disallow: /api/", robots);
            Assert.Contains("Sitemap: https://seo.example.test/sitemap.xml", robots);
        }
    }
}
