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
        IReadOnlyDictionary<string, HashSet<string>> killerToVictims,
        IReadOnlySet<string> normalizedTieKeys,
        string player1Name,
        string player2Name)
    {
        if (string.Equals(p1Move, p2Move, StringComparison.OrdinalIgnoreCase))
            return (RoundOutcomeKind.Tie, "Empate");

        var tieKey = MakeTieKey(p1Move, p2Move);
        if (normalizedTieKeys.Contains(tieKey))
            return (RoundOutcomeKind.Tie, "Empate");

        killerToVictims.TryGetValue(p1Move, out var v1);
        killerToVictims.TryGetValue(p2Move, out var v2);
        var p1beatsP2 = v1 != null && v1.Contains(p2Move);
        var p2beatsP1 = v2 != null && v2.Contains(p1Move);

        if (p1beatsP2 && p2beatsP1)
            return (RoundOutcomeKind.None, "Sin ganador (reglas)");
        if (p1beatsP2)
            return (RoundOutcomeKind.P1Wins, player1Name);
        if (p2beatsP1)
            return (RoundOutcomeKind.P2Wins, player2Name);
        return (RoundOutcomeKind.None, "Sin ganador (reglas)");
    }

    public static string MakeTieKey(string a, string b)
    {
        var c = string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
        var lo = c <= 0 ? a : b;
        var hi = c <= 0 ? b : a;
        return $"{lo.ToLowerInvariant()}\u001f{hi.ToLowerInvariant()}";
    }
}

