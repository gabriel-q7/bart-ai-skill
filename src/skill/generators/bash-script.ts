import type { Endpoint } from '../../types';

// Dollar-sign helper: used inside template literals to produce a literal
// '$' character followed by '{', preventing TypeScript from parsing it as
// a template expression (and satisfying the no-useless-escape lint rule).
const S = '$';

/**
 * Renders a human-readable, color-coded Bash script that tests a single
 * API endpoint using `curl`.
 */
export function generateBashScript(endpoint: Endpoint, _scriptDir: string): string {
  const { method, path, name, params, hasBody } = endpoint;

  const curlArgs = buildCurlArgs(method, hasBody);
  const inputSection = hasBody ? buildInputSection(name) : '';
  const bodyArg = hasBody ? buildBodyArg() : '';

  return `#!/usr/bin/env bash
# =============================================================================
#  BAR-T — Bash API Request Test
#  Test : ${method} ${path}
#  Name : ${name}
# =============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="${S}(cd "${S}(dirname "${S}{BASH_SOURCE[0]}")" && pwd)"
source "${S}{SCRIPT_DIR}/config.sh"
load_env "${S}{SCRIPT_DIR}/.env"
${inputSection}
# ── Request ───────────────────────────────────────────────────────────────────
print_section "${method} ${path}"

RESPONSE=${S}(curl -s -w "\\n%{http_code}" \\
${curlArgs}${bodyArg}  "${S}{BASE_URL}${buildCurlPath(path, params)}")

HTTP_STATUS=${S}(echo "$RESPONSE" | tail -n1)
BODY=${S}(echo "$RESPONSE" | sed '$d')

print_status "$HTTP_STATUS"
print_body "$BODY"

# ── Assertion ─────────────────────────────────────────────────────────────────
assert_success "$HTTP_STATUS"
`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCurlArgs(method: string, hasBody: boolean): string {
  const lines: string[] = [
    `  -X ${method} \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer ${S}{AUTH_TOKEN:-}" \\`,
  ];

  if (hasBody) {
    lines.push(`  -H "Accept: application/json" \\`);
  }

  lines.push(`  ${S}{EXTRA_HEADERS:-} \\`);

  return lines.join('\n');
}

/** Replace path params with env-var references, e.g. :id → ${PARAM_ID} */
function buildCurlPath(path: string, params: string[]): string {
  let result = path;
  for (const param of params) {
    const upper = param.toUpperCase();
    result = result.replace(`:${param}`, `${S}{PARAM_${upper}:-1}`);
    result = result.replace(new RegExp(`<(?:\\w+:)?${param}>`), `${S}{PARAM_${upper}:-1}`);
    result = result.replace(`{${param}}`, `${S}{PARAM_${upper}:-1}`);
  }
  return result;
}

function buildInputSection(name: string): string {
  return `
# ── Input file (optional) ─────────────────────────────────────────────────────
# Place your request payload in the "inputs" directory.
# Supported formats: JSON, CSV, form-data.
INPUT_FILE="${S}{SCRIPT_DIR}/inputs/${name}.json"
if [ ! -f "$INPUT_FILE" ]; then
  INPUT_FILE="${S}{SCRIPT_DIR}/inputs/${name}.csv"
fi

`;
}

function buildBodyArg(): string {
  return `  --data-binary "@${S}{INPUT_FILE:-/dev/null}" \\
`;
}
