namespace GameOfDrones.Api.Contracts;

public record MoveRuleDto(string MoveName, string Kills);

public record RulesResponseDto(IReadOnlyList<MoveRuleDto> Rules);

public record ReplaceRulesRequestDto(IReadOnlyList<KillPairDto> Rules);

public record KillPairDto(string Killer, string Defeated);

public record GameWonRequestDto(string WinnerName);

public record PlayerStatDto(string Name, int GamesWon);
