using GameOfDrones.Api.Data;
using GameOfDrones.Api.Services;
using Microsoft.AspNetCore.StaticFiles;
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
    await db.Database.MigrateAsync();
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

static bool IsAngularFingerprintedAsset(string fileName)
{
    var ext = Path.GetExtension(fileName);
    if (ext is not ".js" and not ".css")
    {
        return false;
    }

    var stem = Path.GetFileNameWithoutExtension(fileName);
    return stem.StartsWith("main-", StringComparison.OrdinalIgnoreCase)
        || stem.StartsWith("chunk-", StringComparison.OrdinalIgnoreCase)
        || stem.StartsWith("polyfills-", StringComparison.OrdinalIgnoreCase)
        || stem.StartsWith("styles-", StringComparison.OrdinalIgnoreCase);
}

static void PrepareBrowserStaticFile(StaticFileResponseContext ctx)
{
    var name = ctx.File.Name;
    var h = ctx.Context.Response.Headers;

    if (string.Equals(name, "index.html", StringComparison.OrdinalIgnoreCase))
    {
        h["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0";
        h["Pragma"] = "no-cache";
        h["Expires"] = "0";
        return;
    }

    if (IsAngularFingerprintedAsset(name))
    {
        h["Cache-Control"] = "public, max-age=31536000, immutable";
        return;
    }

    h["Cache-Control"] = "no-cache, must-revalidate";
}

if (Directory.Exists(browserDir))
{
    var browserFiles = new PhysicalFileProvider(browserDir);
    var browserStatic = new StaticFileOptions
    {
        FileProvider = browserFiles,
        OnPrepareResponse = PrepareBrowserStaticFile,
    };
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = browserFiles });
    app.UseStaticFiles(browserStatic);
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
    app.MapFallbackToFile(
        "index.html",
        new StaticFileOptions
        {
            FileProvider = browserFiles,
            OnPrepareResponse = PrepareBrowserStaticFile,
        });
}
else
{
    app.MapFallbackToFile("index.html");
}

app.Run();
