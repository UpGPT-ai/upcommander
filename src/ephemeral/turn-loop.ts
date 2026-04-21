import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { readSkeleton, writeSkeleton, initSkeleton } from './skeleton';
import { loadIndexContext } from '../index-connector';
import type { OrchestratorSkeleton, TurnResult, RoutingEnvelope } from './types';

const MODEL = 'claude-haiku-4-5-20251001';

// Allowed tools for Haiku orchestrator — Edit/Write/Bash are NOT in this list (AC-2)
const HAIKU_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_coord_file',
    description: 'Read a file inside .claude-coord/ coordination directory only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        relative_path: {
          type: 'string',
          description: 'Path relative to .claude-coord/ (e.g. "db/skeleton.json")',
        },
      },
      required: ['relative_path'],
    },
  },
  {
    name: 'write_skeleton',
    description: 'Persist updated skeleton state at end of turn.',
    input_schema: {
      type: 'object' as const,
      properties: {
        skeleton: {
          type: 'object',
          description: 'Full OrchestratorSkeleton JSON object.',
        },
      },
      required: ['skeleton'],
    },
  },
  {
    name: 'send_tmux',
    description: 'Send a command string to a named tmux window to launch or update a Sonnet worker.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session: { type: 'string' },
        window: { type: 'string' },
        command: { type: 'string', description: '≤500 chars' },
      },
      required: ['session', 'window', 'command'],
    },
  },
  {
    name: 'invoke_opus_commander',
    description: 'Delegate CONTRACT.md generation to the Opus-Commander subprocess. Use only when the task requires authoring a multi-file contract (>3 files). Returns the path to the written CONTRACT.md and a ≤200 token summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        envelope: {
          type: 'object',
          properties: {
            directive: { type: 'string' },
            filesSuspected: { type: 'array', items: { type: 'string' } },
            contextSummary: { type: 'string', description: '≤200 chars' },
          },
          required: ['directive', 'filesSuspected', 'contextSummary'],
        },
      },
      required: ['envelope'],
    },
  },
];

const OPUS_CONTRACT_SYSTEM = `You are an expert TypeScript architect generating a CONTRACT.md for a multi-file coding task.
A CONTRACT.md specifies: exact TypeScript interfaces, DB column names, import paths, SQL conventions, API response formats, and explicit non-goals.
Include exact file paths, exact exported function signatures, and acceptance criteria that can be checked with grep.
Output ONLY the raw markdown for CONTRACT.md — no preamble, no explanation, no code fences around the whole document.`;

async function invokeOpusCommander(
  client: Anthropic,
  envelope: RoutingEnvelope,
  repoPath: string,
): Promise<{ contractPath: string; summary: string }> {
  const coordDir = path.join(repoPath, '.claude-coord');
  if (!fs.existsSync(coordDir)) fs.mkdirSync(coordDir, { recursive: true });

  const contractPath = path.join(coordDir, 'CONTRACT.md');

  // L0 index gives Opus a compact map of the codebase (~2K tokens)
  const l0 = loadIndexContext(repoPath, 'L0');

  const userMessage = [
    `TASK: ${envelope.directive}`,
    '',
    `FILES EXPECTED TO CHANGE: ${envelope.filesSuspected.join(', ')}`,
    '',
    `CONTEXT: ${envelope.contextSummary}`,
    '',
    l0.text,
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    system: OPUS_CONTRACT_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  });

  const contractContent = (response.content as Array<{ type: string; text?: string }>)
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  fs.writeFileSync(contractPath, contractContent, 'utf-8');

  return {
    contractPath: path.relative(repoPath, contractPath),
    summary: contractContent.slice(0, 200),
  };
}

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  skeleton: OrchestratorSkeleton,
  client: Anthropic,
  repoPath: string,
): Promise<{ result: string; updatedSkeleton: OrchestratorSkeleton; delegatedToOpus: boolean }> {
  let delegatedToOpus = false;

  switch (toolName) {
    case 'read_coord_file': {
      const relPath = toolInput['relative_path'] as string;
      const fullPath = path.resolve(repoPath, '.claude-coord', relPath);
      const coordBase = path.resolve(repoPath, '.claude-coord');
      if (!fullPath.startsWith(coordBase)) {
        return { result: 'ERROR: path escapes .claude-coord/ boundary', updatedSkeleton: skeleton, delegatedToOpus };
      }
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return { result: content.slice(0, 4000), updatedSkeleton: skeleton, delegatedToOpus };
      } catch {
        return { result: `ERROR: file not found: ${relPath}`, updatedSkeleton: skeleton, delegatedToOpus };
      }
    }

    case 'write_skeleton': {
      const incoming = toolInput['skeleton'] as OrchestratorSkeleton;
      writeSkeleton(incoming);
      return { result: 'skeleton written', updatedSkeleton: incoming, delegatedToOpus };
    }

    case 'send_tmux': {
      const sess = toolInput['session'] as string;
      const win = toolInput['window'] as string;
      const cmd = toolInput['command'] as string;
      try {
        execSync(`tmux send-keys -t "${sess}:${win}" "${cmd.replace(/"/g, '\\"')}" Enter`, { stdio: 'pipe' });
        return { result: `sent to ${sess}:${win}`, updatedSkeleton: skeleton, delegatedToOpus };
      } catch (e) {
        return { result: `ERROR tmux: ${String(e).slice(0, 200)}`, updatedSkeleton: skeleton, delegatedToOpus };
      }
    }

    case 'invoke_opus_commander': {
      const envelope = toolInput['envelope'] as RoutingEnvelope;
      try {
        const result = await invokeOpusCommander(client, envelope, repoPath);
        delegatedToOpus = true;
        return { result: JSON.stringify(result), updatedSkeleton: skeleton, delegatedToOpus };
      } catch (e) {
        return { result: `ERROR invoke_opus_commander: ${String(e).slice(0, 300)}`, updatedSkeleton: skeleton, delegatedToOpus };
      }
    }

    default:
      return { result: `ERROR: unknown tool ${toolName}`, updatedSkeleton: skeleton, delegatedToOpus };
  }
}

