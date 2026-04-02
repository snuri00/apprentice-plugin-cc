---
description: Delegate a coding task to the Kimi Code sub-agent
argument-hint: "[--background|--wait] [--continue|--session <id>] [--model <model>] [--thinking|--no-thinking] [--max-steps <n>] <task description>"
context: fork
allowed-tools: Bash(node:*), AskUserQuestion
---

Route this request to the `kimi:kimi-coder` subagent.
The final user-visible response must be Kimi's output verbatim.

Raw user request:
$ARGUMENTS

Execution mode:

- If the request includes `--background`, run the `kimi:kimi-coder` subagent in the background.
- Otherwise run in the foreground (default).
- `--background` is an execution flag for Claude Code. Do not forward it to `task`, and do not treat it as part of the task text.
- `--model`, `--thinking`, `--no-thinking`, `--max-steps`, `--continue`, `--session` are runtime flags. Preserve them for the forwarded `task` call.

Operating rules:

- The subagent is a thin forwarder only. It should use one `Bash` call to invoke `node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" task ...` and return that command's stdout as-is.
- Return the Kimi companion stdout verbatim to the user.
- Do not paraphrase, summarize, rewrite, or add commentary before or after it.
- Do not ask the subagent to inspect files, monitor progress, poll `/kimi:status`, fetch `/kimi:result`, call `/kimi:cancel`, or do follow-up work of its own.
- If the user did not supply a request, ask what Kimi should code.
