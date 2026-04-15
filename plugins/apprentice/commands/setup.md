---
description: Check whether the local apprentice runtime (endpoint + model) is ready
argument-hint: '[--endpoint <url>] [--model <name>]'
allowed-tools: Bash(node:*), Bash(ollama:*), Bash(curl:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" setup --json $ARGUMENTS
```

The setup check reports:
- Node availability.
- ripgrep availability (required for Glob/Grep tools).
- Endpoint reachability — defaults to `http://localhost:11434/v1` (Ollama). Override with `--endpoint`.
- Model availability — pass `--model <id>` or set `APPRENTICE_MODEL`.

If the endpoint is unreachable, suggest the user start their backend:
- Ollama: `ollama serve` in a separate terminal, then `ollama pull <model>`.
- llama.cpp: `llama-server --port 8080 --host 0.0.0.0 -cb -m <gguf>` and pass `--endpoint http://localhost:8080/v1`.
- LM Studio / vLLM: start the OpenAI-compatible server and pass its `/v1` URL.

If the endpoint is reachable but the model is not loaded, suggest:
- Ollama: `ollama pull <model>` (e.g. `ollama pull gemma4:26b`, `ollama pull qwen2.5-coder:14b`).
- Other backends: load the model according to their docs.

Present the final setup output to the user.
