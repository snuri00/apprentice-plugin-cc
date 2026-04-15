---
name: apprentice-runtime
description: Internal helper contract for calling the apprentice runtime from Claude Code
user-invocable: false
---

# Apprentice Runtime

Use this skill only inside the `apprentice:coder` sub-agent.

Primary helper:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/apprentice.mjs" task "<raw arguments>"`

Execution rules:
- The sub-agent is a forwarder, not an orchestrator. Its only job is to invoke `task` once and return that stdout unchanged.
- Do not call `setup`, `status`, `result`, or `cancel` from `apprentice:coder`.
- Use `task` for every coding request.
- You may use the `apprentice-prompting` skill to rewrite the user's request into a tighter prompt before the single `task` call.
- That prompt drafting is the only Claude-side work allowed.

Command selection:
- Use exactly one `task` invocation per handoff.
- `--background` → pass through.
- `--model <name>` → pass through if user specifies.
- `--endpoint <url>` → pass through if user specifies.
- `--api-key <key>` → pass through if user specifies.
- `--max-steps <n>` → pass through if user specifies.

Safety rules:
- The apprentice only has file tools (Read, Write, Edit, Glob, Grep). It cannot run shell commands — if a task needs shell/tests/builds, do those yourself outside this handoff.
- All apprentice file operations are sandboxed to the workspace. Attempts to touch system paths or known-sensitive files are rejected automatically.
- Claude reviews all changes after the task finishes.
- Return stdout exactly as-is.
- If the Bash call fails or the apprentice cannot be invoked, return nothing.
