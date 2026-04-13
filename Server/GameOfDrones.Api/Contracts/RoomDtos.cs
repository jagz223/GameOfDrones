namespace GameOfDrones.Api.Contracts;

public record CreateRoomRequestDto(string Player1Name);

public record CreateRoomResponseDto(string RoomId);

public record JoinRoomRequestDto(string RoomId, string Player2Name);

public record JoinRoomResponseDto(string RoomId, string Player1Name, string Player2Name);

public record MoveRequestDto(int Player, string Move);

public record RematchRequestDto(int Player);

public record ResolvedRoundDto(int Round, string Label, string P1Move, string P2Move);

public record MoveResponseDto(
    bool WaitingForOpponent,
    ResolvedRoundDto? RoundResolved,
    int P1Wins,
    int P2Wins,
    int Round,
    string Phase,
    string? WinnerName);

public record RoomStateDto(
    string RoomId,
    string Phase,
    string Player1Name,
    string? Player2Name,
    int Round,
    int P1Wins,
    int P2Wins,
    int AskingPlayer,
    bool OpponentJoined,
    bool YourMoveSubmitted,
    bool OpponentMoveSubmitted,
    ResolvedRoundDto? ResolvedRound,
    string? WinnerName,
    bool YouWantRematch,
    bool OpponentWantsRematch);
