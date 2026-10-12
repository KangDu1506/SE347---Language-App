using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    /// <summary>
    /// DTO cho việc đăng ký người dùng mới.
    /// * Mật khẩu được hash trong lớp Service khi đăng ký.
    ///     (sử dụng PasswordHasher<TUser> hoặc cơ chế tương đương)
    /// * Giải thích:
    ///     - Username: tên người dùng, phải duy nhất trong hệ thống.
    ///     - Email: địa chỉ email người dùng, phải duy nhất và hợp lệ.
    ///     - Password: mật khẩu người dùng nhập vào, sẽ được hash và lưu trong cơ sở dữ liệu.
    ///     - ConfirmPassword: xác nhận mật khẩu, phải trùng với Password.
    /// </summary>
    public class UserRegisterDTO
    {
        [Required, StringLength(50, MinimumLength = 3)]
        public string Username { get; set; } = null!;

        [Required, EmailAddress, StringLength(255)]
        public string Email { get; set; } = null!;

        [Required, MinLength(8)] public string Password { get; set; } = null!;

        [Required, Compare(nameof(Password))]
        public string ConfirmPassword { get; set; } = null!;
    }
}