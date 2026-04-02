---
name: kimi-cli-runtime
description: Internal helper contract for calling the kimi-companion runtime from Claude Code
user-invocable: false
---

# Kimi Runtime

Use this skill only inside the `kimi:kimi-coder` sub-agent.

Primary helper:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" task "<raw arguments>"`

Execution rules:
- The sub-agent is a forwarder, not an orchestrator. Its only job is to invoke `task` once and return that stdout unchanged.
- Prefer the helper over direct `kimi` CLI invocation.
- Do not call `setup`, `status`, `result`, or `cancel` from `kimi:kimi-coder`.
- Use `task` for every coding request.
- You may use the `kimi-prompting` skill to rewrite the user's request into a tighter prompt before the single `task` call.
- That prompt drafting is the only Claude-side work allowed.

Command selection:
- Use exactly one `task` invocation per handoff.
- If `--background` is requested, pass it through.
- If `--continue` is requested, pass it through.
- If `--session <id>` is requested, pass it through.
- If `--model <name>` is requested, pass it through.
- If `--thinking` or `--no-thinking` is requested, pass it through.
- If `--max-steps <n>` is requested, pass it through.

Safety rules:
- Kimi WILL write files (--print implies --yolo). This is expected.
- Claude reviews all changes after Kimi finishes.
- Return stdout exactly as-is.
- If the Bash call fails or Kimi cannot be invoked, return nothing.
