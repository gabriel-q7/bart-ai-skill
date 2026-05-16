import { generateBashScript } from '../skill/generators/bash-script';
import { generateConfigSh } from '../skill/generators/config-sh';
import { generateEnvFile, generateEnvExample } from '../skill/generators/env-file';
import { generateMakefile } from '../skill/generators/makefile';
import type { Endpoint } from '../types';

const GET_ENDPOINT: Endpoint = {
  method: 'GET',
  path: '/api/users',
  name: 'get_api_users',
  file: 'src/routes/users.ts',
  params: [],
  hasBody: false,
};

const POST_ENDPOINT: Endpoint = {
  method: 'POST',
  path: '/api/users',
  name: 'post_api_users',
  file: 'src/routes/users.ts',
  params: [],
  hasBody: true,
};

const GET_WITH_PARAM: Endpoint = {
  method: 'GET',
  path: '/api/users/:id',
  name: 'get_api_users_id',
  file: 'src/routes/users.ts',
  params: ['id'],
  hasBody: false,
};

describe('generateBashScript', () => {
  it('generates a shebang line', () => {
    const script = generateBashScript(GET_ENDPOINT, 'scripts/bar-t');
    expect(script).toMatch(/^#!/);
    expect(script).toContain('#!/usr/bin/env bash');
  });

  it('includes set -euo pipefail', () => {
    const script = generateBashScript(GET_ENDPOINT, 'scripts/bar-t');
    expect(script).toContain('set -euo pipefail');
  });

  it('sources config.sh', () => {
    const script = generateBashScript(GET_ENDPOINT, 'scripts/bar-t');
    expect(script).toContain('source');
    expect(script).toContain('config.sh');
  });

  it('includes curl with the endpoint method', () => {
    const script = generateBashScript(GET_ENDPOINT, 'scripts/bar-t');
    expect(script).toContain('-X GET');
  });

  it('includes curl with POST method for POST endpoint', () => {
    const script = generateBashScript(POST_ENDPOINT, 'scripts/bar-t');
    expect(script).toContain('-X POST');
  });

  it('includes the endpoint path in the curl command', () => {
    const script = generateBashScript(GET_ENDPOINT, 'scripts/bar-t');
    expect(script).toContain('/api/users');
  });

  it('replaces path params with env-var references', () => {
    const script = generateBashScript(GET_WITH_PARAM, 'scripts/bar-t');
    expect(script).toContain('PARAM_ID');
  });

  it('includes --data-binary for endpoints with a body', () => {
    const script = generateBashScript(POST_ENDPOINT, 'scripts/bar-t');
    expect(script).toContain('--data-binary');
  });

  it('does NOT include --data-binary for GET endpoints', () => {
    const script = generateBashScript(GET_ENDPOINT, 'scripts/bar-t');
    expect(script).not.toContain('--data-binary');
  });

  it('calls assert_success', () => {
    const script = generateBashScript(GET_ENDPOINT, 'scripts/bar-t');
    expect(script).toContain('assert_success');
  });
});

describe('generateConfigSh', () => {
  it('generates a shebang line', () => {
    const config = generateConfigSh();
    expect(config).toContain('#!/usr/bin/env bash');
  });

  it('defines BASE_URL', () => {
    const config = generateConfigSh();
    expect(config).toContain('BASE_URL');
  });

  it('defines load_env function', () => {
    const config = generateConfigSh();
    expect(config).toContain('load_env');
  });

  it('defines print_section function', () => {
    const config = generateConfigSh();
    expect(config).toContain('print_section');
  });

  it('defines print_status function', () => {
    const config = generateConfigSh();
    expect(config).toContain('print_status');
  });

  it('defines assert_success function', () => {
    const config = generateConfigSh();
    expect(config).toContain('assert_success');
  });

  it('uses jq for pretty-printing', () => {
    const config = generateConfigSh();
    expect(config).toContain('jq');
  });
});

describe('generateEnvFile', () => {
  it('includes BASE_URL variable', () => {
    const env = generateEnvFile();
    expect(env).toContain('BASE_URL=');
  });

  it('includes AUTH_TOKEN variable', () => {
    const env = generateEnvFile();
    expect(env).toContain('AUTH_TOKEN=');
  });

  it('warns about not committing .env', () => {
    const env = generateEnvFile();
    expect(env).toMatch(/never commit/i);
  });
});

describe('generateEnvExample', () => {
  it('includes BASE_URL', () => {
    expect(generateEnvExample()).toContain('BASE_URL=');
  });

  it('includes AUTH_TOKEN placeholder', () => {
    expect(generateEnvExample()).toContain('AUTH_TOKEN=');
  });
});

describe('generateMakefile', () => {
  const endpoints: Endpoint[] = [GET_ENDPOINT, POST_ENDPOINT];

  it('includes a help target', () => {
    const mf = generateMakefile(endpoints, 'scripts/bar-t');
    expect(mf).toContain('help:');
  });

  it('includes an all target', () => {
    const mf = generateMakefile(endpoints, 'scripts/bar-t');
    expect(mf).toContain('all:');
  });

  it('includes a target for each endpoint', () => {
    const mf = generateMakefile(endpoints, 'scripts/bar-t');
    expect(mf).toContain('get_api_users:');
    expect(mf).toContain('post_api_users:');
  });

  it('references the bash script for each target', () => {
    const mf = generateMakefile(endpoints, 'scripts/bar-t');
    expect(mf).toContain('get_api_users.sh');
    expect(mf).toContain('post_api_users.sh');
  });

  it('includes a setup target', () => {
    const mf = generateMakefile(endpoints, 'scripts/bar-t');
    expect(mf).toContain('setup:');
  });
});
