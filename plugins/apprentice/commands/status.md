---
description: Show active and recent apprentice jobs for this workspace
argument-hint: '[job-id] [--all]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" status $ARGUMENTS
```

Present the output to the user.
