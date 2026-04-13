using System.Globalization;
using System.Linq;
using System.Text;

namespace GameOfDrones.Api.Services;

public static class PlayerNameValidation
{
    private static readonly HashSet<string> BannedTokens = new(StringComparer.Ordinal)
    {
        "mierda", "puta", "puto", "putas", "putos", "cabron", "joder", "cono", "hostia",
        "idiota", "imbecil", "estupido", "mamada", "marica", "maricon", "verga", "pinga",
        "culero", "basura", "fuck", "shit", "bitch", "dick", "cock", "cunt", "asshole",
        "pene", "pito", "mierdoso", "hijoputa",
    };

    public static bool TryValidate(string? name, out string error)
    {
        error = string.Empty;
        var t = name?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(t))
            return true;

        var ascii = StripAccents(t.ToLowerInvariant());
        foreach (var tok in Tokenize(ascii))
        {
            if (BannedTokens.Contains(tok))
            {
                error = "Elige un nombre sin palabras ofensivas.";
                return false;
            }
        }

        var compact = new string(ascii.Where(char.IsLetterOrDigit).ToArray());
        foreach (var banned in BannedTokens.Where(b => b.Length >= 4))
        {
            if (compact.Contains(banned, StringComparison.Ordinal))
            {
                error = "Elige un nombre sin palabras ofensivas.";
                return false;
            }
        }

        return true;
    }

    private static string StripAccents(string s)
    {
        var n = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(n.Length);
        foreach (var c in n)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    private static IEnumerable<string> Tokenize(string asciiLower)
    {
        var sb = new StringBuilder();
        foreach (var c in asciiLower)
        {
            if (char.IsLetterOrDigit(c))
                sb.Append(c);
            else if (sb.Length > 0)
            {
                yield return sb.ToString();
                sb.Clear();
            }
        }
        if (sb.Length > 0)
            yield return sb.ToString();
    }
}
