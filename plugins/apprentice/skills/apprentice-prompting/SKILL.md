---
name: apprentice-prompting
description: Internal guidance for composing effective prompts for the apprentice (local LLM) task runner
user-invocable: false
---

# Apprentice Prompting

Use this skill when `apprentice:apprentice` needs to shape a prompt for the local model before forwarding.

The apprentice is an agentic coder running locally. It uses tools (Read, Write, Edit, Glob, Grep) to explore and modify code within the workspace. It cannot run shell commands — that stays with Claude. Prompt it like an operator giving a clear task brief to a junior developer.

## Prompt structure

1. State the task concisely in one sentence.
2. Specify the target files/directories when known.
3. Define completion criteria (tests pass, lint clean, specific behavior).
4. Mention constraints (preserve existing API, no new dependencies, etc.).
5. If the change touches security, auth, payment, database migrations, or an architectural pattern — call that out explicitly so the apprentice surfaces concerns instead of writing risky code silently.

## What works well

- Implementation tasks with clear specs
- UI components with described behavior
- Boilerplate generation
- Test writing when given the module to test
- Refactoring with clear before/after requirements
- Bug fixes with clear reproduction steps

## What to avoid

- Vague open-ended exploration — the apprentice works better with direction.
- Architecture decisions — keep those with Claude.
- Multiple unrelated tasks in a single prompt — split them.

## Model choice

The user sets `--model` (or `APPRENTICE_MODEL`). Models with strong function-calling + coding benchmarks work best:
- Gemma 4 (26B MoE / 31B Dense) — native function-calling, strong τ2-bench + LiveCodeBench scores.
- Qwen2.5-Coder (14B / 32B) — strong tool-calling, reliable code quality.
- DeepSeek-Coder-V2 / V3 — long context + high code quality.

Models without native function-calling may ignore the tool schema; the apprentice works best when the model supports `tool_calls` properly.

## Example prompt patterns

**Good:** "In src/auth/, create a JWT middleware that validates tokens from the Authorization header. Use the jose library. Export a verifyToken function. Add tests in src/auth/__tests__/jwt.test.ts."

**Bad:** "Add authentication to the app."

**Good:** "Refactor src/utils/date.ts: replace moment.js calls with date-fns equivalents. Keep the same function signatures."

**Bad:** "Clean up the date utils."
