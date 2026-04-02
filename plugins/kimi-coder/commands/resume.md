---
description: Resume a previous Kimi session with follow-up instructions
argument-hint: '[--session <id>] [follow-up instructions]'
context: fork
allowed-tools: Bash(node:*), AskUserQuestion
---

Route this request to the `kimi:kimi-coder` subagent with `--continue` flag.

Raw user request:
$ARGUMENTS

Rules:

- If `--session <id>` is provided, pass it through to the task command.
- Otherwise add `--continue` to resume the last session for this workspace.
- The subagent forwards to `node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" task --continue ...`.
- Return the output verbatim.
- If the user did not supply follow-up instructions, ask what Kimi should do next.
