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
    public DbSet<TieRule> TieRules => Set<TieRule>();
    public DbSet<PlayerStat> PlayerStats => Set<PlayerStat>();
    public DbSet<GameRoom> GameRooms => Set<GameRoom>();

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

        modelBuilder.Entity<TieRule>(e =>
        {
            e.HasIndex(x => new { x.MoveAId, x.MoveBId }).IsUnique();
            e.HasOne(x => x.MoveA)
                .WithMany()
                .HasForeignKey(x => x.MoveAId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.MoveB)
                .WithMany()
                .HasForeignKey(x => x.MoveBId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PlayerStat>(e =>
        {
            e.HasIndex(x => x.NormalizedName).IsUnique();
            e.Property(x => x.NormalizedName).HasMaxLength(128).IsRequired();
            e.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
        });

        modelBuilder.Entity<GameRoom>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(8);
            e.Property(x => x.Player1Name).HasMaxLength(128).IsRequired();
            e.Property(x => x.Player2Name).HasMaxLength(128);
            e.Property(x => x.Phase).HasMaxLength(32).IsRequired();
            e.Property(x => x.PendingP1Move).HasMaxLength(64);
            e.Property(x => x.PendingP2Move).HasMaxLength(64);
            e.Property(x => x.ResolvedLabel).HasMaxLength(128);
            e.Property(x => x.ResolvedP1Move).HasMaxLength(64);
            e.Property(x => x.ResolvedP2Move).HasMaxLength(64);
            e.Property(x => x.WinnerName).HasMaxLength(128);
        });
    }
}
