namespace GameOfDrones.Api.Models;

public class GameRoom
{
    public string Id { get; set; } = string.Empty;

    public string Player1Name { get; set; } = string.Empty;
    public string? Player2Name { get; set; }

    public string Phase { get; set; } = "waiting_join";

    public int P1Wins { get; set; }
    public int P2Wins { get; set; }
    public int Round { get; set; } = 1;

    public string? PendingP1Move { get; set; }
    public string? PendingP2Move { get; set; }

    public int? ResolvedRoundNumber { get; set; }
    public string? ResolvedLabel { get; set; }
    public string? ResolvedP1Move { get; set; }
    public string? ResolvedP2Move { get; set; }

    public string? WinnerName { get; set; }

    public bool WantsRematchP1 { get; set; }
    public bool WantsRematchP2 { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
