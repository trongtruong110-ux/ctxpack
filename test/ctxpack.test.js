import { test } from "node:test";
import assert from "node:assert/strict";
import { loadIgnores } from "../src/ignore.js";
import { redact } from "../src/redact.js";
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

test("redact: leaves clean code untouched", () => {
  const input = "function add(a, b) { return a + b; }";
  const r = redact(input);
  assert.equal(r.count, 0);
  assert.equal(r.text, input);
});

test("tokens: estimate is positive and scales", () => {
  assert.equal(estimateTokens(""), 0);
  const small = estimateTokens("const x = 1;");
  const big = estimateTokens("const x = 1;".repeat(100));
  assert.ok(small > 0);
  assert.ok(big > small * 50);
});
