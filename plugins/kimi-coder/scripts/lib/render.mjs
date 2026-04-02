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

export function renderSetupReport(report) {
  const lines = [];
  lines.push("# Kimi Code Setup\n");

  const status = (obj) => (obj.available ? `OK (${obj.detail})` : `MISSING (${obj.detail})`);
  lines.push(`- **Node:** ${status(report.node)}`);
  lines.push(`- **Kimi CLI:** ${status(report.kimi)}`);
  lines.push(`- **Auth:** ${report.auth.loggedIn ? `OK (${report.auth.detail})` : `NOT AUTHENTICATED (${report.auth.detail})`}`);
  lines.push("");

  if (report.ready) {
    lines.push("Kimi Code is ready.");
  } else {
    lines.push("Kimi Code is **not ready**. See details above.");
  }

  if (report.nextSteps.length > 0) {
    lines.push("\n**Next steps:**");
    for (const step of report.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  return lines.join("\n") + "\n";
}

export function renderTaskResult(result, options = {}) {
  const lines = [];
  const title = options.title ?? "Kimi Task";
  const jobId = options.jobId ?? null;

  lines.push(`# ${title} Result\n`);

  if (result.status !== undefined) {
    const statusLabel = result.status === 0 ? "completed" : "failed";
    lines.push(`**Status:** ${statusLabel}`);
  }
  if (result.stepCount !== undefined) {
    lines.push(`**Steps:** ${result.stepCount}`);
  }
  if (jobId) {
    lines.push(`**Job:** ${jobId}`);
  }
  lines.push("");

  // Files modified
  if (result.touchedFiles && result.touchedFiles.length > 0) {
    lines.push("## Files Modified\n");
    for (const file of result.touchedFiles) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  // Execution steps
  if (result.steps && result.steps.length > 0) {
    lines.push("## Execution Steps\n");
    for (let i = 0; i < result.steps.length; i++) {
      const step = result.steps[i];
      const n = i + 1;

      if (step.think) {
        lines.push(`${n}. [thinking] ${shorten(step.think, 120)}`);
      }
      if (step.toolCall) {
        const preview = extractToolPreviewForRender(step.toolCall);
        lines.push(`${n}. [${step.toolCall.name}] ${preview}`);
      }
    }
    lines.push("");
  }

  // Reasoning summary
  if (result.thinkingBlocks && result.thinkingBlocks.length > 0) {
    lines.push("## Reasoning Summary\n");
    const lastThinks = result.thinkingBlocks.slice(-3);
    for (const think of lastThinks) {
      lines.push(`- ${shorten(think, 200)}`);
    }
    lines.push("");
  }

  // Final response
  if (result.finalMessage) {
    lines.push("## Kimi's Response\n");
    lines.push(result.finalMessage);
    lines.push("");
  }

  // Errors
  if (result.errors && result.errors.length > 0) {
    lines.push("## Errors\n");
    for (const err of result.errors) {
      lines.push(`- ${shorten(err, 200)}`);
    }
    lines.push("");
  }

  if (result.stderr && result.status !== 0) {
    lines.push("## Stderr\n");
    lines.push("```");
    lines.push(result.stderr.trim());
    lines.push("```\n");
  }

  return lines.join("\n");
}

function extractToolPreviewForRender(tc) {
  try {
    const args = JSON.parse(tc.arguments);
    if (tc.name === "Shell") return shorten(args.command ?? "", 120);
    if (tc.name === "Write") return `wrote ${args.file_path ?? ""}`;
    if (tc.name === "Edit") return `edited ${args.file_path ?? ""}`;
    if (tc.name === "Read") return `read ${args.file_path ?? ""}`;
    if (tc.name === "Glob") return `glob ${args.pattern ?? ""}`;
    if (tc.name === "Grep") return `grep ${args.pattern ?? ""}`;
    return "";
  } catch {
    return "";
  }
}

export function renderStatusReport(report) {
  const lines = [];
  lines.push("# Kimi Jobs Status\n");

  if (report.running.length > 0) {
    lines.push("## Active Jobs\n");
    lines.push("| Job | Kind | Phase | Elapsed |");
    lines.push("|-----|------|-------|---------|");
    for (const job of report.running) {
      lines.push(
        `| ${job.id} | ${job.kindLabel} | ${job.phase ?? "running"} | ${job.elapsed ?? "—"} |`
      );
    }
    lines.push("");

    for (const job of report.running) {
      if (job.progressPreview?.length > 0) {
        lines.push(`**${job.id}** progress:`);
        for (const line of job.progressPreview) {
          lines.push(`  - ${line}`);
        }
        lines.push("");
      }
    }
  }

  if (report.latestFinished) {
    const job = report.latestFinished;
    lines.push("## Latest Finished\n");
    lines.push(
      `- **${job.id}** — ${job.status} (${job.duration ?? "—"}) — ${shorten(job.summary ?? "", 80)}`
    );
    lines.push("");
  }

  if (report.recent.length > 0) {
    lines.push("## Recent Jobs\n");
    for (const job of report.recent) {
      lines.push(
        `- **${job.id}** — ${job.status} (${job.duration ?? "—"}) — ${shorten(job.summary ?? "", 60)}`
      );
    }
    lines.push("");
  }

  if (report.running.length === 0 && !report.latestFinished && report.recent.length === 0) {
    lines.push("No Kimi jobs found for this workspace.\n");
  }

  return lines.join("\n");
}

export function renderJobStatusReport(job) {
  const lines = [];
  lines.push(`# Job: ${job.id}\n`);
  lines.push(`- **Kind:** ${job.kindLabel}`);
  lines.push(`- **Status:** ${job.status}`);
  lines.push(`- **Phase:** ${job.phase ?? "unknown"}`);

  if (job.status === "running" || job.status === "queued") {
    lines.push(`- **Elapsed:** ${job.elapsed ?? "—"}`);
  } else {
    lines.push(`- **Duration:** ${job.duration ?? "—"}`);
  }

  if (job.summary) {
    lines.push(`- **Summary:** ${job.summary}`);
  }
  if (job.kimiSessionId) {
    lines.push(`- **Kimi Session:** ${job.kimiSessionId}`);
  }

  if (job.progressPreview?.length > 0) {
    lines.push("\n**Progress:**");
    for (const line of job.progressPreview) {
      lines.push(`  - ${line}`);
    }
  }

  if (job.status === "running") {
    lines.push(`\nCancel: \`/kimi:cancel ${job.id}\``);
  }
  if (job.status === "completed" || job.status === "failed") {
    lines.push(`\nResult: \`/kimi:result ${job.id}\``);
  }

  return lines.join("\n") + "\n";
}

export function renderStoredJobResult(job, storedJob) {
  if (!storedJob) {
    return `No stored details for ${job.id}.\n`;
  }

  if (storedJob.rendered) {
    return storedJob.rendered;
  }

  if (storedJob.result) {
    return renderTaskResult(storedJob.result, {
      title: storedJob.title ?? "Kimi Task",
      jobId: job.id
    });
  }

  if (storedJob.errorMessage) {
    return `# Job ${job.id} Failed\n\n${storedJob.errorMessage}\n`;
  }

  return `Job ${job.id} (${job.status}) — no output available.\n`;
}

export function renderCancelReport(job) {
  const lines = [];
  lines.push(`Cancelled job **${job.id}** (${job.title ?? "Kimi Task"}).`);
  lines.push(`\nCheck \`/kimi:status\` for updated queue.`);
  return lines.join("\n") + "\n";
}
