export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

/** A detected API endpoint in a backend project. */
export interface Endpoint {
  /** HTTP verb */
  method: HttpMethod;
  /** Route path, e.g. /api/users/:id */
  path: string;
  /** Slug used for the generated script filename, e.g. "list_users" */
  name: string;
  /** Source file where the endpoint was found */
  file: string;
  /** Path parameters extracted from the route, e.g. ["id"] */
  params: string[];
  /** Whether the endpoint typically receives a request body */
  hasBody: boolean;
  /** Optional short description */
  description?: string;
}

/** Information about a single application inside (or forming) the project. */
export interface AppInfo {
  /** App / package name */
  name: string;
  /** Relative path from the repo root to the app directory */
  path: string;
  /** Detected endpoints */
  endpoints: Endpoint[];
  /** Detected framework, e.g. "express", "fastapi", "spring" */
  framework: string;
  /** Programming language, e.g. "typescript", "python", "java" */
  language: string;
}

/** Result of scanning for a monorepo structure. */
export interface MonorepoInfo {
  isMonorepo: boolean;
  /** Tool used to manage the monorepo, e.g. "lerna", "nx", "turbo", "pnpm" */
  type: string;
  /** Relative paths from the repo root to each app directory */
  apps: string[];
}

/** A single file that should be written to the target repository. */
export interface GeneratedFile {
  /** Path relative to the repo root */
  path: string;
  /** File contents */
  content: string;
  /** Human-readable description shown in the skill output */
  description: string;
  /** Whether this is a brand-new file (vs. updating an existing one) */
  isNew: boolean;
}

/** Complete output produced by the BAR-T skill. */
export interface BartResult {
  apps: AppInfo[];
  files: GeneratedFile[];
  /** Summary text streamed back to the user */
  summary: string;
}

/** Parsed representation of the repository that the skill operates on. */
export interface RepoContext {
  /** GitHub owner (user or org) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Default branch */
  defaultBranch: string;
  /** Flat list of all file paths in the repo (from the Git tree) */
  filePaths: string[];
  /** Cache of file contents keyed by path */
  fileContents: Map<string, string>;
}
