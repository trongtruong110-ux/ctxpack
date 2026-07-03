#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pack, scan } from "./pack.js";
import { resolveModel } from "./tokens.js";

function parseArgs(argv) {
  const opts = { root: ".", format: "markdown", model: "claude-fable-5", redact: true, out: null, maxKb: 512 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--format" || a === "-f") opts.format = argv[++i];
    else if (a === "--model" || a === "-m") opts.model = argv[++i];
    else if (a === "--out" || a === "-o") opts.out = argv[++i];
    else if (a === "--max-kb") opts.maxKb = Number(argv[++i]);
    else if (a === "--no-redact") opts.redact = false;
    else if (a === "--check") opts.check = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (!a.startsWith("-")) rest.push(a);
  }
  if (rest[0]) opts.root = rest[0];
  return opts;
}

const HELP = `ctxpack — package a codebase into an LLM-optimized context bundle

Usage: ctxpack [path] [options]

Options:
  -f, --format <fmt>   markdown | xml | json   (default: markdown)
  -m, --model <name>   target model for budgeting (default: claude-fable-5)
  -o, --out <file>     write output to file instead of stdout
      --max-kb <n>     skip files larger than n KB (default: 512)
      --no-redact      disable automatic secret redaction (not recommended)
      --check          CI mode: scan for secrets, report them, exit 1 if any found
  -h, --help           show this help

Models: claude-fable-5, claude-opus-4-8, claude-sonnet-5, gpt-5, gpt-4.1, gemini-2.5-pro`;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return; }

  const root = resolve(opts.root);

  if (opts.check) {
    const { findings, filesScanned } = scan(root, { maxBytes: opts.maxKb * 1024 });
    const log = (s) => process.stderr.write(s + "\n");
    if (findings.length === 0) {
      log(`ctxpack --check: no secrets found in ${filesScanned} files ✓`);
      process.exit(0);
    }
    log(`ctxpack --check: ${findings.length} potential secret(s) in ${filesScanned} files:\n`);
    for (const f of findings) log(`  ${f.file}:${f.line}  ${f.type}`);
    log(`\n✗ failing — remove or ignore these before committing.`);
    process.exit(1);
  }

  const { output, stats } = pack(root, {
    format: opts.format,
    redact: opts.redact,
    maxBytes: opts.maxKb * 1024,
  });

  const model = resolveModel(opts.model);
  const pct = ((stats.totalTokens / model.context) * 100).toFixed(1);

  if (opts.out) {
    writeFileSync(opts.out, output);
  } else {
    process.stdout.write(output);
    if (!process.stdout.isTTY) process.stderr.write("\n");
  }

  const log = (s) => process.stderr.write(s + "\n");
  log("");
  log(`ctxpack: ${stats.files} files packed`);
  log(`  tokens: ~${stats.totalTokens.toLocaleString()}  (${pct}% of ${model.label} ${model.context.toLocaleString()} ctx)`);
  if (stats.redacted > 0) log(`  redacted: ${stats.redacted} secret(s)`);
  if (stats.skippedBinary > 0) log(`  skipped: ${stats.skippedBinary} binary file(s)`);
  if (stats.totalTokens > model.context) {
    log(`  ⚠ exceeds ${model.label} context by ~${(stats.totalTokens - model.context).toLocaleString()} tokens`);
  }
}

main();
