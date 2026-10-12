using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    public class UserRegisterDto
    {
        [Required, StringLength(50, MinimumLength = 3)]
        public string Username { get; set; } = null!;

        [Required, EmailAddress, StringLength(255)]
        public string Email { get; set; } = null!;

        [Required, MinLength(8)]
        public string Password { get; set; } = null!;

        [Required, Compare(nameof(Password))]
        public string ConfirmPassword { get; set; } = null!;
    }
}
