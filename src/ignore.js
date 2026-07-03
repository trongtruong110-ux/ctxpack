// Lightweight .gitignore-style matching + sensible defaults. Not a full
// gitignore spec implementation, but covers the common cases (dir names,
// extensions, globs with * and **).

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_IGNORES = [
  ".git", "node_modules", "dist", "build", "out", "target", ".next",
  ".venv", "venv", "__pycache__", ".mypy_cache", ".pytest_cache",
  ".idea", ".vscode", "coverage", ".cache", "vendor",
  "*.min.js", "*.min.css", "*.map", "*.lock", "package-lock.json",
  "*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.ico", "*.svg",
  "*.pdf", "*.zip", "*.tar", "*.gz", "*.mp4", "*.mov", "*.woff", "*.woff2",
  "*.exe", "*.dll", "*.so", "*.dylib", "*.bin", "*.wasm",
];

function patternToRegex(pattern) {
  let p = pattern.trim();
  if (!p || p.startsWith("#")) return null;
  const negate = p.startsWith("!");
  if (negate) p = p.slice(1);
  const anchored = p.startsWith("/");
  if (anchored) p = p.slice(1);
  // Escape regex specials except * and ?, then translate globs. Plain ASCII
  // sentinels keep the multi-pass translation unambiguous with no risk of
  // introducing odd bytes. `**/` matches zero or more directories so a
  // pattern like `**/secret` also matches `secret` at the root.
  const DSLASH = "__CTXPACK_DSTARSLASH__";
  const DSTAR = "__CTXPACK_DSTAR__";
  const re = p
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .split("**/").join(DSLASH)
    .split("**").join(DSTAR)
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .split(DSLASH).join("(?:.*/)?")
    .split(DSTAR).join(".*");
  const body = anchored ? `^${re}(/.*)?$` : `(^|/)${re}(/.*)?$`;
  return { re: new RegExp(body), negate };
}

export function loadIgnores(root, extra = []) {
  const patterns = [...DEFAULT_IGNORES, ...extra];
  try {
    const gi = readFileSync(join(root, ".gitignore"), "utf8");
    patterns.push(...gi.split("\n"));
  } catch { /* no .gitignore */ }
  const compiled = patterns.map(patternToRegex).filter(Boolean);
  return {
    ignored(relPath) {
      let ignored = false;
      for (const { re, negate } of compiled) {
        if (re.test(relPath)) ignored = !negate;
      }
      return ignored;
    },
  };
}
