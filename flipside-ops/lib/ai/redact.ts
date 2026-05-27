// Pure functions for stripping secret fields out of sample rows before they
// are sent to Anthropic. The AI is told the *column header* of a secret field
// (so it can map "Pword" → `password`) but never the values.
//
// Secrets are identified two ways:
//   1. The caller marks a header as a known secret column (precise — used at
//      preview time once mapping is known).
//   2. We heuristically flag any header that looks like a credential during
//      the initial map step (fallback — before we know the mapping).

const SECRET_HEADER_PATTERNS = [
  /pass(word|wd|w)?/i,
  /\bpword\b/i,
  /\bpwd\b/i,
  /\bpw\b/i,
  /secret/i,
  /token/i,
  /api[\s_-]*key/i,
  /\bkey\b/i,
  /credenti?al/i,
  /\bpin\b/i,
  /private[\s_-]*key/i,
  /\bauth\b/i,
];

// Also commonly co-located with secrets and worth protecting by default.
const SEMI_SENSITIVE_HEADER_PATTERNS = [
  /user(name)?/i,
  /\blogin\b/i,
  /\bemail\b/i,
  /further[\s_-]*info/i,
  /\bnotes?\b/i,
];

export type RedactScope = "passwords" | "clients" | "suppliers";

export function isSecretHeader(header: string): boolean {
  return SECRET_HEADER_PATTERNS.some((re) => re.test(header));
}

export function isSemiSensitiveHeader(header: string): boolean {
  return SEMI_SENSITIVE_HEADER_PATTERNS.some((re) => re.test(header));
}

// Replace a value with a length-preserving placeholder so the model still sees
// that the column has content but never the content itself.
function placeholder(v: unknown): string {
  if (v == null) return "<empty>";
  const s = String(v);
  return `<redacted: ${s.length} chars>`;
}

// Redact a single row for the given domain. For passwords, anything matching
// the secret/semi-sensitive header patterns is replaced. For clients/suppliers
// only true secret patterns are redacted (since the column data itself is the
// payload we want the AI to reason about).
export function redactRow<T extends Record<string, unknown>>(
  row: T,
  scope: RedactScope,
): T {
  if (scope === "passwords") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (isSecretHeader(k) || isSemiSensitiveHeader(k)) {
        out[k] = placeholder(v);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }

  // clients / suppliers
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (isSecretHeader(k)) {
      out[k] = placeholder(v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function redactRows<T extends Record<string, unknown>>(
  rows: T[],
  scope: RedactScope,
): T[] {
  return rows.map((r) => redactRow(r, scope));
}

// ─── Mapping-aware redaction ──────────────────────────────────────────────
//
// The chat flow knows which excel header maps to which DB column. Once a
// mapping is known we should redact that excel header even if its name
// doesn't match the heuristic patterns ("Misc" -> password, etc.).

const SECRET_DB_COLUMNS_BY_SCOPE: Record<RedactScope, string[]> = {
  passwords: ["password", "username", "further_info"],
  clients: [],
  suppliers: [],
};

export function redactRowsForChat<T extends Record<string, unknown>>(args: {
  rows: T[];
  scope: RedactScope;
  // excelHeader -> dbColumn. Any header mapped to a secret dbColumn for the
  // scope is redacted, on top of the pattern-based fallback.
  mappings?: Record<string, string>;
}): T[] {
  const { rows, scope, mappings = {} } = args;
  const secretDbCols = new Set(SECRET_DB_COLUMNS_BY_SCOPE[scope]);
  const knownSecretHeaders = new Set(
    Object.entries(mappings)
      .filter(([, db]) => secretDbCols.has(db))
      .map(([excel]) => excel),
  );

  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const isMappedSecret = knownSecretHeaders.has(k);
      const isPatternSecret = isSecretHeader(k);
      const isPasswordSemi = scope === "passwords" && isSemiSensitiveHeader(k);
      if (isMappedSecret || isPatternSecret || isPasswordSemi) {
        out[k] = placeholder(v);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  });
}
