/**
 * Generates the `.env` file template placed at the `scripts/bar-t/` root.
 *
 * This file is intentionally left out of version control (.gitignore)
 * so that secrets are never committed.
 */
export function generateEnvFile(): string {
  return `# =============================================================================
#  BAR-T — environment variables
#
#  Copy this file to .env and fill in your values.
#  ⚠️  Never commit .env to version control!
# =============================================================================

# ── Server ────────────────────────────────────────────────────────────────────
BASE_URL=http://localhost:3000

# ── Authentication ────────────────────────────────────────────────────────────
AUTH_TOKEN=
API_KEY=

# ── Path parameters (used when URL params are present) ────────────────────────
# Add variables like PARAM_ID=1, PARAM_USER_ID=42, etc.
# PARAM_ID=1

# ── Extra curl headers (appended to every request, space-separated) ───────────
# EXTRA_HEADERS='-H "X-Tenant-ID: my-tenant"'

# ── Timeouts ──────────────────────────────────────────────────────────────────
# CURL_TIMEOUT=30
`;
}

/**
 * Generates the `.env.example` template (safe to commit, no secrets).
 */
export function generateEnvExample(): string {
  return `# =============================================================================
#  BAR-T — .env.example
#
#  Copy this file to .env and fill in your values.
# =============================================================================

BASE_URL=http://localhost:3000
AUTH_TOKEN=your-jwt-token-here
API_KEY=your-api-key-here

# PARAM_ID=1
# EXTRA_HEADERS=
# CURL_TIMEOUT=30
`;
}
