using System.ComponentModel.DataAnnotations;
using DTO.UserDTOs;

namespace DTOs.UserDTOs
{
    /// <summary>
    /// DTO cho việc xác minh mã đăng ký người dùng.
    /// * Giải thích: Kế thừa từ BaseVerifyCodeDTO, không có thuộc tính bổ sung nào.
    /// </summary>
    public class VerifyRegisterCodeDTO : BaseVerifyCodeDTO {}
}