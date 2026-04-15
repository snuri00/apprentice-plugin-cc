---
description: Check apprentice runtime (endpoint + model), and offer to save a default model
argument-hint: '[--endpoint <url>] [--model <name>]'
allowed-tools: Bash(node:*), Bash(ollama:*), Bash(curl:*), AskUserQuestion
---

Step 1 — run setup and parse the JSON:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" setup --json $ARGUMENTS
```

Interpret the JSON:

- `endpointStatus.available === false` → the local server is not reachable. Advise the user to start their backend:
  - Ollama: `ollama serve` in a separate terminal, then `ollama pull <model>`.
  - llama.cpp: `llama-server --port 8080 --host 0.0.0.0 -cb -m <gguf>` and re-run `/apprentice:setup --endpoint http://localhost:8080/v1`.
  - LM Studio / vLLM: start the OpenAI-compatible server.

- `ripgrep.available === false` → `Glob` and `Grep` tools will fail. Tell the user to `sudo apt install ripgrep` (or the equivalent package for their distro).

- `endpointStatus.available === true` but no `model` is set AND `availableModels.length > 0`:
  - Offer to save a default. Use **AskUserQuestion** with a single question:
    - `question`: "Save a default model for this workspace?"
    - `options`: up to 4 entries from `availableModels` (each: label = the model id, description = "Save as default for this workspace"). If there is only one available model, suffix its label with `(Recommended)`.
  - On selection, run:
    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" config set model "<chosen>"
    ```
  - Then re-run `node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" setup --json` and show the updated report.

- `endpointStatus.available === true` and `availableModels.length === 0`:
  - No models are loaded at the endpoint. Tell the user to pull one: `ollama pull gemma4:26b`, `ollama pull qwen2.5-coder:14b`, or any supported local model.

- `endpointStatus.available === true` and a `model` is set but `modelStatus.loaded === false`:
  - The configured model is not loaded at the endpoint. Suggest `ollama pull <model>` (or equivalent).

Finally, present the rendered setup report (the non-`--json` version if easier — or summarize from JSON) to the user, and stop.

Rules:
- Use AskUserQuestion at most once, only for the model-picker case described above.
- Never auto-install packages or pull models without asking.
- If `ready === true` from the first setup call, just present it — no follow-up.
