---
name: kimi-prompting
description: Internal guidance for composing effective prompts for the Kimi Code CLI
user-invocable: false
---

# Kimi Code Prompting

Use this skill when `kimi:kimi-coder` needs to shape a prompt for Kimi before forwarding.

Kimi Code is an agentic coding assistant. It uses tools (Shell, Read, Write, Edit, Glob, Grep) to explore and modify code. Prompt it like an operator giving a clear task brief.

## Prompt structure

1. State the task concisely in one sentence
2. Specify the target files/directories when known
3. Define completion criteria (tests pass, lint clean, specific behavior)
4. Mention constraints (preserve existing API, no new dependencies, etc.)

## What works well

- Implementation tasks with clear specs
- UI components with described behavior
- Boilerplate generation
- Test writing when given the module to test
- Refactoring with clear before/after requirements
- Bug fixes with clear reproduction steps

## What to avoid

- Vague open-ended exploration (Kimi works better with direction)
- Architecture decisions (keep those with Claude)
- Security-critical code without explicit security requirements
- Tasks requiring deep understanding of business logic not in the codebase
- Multiple unrelated tasks in a single prompt (split them)

## Example prompt patterns

**Good:** "In src/auth/, create a JWT middleware that validates tokens from the Authorization header. Use the jose library. Export a verifyToken function. Add tests in src/auth/__tests__/jwt.test.ts."

**Bad:** "Add authentication to the app."

**Good:** "Refactor src/utils/date.ts: replace moment.js calls with date-fns equivalents. Keep the same function signatures. Run `npm test` after to verify."

**Bad:** "Clean up the date utils."
