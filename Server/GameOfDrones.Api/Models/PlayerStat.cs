namespace GameOfDrones.Api.Models;

public class PlayerStat
{
    public int Id { get; set; }
    public string NormalizedName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int GamesWon { get; set; }
}
