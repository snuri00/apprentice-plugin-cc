---
description: Cancel an active apprentice job
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" cancel $ARGUMENTS
```

Present the output to the user.
