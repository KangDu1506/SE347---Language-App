using System.ComponentModel.DataAnnotations;

namespace DTO.UserDTOs
{
    /// <summary>
    /// DTO cơ sở cho việc xác minh mã xác thực.
    /// * Giải thích:
    ///     - Code: mã xác thực được gửi đến người dùng, cần được xác minh.
    ///     - Email: địa chỉ email của người dùng, được sử dụng để xác minh mã.
    /// </summary>
    public abstract class BaseVerifyCodeDTO
    {
        [Required] public string Code { get; set; } = null!;
        [Required] public string Email { get; set; } = null!;
    }
}