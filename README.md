# BAR-T — Bash API Request Test

> A **GitHub Copilot AI Skill** that automatically generates readable Bash scripts to test your backend API endpoints.

BAR-T (**B**ash **A**PI **R**equest **T**est) scans your backend project, detects every HTTP endpoint, and produces a well-structured set of `curl`-based Bash scripts — one per endpoint — together with a shared `config.sh`, an `.env` template, input stubs for endpoints that accept a body, and a `Makefile` that ties everything together.

---

## Features

- 🔍 **Language-agnostic endpoint detection** — Express, Fastify, NestJS, Hono, Koa, Flask, FastAPI, Django, Spring Boot, Gin, Echo, Chi, Rails, Laravel
- 🏗️ **Monorepo-aware** — detects Lerna, Nx, Turbo, pnpm/yarn workspaces, Cargo workspaces, Go workspaces; creates `scripts/bar-t/` inside each app separately
- 📁 **Idempotent** — detects whether `scripts/bar-t/` already exists and skips existing files
- 🖍️ **Readable scripts** — coloured output, HTTP status badges, `jq` pretty-printing, clear ✅ / ❌ assertions
- 🔐 **Secrets-safe** — a `.env` template keeps credentials out of version control
- 📦 **Input stubs** — generates `inputs/<name>.json` placeholders for endpoints that receive a body (JSON, form-data, CSV)
- 🛠️ **Makefile** — `make help`, `make all`, and individual targets for every test

---

## Generated folder structure

For a single-app project:

```
scripts/
└── bar-t/
    ├── .env                  ← fill in & add to .gitignore
    ├── .env.example          ← safe to commit
    ├── config.sh             ← shared helpers, sourced by every script
    ├── Makefile
    ├── inputs/
    │   └── post_api_users.json   ← body stub for POST /api/users
    ├── get_api_users.sh
    ├── post_api_users.sh
    ├── get_api_users_id.sh
    └── ...
```

For a monorepo (e.g. `apps/api`, `apps/worker`):

```
apps/
├── api/
│   └── scripts/bar-t/        ← scripts for the API app
└── worker/
    └── scripts/bar-t/        ← scripts for the worker app
```

---

## Using the skill in GitHub Copilot Chat

Once the extension is installed and registered:

```
@BART generate scripts for my-org/my-api
```

Or, when your Copilot chat is already scoped to a repository, simply:

```
@BART generate
```

BAR-T will scan the repository, stream back a summary of detected endpoints, and display every generated file so you can copy them into your project.

---

## Running a generated script

```bash
# 1. Set up your environment
cd scripts/bar-t
cp .env.example .env
# Edit .env: set BASE_URL, AUTH_TOKEN, etc.

# 2. Run all tests
make all

# 3. Run a single test
make get_api_users

# 4. Or execute a script directly
bash get_api_users.sh
```

---

## Supported frameworks / languages

| Language | Frameworks |
|----------|-----------|
| TypeScript / JavaScript | Express, Fastify, NestJS, Hono, Koa, koa-router |
| Python | Flask (1/2), FastAPI, Django |
| Java / Kotlin | Spring Boot (`@GetMapping`, `@PostMapping`, `@RequestMapping`) |
| Go | Gin, Echo, Chi |
| Ruby | Rails (`routes.rb`) |
| PHP | Laravel (`Route::get`, …) |

---

## Development

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Setup

```bash
git clone https://github.com/gabriel-q7/bart-ai-skill
cd bart-ai-skill
npm install
```

### Run in development mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

---

## Environment variables (server)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the skill server listens on |
| `GITHUB_TOKEN` | — | Fallback GitHub token (used when no user token is forwarded) |

---

## Architecture

```
src/
├── index.ts                        # Express server + Copilot SSE handler
├── types.ts                        # Shared TypeScript types
└── skill/
    ├── index.ts                    # Orchestrator (repo fetch → detect → generate)
    ├── endpoint-detector.ts        # Regex-based endpoint extraction
    ├── monorepo-detector.ts        # Workspace / monorepo detection
    └── generators/
        ├── index.ts                # Per-app file orchestration
        ├── bash-script.ts          # Individual .sh script generator
        ├── config-sh.ts            # config.sh generator
        ├── env-file.ts             # .env / .env.example generator
        └── makefile.ts             # Makefile generator
```

---

## License

MIT
