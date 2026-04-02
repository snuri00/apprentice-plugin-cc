---
description: Check whether the local Kimi CLI is ready and authenticated
argument-hint: ''
allowed-tools: Bash(node:*), Bash(kimi:*), Bash(pip:*), Bash(curl:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" setup --json
```

If the result says Kimi is unavailable:
- Use `AskUserQuestion` exactly once to ask whether Claude should install Kimi now.
- Put the install option first and suffix it with `(Recommended)`.
- Use these two options:
  - `Install Kimi Code (Recommended)`
  - `Skip for now`
- If the user chooses install, run:

```bash
curl -L code.kimi.com/install.sh | sh
```

- Then rerun:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" setup --json
```

If Kimi is already installed:
- Do not ask about installation.

Output rules:
- Present the final setup output to the user.
- If installation was skipped, present the original setup output.
- If Kimi is installed but not authenticated, preserve the guidance to run `!kimi login`.
