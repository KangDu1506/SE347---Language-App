using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    /// <summary>
    /// DTO cho việc đăng nhập người dùng bằng Google.
    /// * Giải thích:
    ///     - IdToken: mã thông báo nhận dạng từ Google, được sử dụng để xác thực người dùng.
    ///     - Email: địa chỉ email của người dùng, được lấy từ thông tin của Google.
    /// </summary>
    public class GoogleLoginDTO
    {
        [Required]
        public string IdToken { get; set; } = null!;

        [Required, EmailAddress]
        public string Email { get; set; } = null!;
    }
}