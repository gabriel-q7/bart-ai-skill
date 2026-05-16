import type { Octokit } from '@octokit/rest';
import type {
  AppInfo,
  BartResult,
  GeneratedFile,
  RepoContext,
} from '../types';
import { detectEndpoints } from './endpoint-detector';
import { generateFilesForApp } from './generators/index';
import { detectMonorepo } from './monorepo-detector';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Entry point for the BAR-T skill.
 *
 * Given an authenticated Octokit client and a `{owner, repo}` pair, it:
 *   1. Loads the full file tree of the repository.
 *   2. Detects whether the project is a monorepo.
 *   3. Reads the source files needed for endpoint detection.
 *   4. Generates all BAR-T scripts.
 *   5. Returns a `BartResult` with every file to be written.
 */
export async function runBartSkill(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<BartResult> {
  // ── 1. Build repo context ──────────────────────────────────────────────────
  const context = await buildRepoContext(octokit, owner, repo);

  // ── 2. Detect monorepo ─────────────────────────────────────────────────────
  const monorepo = detectMonorepo(context);

  // ── 3. Detect endpoints ────────────────────────────────────────────────────
  let apps: AppInfo[];
  if (monorepo.isMonorepo) {
    apps = detectEndpoints(context, monorepo.apps);
  } else {
    apps = detectEndpoints(context);
  }

  // Filter out apps with no endpoints (e.g. pure frontend packages)
  const appsWithEndpoints = apps.filter((a) => a.endpoints.length > 0);

  // ── 4. Generate files ──────────────────────────────────────────────────────
  const allFiles: GeneratedFile[] = [];
  for (const app of appsWithEndpoints.length > 0 ? appsWithEndpoints : apps.slice(0, 1)) {
    allFiles.push(...generateFilesForApp(app, context));
  }

  // ── 5. Build summary ───────────────────────────────────────────────────────
  const summary = buildSummary(
    owner,
    repo,
    monorepo.isMonorepo,
    monorepo.type,
    appsWithEndpoints.length > 0 ? appsWithEndpoints : apps,
    allFiles,
  );

  return {
    apps: appsWithEndpoints.length > 0 ? appsWithEndpoints : apps,
    files: allFiles,
    summary,
  };
}

// ── Repository context loading ────────────────────────────────────────────────

/**
 * Fetches the entire Git tree and pre-loads source files relevant to
 * endpoint and monorepo detection.
 */
async function buildRepoContext(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoContext> {
  // Get default branch
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  // Get the full recursive tree
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: 'true',
  });

  const filePaths: string[] = (treeData.tree ?? [])
    .filter((item) => item.type === 'blob' && item.path)
    .map((item) => item.path as string);

  const fileContents = new Map<string, string>();

  // Load files that matter for detection (limit size to avoid rate limits)
  const filesToLoad = filePaths.filter((p) => shouldLoadFile(p));

  await Promise.all(
    filesToLoad.map(async (filePath) => {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
        if (!Array.isArray(data) && data.type === 'file' && data.content) {
          const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
          fileContents.set(filePath, decoded);
        }
      } catch {
        // File may be too large or inaccessible — skip
      }
    }),
  );

  return { owner, repo, defaultBranch, filePaths, fileContents };
}

/**
 * Returns true for files that should be fetched for endpoint / monorepo
 * detection, bounded by a reasonable list.
 */
function shouldLoadFile(filePath: string): boolean {

  // Workspace-level files needed for monorepo detection
  const monorepoFiles = [
    'package.json',
    'lerna.json',
    'nx.json',
    'turbo.json',
    'pnpm-workspace.yaml',
    'pnpm-workspace.yml',
    'go.work',
    'Cargo.toml',
  ];
  if (monorepoFiles.includes(filePath)) return true;

  // Source files
  if (/\.(ts|tsx|js|mjs|cjs|py|java|kt|go|rb|php)$/.test(filePath)) {
    // Skip test files and large generated artefacts
    if (/\.(test|spec|e2e|mock)\./i.test(filePath)) return false;
    if (/node_modules|vendor|\.gen\.|generated|__pycache__|\.pyc$/.test(filePath)) return false;
    return true;
  }

  return false;
}

// ── Summary builder ───────────────────────────────────────────────────────────

function buildSummary(
  owner: string,
  repo: string,
  isMonorepo: boolean,
  monorepoType: string,
  apps: AppInfo[],
  files: GeneratedFile[],
): string {
  const repoStr = `${owner}/${repo}`;
  const newFiles = files.filter((f) => f.isNew).length;

  const lines: string[] = [
    `## 🚀 BAR-T — Bash API Request Test`,
    ``,
    `Repository: \`${repoStr}\``,
    isMonorepo
      ? `Monorepo detected (${monorepoType}) — ${apps.length} app(s) scanned`
      : `Single-app project`,
    ``,
    `### Detected endpoints`,
  ];

  for (const app of apps) {
    if (apps.length > 1) {
      lines.push(`\n**${app.name}** (\`${app.path}\`) — ${app.framework}/${app.language}`);
    }
    for (const ep of app.endpoints) {
      lines.push(`- \`${ep.method} ${ep.path}\``);
    }
    if (app.endpoints.length === 0) {
      lines.push('- _(no endpoints detected)_');
    }
  }

  lines.push(
    ``,
    `### Generated files (${newFiles} new, ${files.length - newFiles} updated)`,
  );

  for (const f of files) {
    const badge = f.isNew ? '🆕' : '♻️';
    lines.push(`- ${badge} \`${f.path}\` — ${f.description}`);
  }

  lines.push(
    ``,
    `### Next steps`,
    `1. Copy \`.env.example\` to \`.env\` and fill in your \`BASE_URL\`, \`AUTH_TOKEN\`, etc.`,
    `2. Review any generated \`inputs/<name>.json\` files and add your request payloads.`,
    `3. Run \`make help\` inside \`scripts/bar-t/\` to see all available tests.`,
    `4. Run \`make all\` to execute the full test suite.`,
    ``,
    `> 💡 Tip: add \`.env\` to your \`.gitignore\` to prevent leaking secrets.`,
  );

  return lines.join('\n');
}
