namespace SE347.Services
{
    /// <summary>
    /// Tự khởi tạo hồ sơ (profiles) và các bảng phụ mặc định (user_settings, user_learning_profiles, user_stats)
    /// cho tài khoản đã tồn tại nhưng chưa có đủ dữ liệu khởi tạo.
    /// Không tạo hồ sơ cho user không tồn tại và không kích hoạt lại hồ sơ đã khóa hoặc đã xóa.
    /// </summary>
    public interface IUserProfileInitializer
    {
        /// <summary>
        /// Đảm bảo các bản ghi mặc định tồn tại nếu user hợp lệ và chưa bị xóa.
        /// Trả về true nếu tồn tại hồ sơ chưa xóa sau khi kiểm tra/khởi tạo.
        /// </summary>
        Task<bool> EnsureInitializedAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}