function writeTrace(tracesDir: string, entry: Record<string, unknown>): string {
  if (!fs.existsSync(tracesDir)) fs.mkdirSync(tracesDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const traceFile = path.join(tracesDir, `ephemeral-${date}.ndjson`);
  fs.appendFileSync(traceFile, JSON.stringify(entry) + '\n', 'utf-8');
  return traceFile;
}

export async function startEphemeralTurn(userPrompt: string, repoPath?: string): Promise<TurnResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resolvedRepoPath = repoPath ?? process.cwd();
  const SYSTEM_PROMPT_PATH = path.join(resolvedRepoPath, 'docs/upcommander/CLAUDE-EPHEMERAL-ORCH.md');
  const TRACES_DIR = path.join(resolvedRepoPath, '.claude-coord/traces');

  // Load or init skeleton
  let skeleton = readSkeleton();
  if (!skeleton) {
    const { execSync } = await import('node:child_process');
    const commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    skeleton = initSkeleton(path.basename(process.cwd()), commitSha);
  }

  // Rotate priorDirectives before this turn
  if (skeleton.humanDirective) {
    skeleton.priorDirectives.push(skeleton.humanDirective.slice(0, 200));
  }
  skeleton.humanDirective = userPrompt.slice(0, 2000);

  // Load cached system prompt
  let systemPrompt = '[CLAUDE-EPHEMERAL-ORCH.md not found — using fallback]';
  try {
    systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
  } catch {
    // fallback
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `<skeleton>\n${JSON.stringify(skeleton, null, 2)}\n</skeleton>\n\n<directive>\n${userPrompt}\n</directive>`,
    },
  ];

  let reply = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let delegatedToOpus = false;
  let traceFile = '';

  try {
    let continueLoop = true;

    while (continueLoop) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            // Cache the stable system prompt prefix across turns
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: HAIKU_TOOLS,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Collect text blocks as the reply
      for (const block of response.content) {
        if (block.type === 'text') reply += block.text;
      }

      if (response.stop_reason === 'tool_use') {
        const assistantMsg: Anthropic.MessageParam = { role: 'assistant', content: response.content };
        messages.push(assistantMsg);

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const { result, updatedSkeleton, delegatedToOpus: delegated } = await handleToolCall(
              block.name,
              block.input as Record<string, unknown>,
              skeleton,
              client,
              resolvedRepoPath,
            );
            skeleton = updatedSkeleton;
            if (delegated) delegatedToOpus = true;
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
          }
        }
        messages.push({ role: 'user', content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    // Approximate cost: Haiku input $0.80/MTok, output $4/MTok
    const costUsd = (totalInputTokens / 1_000_000) * 0.80 + (totalOutputTokens / 1_000_000) * 4.0;
    skeleton.budget.sessionSpent += costUsd;

    // Persist skeleton at turn-end
    writeSkeleton(skeleton);

    traceFile = writeTrace(TRACES_DIR, {
      ts: new Date().toISOString(),
      model: MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUsd,
      delegatedToOpus,
      reply: reply.slice(0, 500),
    });

    return {
      reply: reply || '(no text reply)',
      skeletonUpdated: true,
      traceFile,
      costUsd,
      delegatedToOpus,
    };
  } catch (err) {
    // Write trace even on error (AC-4)
    traceFile = writeTrace(TRACES_DIR, {
      ts: new Date().toISOString(),
      model: MODEL,
      error: String(err),
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });
    throw err;
  }
}
