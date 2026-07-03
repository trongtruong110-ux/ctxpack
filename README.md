# ctxpack

Package a whole codebase into a single, LLM-optimized context bundle — with
**accurate per-model token budgeting** and **automatic secret redaction** built in.

Feeding a repo to Claude, Codex, or any LLM means answering two annoying
questions every time: *will this fit in the context window?* and *am I about to
paste my API keys into a prompt?* `ctxpack` answers both.

```bash
npx github:trongtruong110-ux/ctxpack . --model claude-fable-5
```

```
ctxpack: 34 files packed
  tokens: ~48,210  (24.1% of Claude Fable 5 200,000 ctx)
  redacted: 2 secret(s)
  skipped: 5 binary file(s)
```

## Why ctxpack

- **Per-model token budgeting.** Tells you what fraction of a target model's
  context you'll use *before* you paste, and warns when you blow past it.
  Presets for Claude (Fable 5 / Opus 4.8 / Sonnet 5), GPT-5/4.1, Gemini 2.5 Pro.
- **Automatic secret redaction.** Scans every file for API keys (Anthropic,
  OpenAI, AWS, Google), GitHub tokens, Slack tokens, private keys, and
  `password = "..."`-style assignments, and masks them before they ever reach
  the bundle. On by default.
- **Sensible defaults.** Skips `node_modules`, build output, lockfiles, images,
  and binaries automatically; honors your `.gitignore`.
- **Zero dependencies.** Pure Node, nothing to install into your project.

## Usage

```bash
ctxpack [path] [options]

  -f, --format <fmt>   markdown | xml | json   (default: markdown)
  -m, --model <name>   target model for budgeting (default: claude-fable-5)
  -o, --out <file>     write to a file instead of stdout
      --max-kb <n>     skip files larger than n KB (default: 512)
      --no-redact      disable secret redaction (not recommended)
      --check          CI mode: scan for secrets, exit 1 if any are found
  -h, --help           show help
```

### CI mode — fail the build if a secret leaks

`ctxpack --check` scans your tree and exits non-zero if it finds anything that
looks like a credential, reporting the location without printing the secret:

```
$ ctxpack . --check
ctxpack --check: 1 potential secret(s) in 34 files:

  src/config.js:12  ANTHROPIC_KEY

✗ failing — remove or ignore these before committing.
```

Drop it into a pre-commit hook or CI step:

```yaml
- run: npx github:trongtruong110-ux/ctxpack . --check -i "test/**" -i "**/*.example"
```

Use `-i / --ignore` (repeatable) to skip fixtures or example files that contain
deliberately fake credentials.

Examples:

```bash
# Markdown bundle, budgeted for Claude, written to a file
ctxpack . -m claude-fable-5 -o context.md

# XML format (some models attend better to tagged files), for GPT-5
ctxpack ./src -f xml -m gpt-5

# JSON for programmatic use
ctxpack . -f json -o context.json
```

## Install

No install needed — run it straight from GitHub with npx:

```bash
npx github:trongtruong110-ux/ctxpack . -o context.md
```

Or clone and link it:

```bash
git clone https://github.com/trongtruong110-ux/ctxpack
cd ctxpack && npm link      # now `ctxpack` is on your PATH
```

_(An `npm i -g ctxpack` release is coming.)_

## Formats

- **markdown** — a file index with per-file token counts, then fenced code
  blocks. Best for pasting into a chat.
- **xml** — `<file path="...">` tags; some models attend to structure better.
- **json** — `{ files: [{ path, content }] }` for feeding a pipeline.

## Notes on redaction

Redaction is heuristic and errs toward safety, but it is not a guarantee — treat
any generated bundle as you would the source. Disable with `--no-redact` only
for repos you know are secret-free.

## License

MIT
