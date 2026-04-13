namespace GameOfDrones.Api.Services;

public enum RoundOutcomeKind
{
    P1Wins,
    P2Wins,
    Tie,
    None,
}

public static class RoundResolution
{
    public static (RoundOutcomeKind Outcome, string Label) Evaluate(
        string p1Move,
        string p2Move,
        IReadOnlyDictionary<string, string> killerToVictim,
        string player1Name,
        string player2Name)
    {
        if (p1Move == p2Move)
            return (RoundOutcomeKind.Tie, "Empate");

        killerToVictim.TryGetValue(p1Move, out var p1Beats);
        killerToVictim.TryGetValue(p2Move, out var p2Beats);

        if (p1Beats == p2Move && p2Beats == p1Move)
            return (RoundOutcomeKind.None, "Sin ganador (reglas)");
        if (p1Beats == p2Move)
            return (RoundOutcomeKind.P1Wins, player1Name);
        if (p2Beats == p1Move)
            return (RoundOutcomeKind.P2Wins, player2Name);
        return (RoundOutcomeKind.None, "Sin ganador (reglas)");
    }
}
