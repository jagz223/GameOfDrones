namespace GameOfDrones.Api.Models;

public class TieRule
{
    public int Id { get; set; }
    public int MoveAId { get; set; }
    public Move MoveA { get; set; } = null!;
    public int MoveBId { get; set; }
    public Move MoveB { get; set; } = null!;
}
