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

        var ties = await _db.TieRules
            .AsNoTracking()
            .Include(t => t.MoveA)
            .Include(t => t.MoveB)
            .Select(t => new TiePairDto(t.MoveA.Name, t.MoveB.Name))
            .ToListAsync(ct);

        return Ok(new RulesResponseDto(rules, ties));
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

        var tiePairs = new List<(string A, string B)>();
        foreach (var t in body.Ties ?? Array.Empty<TiePairDto>())
        {
            var a = t.MoveA?.Trim() ?? string.Empty;
            var b = t.MoveB?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b))
                return BadRequest("Empate: nombres no válidos.");
            if (string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
                return BadRequest("Un movimiento no puede empatar consigo mismo.");
            tiePairs.Add((a, b));
        }

        var moveNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (k, d) in pairs)
        {
            moveNames.Add(k);
            moveNames.Add(d);
        }

        foreach (var (a, b) in tiePairs)
        {
            moveNames.Add(a);
            moveNames.Add(b);
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        _db.TieRules.RemoveRange(_db.TieRules);
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

        foreach (var (a, b) in tiePairs)
        {
            var ma = nameToMove[a];
            var mb = nameToMove[b];
            var first = string.Compare(ma.Name, mb.Name, StringComparison.OrdinalIgnoreCase) < 0 ? ma : mb;
            var second = ReferenceEquals(first, ma) ? mb : ma;
            _db.TieRules.Add(new TieRule
            {
                MoveAId = first.Id,
                MoveBId = second.Id
            });
        }

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var responseRules = await _db.KillRules
            .AsNoTracking()
            .Include(k => k.KillerMove)
            .Include(k => k.DefeatedMove)
            .Select(k => new MoveRuleDto(k.KillerMove.Name, k.DefeatedMove.Name))
            .ToListAsync(ct);

        var responseTies = await _db.TieRules
            .AsNoTracking()
            .Include(t => t.MoveA)
            .Include(t => t.MoveB)
            .Select(t => new TiePairDto(t.MoveA.Name, t.MoveB.Name))
            .ToListAsync(ct);

        return Ok(new RulesResponseDto(responseRules, responseTies));
    }

    [HttpPost("reset")]
    public async Task<ActionResult<RulesResponseDto>> ResetToClassic(CancellationToken ct)
    {
        await RulesSeed.ResetToClassicRulesAsync(_db, ct);

        var rules = await _db.KillRules
            .AsNoTracking()
            .Include(k => k.KillerMove)
            .Include(k => k.DefeatedMove)
            .Select(k => new MoveRuleDto(k.KillerMove.Name, k.DefeatedMove.Name))
            .ToListAsync(ct);

        return Ok(new RulesResponseDto(rules, Array.Empty<TiePairDto>()));
    }
}
