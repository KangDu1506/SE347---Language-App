using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    /// <summary>
    /// DTO cho việc quên mật khẩu của người dùng.
    /// * Giải thích:
    ///      - Email: địa chỉ email của người dùng, được sử dụng để xác thực và gửi liên kết đặt lại mật khẩu.
    /// </summary>
    public class ForgetPasswordDTO
    {
        [Required, EmailAddress] public string Email { get; set; } = null!;
    }
}