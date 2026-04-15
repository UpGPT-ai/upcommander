/**
 * Template registry and management system for Claude Commander.
 *
 * Provides 6 built-in project templates (dev, research, book, campaign,
 * video, custom) plus support for user-created custom templates stored
 * in ~/.claude-commander/templates/.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createSession, sessionExists } from './tmux.js';
import { generateWorkerMd, generateProjectOrchestratorMd } from './claude-md-generator.js';

// NOTE: initCoordination is being built by a parallel agent in coordination.ts.
// We import it here with its expected signature. If the file does not yet exist,
// compilation will fail — run `npx tsc --noEmit` after coordination.ts is written.
import { initCoordination } from './coordination.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Supported AI model providers and their model identifiers.
 * Workers can be assigned different models based on task complexity.
 */
export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'custom';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;       // e.g. 'claude-sonnet-4-6', 'gpt-4o', 'gemini-2.5-pro'
  fallback?: string;   // fallback model if primary unavailable
  maxTokens?: number;  // max output tokens for this worker
  temperature?: number; // 0-1, lower = more deterministic
}

/**
 * Model hierarchy (enforced):
 *   DEFAULT → Sonnet: All workers, all standard tasks
 *   CHEAP   → Haiku:  Scanning, triage, formatting, simple lookups
 *   DEEP    → Opus:   ONLY when deep reasoning is explicitly required
 *                      (architecture decisions, cross-jurisdiction synthesis,
 *                       adversarial testing, complex multi-step reasoning)
 *
 * Workers default to Sonnet unless explicitly overridden.
 * Opus should be used sparingly — most tasks do not require it.
 */
export const MODEL_PRESETS: Record<string, ModelConfig> = {
  // DEEP: Use sparingly — only for tasks requiring deep reasoning
  'opus': {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    fallback: 'claude-sonnet-4-6',
    maxTokens: 16384,
    temperature: 0.3,
  },
  // DEFAULT: Standard for all workers and most tasks
  'sonnet': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    fallback: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    temperature: 0.4,
  },
  // CHEAP: Fast/cheap for scanning, formatting, triage
  'haiku': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    temperature: 0.2,
  },
  // OpenAI reasoning models
  'o3': {
    provider: 'openai',
    model: 'o3',
    fallback: 'gpt-4o',
    maxTokens: 16384,
    temperature: 0.3,
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    fallback: 'gpt-4o-mini',
    maxTokens: 8192,
    temperature: 0.4,
  },
  // Google models
  'gemini-pro': {
    provider: 'google',
    model: 'gemini-2.5-pro',
    fallback: 'gemini-2.5-flash',
    maxTokens: 8192,
    temperature: 0.4,
  },
  'gemini-flash': {
    provider: 'google',
    model: 'gemini-2.5-flash',
    maxTokens: 4096,
    temperature: 0.3,
  },
};

export interface WorkerDefinition {
  name: string;
  role: string;        // one-line description
  claudeMd: string;    // CLAUDE.md content for this worker
  tier: number;        // 2 = standard worker
  model?: ModelConfig;  // assigned model (defaults to sonnet if omitted)
}

