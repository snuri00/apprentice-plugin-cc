# apprentice

A Claude Code plugin that delegates file-editing to a local LLM running on your own machine. Claude plans and reviews; the local model ("apprentice") does the typing.

Works with any OpenAI-compatible endpoint — Ollama, `llama.cpp` / `llama-server`, LM Studio, vLLM, LiteLLM, etc. Pick any model you already have pulled.

## Why

Running `Edit`, `Write`, `Read`, `Glob`, `Grep` tools through a local model during long coding sessions cuts Claude API tokens drastically, lets you stay offline, and keeps Claude's "brain" free for architecture and review. Local code models have caught up on tool-use benchmarks enough for this to be practical (Gemma 4, Qwen2.5-Coder, DeepSeek-Coder-V2/V3).

The split matches a senior/junior workflow:

- **Claude (senior):** plans the task, runs shell/tests/git, reviews the apprentice's diff.
- **Apprentice (junior, local):** Read/Edit/Write inside the workspace.

## Requirements

- Claude Code
- Node.js 20+
- `ripgrep` (`rg`) — used by Glob/Grep
- A running OpenAI-compatible endpoint exposing `/v1/chat/completions` and `/v1/models`
- A model with native function-calling / `tool_calls` support

## Install

```bash
# In Claude Code
/plugin marketplace add snuri00/apprentice-plugin-cc
/plugin install apprentice
```

Then start your local backend, e.g.:

```bash
# Ollama (default endpoint http://localhost:11434/v1)
ollama serve &
ollama pull gemma4:26b            # or qwen2.5-coder:14b, deepseek-coder-v2:16b, ...

# or llama.cpp
llama-server --port 8080 --host 0.0.0.0 -cb -m /path/to/model.gguf
```

Check readiness:

```
/apprentice:setup --model gemma4:26b
```

## Usage

```
/apprentice:code [--model <name>] [--endpoint <url>] [--max-steps <n>] [--background] <task>
/apprentice:status [job-id] [--all]
/apprentice:result [job-id]
/apprentice:cancel [job-id]
/apprentice:setup  [--endpoint <url>] [--model <name>]
```

Examples:

```
/apprentice:code --model gemma4:26b "In src/utils/date.ts, replace moment.js calls with date-fns equivalents. Keep function signatures."

/apprentice:code --model qwen2.5-coder:14b --background "Generate tests for src/auth/jwt.ts in src/auth/__tests__/jwt.test.ts"
```

### Environment variables

- `APPRENTICE_MODEL` — default model id (`gemma4:26b`, `qwen2.5-coder:14b`, ...)
- `APPRENTICE_ENDPOINT` — default endpoint (default `http://localhost:11434/v1`)
- `OPENAI_API_KEY` — optional, for proxies / vLLM / LiteLLM gateways

Model and endpoint are always runtime-configurable — never hardcoded. Swap models freely.

## Security model

The apprentice runs in your Node process and has real file-system access, so this plugin ships with defensive defaults — no permission dialogs, just hard rejects.

- **No shell access.** The apprentice has Read / Write / Edit / Glob / Grep only. Shell-style commands (`rm`, `git`, `curl`, build tools) stay with Claude, where they get human oversight.
- **Workspace sandbox.** All paths resolve inside the current working directory. Anything outside is rejected as *"Path escapes workspace"*.
- **Dangerous-path blocklist.** Even if someone points the apprentice at a broader workspace, writes to `/etc`, `/boot`, `/sys`, `/proc`, `/dev`, `/bin`, `/sbin`, `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.docker`, `~/.bashrc`, `~/.gitconfig` (and similar) are rejected.
- **Sensitive-read blocklist.** Reads from `~/.ssh`, `~/.gnupg`, `~/.aws/credentials`, `/etc/shadow`, `/etc/sudoers` are rejected.
- **Protected filenames.** `.env*`, `id_rsa`/`id_ed25519`, `authorized_keys` are blocked regardless of location.
- **Read-before-Edit.** The apprentice must Read a file in the current task before it can Edit it. Stops hallucinated edits.
- **File mutation detection.** `mtime + size` are recorded at Read time and re-checked at Edit time. If the file changed on disk in between, Edit is rejected until the apprentice Reads it again.
- **Unique-match Edit** with smart-quote normalization (` ' ` ↔ `'`, `"` ↔ `"`). Ambiguous matches require `replace_all: true`.
- **No directories / device files** readable via Read.

These are re-implementations of Claude Code's security patterns — the algorithms are similar, the code is this plugin's own (no proprietary code copied).

## Architecture

```
/apprentice:code "..."
    └── Bash → node scripts/apprentice.mjs task ...
              └── scripts/lib/llm.mjs   (agent loop)
                    ├── POST ${endpoint}/v1/chat/completions  (SSE stream, tools=[Read,Write,Edit,Glob,Grep])
                    ├── Parse tool_calls → execute locally (scripts/lib/tools.mjs)
                    ├── Append tool results → continue loop
                    └── Final assistant message → return
              └── Job state + log on disk  (scripts/lib/state.mjs, job-control.mjs, tracked-jobs.mjs)
    └── Claude reviews the rendered result + touched file list.
```

Agent loop runs in a Node subprocess spawned by the Bash tool. Job state persists in `$CLAUDE_PLUGIN_DATA` so `/apprentice:status` and `/apprentice:result` keep working across sessions and background tasks.

## License

MIT
