using GameOfDrones.Api.Contracts;
using GameOfDrones.Api.Data;
using GameOfDrones.Api.Models;
using GameOfDrones.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GameOfDrones.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _db;

    public StatsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PlayerStatDto>>> Get(CancellationToken ct)
    {
        var list = await _db.PlayerStats
            .AsNoTracking()
            .OrderByDescending(p => p.GamesWon)
            .ThenBy(p => p.DisplayName)
            .Select(p => new PlayerStatDto(p.DisplayName, p.GamesWon))
            .ToListAsync(ct);

        return Ok(list);
    }

    [HttpPost("game-won")]
    public async Task<ActionResult<PlayerStatDto>> RecordGameWon([FromBody] GameWonRequestDto body, CancellationToken ct)
    {
        var raw = body.WinnerName?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(raw))
            return BadRequest("Nombre del ganador requerido.");
        if (!PlayerNameValidation.TryValidate(raw, out var errWinner))
            return BadRequest(errWinner);

        var key = raw.ToLowerInvariant();

        var entity = await _db.PlayerStats.FirstOrDefaultAsync(p => p.NormalizedName == key, ct);
        if (entity == null)
        {
            entity = new PlayerStat
            {
                NormalizedName = key,
                DisplayName = raw,
                GamesWon = 0
            };
            _db.PlayerStats.Add(entity);
        }
        else
        {
            entity.DisplayName = raw;
        }

        entity.GamesWon++;
        await _db.SaveChangesAsync(ct);

        return Ok(new PlayerStatDto(entity.DisplayName, entity.GamesWon));
    }
}
