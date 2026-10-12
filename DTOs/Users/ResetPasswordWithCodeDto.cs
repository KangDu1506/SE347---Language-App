using DTOs.UserDTOs;

namespace DTOs.UserDTOs
{
    public class ResetPasswordWithCodeDto : BaseVerifyCodeDto
    {
        public ResetPasswordDto ResetPassword { get; set; } = new();
    }
}
