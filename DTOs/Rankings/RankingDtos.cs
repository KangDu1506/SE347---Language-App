namespace SE347.DTOs.Rankings
{
    /// <summary>
    /// GET /api/rankings: bảng xếp hạng tổng của một kỳ (S3-05).
    /// <paramref name="Period"/> là "week" | "month" | "all". <paramref name="PeriodStart"/> là ngày bắt đầu kỳ
    /// theo giờ Việt Nam (thứ Hai hoặc ngày 01), null với "all".
    /// </summary>
    public record RankingResponseDto(
        string Period,
        DateOnly? PeriodStart,
        IReadOnlyList<RankingEntryDto> Entries,
        RankingCurrentUserDto CurrentUser);

    /// <summary>Một dòng trong danh sách công khai. Hạng liên tục 1, 2, 3..., không có hạng đồng hạng.</summary>
    public record RankingEntryDto(
        int Rank,
        string Username,
        string DisplayName,
        string? AvatarPath,
        long Xp,
        bool IsCurrentUser);

    /// <summary>
    /// Vị trí của người đang gọi, luôn có kể cả khi họ để private.
    /// <paramref name="Rank"/> là hạng nếu được xếp cùng danh sách công khai, null khi 0 XP trong kỳ hoặc tài khoản không active.
    /// </summary>
    public record RankingCurrentUserDto(
        int? Rank,
        long Xp,
        string ProfileVisibility,
        string Username,
        string DisplayName,
        string? AvatarPath);
}
