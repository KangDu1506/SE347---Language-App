using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    /// <summary>
    /// DTO cho việc quên mật khẩu.
    /// * Giải thích:
    ///     - Email: địa chỉ email của người dùng, được sử dụng để gửi liên kết đặt lại mật khẩu.
    ///     - NewPassword: mật khẩu mới mà người dùng muốn đặt lại, phải đáp ứng các yêu cầu bảo mật.
    ///     - ConfirmPassword: xác nhận mật khẩu mới, phải trùng với NewPassword.
    /// </summary>
    public class ResetPasswordDTO
    {
        [Required, EmailAddress] public string Email { get; set; } = null!;
        [Required] public string Token { get; set; } = null!;
        [Required, StringLength(255)] public string NewPassword { get; set; } = null!;
        [Required, Compare(nameof(NewPassword))] public string ConfirmPassword { get; set; } = null!;
    }
}