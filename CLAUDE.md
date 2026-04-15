# antigravity

This project is managed by Claude Commander.

## Agents & Model Assignments
- **orchestrator**: Project Lead — plans and coordinates development [`anthropic/claude-opus-4-6`]
- **backend**: Backend engineer — APIs, database, business logic [`anthropic/claude-sonnet-4-6`]
- **frontend**: Frontend engineer — UI components, pages, styling [`anthropic/claude-sonnet-4-6`]
- **tests**: QA engineer — test suites, validation, coverage [`anthropic/claude-sonnet-4-6`]
- **deploy**: DevOps — CI/CD, staging, production deployment [`anthropic/claude-haiku-4-5-20251001`]

## Coordination
Each agent reads its task from `.claude-coord/<name>/TASK.md`
and writes status to `.claude-coord/<name>/STATUS.json`.
Model configuration is at `.claude-coord/<name>/MODEL.json`.

Project synthesis is at `.claude-coord/SYNTHESIS.md`.