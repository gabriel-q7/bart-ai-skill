import type { Endpoint } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a single Makefile target for the given endpoint. */
function buildTarget(ep: Endpoint): string {
  const scriptPath = `./${ep.name}.sh`;
  return `.PHONY: ${ep.name}\n${ep.name}: ## ${ep.method} ${ep.path}\n\t@bash ${scriptPath}\n`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a `Makefile` at the `scripts/bar-t/` root that provides
 * convenient targets for running individual tests or the full suite.
 */
export function generateMakefile(endpoints: Endpoint[], _scriptDir: string): string {
  // Use a variable for '$' to avoid TypeScript template-expression conflicts
  // when we need literal '${VAR}' in the output.
  const D = '$';

  const targets = endpoints.map((ep) => buildTarget(ep));
  const allNames = endpoints.map((ep) => ep.name).join(' \\\n\t\t\t');

  const header = [
    '# =============================================================================',
    '#  BAR-T — Makefile',
    '#',
    '#  Usage:',
    '#    make help         — show available targets',
    '#    make all          — run every test',
    '#    make <test-name>  — run a single test',
    '# =============================================================================',
    '',
    'SHELL := /usr/bin/env bash',
    '.DEFAULT_GOAL := help',
    '',
    '# ── Color helpers ─────────────────────────────────────────────────────────────',
    'GREEN  := \\033[0;32m',
    'YELLOW := \\033[1;33m',
    'CYAN   := \\033[0;36m',
    'BOLD   := \\033[1m',
    'RESET  := \\033[0m',
    '',
    '# =============================================================================',
    '#  Meta targets',
    '# =============================================================================',
    '',
    '.PHONY: help',
    'help: ## Show this help message',
    '\t@printf "\\n%b%s%b\\n\\n" "$(BOLD)$(CYAN)" "BAR-T — Bash API Request Test" "$(RESET)"',
    '\t@grep -E \'^[a-zA-Z0-9_-]+:.*##\' $(MAKEFILE_LIST) | \\',
    '\t  awk \'BEGIN {FS = ":.*##"}; {printf "  %b%-30s%b %s\\n", "$(BOLD)", $$1, "$(RESET)", $$2}\'',
    '\t@echo ""',
    '',
    '.PHONY: all',
    `all: ${allNames} ## Run every BAR-T test`,
    '\t@printf "\\n%b  ✅  All tests completed%b\\n\\n" "$(GREEN)$(BOLD)" "$(RESET)"',
    '',
    '.PHONY: setup',
    'setup: ## Install required tools (curl, jq)',
    '\t@command -v curl >/dev/null 2>&1 || (echo "⚠️  curl not found — please install it" && exit 1)',
    '\t@command -v jq   >/dev/null 2>&1 || echo "ℹ️  jq not found — JSON output won\'t be pretty-printed"',
    '\t@echo "✅  Dependencies OK"',
    '',
    '.PHONY: env',
    'env: ## Show current environment (masks sensitive values)',
    `\t@echo "BASE_URL   = ${D}{BASE_URL:-<not set>}"`,
    `\t@echo "AUTH_TOKEN = ${D}{AUTH_TOKEN:+<set>}${D}{AUTH_TOKEN:-<not set>}"`,
    `\t@echo "API_KEY    = ${D}{API_KEY:+<set>}${D}{API_KEY:-<not set>}"`,
    '',
    '# =============================================================================',
    '#  Individual test targets',
    '# =============================================================================',
    '',
  ];

  return header.join('\n') + targets.join('\n');
}
