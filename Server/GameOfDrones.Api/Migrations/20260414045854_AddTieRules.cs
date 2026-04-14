using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GameOfDrones.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTieRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TieRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    MoveAId = table.Column<int>(type: "INTEGER", nullable: false),
                    MoveBId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TieRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TieRules_Moves_MoveAId",
                        column: x => x.MoveAId,
                        principalTable: "Moves",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TieRules_Moves_MoveBId",
                        column: x => x.MoveBId,
                        principalTable: "Moves",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TieRules_MoveAId_MoveBId",
                table: "TieRules",
                columns: new[] { "MoveAId", "MoveBId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TieRules_MoveBId",
                table: "TieRules",
                column: "MoveBId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TieRules");
        }
    }
}
