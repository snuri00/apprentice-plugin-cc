import { runCommand } from "./process.mjs";

function getGitRoot(cwd) {
  const result = runCommand("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.error || result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

export function resolveWorkspaceRoot(cwd) {
  return getGitRoot(cwd) ?? cwd;
}
