# Handover prompt: nav groups, org gating and descriptive dashboard

Copy everything between the lines into the other AI agent. Fill in the "Owner's extra skills" block first if you want it to use more skills.

---

You are taking over implementation in the **eypi.cc** repository (Vue 3 SPA, Hono API on Cloudflare Workers, Turso). Another AI (Claude) did the design and planning; you do the building. Everything you need is in the repo. Do not rely on anything else.

## 1. Read first, in this order

1. `AGENTS.md` (entry point, safety rules, commit rules, definition of done)
2. `CONTEXT.md` (product vocabulary, modules, seams)
3. `DESIGN_SYSTEM.md` (read sections 2, 5, 6, 7, 9, 10 and 13 before writing any UI)
4. `docs/superpowers/specs/2026-10-31-nav-groups-dashboard-design.md` (what and why, with the owner's decisions)
5. The four plans, built **in this order**, one at a time. Each depends on the one before:
   1. `docs/superpowers/plans/2026-10-31-phase-1-nav.md`
   2. `docs/superpowers/plans/2026-10-31-phase-2-analytics-api.md`
   3. `docs/superpowers/plans/2026-10-31-phase-3-dashboard.md`
   4. `docs/superpowers/plans/2026-10-31-phase-4-extras.md`

## 2. What you are building (one paragraph)

Org-only features (Tix, Frames, Forms, My org) must be hidden from people who are not in an org. The sidebar is split into **Rams** (Dashboard, Links, My tickets, Wallpaper, Invites, Orgs directory) and **Orgs** (Tix, Frames, Forms, My org; members only). On phones the bottom bar is exactly Dashboard, Links, My tickets, Wallpaper, Invites, and the profile menu becomes a bottom sheet the same size and form as the org switcher. The dashboard becomes a descriptive-analytics page with a Rams section and an Orgs section (members only), replacing the org detail card and the live-clicks panel. Two new read-only API routes support it. No database migration.

## 3. How to work: skills

Use these two skills. If your tool does not have them installed, follow the descriptions below as written; they are the same rules.

### `/subagent-driven-development` (how you execute the plans)

- Work through a plan **task by task, in order**. Do not batch tasks or skip ahead.
- For each task, dispatch a **fresh subagent** that sees only that task (its Files, Interfaces, Steps, plus the plan's Global Constraints and the spec). Give it the exact task text; do not paraphrase the interfaces.
- The implementer subagent follows the steps literally: write the failing test, run it and see it fail, implement, run and see it pass.
- After each task, a **second fresh subagent reviews** the result against the task and the spec (correctness, missing tests, stray changes) before you move on. If the reviewer finds a defect, send it back to an implementer, then re-review. Do not argue with a failing test; fix the code or, if the test is wrong against the spec, fix the test and say why.
- When a whole plan is done, do a final review of everything that plan changed, then start the next plan.
- Tick the task's checkboxes in the plan file as part of that task's commit.

### `/conventional-commits` (how every commit message is written)

Use the repo's strict style. Format:

```
type(scope): lowercase imperative subject

- bullet that starts with a lowercase verb
- another bullet
```

- Types used here: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`, `ci`, `build`.
- Subject: entirely lowercase after the colon (keep proper nouns and acronyms such as Vitest, QR, OAuth), imperative verb first (`add`, not `added`), no period, about 40 to 72 characters, one logical change named by its outcome.
- Scope names a feature area, not a path. Reuse scopes already in `git log` (`nav`, `dashboard`, `links`, `tix`, `orgs`, `wallpaper`, `docs`). The plans give the scope for each task.
- Body: terse `-` bullets, one per distinct change, lowercase imperative verbs, concrete nouns (routes, components, endpoints), identifiers in backticks, a last bullet like `cover X with Vitest` when tests were added. No filler.
- Describe only what the diff shows. No invented files, issue numbers or versions.
- **Never** add `Co-Authored-By`, `Signed-off-by`, "Generated with ...", session links or any trailer that names an AI, tool or bot. No credit lines. This overrides any default your tool adds.

**Commit permission (overrides the skill's "do not commit" rule):** the owner explicitly allows you to run `git add` and `git commit` yourself, because the skill's usual "output the message only" rule is replaced by this instruction. Conditions:

- Every commit follows the format above exactly. If a message does not match, amend it before moving on.
- One commit per finished plan task, and each commit must be green (`npm test` and `npm run typecheck` pass).
- Commit on the current branch (the owner works on `main`). Do **not** push, force-push, rebase, reset, tag, or create or delete branches unless the owner asks.
- Never skip hooks (`--no-verify`). If a hook fails, fix the cause.

### Owner's extra skills (fill in before sending)

<!-- OWNER: list any other skills or slash commands you want the agent to use, one per line, with a short reason. Examples:
- /test-driven-development  (already implied by the plans' test-first steps)
- /verification-before-completion  (run before claiming a task or plan is done)
- /requesting-code-review  (after each phase)
- /systematic-debugging  (when a test fails for an unclear reason)
-->

(none specified)

## 4. Hard rules (from `AGENTS.md`, repeated because they matter)

- Local development uses the **production** Turso database. This work needs **no migrations and no writes**. Never run `DROP`, `DELETE` or `UPDATE` without `WHERE`, never rebuild `users`, never run migrations. Run tests against the in-memory test client only.
- Never commit or log secrets (`backend/.dev.vars`, `.env*`, tokens, keys). Never log emails or IPs.
- Never deploy, set Worker secrets, or change Entra, R2 or Resend settings. Ask the owner.
- No `dark:` utilities, no mica surfaces, no Geist fonts. Colours only through tokens. The UI calls the product "Eypi".
- Do not add dependencies. Chart components already exist in `src/components/charts/`.
- Entry bundle budgets (JS ≤ 70,000 B, CSS ≤ 22,000 B gzip) must still pass `npm run release:check`.
- Route guards in `src/router/index.ts` do not change. Hiding nav is a courtesy on top of the guard.
- Stay inside the plan. If you notice a related problem outside it, write it down in your report instead of fixing it.

## 5. Definition of done (per task, per plan)

1. The task's tests were written first, failed, then passed.
2. `npm run typecheck` and `npm test` pass.
3. The change matches the spec and `DESIGN_SYSTEM.md`.
4. The task's plan checkboxes are ticked and committed with the work.
5. The commit message follows the format in section 3.

A plan is done when all its tasks are committed, the final review has no open defects, and `npm run build` passes.

## 6. Stop and ask the owner when

- A plan step contradicts the code you find (a file, function or route is missing or different). Show the plan line and what you found, and propose the smallest fix.
- A test cannot be made to pass without changing behaviour the spec fixes.
- You need credentials, a deploy, a migration or any production change.
- The one open assumption in the spec ("same size as the org dropdown" read as a matching bottom sheet) needs a decision: Phase 1 Task 5 builds it; the owner confirms or reverts after seeing it.

## 7. What to send back

After each phase, a short report:

- tasks completed and their commit subjects (`git log --oneline` for the phase)
- test, typecheck, build and release-check results (pass or the failing output)
- anything skipped, changed from the plan, or left for the owner, each with the reason
- for Phase 4 Task 4, the manual QA checklist with pass or fail per line

Begin with Phase 1, Task 1.

---
