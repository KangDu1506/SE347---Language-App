using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    public class GoogleLoginDto
    {
        [Required]
        public string IdToken { get; set; } = null!;
    }
}
