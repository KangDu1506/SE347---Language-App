namespace DTOs.Quiz
{
    public enum DifficultyLevel
    {
        Beginner,
        Intermediate,
        Advanced,
        Expert,
        Master
    }

    public class Quiz
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public DifficultyLevel Difficulty { get; set; } = DifficultyLevel.Beginner;
        public List<string> Questions { get; set; } = new List<string>();
    }
}
