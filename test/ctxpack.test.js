import { test } from "node:test";
import assert from "node:assert/strict";
import { loadIgnores } from "../src/ignore.js";
import { redact, findSecrets } from "../src/redact.js";
import { estimateTokens } from "../src/tokens.js";

test("ignore: default dirs and extensions", () => {
  const ig = loadIgnores("/nonexistent-root");
  assert.equal(ig.ignored("node_modules/foo.js"), true);
  assert.equal(ig.ignored("a/b/node_modules/x.js"), true);
  assert.equal(ig.ignored("bundle.min.js"), true);
  assert.equal(ig.ignored("logo.png"), true);
  assert.equal(ig.ignored("src/ignore.js"), false);
  assert.equal(ig.ignored("README.md"), false);
});

test("ignore: ** glob matches across dirs", () => {
  const ig = loadIgnores("/nonexistent-root", ["**/secret/**"]);
  assert.equal(ig.ignored("a/b/secret/c.txt"), true);
  assert.equal(ig.ignored("secret/c.txt"), true);
  assert.equal(ig.ignored("a/public/c.txt"), false);
});

test("ignore: no stray bytes break single-star patterns", () => {
  const ig = loadIgnores("/nonexistent-root", ["*.tmp"]);
  assert.equal(ig.ignored("x.tmp"), true);
  assert.equal(ig.ignored("x.js"), false);
});

test("redact: masks known secret formats", () => {
  const input = [
    'const k = "sk-ant-api03-abcdefghij1234567890XYZ";',
    'password = "hunter2secret"',
    "AKIAIOSFODNN7EXAMPLE",
    "ghp_abcdefghijklmnopqrstuvwxyz0123456789",
  ].join("\n");
  const r = redact(input);
  assert.equal(r.count, 4);
  assert.ok(!r.text.includes("sk-ant-api03-abcdefghij"));
  assert.ok(!r.text.includes("hunter2secret"));
  assert.ok(r.text.includes("password = "), "keeps the assignment name");
});

test("redact: catches extended provider formats", () => {
  const cases = [
    'stripe = "sk_live_' + "a".repeat(30) + '"',
    'npm_' + "b".repeat(36),
    "GOCSPX-" + "c".repeat(28),
    "github_pat_" + "d".repeat(60),
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dQw4w9WgXcQabcdefghij",
  ];
  for (const c of cases) {
    const r = redact(c);
    assert.ok(r.count >= 1, `should redact: ${c.slice(0, 20)}`);
  }
});

test("redact: does not flag ordinary identifiers", () => {
  const ok = "const skateboard = 1; let token_count = 42; function key() {}";
  assert.equal(redact(ok).count, 0);
});

test("redact: leaves clean code untouched", () => {
  const input = "function add(a, b) { return a + b; }";
  const r = redact(input);
  assert.equal(r.count, 0);
  assert.equal(r.text, input);
});

test("findSecrets: reports line numbers and types, hides the value", () => {
  const text = "clean line\nconst k = \"sk-ant-api03-abcdefghij1234567890XYZ\";\nmore\nAKIAIOSFODNN7EXAMPLE\n";
  const hits = findSecrets(text);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].line, 2);
  assert.equal(hits[0].label, "ANTHROPIC_KEY");
  assert.equal(hits[1].line, 4);
  assert.equal(hits[1].label, "AWS_ACCESS_KEY_ID");
  // findings never carry the raw secret
  assert.ok(!JSON.stringify(hits).includes("sk-ant-api03-abcdefghij"));
});

test("findSecrets: clean text yields nothing", () => {
  assert.equal(findSecrets("function add(a,b){return a+b}").length, 0);
});

test("pack --fit: trims largest bodies to fit a token budget", async () => {
  const { pack } = await import("../src/pack.js");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "ctxpack-fit-"));
  writeFileSync(join(dir, "small.js"), "const a = 1;\n");
  writeFileSync(join(dir, "big.js"), "x".repeat(20000) + "\n");
  const full = pack(dir, {});
  const fit = pack(dir, { fitTokens: 400 });
  assert.ok(fit.stats.totalTokens < full.stats.totalTokens, "fit reduces tokens");
  assert.ok(fit.stats.trimmed >= 1, "at least one file trimmed");
  // the big file is listed but its body is omitted
  assert.ok(fit.output.includes("big.js"), "trimmed file still listed");
  assert.ok(!fit.output.includes("x".repeat(20000)), "big body omitted");
});

test("tokens: estimate is positive and scales", () => {
  assert.equal(estimateTokens(""), 0);
  const small = estimateTokens("const x = 1;");
  const big = estimateTokens("const x = 1;".repeat(100));
  assert.ok(small > 0);
  assert.ok(big > small * 50);
});
