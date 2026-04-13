using GameOfDrones.Api.Data;
using GameOfDrones.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GameOfDrones.Api.Services;

public static class RulesSeed
{
    public static async Task EnsureDefaultRulesAsync(AppDbContext db)
    {
        if (await db.Moves.AnyAsync())
            return;

        var paper = new Move { Name = "Paper" };
        var rock = new Move { Name = "Rock" };
        var scissors = new Move { Name = "Scissors" };

        db.Moves.AddRange(paper, rock, scissors);
        await db.SaveChangesAsync();

        db.KillRules.AddRange(
            new KillRule { KillerMoveId = paper.Id, DefeatedMoveId = rock.Id },
            new KillRule { KillerMoveId = rock.Id, DefeatedMoveId = scissors.Id },
            new KillRule { KillerMoveId = scissors.Id, DefeatedMoveId = paper.Id }
        );
        await db.SaveChangesAsync();
    }
}
