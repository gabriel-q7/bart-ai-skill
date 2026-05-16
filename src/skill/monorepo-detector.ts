import type { RepoContext, MonorepoInfo } from '../types';

/** Files / directories that indicate the root of an individual app inside a monorepo */
const APP_ROOTS = [
  'package.json',
  'pyproject.toml',
  'setup.py',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
];

/** Workspace-level files that define the monorepo tooling */
const MONOREPO_MARKERS: Record<string, string> = {
  'lerna.json': 'lerna',
  'nx.json': 'nx',
  'turbo.json': 'turbo',
  'pnpm-workspace.yaml': 'pnpm',
  'pnpm-workspace.yml': 'pnpm',
  'go.work': 'go-workspaces',
};

/**
 * Detect whether the repository is a monorepo and, if so, enumerate the
 * paths to each individual application.
 */
export function detectMonorepo(context: RepoContext): MonorepoInfo {
  const { filePaths, fileContents } = context;

  // ── Direct marker files (lerna, nx, turbo, pnpm, go workspaces) ────────────
  for (const [markerFile, type] of Object.entries(MONOREPO_MARKERS)) {
    if (filePaths.includes(markerFile)) {
      const apps = findAppDirectories(filePaths, fileContents, markerFile, type);
      if (apps.length > 0) {
        return { isMonorepo: true, type, apps };
      }
    }
  }

  // ── Yarn / npm workspaces ────────────────────────────────────────────────────
  if (filePaths.includes('package.json')) {
    const pkgRaw = fileContents.get('package.json') ?? '';
    try {
      const pkg = JSON.parse(pkgRaw) as { workspaces?: unknown };
      if (pkg.workspaces) {
        const apps = findAppDirectories(filePaths, fileContents, 'package.json', 'yarn-workspaces');
        if (apps.length > 0) {
          return { isMonorepo: true, type: 'yarn-workspaces', apps };
        }
      }
    } catch {
      // not valid JSON — skip
    }
  }

  // ── Cargo workspaces ─────────────────────────────────────────────────────────
  if (filePaths.includes('Cargo.toml')) {
    const cargoRaw = fileContents.get('Cargo.toml') ?? '';
    if (/\[workspace\]/.test(cargoRaw)) {
      const apps = findCargoMembers(cargoRaw, filePaths);
      if (apps.length > 0) {
        return { isMonorepo: true, type: 'cargo-workspaces', apps };
      }
    }
  }

  // ── Heuristic: apps/ or packages/ directory with sub-projects ────────────────
  const conventionalRoots = ['apps/', 'packages/', 'services/'];
  for (const root of conventionalRoots) {
    const subdirs = getDirectChildren(filePaths, root);
    if (subdirs.length >= 2) {
      const appsWithManifest = subdirs.filter((dir) =>
        APP_ROOTS.some((manifest) => filePaths.includes(`${dir}/${manifest}`)),
      );
      if (appsWithManifest.length >= 2) {
        return {
          isMonorepo: true,
          type: 'conventional',
          apps: appsWithManifest,
        };
      }
    }
  }

  return { isMonorepo: false, type: '', apps: [] };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the set of immediate sub-directories under `prefix` that appear in
 * `filePaths`, e.g. for prefix "apps/" returns ["apps/api", "apps/web", …].
 */
function getDirectChildren(filePaths: string[], prefix: string): string[] {
  const seen = new Set<string>();
  for (const p of filePaths) {
    if (!p.startsWith(prefix)) continue;
    const rest = p.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash === -1) continue; // file directly in the prefix dir — skip
    seen.add(prefix + rest.slice(0, slash));
  }
  return [...seen];
}

/**
 * Find app directories based on the monorepo type.
 * Returns paths relative to the repo root (no trailing slash).
 */
function findAppDirectories(
  filePaths: string[],
  fileContents: Map<string, string>,
  _markerFile: string,
  type: string,
): string[] {
  // For most tool types, look inside apps/, packages/, services/, libs/
  const searchRoots = ['apps/', 'packages/', 'services/', 'libs/'];

  if (type === 'go-workspaces') {
    const goWorkContent = fileContents.get('go.work');
    if (!goWorkContent) return [];
    return findGoWorkspaceModules(goWorkContent, filePaths);
  }

  const apps: string[] = [];
  for (const root of searchRoots) {
    const children = getDirectChildren(filePaths, root);
    for (const child of children) {
      const hasManifest = APP_ROOTS.some((m) => filePaths.includes(`${child}/${m}`));
      if (hasManifest) apps.push(child);
    }
  }
  return apps;
}

/** Parse `go.work` to extract member module paths. */
function findGoWorkspaceModules(goWork: string, filePaths: string[]): string[] {
  const apps: string[] = [];
  const useBlock = goWork.match(/use\s*\(([^)]+)\)/s);
  const lines = useBlock
    ? useBlock[1].split('\n')
    : goWork.split('\n').filter((l) => l.trimStart().startsWith('use '));

  for (const line of lines) {
    const match = line.match(/^\s*use\s+(\S+)/);
    if (!match) continue;
    const modPath = match[1].replace(/^\.\//, '');
    if (filePaths.some((p) => p.startsWith(modPath + '/'))) {
      apps.push(modPath);
    }
  }
  return apps;
}

/** Parse `[workspace] members = [...]` from Cargo.toml. */
function findCargoMembers(cargoToml: string, filePaths: string[]): string[] {
  const membersMatch = cargoToml.match(/members\s*=\s*\[([^\]]+)\]/s);
  if (!membersMatch) return [];
  return membersMatch[1]
    .split(',')
    .map((m) => m.replace(/["'\s]/g, ''))
    .filter((m) => m && filePaths.some((p) => p.startsWith(m + '/')));
}
