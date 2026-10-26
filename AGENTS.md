# AGENTS.md

Entry point for any coding agent (Cursor, Claude Code, Codex, Grok, …) working in this repo. Read this first, then follow the links.

## Where the truth lives

| Need | Read |
|---|---|
| Product vocabulary, modules, seams | `CONTEXT.md` |
| Design language (wantap tokens, components, layout), UI copy, accessibility | `DESIGN_SYSTEM.md` |
| Current overhaul (what and why) | `docs/superpowers/specs/2026-10-25-eypi-overhaul-design.md` |
| Current overhaul (task-by-task) | `docs/superpowers/plans/2026-10-25-eypi-overhaul.md` |
| Audit findings (`F-*` IDs) | `docs/superpowers/specs/2026-10-25-eypi-audit-findings.md` |
| Live database schema | `docs/db/schema-baseline.md` (versioned migrations land in `backend/migrations/` with the overhaul) |
| Deploys | `docs/RELEASE.md` |

## Stack and commands

Vue 3 SPA (`src/`) · Hono API on Cloudflare Workers (`backend/`) · frontend edge Worker (`worker/`) · shared contracts (`shared/`) · Turso/libSQL.

```bash
npm run setup       # install both packages, seed backend/.dev.vars
npm run doctor      # check required env keys
npm run dev:local   # API :8787 + Vite :5173
npm test            # Vitest
npm run typecheck   # vue-tsc + backend tsc
npm run build
```

## Safety rules

- Local development uses the **production** Turso database. Prefer a read-only token unless the task needs writes.
- Never run destructive SQL (`DROP`, `DELETE`/`UPDATE` without `WHERE`, column drops) or production migrations without the owner's explicit approval.
- Never `DROP TABLE users` or rebuild it: foreign keys are on and `links` cascades, so every link and its analytics would be deleted.
- Never commit or log secrets (`backend/.dev.vars`, `.env*`, tokens, keys). Never log emails or IPs.
- Never deploy, set Worker secrets, or change Entra, R2, or Resend settings yourself. Ask the owner.

## Commits

Conventional Commits in the owner's style: `type(scope): lowercase imperative subject` (no period, ≤ ~72 chars), blank line, then `- bullet` lines that start with a lowercase verb. One commit per finished task or milestone; each commit green.

**Never add `Co-Authored-By`, `Signed-off-by`, "Generated with …", or any AI/tool trailer.**

## Definition of done

1. The task's tests were written first, failed, and now pass.
2. `npm run typecheck` and `npm test` pass (plus `npm run lint` once it exists).
3. The change matches the spec and `DESIGN_SYSTEM.md`.
4. The plan checkboxes for the task are ticked and committed with the work.
