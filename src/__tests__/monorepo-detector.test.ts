import { detectMonorepo } from '../skill/monorepo-detector';
import type { RepoContext } from '../types';

function makeContext(
  filePaths: string[],
  fileContents: Record<string, string> = {},
): RepoContext {
  return {
    owner: 'test',
    repo: 'test',
    defaultBranch: 'main',
    filePaths,
    fileContents: new Map(Object.entries(fileContents)),
  };
}

describe('detectMonorepo', () => {
  it('returns isMonorepo=false for a simple single-app repo', () => {
    const ctx = makeContext(['package.json', 'src/index.ts'], {
      'package.json': '{"name":"my-app"}',
    });
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(false);
  });

  it('detects lerna monorepo', () => {
    const ctx = makeContext(
      ['lerna.json', 'packages/api/package.json', 'packages/web/package.json'],
      { 'lerna.json': '{"version":"1.0.0"}' },
    );
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(true);
    expect(result.type).toBe('lerna');
    expect(result.apps).toContain('packages/api');
    expect(result.apps).toContain('packages/web');
  });

  it('detects nx monorepo', () => {
    const ctx = makeContext(
      ['nx.json', 'apps/api/package.json', 'apps/frontend/package.json'],
      { 'nx.json': '{}' },
    );
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(true);
    expect(result.type).toBe('nx');
  });

  it('detects turbo monorepo', () => {
    const ctx = makeContext(
      ['turbo.json', 'apps/backend/package.json', 'apps/dashboard/package.json'],
      { 'turbo.json': '{"pipeline":{}}' },
    );
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(true);
    expect(result.type).toBe('turbo');
  });

  it('detects pnpm workspace', () => {
    const ctx = makeContext(
      ['pnpm-workspace.yaml', 'apps/api/package.json', 'apps/web/package.json'],
      { 'pnpm-workspace.yaml': 'packages:\n  - "apps/*"' },
    );
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(true);
    expect(result.type).toBe('pnpm');
  });

  it('detects yarn workspaces', () => {
    const ctx = makeContext(
      ['package.json', 'packages/server/package.json', 'packages/client/package.json'],
      { 'package.json': '{"workspaces":["packages/*"]}' },
    );
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(true);
    expect(result.type).toBe('yarn-workspaces');
  });

  it('detects Cargo workspaces', () => {
    const ctx = makeContext(
      ['Cargo.toml', 'crates/api/Cargo.toml', 'crates/db/Cargo.toml'],
      {
        'Cargo.toml': '[workspace]\nmembers = ["crates/api", "crates/db"]',
        'crates/api/Cargo.toml': '[package]\nname="api"',
        'crates/db/Cargo.toml': '[package]\nname="db"',
      },
    );
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(true);
    expect(result.type).toBe('cargo-workspaces');
  });

  it('detects conventional monorepo via apps/ directory', () => {
    const ctx = makeContext([
      'apps/backend/package.json',
      'apps/backend/src/index.ts',
      'apps/frontend/package.json',
      'apps/frontend/src/App.tsx',
    ]);
    const result = detectMonorepo(ctx);
    expect(result.isMonorepo).toBe(true);
    expect(result.apps).toContain('apps/backend');
    expect(result.apps).toContain('apps/frontend');
  });
});
