#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import { readStdinIfPiped } from "./lib/fs.mjs";
import { getKimiAvailability, getKimiLoginStatus, runKimiTask } from "./lib/kimi.mjs";
import { binaryAvailable, terminateProcessTree } from "./lib/process.mjs";
import {
  renderCancelReport,
  renderJobStatusReport,
  renderSetupReport,
  renderStatusReport,
  renderStoredJobResult,
  renderTaskResult
} from "./lib/render.mjs";
import {
  generateJobId,
  listJobs,
  resolveJobFile,
  upsertJob,
  writeJobFile
} from "./lib/state.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  nowIso,
  runTrackedJob
} from "./lib/tracked-jobs.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  enrichJob,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob,
  sortJobsNewestFirst
} from "./lib/job-control.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/kimi-companion.mjs setup [--json]",
      "  node scripts/kimi-companion.mjs task [--background] [--continue] [--session <id>] [--model <model>] [--thinking|--no-thinking] [--max-steps <n>] [prompt]",
      "  node scripts/kimi-companion.mjs status [job-id] [--all] [--json]",
      "  node scripts/kimi-companion.mjs result [job-id] [--json]",
      "  node scripts/kimi-companion.mjs cancel [job-id] [--json]"
    ].join("\n")
  );
}

function outputResult(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    process.stdout.write(value);
  }
}

function normalizeArgv(argv) {
  if (argv.length === 1) {
    const [raw] = argv;
    if (!raw || !raw.trim()) return [];
    return splitRawArgumentString(raw);
  }
  return argv;
}

