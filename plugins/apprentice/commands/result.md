---
description: Show the stored result for a finished apprentice job
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" result $ARGUMENTS
```

Present the output to the user.
