using System.Security.Cryptography;
using GameOfDrones.Api.Contracts;
using GameOfDrones.Api.Data;
using GameOfDrones.Api.Models;
using GameOfDrones.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GameOfDrones.Api.Controllers;

[ApiController]
[Route("api/rooms")]
public class RoomsController : ControllerBase
{
    private const int RoomIdLength = 6;
    private static readonly char[] RoomIdChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();

    private readonly AppDbContext _db;

    public RoomsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<ActionResult<CreateRoomResponseDto>> Create([FromBody] CreateRoomRequestDto body, CancellationToken ct)
    {
        var name = body.Player1Name?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(name))
            return BadRequest("Nombre del jugador 1 requerido.");
        if (!PlayerNameValidation.TryValidate(name, out var errName))
            return BadRequest(errName);

        await RulesSeed.EnsureDefaultRulesAsync(_db);

        var id = await GenerateUniqueRoomId(ct);
        var now = DateTimeOffset.UtcNow;
        var room = new GameRoom
        {
            Id = id,
            Player1Name = name,
            Phase = "waiting_join",
            CreatedAt = now,
            UpdatedAt = now,
        };
        _db.GameRooms.Add(room);
        await _db.SaveChangesAsync(ct);

        return Ok(new CreateRoomResponseDto(id));
    }

    [HttpPost("join")]
    public async Task<ActionResult<JoinRoomResponseDto>> Join([FromBody] JoinRoomRequestDto body, CancellationToken ct)
    {
        var rid = NormalizeRoomId(body.RoomId);
        var p2 = body.Player2Name?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(rid))
            return BadRequest("ID de sala requerido.");
        if (string.IsNullOrEmpty(p2))
            return BadRequest("Nombre del jugador 2 requerido.");
        if (!PlayerNameValidation.TryValidate(p2, out var errP2))
            return BadRequest(errP2);

        var room = await _db.GameRooms.FirstOrDefaultAsync(r => r.Id == rid, ct);
        if (room == null)
            return NotFound("No existe una sala con ese ID.");

        if (room.Phase != "waiting_join")
            return BadRequest("Esa sala ya no acepta jugadores.");

        if (!string.IsNullOrEmpty(room.Player2Name))
            return BadRequest("La sala ya está completa.");

        if (string.Equals(p2, room.Player1Name, StringComparison.OrdinalIgnoreCase))
            return BadRequest("El jugador 2 debe tener un nombre distinto al jugador 1.");

        room.Player2Name = p2;
        room.Phase = "playing";
        room.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new JoinRoomResponseDto(room.Id, room.Player1Name, room.Player2Name!));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RoomStateDto>> GetState(string id, [FromQuery] int player, CancellationToken ct)
    {
        if (player is not (1 or 2))
            return BadRequest("El parámetro player debe ser 1 o 2.");

        var rid = NormalizeRoomId(id);
        if (string.IsNullOrEmpty(rid))
            return BadRequest("ID de sala no válido.");

        var room = await _db.GameRooms.AsNoTracking().FirstOrDefaultAsync(r => r.Id == rid, ct);
        if (room == null)
            return NotFound();

        return Ok(BuildState(room, player));
    }

    [HttpPost("{id}/move")]
    public async Task<ActionResult<MoveResponseDto>> SubmitMove(string id, [FromBody] MoveRequestDto body, CancellationToken ct)
    {
        if (body.Player is not (1 or 2))
            return BadRequest("Player debe ser 1 o 2.");

        var rid = NormalizeRoomId(id);
        if (string.IsNullOrEmpty(rid))
            return BadRequest("ID de sala no válido.");

        var move = body.Move?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(move))
            return BadRequest("Movimiento requerido.");

        await RulesSeed.EnsureDefaultRulesAsync(_db);
        var allowed = await GetAllowedMoveNames(ct);
        if (!allowed.Contains(move))
            return BadRequest("Movimiento no válido según las reglas actuales.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var room = await _db.GameRooms.FirstOrDefaultAsync(r => r.Id == rid, ct);
        if (room == null)
        {
            await tx.RollbackAsync(ct);
            return NotFound();
        }

        if (room.Phase != "playing")
        {
            await tx.RollbackAsync(ct);
            return BadRequest("La partida no está en curso.");
        }

        if (string.IsNullOrEmpty(room.Player2Name))
        {
            await tx.RollbackAsync(ct);
            return BadRequest("Aún no se unió el segundo jugador.");
        }

        var bothWereEmpty = string.IsNullOrEmpty(room.PendingP1Move) && string.IsNullOrEmpty(room.PendingP2Move);
        if (bothWereEmpty)
        {
            room.ResolvedRoundNumber = null;
            room.ResolvedLabel = null;
            room.ResolvedP1Move = null;
            room.ResolvedP2Move = null;
        }

        if (body.Player == 1)
        {
            if (!string.IsNullOrEmpty(room.PendingP1Move))
            {
                await tx.RollbackAsync(ct);
                return BadRequest("Ya enviaste tu movimiento en esta ronda.");
            }
            room.PendingP1Move = move;
        }
        else
        {
            if (!string.IsNullOrEmpty(room.PendingP2Move))
            {
                await tx.RollbackAsync(ct);
                return BadRequest("Ya enviaste tu movimiento en esta ronda.");
            }
            room.PendingP2Move = move;
        }

        var now = DateTimeOffset.UtcNow;
        room.UpdatedAt = now;

        if (string.IsNullOrEmpty(room.PendingP1Move) || string.IsNullOrEmpty(room.PendingP2Move))
        {
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Ok(new MoveResponseDto(
                WaitingForOpponent: true,
                RoundResolved: null,
                room.P1Wins,
                room.P2Wins,
                room.Round,
                room.Phase,
                room.WinnerName));
        }

        var killerMap = await LoadKillerMap(ct);
        var (outcome, label) = RoundResolution.Evaluate(
            room.PendingP1Move!,
            room.PendingP2Move!,
            killerMap,
            room.Player1Name,
            room.Player2Name!);

        switch (outcome)
        {
            case RoundOutcomeKind.P1Wins:
                room.P1Wins++;
                break;
            case RoundOutcomeKind.P2Wins:
                room.P2Wins++;
                break;
        }

        room.ResolvedRoundNumber = room.Round;
        room.ResolvedLabel = label;
        room.ResolvedP1Move = room.PendingP1Move;
        room.ResolvedP2Move = room.PendingP2Move;
        room.PendingP1Move = null;
        room.PendingP2Move = null;

        string? winner = null;
        if (room.P1Wins >= 3 || room.P2Wins >= 3)
        {
            room.Phase = "game_over";
            winner = room.P1Wins >= 3 ? room.Player1Name : room.Player2Name!;
            room.WinnerName = winner;
            await RecordGameWonAsync(winner, ct);
        }
        else
        {
            room.Round++;
        }

        var resolved = new ResolvedRoundDto(
            room.ResolvedRoundNumber.Value,
            room.ResolvedLabel!,
            room.ResolvedP1Move!,
            room.ResolvedP2Move!);

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return Ok(new MoveResponseDto(
            WaitingForOpponent: false,
            RoundResolved: resolved,
            room.P1Wins,
            room.P2Wins,
            room.Round,
            room.Phase,
            room.WinnerName));
    }

    [HttpPost("{id}/rematch")]
    public async Task<ActionResult<RoomStateDto>> RequestRematch(string id, [FromBody] RematchRequestDto body, CancellationToken ct)
    {
        if (body.Player is not (1 or 2))
            return BadRequest("Player debe ser 1 o 2.");

        var rid = NormalizeRoomId(id);
        if (string.IsNullOrEmpty(rid))
            return BadRequest("ID de sala no válido.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var room = await _db.GameRooms.FirstOrDefaultAsync(r => r.Id == rid, ct);
        if (room == null)
        {
            await tx.RollbackAsync(ct);
            return NotFound();
        }

        if (room.Phase != "game_over")
        {
            await tx.RollbackAsync(ct);
            return BadRequest("La revancha solo está disponible al terminar la partida.");
        }

        if (body.Player == 1)
            room.WantsRematchP1 = true;
        else
            room.WantsRematchP2 = true;

        room.UpdatedAt = DateTimeOffset.UtcNow;

        if (room.WantsRematchP1 && room.WantsRematchP2)
            ResetRoomAfterRematch(room);

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var fresh = await _db.GameRooms.AsNoTracking().FirstAsync(r => r.Id == rid, ct);
        return Ok(BuildState(fresh, body.Player));
    }

    private static void ResetRoomAfterRematch(GameRoom room)
    {
        room.Phase = "playing";
        room.P1Wins = 0;
        room.P2Wins = 0;
        room.Round = 1;
        room.PendingP1Move = null;
        room.PendingP2Move = null;
        room.ResolvedRoundNumber = null;
        room.ResolvedLabel = null;
        room.ResolvedP1Move = null;
        room.ResolvedP2Move = null;
        room.WinnerName = null;
        room.WantsRematchP1 = false;
        room.WantsRematchP2 = false;
        room.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static RoomStateDto BuildState(GameRoom r, int askingPlayer)
    {
        var opponentJoined = !string.IsNullOrEmpty(r.Player2Name);
        var yourMove = askingPlayer == 1 ? r.PendingP1Move : r.PendingP2Move;
        var oppMove = askingPlayer == 1 ? r.PendingP2Move : r.PendingP1Move;

        ResolvedRoundDto? resolved = null;
        if (r.ResolvedRoundNumber is { } rn
            && r.ResolvedLabel != null
            && r.ResolvedP1Move != null
            && r.ResolvedP2Move != null)
        {
            resolved = new ResolvedRoundDto(rn, r.ResolvedLabel, r.ResolvedP1Move, r.ResolvedP2Move);
        }

        var youRm = askingPlayer == 1 ? r.WantsRematchP1 : r.WantsRematchP2;
        var oppRm = askingPlayer == 1 ? r.WantsRematchP2 : r.WantsRematchP1;

        return new RoomStateDto(
            r.Id,
            r.Phase,
            r.Player1Name,
            r.Player2Name,
            r.Round,
            r.P1Wins,
            r.P2Wins,
            askingPlayer,
            opponentJoined,
            !string.IsNullOrEmpty(yourMove),
            !string.IsNullOrEmpty(oppMove),
            resolved,
            r.WinnerName,
            youRm,
            oppRm);
    }

    private async Task<HashSet<string>> GetAllowedMoveNames(CancellationToken ct)
    {
        var rules = await _db.KillRules
            .AsNoTracking()
            .Include(k => k.KillerMove)
            .Include(k => k.DefeatedMove)
            .ToListAsync(ct);

        var set = new HashSet<string>(StringComparer.Ordinal);
        foreach (var k in rules)
        {
            set.Add(k.KillerMove.Name);
            set.Add(k.DefeatedMove.Name);
        }
        return set;
    }

    private async Task<Dictionary<string, string>> LoadKillerMap(CancellationToken ct)
    {
        var rules = await _db.KillRules
            .AsNoTracking()
            .Include(k => k.KillerMove)
            .Include(k => k.DefeatedMove)
            .ToListAsync(ct);

        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var k in rules)
            map[k.KillerMove.Name] = k.DefeatedMove.Name;
        return map;
    }

    private async Task RecordGameWonAsync(string winnerName, CancellationToken ct)
    {
        var raw = winnerName.Trim();
        var key = raw.ToLowerInvariant();

        var entity = await _db.PlayerStats.FirstOrDefaultAsync(p => p.NormalizedName == key, ct);
        if (entity == null)
        {
            entity = new PlayerStat
            {
                NormalizedName = key,
                DisplayName = raw,
                GamesWon = 0,
            };
            _db.PlayerStats.Add(entity);
        }
        else
        {
            entity.DisplayName = raw;
        }

        entity.GamesWon++;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<string> GenerateUniqueRoomId(CancellationToken ct)
    {
        for (var attempt = 0; attempt < 40; attempt++)
        {
            var id = NewRoomId();
            var exists = await _db.GameRooms.AsNoTracking().AnyAsync(r => r.Id == id, ct);
            if (!exists)
                return id;
        }

        throw new InvalidOperationException("No se pudo generar un ID de sala único.");
    }

    private static string NewRoomId()
    {
        Span<byte> bytes = stackalloc byte[RoomIdLength];
        RandomNumberGenerator.Fill(bytes);
        var chars = new char[RoomIdLength];
        for (var i = 0; i < RoomIdLength; i++)
            chars[i] = RoomIdChars[bytes[i] % RoomIdChars.Length];
        return new string(chars);
    }

    private static string? NormalizeRoomId(string? id)
    {
        var t = id?.Trim().ToUpperInvariant();
        return string.IsNullOrEmpty(t) ? null : t;
    }
}
