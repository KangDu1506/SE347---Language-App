using System.ComponentModel.DataAnnotations;

namespace DTOs.UserDTOs
{
    public abstract class BaseVerifyCodeDto
    {
        [Required]
        public string Code { get; set; } = null!;
    }
}
