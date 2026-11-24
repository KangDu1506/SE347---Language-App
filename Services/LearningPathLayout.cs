namespace SE347.Services
{
    /// <summary>
    /// Bố cục 1 lộ trình (dựng từ LearningPath.json lúc khởi động, giống nhau cho mọi user).
    /// Chỉ chứa bài đã nạp được; trạng thái theo user do <see cref="ILearningPathService"/> tính.
    /// </summary>
    public sealed record LearningPathLayout(
        string Id,
        string Title,
        string Description,
        int Version,
        IReadOnlyList<LearningPathLayoutNode> Nodes);

    /// <summary>
    /// 1 bài trong lộ trình.
    /// * Mạch chính: Row = 1, Column = thứ tự trên mạch chính (1, 2, ...), Prerequisites = bài mạch chính liền trước
    ///   (cộng thêm prerequisites khai báo trong JSON nếu có).
    /// * Nhánh: Row xen kẽ 0 / 2 theo thứ tự nhánh, Column = cột bài mạch chính mà nhánh gắn vào
    ///   (afterLessonId, hoặc prerequisite đầu tiên nằm trên mạch chính) + thứ tự bài trong nhánh.
    /// </summary>
    public sealed record LearningPathLayoutNode(
        string ItemId,
        string LessonId,
        bool IsBranch,
        string? BranchId,
        string? BranchTitle,
        bool BranchRequired,
        int Column,
        int Row,
        IReadOnlyList<string> Prerequisites);
}
