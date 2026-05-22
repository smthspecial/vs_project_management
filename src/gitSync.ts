import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ChangedFile {
  /** Trimmed two-character porcelain status, e.g. "M", "A", "D", "??" */
  xy: string;
  path: string;
}

export interface RemoteStatus {
  branch: string;
  ahead: number;
  behind: number;
  hasRemote: boolean;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, timeout: 15_000 });
  return stdout.trim();
}

export async function isGitRepo(rootPath: string): Promise<boolean> {
  try {
    await git(rootPath, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Silently fetches from origin so remote-tracking refs are up to date.
 * Errors (e.g. no network) are swallowed intentionally.
 */
export async function fetchRemote(rootPath: string): Promise<void> {
  try {
    await execFileAsync("git", ["fetch", "--quiet"], {
      cwd: rootPath,
      timeout: 30_000,
    });
  } catch {
    // network unavailable or no remote — ignore
  }
}

export async function getRemoteStatus(rootPath: string): Promise<RemoteStatus> {
  try {
    const branch = await git(rootPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    let ahead = 0;
    let behind = 0;
    let hasRemote = false;
    try {
      const result = await git(rootPath, [
        "rev-list",
        "--left-right",
        "--count",
        `origin/${branch}...HEAD`,
      ]);
      const [behindStr, aheadStr] = result.split("\t");
      behind = parseInt(behindStr ?? "0", 10) || 0;
      ahead = parseInt(aheadStr ?? "0", 10) || 0;
      hasRemote = true;
    } catch {
      // no remote tracking branch configured
    }
    return { branch, ahead, behind, hasRemote };
  } catch {
    return { branch: "unknown", ahead: 0, behind: 0, hasRemote: false };
  }
}

export async function getChangedSpecFiles(
  rootPath: string,
): Promise<ChangedFile[]> {
  try {
    const output = await git(rootPath, [
      "status",
      "--porcelain",
      "--",
      ".spec/",
    ]);
    if (!output) {
      return [];
    }
    return output
      .split("\n")
      .filter(Boolean)
      .map((line) => ({
        xy: line.slice(0, 2).trim(),
        path: line.slice(3).trim(),
      }));
  } catch {
    return [];
  }
}

export async function stageAndCommitSpec(
  rootPath: string,
  message: string,
): Promise<void> {
  await git(rootPath, ["add", ".spec/"]);
  await git(rootPath, ["commit", "-m", message]);
}

export async function pushBranch(rootPath: string): Promise<void> {
  const branch = await git(rootPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  await git(rootPath, ["push", "origin", branch]);
}

export async function pullBranch(rootPath: string): Promise<void> {
  await git(rootPath, ["pull", "--rebase"]);
}

export async function getRemoteUrl(
  rootPath: string,
): Promise<string | undefined> {
  try {
    return await git(rootPath, ["remote", "get-url", "origin"]);
  } catch {
    return undefined;
  }
}

/**
 * Derives a "new pull request" URL for GitHub or GitLab from a remote URL.
 * Returns undefined for unrecognised hosts.
 */
export function buildPrUrl(
  remoteUrl: string,
  branch: string,
): string | undefined {
  // GitHub — HTTPS or SSH
  const ghMatch = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (ghMatch) {
    return `https://github.com/${ghMatch[1]}/compare/${encodeURIComponent(branch)}?expand=1`;
  }
  // GitLab
  const glMatch = remoteUrl.match(/gitlab\.com[:/](.+?)(?:\.git)?$/);
  if (glMatch) {
    return `https://gitlab.com/${glMatch[1]}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(branch)}`;
  }
  return undefined;
}
