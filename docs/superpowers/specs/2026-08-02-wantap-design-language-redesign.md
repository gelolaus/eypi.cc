# eypi.cc Wantap Design Language Redesign

Date: 2026-08-02  
Status: Draft for user review  
Branch: `redesign`  
Reference product: [wantap.cc](https://www.wantap.cc/) (Next.js) and local `C:\Users\gelo\Desktop\dev\wantap.cc`  
Target product: `eypi.cc` (Vue + Vite + existing Hono/Turso backend)

## 1. Goal

Rebuild eypi.cc's UI so it matches Wantap's design language (shell, density, type, radius, mobile-first chrome) while keeping:

- APC **Blue** `#34418F` and **Gold** `#DEAC4B` as the brand colors
- All existing eypi features, routes, and backend contracts
- Vue frontend (no framework rewrite)

Success: a side-by-side with Wantap reads as the same UI system; only product content and blue/gold differ.

## 2. Non-goals

- Porting Wantap product features (digital cards, leads, webhooks, multi-profile builder)
- Rewriting Vue to Next, or changing Nest/Wantap backend patterns into eypi
- New auth providers, billing, or API/schema work required only for the look
- Keeping gelolaus signatures: custom cursor, 120px fixed dot grid, mica/pill-glass, floating pill nav
- A half-finished light mode

## 3. Locked decisions

| Topic | Decision |
|---|---|
| Themes | **Dual themes, equally first-class** (light + dark) |
| Interactive primary | **Gold** = CTAs, active nav, charts, focus (Wantap coral role) |
| Brand secondary | **Blue** = logo, selected headings, structural accents |
| Light atmosphere | **Warm paper** off-white surfaces |
| Dark atmosphere | **Deep navy-ink** (Wantap ink structure, blue-shifted; not warm brown) |
| Gelolaus chrome | **Dropped** (cursor, 120px grid, mica, floating pill nav) |
| App nav | **Role-aware**: always Home + Links; org tools expand with membership |
| Mobile org overflow | Bottom bar max 4–5 slots; **Org tools** sheet/menu for Forms/Frames/Tix/Orgs |
| Marketing `/` | Wantap-exact structure (hero + mock + proof + final CTA); remove stats/carousel/why dump |
| Public surfaces | **Full visual pass** (Frames, Tix, Orgs public, legal/contact) |
| Ship order | Foundation tokens/kit → shell → marketing/auth → modules → public → cleanup/docs |
| Implementation | **Primitive kit first**, migrate views onto shared Vue components |

## 4. Approaches considered

| Approach | Pros | Cons |
|---|---|---|
| A. Retokenize + restyle views in place | Fast | Drift; one-off classes; hard to keep Wantap parity |
| **B. Vue primitive kit, then migrate screens** (chosen) | Consistent like Wantap; keeps feature code | Upfront kit work |
| C. Parallel new-UI folder, cut over per route | Cleanest isolation | Slow; high rewrite risk for UI-only goal |

**Decision: B.**

## 5. Visual system

### 5.1 Typography

| Role | Font | Use |
|---|---|---|
| Display / headings | Syne | Page titles, marketing brand, H1–H3 |
| UI / body | Plus Jakarta Sans | Nav, buttons, forms, body, labels |
| Data | Monospace or tabular numerals | Slugs, codes, timestamps, table numbers |

Load via existing frontend font strategy (self-host or Google Fonts). Map Tailwind `font-sans` → Plus Jakarta Sans; `font-display` / heading utilities → Syne. Remove Geist as the default UI stack.

### 5.2 Color roles

| Role | Token intent | Value |
|---|---|---|
| Primary interactive | `--color-primary` (filled buttons, active nav tint, charts, ring) | APC Gold `#DEAC4B` |
| Primary on-primary | Text/icons on gold fills | Dark ink (readable on gold) |
| Brand secondary | `--color-brand` (Blue; do not reuse `--color-primary`) | APC Blue `#34418F` |
| Destructive | Danger actions | Cool red (Wantap-like) |

Gold hover variants may keep current eypi gold hover hexes (`#d4b55a`, `#c9a84c`) if contrast holds in both themes.

**Mapping note:** Today's eypi tokens use `--color-primary` for Blue and `--color-accent` for Gold. The redesign **inverts the interactive role**: Gold becomes the Wantap-style primary action token. Blue remains a named brand token. Update `DESIGN_SYSTEM.md` and Tailwind maps in Phase 0 so components do not keep the old meaning by accident.

### 5.3 Surfaces

**Dark**

- Background: deep warm navy-ink (Wantap `.dark` structure with hue shifted toward blue/navy, not brown coral ink)
- Cards: slightly lighter, optional translucent `glass-panel` via tokens
- Borders: soft light strokes ~10% white
- Text: off-white primary; muted secondary

**Light (warm paper)**

- Background: warm off-white
- Cards: soft warm white
- Borders: soft warm gray
- Text: near-black primary; muted brown-gray secondary

### 5.4 Shape and density

Copied from Wantap's friendly UI scale:

- Base radius ~`0.875rem`; larger radii for section cards; pills for primary CTAs
- Default Button/Input height ~`h-11` / `text-base`; large CTA ~`h-12`
- Section cards padded `p-7`–`p-8`; content pane near full width (`max-w-6xl` or fluid), not narrow `max-w-2xl`
- Bottom tabs: icon above label; clear gold active state; `env(safe-area-inset-bottom)`

### 5.5 Motion

2–3 intentional moves per marketing composition (CTA hover, mock accent crossfade, optional block toggle). No custom cursor theater. Prefer short ease transitions on shell chrome.

## 6. Primitive kit (Phase 0)

Build Vue components that encode Wantap parity before restyling screens:

- `Button` (primary / secondary / ghost / destructive / sizes)
- `Input`, `Textarea`, `Select`
- `Card` / glass panel utility
- `Dialog`
- `Switch`
- `Badge`
- `Tabs`
- `Avatar`
- `EmptyState`
- Theme toggle control

Then `AppShell` (Phase 1) consumes the kit.

Location: prefer `src/components/ui/` (new) so suite views import one kit. Do not invent a second parallel style path.

## 7. App shell and navigation

### 7.1 Breakpoints

| Viewport | Chrome |
|---|---|
| `< lg` | Slim top bar (logo, theme toggle, account) + fixed bottom tab bar |
| `lg+` | Left sidebar ~14–15rem; icon-only rail (~56px) on dense editors (Frames canvas, heavy Tix selection) |

### 7.2 Destinations

**Always**

- Home → `/dashboard`
- Links → `/links`

**When org membership is activated**

- Desktop sidebar: group **ORG** with Orgs, Forms, Frames, Tix
- Mobile bottom bar: do not exceed 4–5 slots; expose Forms/Frames/Tix/Orgs via an **Org tools** overflow sheet/menu

**Account**

- Avatar menu: Settings, theme, sign out
- Org switcher near account (sidebar footer / mobile top), same `active_org_id` behavior as today

### 7.3 Home

Wantap-style greeting + bento module cards. Links always available; org tools gated by membership.

### 7.4 Outside the shell

Marketing `/`, auth, public Frames/Tix/Orgs, legal pages: no bottom tabs.

## 8. Marketing, auth, public

### 8.1 Marketing `/`

Structure (Wantap product-stage):

1. Nav: logo + Log in + Get started (gold)
2. Hero: dominant eypi brand, one headline, one support line, CTA group, live **eypi** product mock (short-link / phone preview). Optional mini-controls only if the first viewport stays one composition
3. One proof section (QR / share / analytics beat)
4. Final CTA band + footer

Remove: StatsStrip, FeaturesCarousel, WhyEypi multi-section dump.

### 8.2 Auth

Quiet bordered panel; warm gold wash at low opacity (no blue glow orb); Syne title; large controls. Keep APC email auth flows (login, verify, reset).

### 8.3 Public and legal

Full visual pass: public Frames, Tix ticket/selection/lookup, org catalog/profile, Privacy/Terms/Contact, not-found. Same tokens, type, radius, buttons. Layouts may stay functionally the same where flows are specialized (canvas, QR); chrome and controls must match the system.

Theme: respect stored/system preference where those routes can; otherwise inherit site dual-theme CSS.

## 9. Module pages

All suite screens use the same grammar:

- Syne page title + optional one-line support (only if it adds information)
- Rounded section cards; multi-column on desktop where useful; stack on mobile
- Gold primary actions; outline secondary; red destructive
- Empty states state the next action (existing eypi UI copy rules)
- Charts use gold bars

No route or API contract changes for the redesign itself.

## 10. Migration phases

| Phase | Deliverable |
|---|---|
| 0 | Tokens (both themes), fonts, primitive kit, theme toggle |
| 1 | `AppShell` + role-aware nav on existing routes |
| 2 | Marketing `/` + auth |
| 3 | Home, Links, Settings |
| 4 | Forms, Frames admin, Tix admin, Orgs |
| 5 | Public Frames/Tix/Orgs + legal/contact |
| 6 | Delete dead gelolaus CSS/components; rewrite `DESIGN_SYSTEM.md` |

Do not start the next phase until the current phase is intentional in **both** themes.

## 11. Docs and ownership

| Source | Owns |
|---|---|
| APC | Blue `#34418F`, Gold `#DEAC4B` (and listed hover variants) |
| Wantap design language (ported) | Shell pattern, density, radius, Syne + Plus Jakarta roles, dark-ink structure adapted to navy, warm-paper light |
| eypi.cc | Product modules, copy rules in `DESIGN_SYSTEM.md` § UI writing, backend |

Phase 6 replaces gelolaus-era visual rules in `DESIGN_SYSTEM.md` with this system. `CONTEXT.md` module map stays; only UI references update.

## 12. Acceptance criteria

- [ ] Wantap shell parity: desktop sidebar, mobile/tablet bottom tabs, safe areas, friendly control scale
- [ ] Gold owns interactive primary; Blue owns brand secondary; both themes polished
- [ ] Marketing matches Wantap structure with eypi content/mock
- [ ] Auth quiet premium panel; no gelolaus cursor/mica/pill nav/120px grid
- [ ] Suite modules and public surfaces use the kit; features still work without backend changes
- [ ] Role-aware nav: personal users stay lean; org tools appear when activated
- [ ] `DESIGN_SYSTEM.md` matches shipped tokens and components

## 13. Open implementation details (for the plan, not blockers)

These do not change the design intent; resolve during planning/implementation:

1. Exact oklch/hex values for navy-ink and warm-paper surfaces (derive from Wantap `.dark` structure + APC blue shift; verify contrast for Gold-on-fill and text)
2. Whether Org tools mobile overflow is a bottom-sheet or a top-bar menu
3. Exact Home bento card set and copy
4. Hero mock content (which Links preview state to seed)

## 14. Next step

After user approval of this spec: invoke **writing-plans** to produce a phased implementation plan under `docs/superpowers/plans/`. No UI implementation until that plan exists and is accepted.
