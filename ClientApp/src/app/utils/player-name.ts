/** Normaliza para comparar sin tildes ni mayúsculas. */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

const BANNED_TOKENS = new Set(
  [
    'mierda',
    'puta',
    'puto',
    'putas',
    'putos',
    'cabron',
    'cabrón',
    'joder',
    'coño',
    'cono',
    'hostia',
    'idiota',
    'imbecil',
    'imbécil',
    'estupido',
    'estúpido',
    'mamada',
    'marica',
    'maricón',
    'maricon',
    'verga',
    'pinga',
    'culero',
    'basura',
    'fuck',
    'shit',
    'bitch',
    'dick',
    'cock',
    'cunt',
    'asshole',
    'pene',
    'pito',
    'mierdoso',
    'hijoputa',
  ].map((w) => stripAccents(w.toLowerCase())),
);

function tokenize(normalizedAscii: string): string[] {
  return normalizedAscii
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Devuelve un mensaje de error si el nombre no es válido, o null si está bien.
 */
export function validatePlayerDisplayName(raw: string): string | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const ascii = stripAccents(t.toLowerCase());
  const tokens = tokenize(ascii);
  for (const tok of tokens) {
    if (BANNED_TOKENS.has(tok)) {
      return 'Elige un nombre sin palabras ofensivas.';
    }
  }
  const compact = ascii.replace(/[^a-z0-9]/g, '');
  for (const banned of BANNED_TOKENS) {
    if (banned.length >= 4 && compact.includes(banned)) {
      return 'Elige un nombre sin palabras ofensivas.';
    }
  }
  return null;
}
