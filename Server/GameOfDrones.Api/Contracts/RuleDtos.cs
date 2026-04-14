namespace GameOfDrones.Api.Contracts;

public record MoveRuleDto(string MoveName, string Kills);

public record TiePairDto(string MoveA, string MoveB);

public record RulesResponseDto(IReadOnlyList<MoveRuleDto> Rules, IReadOnlyList<TiePairDto> Ties);

public record ReplaceRulesRequestDto(IReadOnlyList<KillPairDto> Rules, IReadOnlyList<TiePairDto>? Ties);

public record KillPairDto(string Killer, string Defeated);

public record GameWonRequestDto(string WinnerName);

public record PlayerStatDto(string Name, int GamesWon);
