import { spawn } from "node:child_process";
import readline from "node:readline";
import process from "node:process";

import { binaryAvailable, runCommand } from "./process.mjs";

export function getKimiAvailability(cwd) {
  return binaryAvailable("kimi", ["-V"], { cwd });
}

export function getKimiLoginStatus(cwd) {
  const result = runCommand("kimi", ["info"], { cwd });
  if (result.error) {
    return { available: false, loggedIn: false, detail: result.error.message };
  }
  if (result.status !== 0) {
    return { available: true, loggedIn: false, detail: result.stderr.trim() || "not authenticated" };
  }
  const output = result.stdout + result.stderr;
  const loggedIn = !(/not logged in|not authenticated|please login/i.test(output));
  return { available: true, loggedIn, detail: loggedIn ? "authenticated" : "not authenticated" };
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

export function buildKimiArgs(options) {
  const args = ["--print", "--output-format", "stream-json"];

  if (options.workDir) {
    args.push("--work-dir", options.workDir);
  }
  if (options.session) {
    args.push("--session", options.session);
  } else if (options.continueSession) {
    args.push("--continue");
  }
  if (options.model) {
    args.push("--model", options.model);
  }
  if (options.thinking === true) {
    args.push("--thinking");
  } else if (options.thinking === false) {
    args.push("--no-thinking");
  }
  if (options.maxSteps) {
    args.push("--max-steps-per-turn", String(options.maxSteps));
  }

  return args;
}

export function parseStreamJsonLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { type: "parse_error", raw: trimmed };
  }

  if (parsed.role === "assistant") {
    const thinks = [];
    const texts = [];
    const toolCalls = [];

    for (const block of parsed.content ?? []) {
      if (block.type === "think") {
        thinks.push(block.think);
      } else if (block.type === "text") {
        texts.push(block.text);
      }
    }

    for (const tc of parsed.tool_calls ?? []) {
      toolCalls.push({
        id: tc.id,
        name: tc.function?.name ?? tc.name ?? "unknown",
        arguments: tc.function?.arguments ?? tc.arguments ?? "{}"
      });
    }

    return { type: "assistant", thinks, texts, toolCalls };
  }

  if (parsed.role === "tool") {
    const outputs = [];
    for (const block of parsed.content ?? []) {
      if (block.type === "text") {
        outputs.push(block.text);
      }
    }
    return { type: "tool_result", toolCallId: parsed.tool_call_id, outputs };
  }

  return { type: "unknown", raw: parsed };
}

function extractToolPreview(tc) {
  try {
    const args = JSON.parse(tc.arguments);
    if (tc.name === "Shell") return shorten(args.command ?? "", 80);
    if (tc.name === "Write") return shorten(args.file_path ?? "", 80);
    if (tc.name === "Edit") return shorten(args.file_path ?? "", 80);
    if (tc.name === "Read") return shorten(args.file_path ?? "", 80);
    if (tc.name === "Glob") return shorten(args.pattern ?? "", 80);
    if (tc.name === "Grep") return shorten(args.pattern ?? "", 80);
    return "";
  } catch {
    return "";
  }
}

function describeToolPhase(toolName) {
  switch (toolName) {
    case "Shell":
      return "running";
    case "Write":
    case "Edit":
      return "editing";
    case "Read":
    case "Glob":
    case "Grep":
      return "investigating";
    case "WebSearch":
    case "WebFetch":
      return "researching";
    default:
      return "running";
  }
}

function extractFileChanges(toolCall, outputText, touchedFiles) {
  if (!toolCall) return;

  try {
    const args = JSON.parse(toolCall.arguments);
    if (toolCall.name === "Write" && args.file_path) {
      touchedFiles.add(args.file_path);
    }
    if (toolCall.name === "Edit" && args.file_path) {
      touchedFiles.add(args.file_path);
    }
  } catch {
    // ignore parse errors
  }

  const diffPattern = /(?:Wrote|Created|Updated|Modified|Overwritten)\s+(.+?)(?:\.|$)/gm;
  let match;
  while ((match = diffPattern.exec(outputText)) !== null) {
    touchedFiles.add(match[1].trim());
  }
}

function emitProgress(onProgress, message, phase) {
  if (!onProgress) return;
  onProgress({
    message,
    phase,
    stderrMessage: message
  });
}

function createKimiCaptureState(options) {
  return {
    steps: [],
    currentThink: null,
    pendingToolCalls: new Map(),
    finalTexts: [],
    thinkingBlocks: [],
    touchedFiles: new Set(),
    errors: [],
    onProgress: options.onProgress ?? null,
    stepCount: 0
  };
}

function applyStreamEvent(state, event) {
  if (!event) return;

  switch (event.type) {
    case "assistant": {
      for (const think of event.thinks) {
        state.thinkingBlocks.push(think);
        state.currentThink = think;
        emitProgress(state.onProgress, `Thinking: ${shorten(think, 96)}`, "thinking");
      }

      for (const tc of event.toolCalls) {
        state.pendingToolCalls.set(tc.id, tc);
        state.stepCount++;
        const preview = extractToolPreview(tc);
        emitProgress(
          state.onProgress,
          `Step ${state.stepCount}: ${tc.name} ${preview}`.trim(),
          describeToolPhase(tc.name)
        );
      }

      for (const text of event.texts) {
        state.finalTexts.push(text);
        emitProgress(state.onProgress, `Kimi response: ${shorten(text, 96)}`, "finalizing");
      }
      break;
    }

    case "tool_result": {
      const tc = state.pendingToolCalls.get(event.toolCallId);
      const outputText = event.outputs.join("\n");

      extractFileChanges(tc, outputText, state.touchedFiles);

      state.steps.push({
        think: state.currentThink,
        toolCall: tc ?? null,
        toolResult: shorten(outputText, 500)
      });
      state.currentThink = null;

      const statusLabel = outputText.includes("successfully") ? "completed" : "returned";
      emitProgress(
        state.onProgress,
        `${tc?.name ?? "Tool"} ${statusLabel}`,
        describeToolPhase(tc?.name)
      );
      break;
    }

    case "parse_error": {
      state.errors.push(event.raw);
      break;
    }
  }
}

export async function runKimiTask(options) {
  const args = buildKimiArgs(options);
  const state = createKimiCaptureState(options);

  return new Promise((resolve, reject) => {
    const proc = spawn("kimi", args, {
      cwd: options.cwd ?? process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    // Send prompt via stdin
    if (options.prompt) {
      proc.stdin.write(options.prompt);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    const stderrChunks = [];

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      const event = parseStreamJsonLine(line);
      applyStreamEvent(state, event);
    });

    proc.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    proc.on("close", (code) => {
      resolve({
        status: code === 0 ? 0 : 1,
        finalMessage: state.finalTexts.join("\n"),
        steps: state.steps,
        stepCount: state.stepCount,
        touchedFiles: [...state.touchedFiles],
        thinkingBlocks: state.thinkingBlocks,
        errors: state.errors,
        stderr: stderrChunks.join("")
      });
    });

    proc.on("error", (err) => {
      reject(err);
    });

    if (options.onPid) {
      options.onPid(proc.pid);
    }
  });
}
