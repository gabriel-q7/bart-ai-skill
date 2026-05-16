import type { Endpoint, HttpMethod, RepoContext, AppInfo } from '../types';

// ── Pattern definitions ───────────────────────────────────────────────────────

interface RoutePattern {
  /**
   * Regex to match a route declaration.
   * Required capture groups:
   *   1 → HTTP method (or blank when derivable from decorator name)
   *   2 → route path
   */
  regex: RegExp;
  language: string;
  framework: string;
  /** Extract the HTTP method from the regex match */
  extractMethod: (m: RegExpMatchArray) => string;
  /** Extract the path from the regex match */
  extractPath: (m: RegExpMatchArray) => string;
}

const ROUTE_PATTERNS: RoutePattern[] = [
  // ── Express / Fastify (JS/TS) ──────────────────────────────────────────────
  {
    // app.get('/path', ...) | router.post('/path', ...) | fastify.put('/path', ...)
    regex:
      /(?:app|router|fastify|server|api|v\d+)\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    language: 'typescript',
    framework: 'express',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── NestJS / TypeScript decorators ─────────────────────────────────────────
  {
    // @Get('/path') | @Post('/path') etc.
    regex: /@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/gi,
    language: 'typescript',
    framework: 'nestjs',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  {
    // @Get() with no path argument → root of the controller
    regex: /@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*\)/gi,
    language: 'typescript',
    framework: 'nestjs',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (_m) => '/',
  },
  // ── Flask / Python ──────────────────────────────────────────────────────────
  {
    // @app.route('/path', methods=['GET', 'POST'])
    regex:
      /@(?:app|blueprint|bp|api|v\d+)\.route\s*\(\s*['"]([^'"]+)['"]\s*,\s*methods\s*=\s*\[([^\]]+)\]/gi,
    language: 'python',
    framework: 'flask',
    // For Flask, group 1 is path and group 2 is methods — we'll emit one entry per method
    extractMethod: (m) => m[2].replace(/['" ]/g, '').split(',')[0].toUpperCase(),
    extractPath: (m) => m[1],
  },
  {
    // @app.get('/path') | @app.post('/path') — Flask 2.x shorthand
    regex:
      /@(?:app|blueprint|bp|api|v\d+)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*\)/gi,
    language: 'python',
    framework: 'flask',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── FastAPI / Python ────────────────────────────────────────────────────────
  {
    // @router.get('/path') | @app.post('/path')
    regex:
      /@(?:router|app|api_router|v\d+)\.(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]+)['"]/gi,
    language: 'python',
    framework: 'fastapi',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── Django URLs ─────────────────────────────────────────────────────────────
  {
    // path('api/users/', UserListView.as_view(), name='user-list')
    regex: /(?:re_)?path\s*\(\s*['"]([^'"]+)['"]/gi,
    language: 'python',
    framework: 'django',
    extractMethod: (_m) => 'GET', // Django views define methods internally; default to GET
    extractPath: (m) => '/' + m[1].replace(/\^|\$/, ''),
  },
  // ── Spring Boot / Java ──────────────────────────────────────────────────────
  {
    // @GetMapping("/path") | @PostMapping("/path") | @GetMapping(value="/path")
    regex:
      /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\s*\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]/gi,
    language: 'java',
    framework: 'spring',
    extractMethod: (m) =>
      m[1].replace('Mapping', '').toUpperCase(),
    extractPath: (m) => m[2],
  },
  {
    regex:
      /@RequestMapping\s*\([^)]*value\s*=\s*['"]([^'"]+)['"][^)]*method\s*=\s*RequestMethod\.(\w+)/gi,
    language: 'java',
    framework: 'spring',
    extractMethod: (m) => m[2].toUpperCase(),
    extractPath: (m) => m[1],
  },
  // ── Gin / Go ────────────────────────────────────────────────────────────────
  {
    // r.GET("/path", handler) | r.POST("/path", handler)
    regex:
      /(?:r|router|engine|g|v\d+|api)\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(\s*"([^"]+)"/gi,
    language: 'go',
    framework: 'gin',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── Echo / Go ───────────────────────────────────────────────────────────────
  {
    // e.GET("/path", handler) | g.POST("/path", handler)
    regex:
      /(?:e|echo|g|api|v\d+)\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(\s*"([^"]+)"/gi,
    language: 'go',
    framework: 'echo',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── Chi / Go ────────────────────────────────────────────────────────────────
  {
    // r.Method("GET", "/path", handler)
    regex: /\.Method\s*\(\s*"(GET|POST|PUT|PATCH|DELETE)"\s*,\s*"([^"]+)"/gi,
    language: 'go',
    framework: 'chi',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── Ruby on Rails ───────────────────────────────────────────────────────────
  {
    // get '/path', to: 'controller#action'
    regex: /\b(get|post|put|patch|delete)\s+['"]([^'"]+)['"]/gi,
    language: 'ruby',
    framework: 'rails',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── Laravel / PHP ───────────────────────────────────────────────────────────
  {
    // Route::get('/path', handler) | Route::post('/path', handler)
    regex:
      /Route::(get|post|put|patch|delete|any)\s*\(\s*['"]([^'"]+)['"]/gi,
    language: 'php',
    framework: 'laravel',
    extractMethod: (m) => (m[1].toLowerCase() === 'any' ? 'GET' : m[1].toUpperCase()),
    extractPath: (m) => m[2],
  },
  // ── Hono / Elysia (TS) ──────────────────────────────────────────────────────
  {
    regex:
      /(?:app|hono|elysia)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    language: 'typescript',
    framework: 'hono',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
  // ── Koa + koa-router (JS/TS) ────────────────────────────────────────────────
  {
    regex:
      /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    language: 'typescript',
    framework: 'koa',
    extractMethod: (m) => m[1].toUpperCase(),
    extractPath: (m) => m[2],
  },
];

// ── File extensions we consider for each language ────────────────────────────
const ROUTE_FILE_PATTERNS: { pattern: RegExp; language: string }[] = [
  { pattern: /\.(ts|tsx|js|mjs|cjs)$/, language: 'typescript' },
  { pattern: /\.py$/, language: 'python' },
  { pattern: /\.(java|kt)$/, language: 'java' },
  { pattern: /\.go$/, language: 'go' },
  { pattern: /\.rb$/, language: 'ruby' },
  { pattern: /\.php$/, language: 'php' },
];

// Route-related filenames (heuristic to reduce scanning)
const ROUTE_FILENAME_HINTS =
  /route|router|controller|endpoint|handler|view|url|api|resource/i;

const METHODS_WITH_BODY: HttpMethod[] = ['POST', 'PUT', 'PATCH'];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect API endpoints across all files in the repo context.
 * Returns a list of `AppInfo` objects — one per detected framework/app.
 */
export function detectEndpoints(
  context: RepoContext,
  appPaths?: string[],
): AppInfo[] {
  const roots = appPaths && appPaths.length > 0 ? appPaths : [''];

  return roots.map((appRoot) => {
    const prefix = appRoot ? appRoot + '/' : '';
    const relevantFiles = context.filePaths.filter(
      (p) =>
        p.startsWith(prefix) &&
        ROUTE_FILE_PATTERNS.some((fp) => fp.pattern.test(p)) &&
        (ROUTE_FILENAME_HINTS.test(p) || true), // scan all source files
    );

    const endpoints: Endpoint[] = [];
    const frameworkCounts: Record<string, number> = {};
    const languageCounts: Record<string, number> = {};

    for (const filePath of relevantFiles) {
      const content = context.fileContents.get(filePath);
      if (!content) continue;

      const fileEndpoints = extractEndpointsFromFile(filePath, content);
      endpoints.push(...fileEndpoints);

      for (let i = 0; i < fileEndpoints.length; i++) {
        const pattern = ROUTE_PATTERNS.find(
          (rp) => rp.language && rp.framework,
        );
        if (pattern) {
          frameworkCounts[pattern.framework] =
            (frameworkCounts[pattern.framework] ?? 0) + 1;
          languageCounts[pattern.language] =
            (languageCounts[pattern.language] ?? 0) + 1;
        }
      }
    }

    const framework = topKey(frameworkCounts) ?? 'unknown';
    const language = topKey(languageCounts) ?? 'unknown';
    const appName = appRoot ? appRoot.split('/').pop() ?? appRoot : 'app';

    return {
      name: appName,
      path: appRoot || '.',
      endpoints: deduplicateEndpoints(endpoints),
      framework,
      language,
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractEndpointsFromFile(filePath: string, content: string): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const seenKeys = new Set<string>();

  for (const pattern of ROUTE_PATTERNS) {
    // Reset lastIndex to ensure re-use of global regex is safe
    pattern.regex.lastIndex = 0;
    let match: RegExpMatchArray | null;

    while ((match = pattern.regex.exec(content)) !== null) {
      const rawMethod = pattern.extractMethod(match);
      const rawPath = pattern.extractPath(match);

      // Handle Flask multi-method patterns
      const methods = rawMethod.includes(',')
        ? rawMethod.split(',').map((m) => m.trim())
        : [rawMethod];

      for (const method of methods) {
        const httpMethod = normalizeMethod(method);
        if (!httpMethod) continue;

        const normalizedPath = normalizePath(rawPath);
        const key = `${httpMethod}:${normalizedPath}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const params = extractPathParams(normalizedPath);

        endpoints.push({
          method: httpMethod,
          path: normalizedPath,
          name: buildName(httpMethod, normalizedPath),
          file: filePath,
          params,
          hasBody: METHODS_WITH_BODY.includes(httpMethod),
        });
      }
    }
  }

  return endpoints;
}

function normalizeMethod(raw: string): HttpMethod | null {
  const upper = raw.toUpperCase() as HttpMethod;
  const valid: HttpMethod[] = [
    'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
  ];
  return valid.includes(upper) ? upper : null;
}

function normalizePath(raw: string): string {
  // Ensure leading slash
  let p = raw.startsWith('/') ? raw : '/' + raw;
  // Normalize trailing slash (remove unless root)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function extractPathParams(path: string): string[] {
  const params: string[] = [];
  // Express-style :param
  const expressParams = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  if (expressParams) params.push(...expressParams.map((p) => p.slice(1)));
  // Python/Django <type:param> or <param>
  const djangoParams = path.match(/<(?:\w+:)?(\w+)>/g);
  if (djangoParams) params.push(...djangoParams.map((p) => p.replace(/<(?:\w+:)?(\w+)>/, '$1')));
  // Go {param} or {param:regex}
  const goParams = path.match(/\{([^}:]+)(?::[^}]*)?\}/g);
  if (goParams) params.push(...goParams.map((p) => p.replace(/\{([^}:]+).*\}/, '$1')));
  // Spring {param}
  const springParams = path.match(/\{([^}]+)\}/g);
  if (springParams) params.push(...springParams.map((p) => p.slice(1, -1)));
  return [...new Set(params)];
}

/**
 * Build a snake_case name like "get_users_id" from "GET /users/:id"
 */
function buildName(method: string, path: string): string {
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((seg) =>
      seg
        .replace(/^:/, '')
        .replace(/[<>{}]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase(),
    )
    .filter(Boolean);

  return [method.toLowerCase(), ...parts].join('_');
}

function deduplicateEndpoints(endpoints: Endpoint[]): Endpoint[] {
  const seen = new Set<string>();
  return endpoints.filter((ep) => {
    const key = `${ep.method}:${ep.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function topKey(counts: Record<string, number>): string | null {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