function parseCommandInput(argv, config = {}) {
  return parseArgs(normalizeArgv(argv), {
    ...config,
    aliasMap: {
      C: "cwd",
      ...(config.aliasMap ?? {})
    }
  });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function resolveCommandWorkspace(options = {}) {
  return resolveWorkspaceRoot(resolveCommandCwd(options));
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

function firstMeaningfulLine(text, fallback) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .find(Boolean);
  return line ?? fallback;
}

// ─── setup ───────────────────────────────────────────────────────────────────

function buildSetupReport(cwd) {
  const nodeStatus = binaryAvailable("node", ["--version"], { cwd });
  const kimiStatus = getKimiAvailability(cwd);
  const authStatus = getKimiLoginStatus(cwd);

  const nextSteps = [];
  if (!kimiStatus.available) {
    nextSteps.push("Install Kimi CLI: `curl -L code.kimi.com/install.sh | sh`");
  }
  if (kimiStatus.available && !authStatus.loggedIn) {
    nextSteps.push("Run `!kimi login` to authenticate.");
  }

  return {
    ready: nodeStatus.available && kimiStatus.available && authStatus.loggedIn,
    node: nodeStatus,
    kimi: kimiStatus,
    auth: authStatus,
    nextSteps
  };
}

function handleSetup(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const report = buildSetupReport(cwd);
  outputResult(options.json ? report : renderSetupReport(report), options.json);
}

// ─── task ────────────────────────────────────────────────────────────────────

function buildTaskJob(workspaceRoot, title, summary) {
  return createJobRecord({
    id: generateJobId("kimi-task"),
    kind: "task",
    kindLabel: "code",
    title,
    workspaceRoot,
    jobClass: "task",
    summary
  });
}

async function executeTaskRun(request) {
  const result = await runKimiTask({
    cwd: request.cwd,
    prompt: request.prompt,
    workDir: request.cwd,
    session: request.session,
    continueSession: request.continueSession,
    model: request.model,
    thinking: request.thinking,
    maxSteps: request.maxSteps,
    onProgress: request.onProgress,
    onPid: request.onPid
  });

  const rendered = renderTaskResult(result, {
    title: request.title ?? "Kimi Task",
    jobId: request.jobId ?? null
  });

  return {
    exitStatus: result.status,
    kimiSessionId: null,
    payload: {
      status: result.status,
      finalMessage: result.finalMessage,
      steps: result.steps,
      stepCount: result.stepCount,
      touchedFiles: result.touchedFiles,
      thinkingBlocks: result.thinkingBlocks,
      errors: result.errors
    },
    rendered,
    summary: firstMeaningfulLine(result.finalMessage, "Kimi task finished."),
    jobTitle: request.title ?? "Kimi Task",
    jobClass: "task"
  };
}

function spawnDetachedTaskWorker(cwd, jobId) {
  const scriptPath = path.join(ROOT_DIR, "scripts", "kimi-companion.mjs");
  const child = spawn(process.execPath, [scriptPath, "task-worker", "--cwd", cwd, "--job-id", jobId], {
    cwd,
    env: process.env,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child;
}

async function handleTask(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["model", "session", "max-steps", "cwd", "prompt-file"],
    booleanOptions: ["json", "continue", "thinking", "no-thinking", "background"],
    aliasMap: {
      m: "model",
      S: "session",
      C_session: "continue"
    }
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const model = options.model || null;
  const session = options.session || null;
  const continueSession = Boolean(options["continue"]);
  const maxSteps = options["max-steps"] ? Number(options["max-steps"]) : null;

  let thinking = undefined;
  if (options.thinking) thinking = true;
  if (options["no-thinking"]) thinking = false;

  // Read prompt
  let prompt;
  if (options["prompt-file"]) {
    prompt = fs.readFileSync(path.resolve(cwd, options["prompt-file"]), "utf8");
  } else {
    prompt = positionals.join(" ") || readStdinIfPiped();
  }

  if (!prompt && !continueSession && !session) {
    throw new Error("Provide a prompt, a prompt file, or piped stdin.");
  }

  const title = continueSession || session ? "Kimi Resume" : "Kimi Task";
  const summary = shorten(prompt || "continue", 80);
  const job = buildTaskJob(workspaceRoot, title, summary);

  if (options.background) {
    const logFile = createJobLogFile(workspaceRoot, job.id, title);
    appendLogLine(logFile, "Queued for background execution.");

    const child = spawnDetachedTaskWorker(cwd, job.id);
    const queuedRecord = {
      ...job,
      status: "queued",
      phase: "queued",
      pid: child.pid ?? null,
      logFile,
      request: { cwd, prompt, model, session, continueSession, thinking, maxSteps, title }
    };
    writeJobFile(workspaceRoot, job.id, queuedRecord);
    upsertJob(workspaceRoot, queuedRecord);

    const output = `${title} started in the background as ${job.id}. Check /kimi:status ${job.id} for progress.\n`;
    outputResult(options.json ? { jobId: job.id, status: "queued", title, summary } : output, options.json);
    return;
  }

  // Foreground execution
  const logFile = createJobLogFile(workspaceRoot, job.id, title);
  const progress = createProgressReporter({
    stderr: !options.json,
    logFile,
    onEvent: createJobProgressUpdater(workspaceRoot, job.id)
  });

  const execution = await runTrackedJob(
    { ...job, logFile },
    () =>
      executeTaskRun({
        cwd,
        prompt,
        model,
        session,
        continueSession,
        thinking,
        maxSteps,
        title,
        jobId: job.id,
        onProgress: progress
      }),
    { logFile }
  );

  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
}

async function handleTaskWorker(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd", "job-id"]
  });

  if (!options["job-id"]) {
    throw new Error("Missing required --job-id for task-worker.");
  }

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const storedJob = readStoredJob(workspaceRoot, options["job-id"]);
  if (!storedJob) {
    throw new Error(`No stored job found for ${options["job-id"]}.`);
  }

  const request = storedJob.request;
  if (!request || typeof request !== "object") {
    throw new Error(`Stored job ${options["job-id"]} is missing its task request payload.`);
  }

  const logFile = storedJob.logFile ?? createJobLogFile(workspaceRoot, storedJob.id, storedJob.title);
  const progress = createProgressReporter({
    logFile,
    onEvent: createJobProgressUpdater(workspaceRoot, storedJob.id)
  });

  await runTrackedJob(
    { ...storedJob, workspaceRoot, logFile },
    () =>
      executeTaskRun({
        ...request,
        jobId: storedJob.id,
        onProgress: progress
      }),
    { logFile }
  );
}

// ─── status ──────────────────────────────────────────────────────────────────

function handleStatus(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json", "all"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";

  if (reference) {
    const snapshot = buildSingleJobSnapshot(cwd, reference);
    outputResult(options.json ? snapshot : renderJobStatusReport(snapshot.job), options.json);
    return;
  }

  const report = buildStatusSnapshot(cwd, { all: options.all });
  outputResult(options.json ? report : renderStatusReport(report), options.json);
}

// ─── result ──────────────────────────────────────────────────────────────────

function handleResult(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveResultJob(cwd, reference);
  const storedJob = readStoredJob(workspaceRoot, job.id);
  const payload = { job, storedJob };

  outputResult(options.json ? payload : renderStoredJobResult(job, storedJob), options.json);
}

// ─── cancel ──────────────────────────────────────────────────────────────────

function handleCancel(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveCancelableJob(cwd, reference);

  terminateProcessTree(job.pid ?? Number.NaN);
  appendLogLine(job.logFile, "Cancelled by user.");

  const completedAt = nowIso();
  const nextJob = {
    ...job,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    completedAt,
    errorMessage: "Cancelled by user."
  };

  writeJobFile(workspaceRoot, job.id, nextJob);
  upsertJob(workspaceRoot, {
    id: job.id,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    errorMessage: "Cancelled by user.",
    completedAt
  });

  const payload = {
    jobId: job.id,
    status: "cancelled",
    title: job.title
  };

  outputResult(options.json ? payload : renderCancelReport(nextJob), options.json);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const [subcommand, ...argv] = process.argv.slice(2);
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }

  switch (subcommand) {
    case "setup":
      handleSetup(argv);
      break;
    case "task":
      await handleTask(argv);
      break;
    case "task-worker":
      await handleTaskWorker(argv);
      break;
    case "status":
      handleStatus(argv);
      break;
    case "result":
      handleResult(argv);
      break;
    case "cancel":
      handleCancel(argv);
      break;
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
