using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace SE347.Auth;

public sealed class LocalDevelopmentAuthOptions : AuthenticationSchemeOptions
{
    public Guid UserId { get; set; }
}

public sealed class LocalDevelopmentAuthHandler : AuthenticationHandler<LocalDevelopmentAuthOptions>
{
    public const string SchemeName = "LocalDevelopment";

    public LocalDevelopmentAuthHandler(
        IOptionsMonitor<LocalDevelopmentAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var identity = new ClaimsIdentity(
            [new Claim("sub", Options.UserId.ToString())],
            SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}