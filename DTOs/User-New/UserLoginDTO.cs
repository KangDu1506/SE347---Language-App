using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    /// <summary>
    /// DTO cho việc đăng nhập người dùng.
    /// * Mật khẩu được verify với password hash trong lớp Service.
    ///     (sử dụng PasswordHasher<TUser> hoặc cơ chế tương đương)
    /// * Giải thích:
    ///     - Identifier: có thể là username hoặc email, tùy thuộc vào cách triển khai xác thực trong Service.
    ///     - Password: mật khẩu người dùng nhập vào, sẽ được so sánh với hash mật khẩu lưu trong cơ sở dữ liệu.
    /// </summary>
    public class UserLoginDTO
    {
        [Required, StringLength(255)]
        public string Identifier { get; set; } = null!;

        [Required, MinLength(8)] public string Password { get; set; } = null!;
    }
}