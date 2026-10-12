using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    public class UserLoginDto
    {
        [Required, StringLength(255)]
        public string Identifier { get; set; } = null!;

        [Required, MinLength(8)]
        public string Password { get; set; } = null!;
    }
}
