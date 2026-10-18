using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    public class UserRegisterDto
    {
        [Required, StringLength(50, MinimumLength = 3)]
        public string Username { get; set; } = null!;

        [Required, EmailAddress, StringLength(255)]
        public string Email { get; set; } = null!;

        [Required, MinLength(16)]
        [RegularExpression(@"^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E])[A-Za-z0-9\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+$")]
        public string Password { get; set; } = null!;

        [Required, Compare(nameof(Password))]
        public string ConfirmPassword { get; set; } = null!;
    }
}
