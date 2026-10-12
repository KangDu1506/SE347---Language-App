using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    public class ForgetPasswordDto
    {
        [Required, EmailAddress, StringLength(255)]
        public string Email { get; set; } = null!;
    }
}
