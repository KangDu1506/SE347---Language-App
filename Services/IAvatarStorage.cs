namespace SE347.Services
{
    /// <summary>
    /// Lưu file trong bucket "avatars" của Supabase Storage.
    /// Path truyền vào không có tiền tố bucket, dạng "{userId}/{tên file}".
    /// </summary>
    public interface IAvatarStorage
    {
        /// <summary>Tải file lên, không ghi đè. Ném <see cref="AvatarStorageException"/> nếu Storage từ chối hoặc chưa cấu hình.</summary>
        Task UploadAsync(string path, byte[] content, string contentType, CancellationToken cancellationToken = default);

        /// <summary>Xóa file. File không tồn tại coi như đã xóa. Ném <see cref="AvatarStorageException"/> nếu lỗi.</summary>
        Task DeleteAsync(string path, CancellationToken cancellationToken = default);
    }

    public class AvatarStorageException : Exception
    {
        public AvatarStorageException(string message, Exception? inner = null)
            : base(message, inner)
        {
        }
    }
}
