using Microsoft.EntityFrameworkCore;
using SE347.Data;
using SE347.Models;

namespace SE347.Services
{
    public class UserProfileInitializer : IUserProfileInitializer
    {
        private readonly ApplicationDbContext _db;

        public UserProfileInitializer(ApplicationDbContext db)
        {
            _db = db;
        }

        public Task<bool> EnsureInitializedAsync(Guid userId, CancellationToken cancellationToken = default) =>
            _db.Database.IsNpgsql()
                ? EnsurePostgreSqlAsync(userId, cancellationToken)
                : EnsureInMemoryAsync(userId, cancellationToken);

        private async Task<bool> EnsurePostgreSqlAsync(Guid userId, CancellationToken cancellationToken)
        {
            var hasProfile = await _db.Profiles
                .AsNoTracking()
                .AnyAsync(p => p.Id == userId, cancellationToken);

            if (!hasProfile)
            {
                await InsertProfileFromAuthUserAsync(userId, string.Empty, cancellationToken);

                hasProfile = await _db.Profiles
                    .AsNoTracking()
                    .AnyAsync(p => p.Id == userId, cancellationToken);

                if (!hasProfile)
                {
                    await InsertProfileFromAuthUserAsync(userId, $"u{Guid.NewGuid():N}"[..13], cancellationToken);
                }
            }

            await _db.Database.ExecuteSqlInterpolatedAsync($"""
                insert into public.user_settings (user_id)
                select p.id from public.profiles p
                where p.id = {userId} and p.status <> 'deleted'
                on conflict (user_id) do nothing
                """, cancellationToken);

            await _db.Database.ExecuteSqlInterpolatedAsync($"""
                insert into public.user_learning_profiles (user_id)
                select p.id from public.profiles p
                where p.id = {userId} and p.status <> 'deleted'
                on conflict (user_id) do nothing
                """, cancellationToken);

            await _db.Database.ExecuteSqlInterpolatedAsync($"""
                insert into public.user_stats (user_id)
                select p.id from public.profiles p
                where p.id = {userId} and p.status <> 'deleted'
                on conflict (user_id) do nothing
                """, cancellationToken);

            return await _db.Profiles
                .AsNoTracking()
                .AnyAsync(p => p.Id == userId && p.Status != "deleted", cancellationToken);
        }

        private Task<int> InsertProfileFromAuthUserAsync(Guid userId, string forcedUsername, CancellationToken cancellationToken) =>
            _db.Database.ExecuteSqlInterpolatedAsync($$"""
                insert into public.profiles (id, username, display_name, ui_locale)
                select
                    u.id,
                    case
                        when nullif({{forcedUsername}}, '') is not null
                            then {{forcedUsername}}
                        when public.is_valid_username(lower(btrim(coalesce(coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'username', ''))))
                             and not exists (
                                 select 1 from public.profiles p
                                 where p.username = lower(btrim(coalesce(coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'username', '')))
                             )
                            then lower(btrim(coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'username'))
                        when public.is_valid_username(public.username_from_email(u.email))
                             and not exists (
                                 select 1 from public.profiles p
                                 where p.username = public.username_from_email(u.email)
                             )
                            then public.username_from_email(u.email)
                        else 'u' || substr(replace(u.id::text, '-', ''), 1, 12)
                    end,
                    coalesce(
                        nullif(btrim(left(btrim(coalesce(
                            nullif(btrim(coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'display_name'), ''),
                            nullif(btrim(coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'full_name'), ''),
                            nullif(btrim(coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'fullName'), ''),
                            nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''),
                            ''
                        )), 80)), ''),
                        'learner'
                    ),
                    case
                        when (coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'ui_locale') in ('vi', 'en')
                            then coalesce(u.raw_user_meta_data, '{}'::jsonb) ->> 'ui_locale'
                        else 'vi'
                    end
                from auth.users u
                where u.id = {{userId}}
                  and not exists (select 1 from public.profiles p where p.id = u.id)
                on conflict do nothing
                """, cancellationToken);

        private async Task<bool> EnsureInMemoryAsync(Guid userId, CancellationToken cancellationToken)
        {
            var hasActiveProfile = await _db.Profiles
                .AsNoTracking()
                .AnyAsync(p => p.Id == userId && p.Status != "deleted", cancellationToken);

            if (!hasActiveProfile)
            {
                return false;
            }

            var added = false;

            if (!await _db.UserSettings.AsNoTracking().AnyAsync(s => s.UserId == userId, cancellationToken))
            {
                _db.UserSettings.Add(new UserSetting { UserId = userId });
                added = true;
            }

            if (!await _db.UserLearningProfiles.AsNoTracking().AnyAsync(lp => lp.UserId == userId, cancellationToken))
            {
                _db.UserLearningProfiles.Add(new UserLearningProfile { UserId = userId });
                added = true;
            }

            if (!await _db.UserStats.AsNoTracking().AnyAsync(s => s.UserId == userId, cancellationToken))
            {
                _db.UserStats.Add(new UserStat { UserId = userId });
                added = true;
            }

            if (added)
            {
                await _db.SaveChangesAsync(cancellationToken);
            }

            return true;
        }
    }
}
