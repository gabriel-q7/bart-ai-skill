import path from 'path';
import type { AppInfo, GeneratedFile, RepoContext } from '../../types';
import { generateBashScript } from './bash-script';
import { generateConfigSh } from './config-sh';
import { generateEnvFile, generateEnvExample } from './env-file';
import { generateMakefile } from './makefile';

/**
 * For a given app (or the root of a non-monorepo project), produce all the
 * files that BAR-T should create or update.
 *
 * Folder layout (relative to repo root):
 *
 *   <appPath>/scripts/bar-t/
 *     ├── .env               ← ignored by git
 *     ├── .env.example       ← safe to commit
 *     ├── config.sh
 *     ├── Makefile
 *     ├── inputs/            ← JSON / CSV input files for endpoints with a body
 *     │   └── <name>.json
 *     └── <name>.sh          ← one script per endpoint
 */
export function generateFilesForApp(
  app: AppInfo,
  context: RepoContext,
): GeneratedFile[] {
  const appRoot = app.path === '.' ? '' : app.path;
  const bartDir = appRoot
    ? path.join(appRoot, 'scripts', 'bar-t')
    : path.join('scripts', 'bar-t');

  // Determine which files already exist in the repo
  const existingPaths = new Set(context.filePaths);

  const files: GeneratedFile[] = [];

  // ── config.sh ──────────────────────────────────────────────────────────────
  const configShPath = `${bartDir}/config.sh`;
  files.push({
    path: configShPath,
    content: generateConfigSh(),
    description: 'Shared Bash configuration: colour helpers, load_env, print_section, assert_success',
    isNew: !existingPaths.has(configShPath),
  });

  // ── .env (only if not already present) ────────────────────────────────────
  const envPath = `${bartDir}/.env`;
  if (!existingPaths.has(envPath)) {
    files.push({
      path: envPath,
      content: generateEnvFile(),
      description: 'Environment variables template (BASE_URL, AUTH_TOKEN, API_KEY). Add this to .gitignore.',
      isNew: true,
    });
  }

  // ── .env.example (always safe to commit) ─────────────────────────────────
  const envExamplePath = `${bartDir}/.env.example`;
  files.push({
    path: envExamplePath,
    content: generateEnvExample(),
    description: 'Sanitised .env example (safe to commit)',
    isNew: !existingPaths.has(envExamplePath),
  });

  // ── Individual bash scripts ────────────────────────────────────────────────
  for (const endpoint of app.endpoints) {
    const scriptPath = `${bartDir}/${endpoint.name}.sh`;
    files.push({
      path: scriptPath,
      content: generateBashScript(endpoint, bartDir),
      description: `Test script for ${endpoint.method} ${endpoint.path}`,
      isNew: !existingPaths.has(scriptPath),
    });

    // ── Input file stub for endpoints that receive a body ─────────────────
    if (endpoint.hasBody) {
      const inputPath = `${bartDir}/inputs/${endpoint.name}.json`;
      if (!existingPaths.has(inputPath)) {
        files.push({
          path: inputPath,
          content: generateInputStub(endpoint.name),
          description: `JSON input payload for ${endpoint.method} ${endpoint.path}`,
          isNew: true,
        });
      }
    }
  }

  // ── Makefile ───────────────────────────────────────────────────────────────
  if (app.endpoints.length > 0) {
    const makefilePath = `${bartDir}/Makefile`;
    files.push({
      path: makefilePath,
      content: generateMakefile(app.endpoints, bartDir),
      description: 'Makefile with targets for every BAR-T test',
      isNew: !existingPaths.has(makefilePath),
    });
  }

  return files;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateInputStub(name: string): string {
  return `{
  "_comment": "Fill in the request body for ${name}",
  "example_field": "example_value"
}
`;
}
