// Dollar-sign helper: avoids no-useless-escape lint errors while still
// producing literal '${VAR}' bash variable syntax in the output string.
const S = '$';

/**
 * Generates the shared `config.sh` used by all BAR-T test scripts.
 */
export function generateConfigSh(): string {
  return `#!/usr/bin/env bash
# =============================================================================
#  BAR-T config.sh — shared configuration for all test scripts
#
#  Source this file at the top of every BAR-T script:
#    source "${S}{SCRIPT_DIR}/../config.sh"
# =============================================================================

# ── Base URL (override via .env or environment variable) ──────────────────────
: "${S}{BASE_URL:=http://localhost:3000}"

# ── Auth (override via .env or environment variable) ─────────────────────────
: "${S}{AUTH_TOKEN:=}"
: "${S}{API_KEY:=}"

# ── ANSI colors ───────────────────────────────────────────────────────────────
RED="\\033[0;31m"
GREEN="\\033[0;32m"
YELLOW="\\033[1;33m"
BLUE="\\033[0;34m"
CYAN="\\033[0;36m"
BOLD="\\033[1m"
RESET="\\033[0m"

# ── load_env ──────────────────────────────────────────────────────────────────
# Usage: load_env /path/to/.env
load_env() {
  local env_file="${S}{1:-}"
  if [ -f "${S}env_file" ]; then
    # shellcheck disable=SC1090
    set -a
    source "${S}env_file"
    set +a
  fi
}

# ── print_section ─────────────────────────────────────────────────────────────
# Usage: print_section "GET /api/users"
print_section() {
  local title="${S}{1:-}"
  echo ""
  printf "%b%s%b\\n" "${S}{BOLD}${S}{CYAN}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "${S}{RESET}"
  printf "  %b🚀 %s%b\\n" "${S}{BOLD}" "${S}title" "${S}{RESET}"
  printf "%b%s%b\\n" "${S}{BOLD}${S}{CYAN}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "${S}{RESET}"
  echo ""
}

# ── print_status ──────────────────────────────────────────────────────────────
# Usage: print_status "${S}HTTP_STATUS"
print_status() {
  local status="${S}{1:-0}"
  if [ "${S}status" -ge 200 ] && [ "${S}status" -lt 300 ]; then
    printf "  %b📥 HTTP Status: %s ✅%b\\n" "${S}{GREEN}${S}{BOLD}" "${S}status" "${S}{RESET}"
  elif [ "${S}status" -ge 300 ] && [ "${S}status" -lt 400 ]; then
    printf "  %b📥 HTTP Status: %s ↪️%b\\n"  "${S}{YELLOW}${S}{BOLD}" "${S}status" "${S}{RESET}"
  else
    printf "  %b📥 HTTP Status: %s ❌%b\\n"  "${S}{RED}${S}{BOLD}"    "${S}status" "${S}{RESET}"
  fi
  echo ""
}

# ── print_body ────────────────────────────────────────────────────────────────
# Usage: print_body "${S}BODY"
print_body() {
  local body="${S}{1:-}"
  printf "  %b📄 Response:%b\\n" "${S}{BOLD}" "${S}{RESET}"
  if command -v jq &>/dev/null && echo "${S}body" | jq . &>/dev/null 2>&1; then
    echo "${S}body" | jq --color-output .
  else
    echo "${S}body"
  fi
  echo ""
}

# ── assert_success ────────────────────────────────────────────────────────────
# Usage: assert_success "${S}HTTP_STATUS"
assert_success() {
  local status="${S}{1:-0}"
  if [ "${S}status" -ge 200 ] && [ "${S}status" -lt 300 ]; then
    printf "%b  ✅  Test PASSED%b\\n\\n" "${S}{GREEN}${S}{BOLD}" "${S}{RESET}"
  else
    printf "%b  ❌  Test FAILED (HTTP %s)%b\\n\\n" "${S}{RED}${S}{BOLD}" "${S}status" "${S}{RESET}"
    exit 1
  fi
}
`;
}
