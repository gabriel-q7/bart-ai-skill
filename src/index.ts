import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createAckEvent,
  createDoneEvent,
  createErrorsEvent,
  createTextEvent,
  verifyAndParseRequest,
  getUserMessage,
  type CopilotRequestPayload,
  type CopilotMessage,
} from '@copilot-extensions/preview-sdk';
import { Octokit } from '@octokit/rest';
import { runBartSkill } from './skill/index';

const app = express();

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // max 20 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later.' },
});

// ── Health-check endpoint ─────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ name: 'BAR-T', version: '1.0.0', status: 'ok' });
});

// ── Copilot Extension entry point ─────────────────────────────────────────────
app.post('/', limiter, express.json(), async (req: Request, res: Response) => {
  // 1. Verify the request comes from GitHub Copilot
  const signature = req.get('Github-Public-Key-Signature') ?? '';
  const keyId = req.get('Github-Public-Key-Identifier') ?? '';
  const tokenForUser = req.get('X-GitHub-Token') ?? '';

  let copilotPayload: CopilotRequestPayload;
  try {
    const result = await verifyAndParseRequest(
      JSON.stringify(req.body),
      signature,
      keyId,
      { token: tokenForUser },
    );
    copilotPayload = result.payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(401).json({ error: `Unauthorized: ${message}` });
    return;
  }

  // 2. Stream back Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Acknowledge receipt immediately
  res.write(createAckEvent());

  try {
    const userMessage = getUserMessage(copilotPayload) ?? '';
    await handleSkillRequest(copilotPayload, userMessage, tokenForUser, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.write(createErrorsEvent([{ type: 'agent', code: '500', message, identifier: 'bart' }]));
  }

  res.write(createDoneEvent());
  res.end();
});

// ── Core skill handler ────────────────────────────────────────────────────────

async function handleSkillRequest(
  payload: CopilotRequestPayload,
  userMessage: string,
  tokenForUser: string,
  res: Response,
): Promise<void> {
  // Try to infer the target repository from the conversation context
  const { owner, repo } = extractRepoFromPayload(payload, userMessage);

  if (!owner || !repo) {
    res.write(
      createTextEvent(
        [
          '## BAR-T — Bash API Request Test',
          '',
          'Please tell me which repository to analyse, for example:',
          '',
          '```',
          '@BART generate scripts for owner/repo-name',
          '```',
          '',
          'Or open this Copilot chat while viewing the repository and try again.',
        ].join('\n'),
      ),
    );
    return;
  }

  res.write(createTextEvent(`🔍 Analysing \`${owner}/${repo}\`…\n\n`));

  const octokit = new Octokit({ auth: tokenForUser || process.env.GITHUB_TOKEN });
  const result = await runBartSkill(octokit, owner, repo);

  // Stream the summary
  res.write(createTextEvent(result.summary));

  // Stream the generated file contents as fenced code blocks
  res.write(
    createTextEvent(['', '', '---', '', '## 📂 Generated file contents', ''].join('\n')),
  );

  for (const file of result.files) {
    const lang = detectLanguage(file.path);
    res.write(
      createTextEvent(
        [`### \`${file.path}\``, '', `\`\`\`${lang}`, file.content.trimEnd(), '```', ''].join('\n'),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Attempt to find owner/repo from:
 *  1. The message itself (e.g. "generate scripts for acme/my-api")
 *  2. Copilot conversation context (repository references in messages)
 */
function extractRepoFromPayload(
  payload: CopilotRequestPayload,
  userMessage: string,
): { owner: string; repo: string } {
  // Pattern: "owner/repo" in the user message
  const msgMatch = userMessage.match(/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (msgMatch) {
    return { owner: msgMatch[1], repo: msgMatch[2] };
  }

  // Look in Copilot references for a repository reference
  for (const message of payload.messages as CopilotMessage[]) {
    for (const ref of message.copilot_references ?? []) {
      if (ref.type === 'github.repository') {
        const data = ref.data as { ownerLogin?: string; name?: string };
        if (data.ownerLogin && data.name) {
          return { owner: data.ownerLogin, repo: data.name };
        }
      }
    }
  }

  return { owner: '', repo: '' };
}

function detectLanguage(filePath: string): string {
  if (filePath.endsWith('.sh')) return 'bash';
  if (filePath.endsWith('Makefile')) return 'makefile';
  if (filePath.endsWith('.env') || filePath.endsWith('.env.example')) return 'dotenv';
  return 'text';
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`BAR-T AI Skill — listening on port ${PORT}`);
});

export default app;
