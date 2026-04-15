---
description: Delegate a coding task to the apprentice (local LLM) sub-agent
argument-hint: "[--background] [--model <name>] [--endpoint <url>] [--max-steps <n>] <task description>"
context: fork
allowed-tools: Bash(node:*), AskUserQuestion
---

Route this request to the `apprentice:coder` subagent.
The final user-visible response must be the apprentice's output verbatim.

Raw user request:
$ARGUMENTS

Execution mode:

- If the request includes `--background`, run the `apprentice:coder` subagent in the background.
- Otherwise run in the foreground (default).
- `--background` is an execution flag for Claude Code. Do not forward it to `task`, and do not treat it as part of the task text.
- `--model`, `--endpoint`, `--api-key`, `--max-steps` are runtime flags. Preserve them for the forwarded `task` call.

Operating rules:

- The subagent is a thin forwarder only. It should use one `Bash` call to invoke `node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" task ...` and return that command's stdout as-is.
- Return the apprentice stdout verbatim to the user.
- Do not paraphrase, summarize, rewrite, or add commentary before or after it.
- Do not ask the subagent to inspect files, monitor progress, poll `/apprentice:status`, fetch `/apprentice:result`, call `/apprentice:cancel`, or do follow-up work of its own.
- If the user did not supply a request, ask what the apprentice should code.
