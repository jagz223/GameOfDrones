using GameOfDrones.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GameOfDrones.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Move> Moves => Set<Move>();
    public DbSet<KillRule> KillRules => Set<KillRule>();
    public DbSet<PlayerStat> PlayerStats => Set<PlayerStat>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Move>(e =>
        {
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Name).HasMaxLength(64).IsRequired();
        });

        modelBuilder.Entity<KillRule>(e =>
        {
            e.HasIndex(x => new { x.KillerMoveId, x.DefeatedMoveId }).IsUnique();
            e.HasOne(x => x.KillerMove)
                .WithMany(m => m.RulesWhereKiller)
                .HasForeignKey(x => x.KillerMoveId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.DefeatedMove)
                .WithMany()
                .HasForeignKey(x => x.DefeatedMoveId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PlayerStat>(e =>
        {
            e.HasIndex(x => x.NormalizedName).IsUnique();
            e.Property(x => x.NormalizedName).HasMaxLength(128).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
        });
    }
}
