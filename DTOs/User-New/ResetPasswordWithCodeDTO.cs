using System.ComponentModel.DataAnnotations;
using DTO.UserDTOs;

namespace DTOs.UserDTOs
{
    /// <summary>
    /// DTO cho việc đặt lại mật khẩu bằng mã xác thực.
    /// * Giải thích:
    ///     - Code: mã xác thực được gửi đến người dùng, cần được xác minh.
    ///     - Email: địa chỉ email của người dùng, được sử dụng để xác minh mã.
    /// </summary>
    public class ResetPasswordWithCodeDTO : BaseVerifyCodeDTO
    {
        [Required, StringLength(255)] public string NewPassword { get; set; } = null!;

        [Required, Compare(nameof(NewPassword))] public string ConfirmPassword { get; set; } = null!;
    }
}