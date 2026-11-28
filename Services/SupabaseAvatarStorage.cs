using System.Net;
using System.Net.Http.Headers;

namespace SE347.Services
{
    /// <summary>
    /// Gọi Supabase Storage REST (/storage/v1/object/avatars/...) từ server bằng Supabase:SecretKey.
    /// Secret key không phải JWT: theo tài liệu API keys của Supabase, nó chỉ được đặt trong
    /// "Authorization: Bearer" khi trùng hệt header "apikey" (gateway sẽ đổi sang JWT service_role nội bộ),
    /// nên gửi cả hai header giống nhau như supabase-js. Key chỉ nằm ở server, không trả xuống client.
    /// </summary>
    public class SupabaseAvatarStorage : IAvatarStorage
    {
        private const string Bucket = "avatars";

        private readonly HttpClient _http;
        private readonly string _secretKey;

        public SupabaseAvatarStorage(HttpClient http, IConfiguration configuration)
        {
            _http = http;
            _secretKey = configuration["Supabase:SecretKey"] ?? string.Empty;

            var url = configuration["Supabase:Url"]?.TrimEnd('/');
            if (!string.IsNullOrEmpty(url))
            {
                _http.BaseAddress = new Uri($"{url}/storage/v1/");
            }
        }

        public async Task UploadAsync(string path, byte[] content, string contentType, CancellationToken cancellationToken = default)
        {
            using var request = CreateRequest(HttpMethod.Post, path);
            request.Content = new ByteArrayContent(content);
            request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            request.Headers.Add("x-upsert", "false");
            request.Headers.CacheControl = new CacheControlHeaderValue { MaxAge = TimeSpan.FromHours(1) };

            using var response = await SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new AvatarStorageException($"Supabase Storage từ chối upload ({(int)response.StatusCode}).");
            }
        }

        public async Task DeleteAsync(string path, CancellationToken cancellationToken = default)
        {
            using var request = CreateRequest(HttpMethod.Delete, path);

            using var response = await SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode && response.StatusCode != HttpStatusCode.NotFound)
            {
                throw new AvatarStorageException($"Supabase Storage từ chối xóa ({(int)response.StatusCode}).");
            }
        }

        private HttpRequestMessage CreateRequest(HttpMethod method, string path)
        {
            if (_http.BaseAddress is null || string.IsNullOrEmpty(_secretKey))
            {
                throw new AvatarStorageException("Chưa cấu hình Supabase:Url hoặc Supabase:SecretKey.");
            }

            var encodedPath = string.Join('/', path.Split('/').Select(Uri.EscapeDataString));
            var request = new HttpRequestMessage(method, $"object/{Bucket}/{encodedPath}");
            request.Headers.Add("apikey", _secretKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _secretKey);
            return request;
        }

        private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            try
            {
                return await _http.SendAsync(request, cancellationToken);
            }
            catch (HttpRequestException ex)
            {
                throw new AvatarStorageException("Không kết nối được Supabase Storage.", ex);
            }
            catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
            {
                throw new AvatarStorageException("Supabase Storage không phản hồi.", ex);
            }
        }
    }
}
