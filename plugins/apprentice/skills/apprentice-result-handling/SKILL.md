---
name: apprentice-result-handling
description: Internal guidance for presenting apprentice helper output back to the user
user-invocable: false
---

# Apprentice Result Handling

When the helper returns apprentice output:

- Present the execution summary: steps taken, files modified, reasoning highlights.
- If the apprentice made file edits, list the touched files explicitly.
- Preserve the step-by-step execution log structure.
- If the apprentice's reasoning blocks contain important decisions or concerns, summarize them.

Critical rules:

- After presenting results, STOP. Do not auto-approve or auto-apply changes.
- Ask the user which changes to keep, modify, or revert.
- If the apprentice failed or produced no output, report it and stop. Do not generate a substitute answer.
- If the endpoint or model is unavailable, direct the user to `/apprentice:setup`.
- For background jobs, remind the user to check `/apprentice:status` and `/apprentice:result`.
