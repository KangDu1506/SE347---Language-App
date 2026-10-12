using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    public class ResetPasswordDto
    {
        [Required, MinLength(8)]
        public string Password { get; set; } = null!;

        [Required, Compare(nameof(Password))]
        public string ConfirmPassword { get; set; } = null!;
    }
}