export interface ProjectTemplate {
  name: string;
  description: string;
  workers: WorkerDefinition[];
  outputStructure: Record<string, string>; // directory → description
  defaultModel?: ModelConfig;  // default model for workers without explicit assignment
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CONFIG_DIR = join(homedir(), '.claude-commander');
const TEMPLATES_DIR = join(CONFIG_DIR, 'templates');

/**
 * Build a WorkerDefinition from minimal inputs, generating the CLAUDE.md
 * automatically via generateWorkerMd.
 */
function makeWorker(
  name: string,
  role: string,
  domain: string,
  tier = 2,
  model?: ModelConfig | string
): WorkerDefinition {
  // Resolve string model names to ModelConfig presets
  const resolvedModel = typeof model === 'string'
    ? MODEL_PRESETS[model] ?? MODEL_PRESETS['sonnet']
    : model;

  return {
    name,
    role,
    // We do not know the project name at template-definition time; the
    // placeholder "{{PROJECT}}" is replaced at applyTemplate() time.
    claudeMd: generateWorkerMd('{{PROJECT}}', name, role, domain),
    tier,
    model: resolvedModel,
  };
}

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

/**
 * Return all 6 built-in templates keyed by their short name.
 */
export function getBuiltinTemplates(): Record<string, ProjectTemplate> {
  return {
    // -----------------------------------------------------------------------
    // dev — Software Development
    // -----------------------------------------------------------------------
    dev: {
      name: 'dev',
      description: 'Software Development',
      defaultModel: MODEL_PRESETS['sonnet'],
      workers: [
        makeWorker(
          'orchestrator',
          'Project Lead — plans and coordinates development',
          'dev',
          1,
          'sonnet'  // Default to Sonnet; use Opus only when explicitly requested
        ),
        makeWorker(
          'backend',
          'Backend engineer — APIs, database, business logic',
          'dev',
          2,
          'sonnet'
        ),
        makeWorker(
          'frontend',
          'Frontend engineer — UI components, pages, styling',
          'dev',
          2,
          'sonnet'
        ),
        makeWorker(
          'tests',
          'QA engineer — test suites, validation, coverage',
          'dev',
          2,
          'sonnet'
        ),
        makeWorker(
          'deploy',
          'DevOps — CI/CD, staging, production deployment',
          'dev',
          2,
          'haiku'  // deployment scripts are formulaic
        ),
      ],
      outputStructure: {
        'src/': 'Application source code',
        'src/api/': 'Backend API routes and handlers',
        'src/ui/': 'Frontend components and pages',
        'tests/': 'Test suites (unit, integration, e2e)',
        '.github/workflows/': 'CI/CD pipeline definitions',
        '.claude-coord/': 'Agent coordination layer',
      },
    },

    // -----------------------------------------------------------------------
    // research — Market Research
    // -----------------------------------------------------------------------
    research: {
      name: 'research',
      description: 'Market Research',
      defaultModel: MODEL_PRESETS['sonnet'],
      workers: [
        makeWorker(
          'orchestrator',
          'Research Director — coordinates analysis campaign',
          'research',
          1,
          'opus'  // strategic synthesis needs deep reasoning
        ),
        makeWorker(
          'competitors',
          'Competitive Analyst — profiles and feature matrices',
          'research',
          2,
          'sonnet'
        ),
        makeWorker(
          'complaints',
          'Complaint Miner — Reddit, G2, Trustpilot, app stores',
          'research',
          2,
          'haiku'  // high-volume scanning, pattern matching
        ),
        makeWorker(
          'pricing',
          'Pricing Analyst — tier comparison, value mapping',
          'research',
          2,
          'sonnet'
        ),
        makeWorker(
          'influencers',
          'Influencer Scout — key voices, outreach targets',
          'research',
          2,
          'haiku'  // scanning and listing, not deep analysis
        ),
        makeWorker(
          'synthesis',
          'Research Synthesizer — final report compilation',
          'research',
          2,
          'opus'  // final synthesis requires highest quality
        ),
      ],
      outputStructure: {
        'research/competitors/': 'Competitor profiles and feature matrices',
        'research/complaints/': 'Complaint mining output by source',
        'research/pricing/': 'Pricing tier comparisons and value maps',
        'research/influencers/': 'Influencer profiles and outreach lists',
        'research/reports/': 'Final synthesized research report',
        '.claude-coord/': 'Agent coordination layer',
      },
    },

    // -----------------------------------------------------------------------
    // book — Long-Form Writing
    // -----------------------------------------------------------------------
    book: {
      name: 'book',
      description: 'Long-Form Writing',
      defaultModel: MODEL_PRESETS['sonnet'],
      workers: [
        makeWorker(
          'orchestrator',
          'Editor-in-Chief — chapter planning and consistency',
          'book',
          1,
          'opus'  // narrative coherence needs deep reasoning
        ),
        makeWorker(
          'outline',
          'Outline Writer — structure, themes, chapter flow',
          'book',
          2,
          'opus'  // structural design is high-stakes
        ),
        makeWorker(
          'writer-1',
          'Chapter Writer — drafts assigned chapters',
          'book',
          2,
          'sonnet'
        ),
        makeWorker(
          'writer-2',
          'Chapter Writer — drafts assigned chapters',
          'book',
          2,
          'sonnet'
        ),
        makeWorker(
          'writer-3',
          'Chapter Writer — drafts assigned chapters',
          'book',
          2,
          'sonnet'
        ),
        makeWorker(
          'editor',
          'Copy Editor — consistency, tone, accuracy review',
          'book',
          2,
          'opus'  // editorial judgment needs highest quality
        ),
        makeWorker(
          'citations',
          'Fact Checker — claim verification, bibliography',
          'book',
          2,
          'haiku'  // lookup and verification tasks
        ),
        makeWorker(
          'format',
          'Formatter — final manuscript compilation',
          'book',
          2,
          'haiku'  // mechanical formatting
        ),
      ],
      outputStructure: {
        'manuscript/outline/': 'Chapter outline and structure documents',
        'manuscript/chapters/': 'Raw chapter drafts (one file per chapter)',
        'manuscript/edited/': 'Editor-reviewed chapter drafts',
        'manuscript/citations/': 'Fact-check reports and bibliography',
        'manuscript/final/': 'Final compiled manuscript',
        '.claude-coord/': 'Agent coordination layer',
      },
    },

    // -----------------------------------------------------------------------
    // campaign — Marketing Campaign
    // -----------------------------------------------------------------------
    campaign: {
      name: 'campaign',
      description: 'Marketing Campaign',
      defaultModel: MODEL_PRESETS['sonnet'],
      workers: [
        makeWorker(
          'orchestrator',
          'Campaign Director — channel coordination',
          'campaign',
          1,
          'opus'
        ),
        makeWorker(
          'copy',
          'Copywriter — landing pages, emails, ad variants',
          'campaign',
          2,
          'sonnet'  // creative writing needs sonnet-level
        ),
        makeWorker(
          'social',
          'Social Media Manager — platform-specific content',
          'campaign',
          2,
          'haiku'  // short-form content generation
        ),
        makeWorker(
          'paid-search',
          'PPC Specialist — keyword research, ad groups',
          'campaign',
          2,
          'sonnet'
        ),
        makeWorker(
          'creative',
          'Creative Director — visual asset briefs, image prompts',
          'campaign',
          2,
          'sonnet'
        ),
        makeWorker(
          'analytics',
          'Analytics Engineer — tracking, attribution, dashboards',
          'campaign',
          2,
          'haiku'  // structured config generation
        ),
      ],
      outputStructure: {
        'campaign/copy/': 'Landing pages, email sequences, ad copy variants',
        'campaign/social/': 'Platform-specific social content calendars',
        'campaign/paid-search/': 'Keyword lists, ad group structures',
        'campaign/creative/': 'Visual asset briefs and image generation prompts',
        'campaign/analytics/': 'Tracking specs, attribution models, dashboard configs',
        '.claude-coord/': 'Agent coordination layer',
      },
    },

    // -----------------------------------------------------------------------
    // video — AI Video Production
    // -----------------------------------------------------------------------
    video: {
      name: 'video',
      description: 'AI Video Production',
      defaultModel: MODEL_PRESETS['sonnet'],
      workers: [
        makeWorker(
          'orchestrator',
          'Production Director — episode planning',
          'video',
          1,
          'opus'
        ),
        makeWorker(
          'scripts',
          'Scriptwriter — per-episode scripts',
          'video',
          2,
          'sonnet'  // creative writing
        ),
        makeWorker(
          'storyboard',
          'Storyboard Artist — shot lists, visual descriptions',
          'video',
          2,
          'sonnet'
        ),
        makeWorker(
          'prompts',
          'Prompt Engineer — generation prompts for Sora/Runway/Kling',
          'video',
          2,
          'gemini-pro'  // Google model for Veo/Imagen prompt optimization
        ),
        makeWorker(
          'audio',
          'Audio Director — voiceover scripts, music direction',
          'video',
          2,
          'haiku'  // structured script output
        ),
        makeWorker(
          'assembly',
          'Assembly Editor — asset manifests, edit instructions',
          'video',
          2,
          'haiku'  // mechanical assembly instructions
        ),
      ],
      outputStructure: {
        'production/scripts/': 'Per-episode scripts',
        'production/storyboards/': 'Shot lists and visual descriptions',
        'production/prompts/': 'AI video generation prompts by scene',
        'production/audio/': 'Voiceover scripts and music direction docs',
        'production/assembly/': 'Asset manifests and edit decision lists',
        '.claude-coord/': 'Agent coordination layer',
      },
    },

    // -----------------------------------------------------------------------
    // custom — User-Defined
    // -----------------------------------------------------------------------
    custom: {
      name: 'custom',
      description: 'User-Defined',
      defaultModel: MODEL_PRESETS['sonnet'],
      workers: [
        makeWorker(
          'orchestrator',
          'Project Lead — coordinates all workers',
          'custom',
          1,
          'opus'
        ),
      ],
      outputStructure: {
        'output/': 'Project deliverables',
        '.claude-coord/': 'Agent coordination layer',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve a single template by name (built-in or custom).
 * Returns null if not found.
 */
export function getTemplate(name: string): ProjectTemplate | null {
  const all = { ...getBuiltinTemplates(), ...loadCustomTemplates() };
  return all[name] ?? null;
}

/**
 * List all available templates (built-in + custom) as a summary array.
 */
export function listTemplates(): { name: string; description: string; workers: string[] }[] {
  const all = { ...getBuiltinTemplates(), ...loadCustomTemplates() };
  return Object.values(all).map((t) => ({
    name: t.name,
    description: t.description,
    workers: t.workers.map((w) => w.name),
  }));
}

/**
 * Create a custom template from user-supplied inputs and persist it to
 * ~/.claude-commander/templates/{name}.json.
 */
export function createCustomTemplate(
  name: string,
  description: string,
  workers: WorkerDefinition[]
): ProjectTemplate {
  const template: ProjectTemplate = {
    name,
    description,
    workers,
    outputStructure: {
      'output/': 'Project deliverables',
      '.claude-coord/': 'Agent coordination layer',
    },
  };

  if (!existsSync(TEMPLATES_DIR)) {
    mkdirSync(TEMPLATES_DIR, { recursive: true, mode: 0o700 });
  }

  const filePath = join(TEMPLATES_DIR, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(template, null, 2), { mode: 0o600 });

  return template;
}

/**
 * Load all user-created custom templates from disk.
 * Returns an empty object if the templates directory doesn't exist.
 */
export function loadCustomTemplates(): Record<string, ProjectTemplate> {
  if (!existsSync(TEMPLATES_DIR)) {
    return {};
  }

  const result: Record<string, ProjectTemplate> = {};

  try {
    const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      try {
        const raw = readFileSync(join(TEMPLATES_DIR, file), 'utf8');
        const parsed = JSON.parse(raw) as ProjectTemplate;
        if (parsed.name) {
          result[parsed.name] = parsed;
        }
      } catch {
        // Skip malformed template files silently
      }
    }
  } catch {
    // Skip if directory is unreadable
  }

  return result;
}

/**
 * Apply a template to a project path.
 *
 * Steps:
 * 1. Validate that the tmux session does not already exist
 * 2. Initialize the .claude-coord/ coordination structure
 * 3. Write each worker's CLAUDE.md into the project directory
 * 4. Write the orchestrator's CLAUDE.md
 * 5. Create the tmux session with all workers
 */
export function applyTemplate(
  template: ProjectTemplate,
  projectPath: string,
  projectName: string
): void {
  if (sessionExists(projectName)) {
    throw new Error(`tmux session "${projectName}" already exists`);
  }

  const workerNames = template.workers.map((w) => w.name);

  // Initialise .claude-coord/ with all worker directories + STATUS.json stubs
  initCoordination(projectPath, workerNames);

  // Write CLAUDE.md for each worker, substituting {{PROJECT}} with the real name
  for (const worker of template.workers) {
    const coordDir = join(projectPath, '.claude-coord', worker.name);

    if (!existsSync(coordDir)) {
      mkdirSync(coordDir, { recursive: true });
    }

    const workerClaudeMd = worker.claudeMd.replace(/\{\{PROJECT\}\}/g, projectName);

    // Determine if this is the orchestrator
    const isOrchestrator = worker.name === 'orchestrator' || worker.tier === 1;

    let claudeMdContent: string;

    if (isOrchestrator) {
      // Replace the generic worker CLAUDE.md with a project-orchestrator one
      const otherWorkers = workerNames.filter((n) => n !== worker.name);
      claudeMdContent = generateProjectOrchestratorMd(projectName, otherWorkers);
    } else {
      claudeMdContent = workerClaudeMd;
    }

    writeFileSync(join(coordDir, 'CLAUDE.md'), claudeMdContent, 'utf8');
  }

  // Write model configuration for each worker into coord dir
  for (const worker of template.workers) {
    const coordDir = join(projectPath, '.claude-coord', worker.name);
    const modelConfig = worker.model ?? template.defaultModel ?? MODEL_PRESETS['sonnet'];
    writeFileSync(
      join(coordDir, 'MODEL.json'),
      JSON.stringify(modelConfig, null, 2),
      { mode: 0o600 }
    );
  }

  // Write a root CLAUDE.md in the project pointing workers to their coord dir
  const modelSummary = template.workers.map((w) => {
    const m = w.model ?? template.defaultModel ?? MODEL_PRESETS['sonnet'];
    return `- **${w.name}**: ${w.role} [\`${m.provider}/${m.model}\`]`;
  });

  const rootClaudeMd = [
    `# ${projectName}`,
    '',
    'This project is managed by Claude Commander.',
    '',
    '## Agents & Model Assignments',
    ...modelSummary,
    '',
    '## Coordination',
    'Each agent reads its task from `.claude-coord/<name>/TASK.md`',
    'and writes status to `.claude-coord/<name>/STATUS.json`.',
    'Model configuration is at `.claude-coord/<name>/MODEL.json`.',
    '',
    'Project synthesis is at `.claude-coord/SYNTHESIS.md`.',
  ].join('\n');

  writeFileSync(join(projectPath, 'CLAUDE.md'), rootClaudeMd, 'utf8');

  // Create the tmux session with all workers
  createSession(projectName, projectPath, workerNames);
}
