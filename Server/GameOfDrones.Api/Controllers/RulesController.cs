using GameOfDrones.Api.Contracts;
using GameOfDrones.Api.Data;
using GameOfDrones.Api.Models;
using GameOfDrones.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GameOfDrones.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RulesController : ControllerBase
{
    private readonly AppDbContext _db;

    public RulesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<RulesResponseDto>> Get(CancellationToken ct)
    {
        await RulesSeed.EnsureDefaultRulesAsync(_db);

        var rules = await _db.KillRules
            .AsNoTracking()
            .Include(k => k.KillerMove)
            .Include(k => k.DefeatedMove)
            .Select(k => new MoveRuleDto(k.KillerMove.Name, k.DefeatedMove.Name))
            .ToListAsync(ct);

        return Ok(new RulesResponseDto(rules));
    }

    [HttpPut]
    public async Task<ActionResult<RulesResponseDto>> Put([FromBody] ReplaceRulesRequestDto body, CancellationToken ct)
    {
        if (body.Rules == null || body.Rules.Count == 0)
            return BadRequest("Se requiere al menos una regla.");

        var pairs = new List<(string Killer, string Defeated)>();
        foreach (var r in body.Rules)
        {
            var killer = r.Killer?.Trim() ?? string.Empty;
            var defeated = r.Defeated?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(killer) || string.IsNullOrEmpty(defeated))
                return BadRequest("Nombres de movimiento no válidos.");
            if (string.Equals(killer, defeated, StringComparison.OrdinalIgnoreCase))
                return BadRequest("Un movimiento no puede derrotarse a sí mismo.");
            pairs.Add((killer, defeated));
        }

        var moveNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (k, d) in pairs)
        {
            moveNames.Add(k);
            moveNames.Add(d);
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        _db.KillRules.RemoveRange(_db.KillRules);
        _db.Moves.RemoveRange(_db.Moves);
        await _db.SaveChangesAsync(ct);

        var nameToMove = new Dictionary<string, Move>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in moveNames.OrderBy(x => x, StringComparer.OrdinalIgnoreCase))
        {
            var m = new Move { Name = name };
            _db.Moves.Add(m);
            nameToMove[name] = m;
        }

        await _db.SaveChangesAsync(ct);

        foreach (var (killer, defeated) in pairs)
        {
            var km = nameToMove[killer];
            var dm = nameToMove[defeated];
            _db.KillRules.Add(new KillRule
            {
                KillerMoveId = km.Id,
                DefeatedMoveId = dm.Id
            });
        }

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var response = await _db.KillRules
            .AsNoTracking()
            .Include(k => k.KillerMove)
            .Include(k => k.DefeatedMove)
            .Select(k => new MoveRuleDto(k.KillerMove.Name, k.DefeatedMove.Name))
            .ToListAsync(ct);

        return Ok(new RulesResponseDto(response));
    }
}
