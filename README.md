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
      --fit <tokens>   trim the largest files to fit a token budget
      --check          CI mode: scan for secrets, exit 1 if any are found
  -h, --help           show help
```

### Fit a token budget

When a repo is too big for the window, `--fit` keeps the bundle under a target
by omitting the **largest** file bodies first — but still lists every file, so
the model knows the full shape of the project:

```bash
ctxpack . --fit 60000 -o context.md
```

```
ctxpack: 220 files packed
  tokens: ~59,400
  trimmed: 34 file(s) omitted to fit 60,000 tokens
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

## Writeups

- [Stop pasting your API keys into ChatGPT: a safer way to feed a codebase to an LLM](https://dev.to/cu_thinvreview_b2/stop-pasting-your-api-keys-into-chatgpt-a-safer-way-to-feed-a-codebase-to-an-llm-3j35)
- [A 2-minute pre-commit hook that stops you from committing API keys](https://dev.to/cu_thinvreview_b2/a-2-minute-pre-commit-hook-that-stops-you-from-committing-api-keys-5ca1)
- [Will your codebase fit in the context window? How to measure it (and trim to fit)](https://dev.to/cu_thinvreview_b2/will-your-codebase-fit-in-the-context-window-how-to-measure-it-and-trim-to-fit-5bn8)
- [How to give Claude or ChatGPT your entire codebase (the right way)](https://dev.to/cu_thinvreview_b2/how-to-give-claude-or-chatgpt-your-entire-codebase-the-right-way-4nbm)

## License

MIT
