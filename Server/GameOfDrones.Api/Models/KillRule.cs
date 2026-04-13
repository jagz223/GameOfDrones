namespace GameOfDrones.Api.Models;

public class KillRule
{
    public int Id { get; set; }
    public int KillerMoveId { get; set; }
    public Move KillerMove { get; set; } = null!;
    public int DefeatedMoveId { get; set; }
    public Move DefeatedMove { get; set; } = null!;
}
