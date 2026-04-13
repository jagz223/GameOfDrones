using GameOfDrones.Api.Data;
using GameOfDrones.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

var conn = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Data Source=gameofdrones.db";

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(conn));
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var corsSection = builder.Configuration.GetSection("Cors:ClientOrigins");
var origins = corsSection.Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o =>
{
    o.AddDefaultPolicy(p =>
    {
        p.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    await RulesSeed.EnsureDefaultRulesAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

var wwwroot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
var browserDir = Path.Combine(wwwroot, "browser");
if (Directory.Exists(browserDir))
{
    var browserFiles = new PhysicalFileProvider(browserDir);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = browserFiles });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = browserFiles });
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.MapControllers();

if (Directory.Exists(browserDir))
{
    var browserFiles = new PhysicalFileProvider(browserDir);
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = browserFiles });
}
else
{
    app.MapFallbackToFile("index.html");
}

app.Run();
