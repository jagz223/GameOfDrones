using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GameOfDrones.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GameRooms",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Player1Name = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Player2Name = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Phase = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    P1Wins = table.Column<int>(type: "INTEGER", nullable: false),
                    P2Wins = table.Column<int>(type: "INTEGER", nullable: false),
                    Round = table.Column<int>(type: "INTEGER", nullable: false),
                    PendingP1Move = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    PendingP2Move = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    ResolvedRoundNumber = table.Column<int>(type: "INTEGER", nullable: true),
                    ResolvedLabel = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    ResolvedP1Move = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    ResolvedP2Move = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    WinnerName = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameRooms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Moves",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Moves", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlayerStats",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    NormalizedName = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    DisplayName = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    GamesWon = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerStats", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KillRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    KillerMoveId = table.Column<int>(type: "INTEGER", nullable: false),
                    DefeatedMoveId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KillRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KillRules_Moves_DefeatedMoveId",
                        column: x => x.DefeatedMoveId,
                        principalTable: "Moves",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_KillRules_Moves_KillerMoveId",
                        column: x => x.KillerMoveId,
                        principalTable: "Moves",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KillRules_DefeatedMoveId",
                table: "KillRules",
                column: "DefeatedMoveId");

            migrationBuilder.CreateIndex(
                name: "IX_KillRules_KillerMoveId_DefeatedMoveId",
                table: "KillRules",
                columns: new[] { "KillerMoveId", "DefeatedMoveId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Moves_Name",
                table: "Moves",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlayerStats_NormalizedName",
                table: "PlayerStats",
                column: "NormalizedName",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GameRooms");

            migrationBuilder.DropTable(
                name: "KillRules");

            migrationBuilder.DropTable(
                name: "PlayerStats");

            migrationBuilder.DropTable(
                name: "Moves");
        }
    }
}
