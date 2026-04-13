using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GameOfDrones.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRematchFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "WantsRematchP1",
                table: "GameRooms",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "WantsRematchP2",
                table: "GameRooms",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WantsRematchP1",
                table: "GameRooms");

            migrationBuilder.DropColumn(
                name: "WantsRematchP2",
                table: "GameRooms");
        }
    }
}
