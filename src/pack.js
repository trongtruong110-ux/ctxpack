import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { loadIgnores } from "./ignore.js";
import { redact as redactText } from "./redact.js";
import { estimateTokens } from "./tokens.js";

function isProbablyBinary(buf) {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true; // NUL byte => binary
  }
  return false;
}

function walk(root, ig, maxBytes) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      const full = join(dir, e.name);
      const rel = relative(root, full).split(sep).join("/");
      if (ig.ignored(rel)) continue;
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.isFile()) continue;
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.size > maxBytes) continue;
      files.push({ full, rel, size: st.size });
    }
  }
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files;
}

export function pack(root, opts = {}) {
  const {
    maxBytes = 512 * 1024,
    redact = true,
    format = "markdown",
    extraIgnores = [],
  } = opts;

  const ig = loadIgnores(root, extraIgnores);
  const files = walk(root, ig, maxBytes);

  const included = [];
  let redactedTotal = 0;
  let skippedBinary = 0;

  for (const f of files) {
    let buf;
    try { buf = readFileSync(f.full); } catch { continue; }
    if (isProbablyBinary(buf)) { skippedBinary++; continue; }
    let content = buf.toString("utf8");
    if (redact) {
      const r = redactText(content);
      content = r.text;
      redactedTotal += r.count;
    }
    included.push({ rel: f.rel, content, tokens: estimateTokens(content) });
  }

  const output = render(included, format);
  const totalTokens = estimateTokens(output);

  return {
    output,
    stats: {
      files: included.length,
      redacted: redactedTotal,
      skippedBinary,
      totalTokens,
      perFile: included.map((f) => ({ rel: f.rel, tokens: f.tokens })),
    },
  };
}

function fenceLang(rel) {
  const ext = rel.split(".").pop().toLowerCase();
  const map = { js: "javascript", ts: "typescript", py: "python", rb: "ruby",
    go: "go", rs: "rust", java: "java", md: "markdown", json: "json",
    yml: "yaml", yaml: "yaml", sh: "bash", html: "html", css: "css" };
  return map[ext] || "";
}

function render(files, format) {
  if (format === "json") {
    return JSON.stringify({ files: files.map((f) => ({ path: f.rel, content: f.content })) }, null, 2);
  }
  if (format === "xml") {
    const parts = ["<codebase>"];
    for (const f of files) {
      parts.push(`  <file path="${f.rel}">`);
      parts.push(f.content);
      parts.push("  </file>");
    }
    parts.push("</codebase>");
    return parts.join("\n");
  }
  // markdown (default)
  const parts = ["# Codebase context\n"];
  parts.push("## Files\n");
  for (const f of files) parts.push(`- \`${f.rel}\` (~${f.tokens} tokens)`);
  parts.push("");
  for (const f of files) {
    parts.push(`\n## \`${f.rel}\`\n`);
    parts.push("```" + fenceLang(f.rel));
    parts.push(f.content);
    parts.push("```");
  }
  return parts.join("\n");
}
