---
name: kimi-result-handling
description: Internal guidance for presenting Kimi Code helper output back to the user
user-invocable: false
---

# Kimi Result Handling

When the helper returns Kimi output:

- Present the execution summary: steps taken, files modified, thinking highlights.
- If Kimi made file edits, list the touched files explicitly.
- Preserve the step-by-step execution log structure.
- If Kimi's thinking blocks contain important reasoning, summarize them.

Critical rules:

- After presenting results, STOP. Do not auto-approve or auto-apply changes.
- Ask the user which changes to keep, modify, or revert.
- If Kimi failed or produced no output, report it and stop. Do not generate a substitute answer.
- If setup or authentication is required, direct the user to `/kimi:setup`.
- For background jobs, remind the user to check `/kimi:status` and `/kimi:result`.
