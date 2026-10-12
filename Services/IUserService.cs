using SE347.DTOs.Users;

namespace SE347.Services
{
    public interface IUserService
    {
        Task<bool> IsUsernameAvailableAsync(string username, CancellationToken cancellationToken = default);

        Task<PublicProfileDto?> GetPublicProfileAsync(string username, CancellationToken cancellationToken = default);

        Task<MyProfileDto?> GetMyProfileAsync(Guid userId, CancellationToken cancellationToken = default);
    }
}
