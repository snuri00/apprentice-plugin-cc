---
description: Get, set, or unset apprentice defaults (model, endpoint) for this workspace
argument-hint: '<get|set|unset> [key] [value]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" config $ARGUMENTS
```

Keys: `model`, `endpoint`. Config is per-workspace (keyed by git root or cwd).

Examples:
- `/apprentice:config get` — show current values
- `/apprentice:config set model gemma4:26b` — default model for this workspace
- `/apprentice:config set endpoint http://localhost:8080/v1` — switch to llama-server on 8080
- `/apprentice:config unset model` — remove saved default

Resolution order at task time: `--model` flag > `APPRENTICE_MODEL` env > workspace config > error.

Present the output to the user.
