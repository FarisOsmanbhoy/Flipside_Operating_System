import "server-only";

import fs from "node:fs";
import path from "node:path";

// Curated documentation excerpts injected into the import chat's system
// prompt. Reads the user-maintained markdown files at module load so the AI
// stays in sync with the docs without paying file I/O per chat turn.
//
// Add a section by listing it in SECTIONS. Each entry names the file, the
// heading text to anchor on, and the heading level (## or ###). Extraction
// captures everything from the matching heading up to the next heading at
// the same or higher level.

type Section = {
  file: string;
  heading: string;
  level: 2 | 3;
};

const SECTIONS: Section[] = [
  { file: "USER_GUIDE.md", heading: "The three access levels", level: 3 },
  { file: "USER_GUIDE.md", heading: "Add a password to the vault", level: 3 },
  { file: "USER_GUIDE.md", heading: "Edit soft-configurable lookups", level: 2 },
  { file: "USER_GUIDE.md", heading: "Import from Excel (AI-assisted)", level: 2 },
  { file: "README.md", heading: "AI features (import + diagnostics)", level: 2 },
];

const MAX_TOTAL_CHARS = 6000;
const PER_SECTION_CAP = 2000;

function extractSection(body: string, heading: string, level: 2 | 3): string | null {
  const lines = body.split(/\r?\n/);
  const headingPrefix = "#".repeat(level) + " ";
  const startIdx = lines.findIndex((l) => l.trim() === `${headingPrefix}${heading}`);
  if (startIdx === -1) return null;

  // Stop at the next heading of the same or higher level (## or # if level=2;
  // ##, ### caps would not stop a level-3 section, so we use <= level).
  const stopRe = new RegExp(`^#{1,${level}} `);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (stopRe.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join("\n").trim();
}

function truncate(text: string, cap: number): string {
  if (text.length <= cap) return text;
  return text.slice(0, cap).trimEnd() + "\n\n[…truncated]";
}

function buildPack(): string {
  const root = process.cwd();
  const fileCache = new Map<string, string | null>();
  const chunks: string[] = [];
  let total = 0;

  for (const sec of SECTIONS) {
    if (total >= MAX_TOTAL_CHARS) break;

    if (!fileCache.has(sec.file)) {
      try {
        const body = fs.readFileSync(path.join(root, sec.file), "utf8");
        fileCache.set(sec.file, body);
      } catch (e) {
        console.warn(
          `[importKnowledge] could not read ${sec.file}: ${(e as Error).message}`,
        );
        fileCache.set(sec.file, null);
      }
    }
    const body = fileCache.get(sec.file);
    if (!body) continue;

    const extracted = extractSection(body, sec.heading, sec.level);
    if (!extracted) {
      console.warn(
        `[importKnowledge] heading not found in ${sec.file}: "${sec.heading}"`,
      );
      continue;
    }

    const remaining = MAX_TOTAL_CHARS - total;
    const piece = truncate(extracted, Math.min(PER_SECTION_CAP, remaining));
    chunks.push(`<<< from ${sec.file} >>>\n${piece}`);
    total += piece.length;
  }

  return chunks.join("\n\n---\n\n");
}

// Computed once per server boot.
const KNOWLEDGE_PACK = buildPack();

export function getImportKnowledgePack(): string {
  return KNOWLEDGE_PACK;
}
