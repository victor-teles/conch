# Plan 024: Conch is neutral gray with a vermilion mark

> **Executor instructions**: Deliver the stated outcome within scope. Adapt routine
> implementation details to current code, preserve the listed contracts, and run
> the relevant acceptance checks. Fix task-caused failures and recheck affected
> behavior. Escalate only the material conditions below. Update the plan's status
> in `.factory/plans/README.md` unless the coordinator owns that index.
>
> **Drift check**: Compare
> `git diff --stat aaa8938 -- apps/app/src/mainview/index.css apps/app/src/mainview/components apps/app/scripts apps/app/assets .github CLAUDE.md PRODUCT.md DESIGN.md`
> and `git status --short` with the recorded current state. Reconcile routine drift;
> pause dependent work if drift invalidates scope, a protected contract, or an
> unresolved product or permission decision.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `aaa8938`, 2026-11-22, clean working tree

## Why this matters

The owner finds the warm brown surfaces and amber accent dated. Conch should
look like a native macOS tool: neutral gray surfaces close to the system's own
(the reference is Raycast's launcher), with one brand color, a vermilion red,
kept for the logo and for the moment something is in flight. This plan swaps
the token values, adds a `--brand` token, redraws the icon and logo lockups in
the new colors, and rewrites the brand docs that still say "warm amber". Plan
025 then builds themes on top, and brings the old look back as a selectable
"Amber" theme.

## Owner decisions (2026-11-22)

These are settled. Do not reopen them.

1. **Red's role is "Quiet".** The UI is neutral gray. `--primary` becomes a
   near-white (dark) or near-black (light) neutral. Red appears only on the
   logo, the input caret and progress indicators. It is not the selection, the
   focus ring, a button fill or a chart color.
2. **The red is vermilion**, `oklch(0.66 0.22 29)` (`#fc4738`) on dark and
   `oklch(0.58 0.23 29)` (`#e31510`) on light.
3. **The app icon is a vermilion shell on a near-black tile** (`#121212`),
   same shell geometry as today.
4. The old warm palette returns as a theme in plan 025, not here. Between the
   two plans it exists only in git history (`aaa8938`).

This supersedes two earlier notes in `.factory/plans/README.md`: "What stays
Conch: the amber selection" and the rejected finding "The amber `--row-active`
is the brand".

## Current state

- `apps/app/src/mainview/index.css` (458 lines) holds every color. Lines 7–78
  are `:root, .light`, lines 80–141 are `.dark`, lines 143–158 are the
  `prefers-contrast: more` overrides, lines 160–226 are the Tailwind
  `@theme inline` mapping, and the rest are utilities (`launcher-material`,
  `capsule-material`, `popover-material`, `ask-shimmer`, `scroll-fade`).
  Values are `oklch`, all tinted warm (hue 34–75), for example:

  ```css
  /* .dark, index.css:81-127 */
  --background: oklch(18.2% 0.00699 34.3deg);
  --primary: oklch(0.9247 0.0524 66.1732);
  --panel: oklch(0.185 0.008 45 / 0.88);
  --row-active: oklch(0.82 0.08 66 / 0.2);
  ```

- Colors are well tokenized. Only three literals live outside the CSS file:
  - `apps/app/src/mainview/components/ui/dialog.tsx:29` — scrim
    `bg-[oklch(0.18_0.007_34/0.6)]` (warm).
  - `apps/app/src/mainview/components/board/board-grid.tsx:24` —
    `LIFT_SHADOW = "0 24px 48px -12px oklch(0 0 0 / 0.55)"`.
  - `apps/app/src/mainview/components/connection-form/color-swatch.tsx:53` —
    check mark `text-[oklch(0.18_0.005_40)]`.
- `--sidebar*` (8 tokens) are leftovers from the old workspace app. Their only
  consumer is `components/ui/tooltip.tsx:50-51`
  (`border-sidebar-border bg-sidebar text-sidebar-foreground`).
- There is no `@custom-variant dark` in `index.css` or in
  `shadcn/tailwind.css`, so every Tailwind `dark:` utility (used in
  `components/ui/{button,checkbox,input,select,textarea,input-group,command,chart}.tsx`)
  follows the OS `prefers-color-scheme`, not the `.dark` class that
  `next-themes` sets. Picking Light in Settings on a dark Mac mixes the two.
- Where `primary` is used today (it is amber in dark): focus rings
  (`ring-primary`, ~40 places), button and checkbox fills (`bg-primary`),
  chips (`bg-primary/14 text-primary` in `launcher/mode-badge.tsx:35` and
  `launcher/links/link-marker-chip.tsx:35`), one-shot pulses
  (`ask/assumptions-line.tsx:43`, `board/tile-cue.tsx:67`,
  `sources/draft/filled-field.tsx`), and the progress marks:
  - `components/motion/progress-hairline.tsx:20,24` — `bg-primary/40`, `bg-primary`.
  - `components/ask/sql-block.tsx:30` — the streaming rule, `bg-primary`; line
    79 carries the `ask-caret` blink class.
  - `components/launcher/launcher-input.tsx:42` — the main input; it sets no
    `caret-*` class.
- The mark is not shown anywhere in the app UI. It exists as
  `.github/brand/conch-mark.svg` (one filled path, `fill="currentColor"`,
  `viewBox="0 0 1000 1000"`) and as rasters:
  `apps/app/assets/icon.png` (512), `apps/app/assets/icon.iconset/*.png` (ten
  sizes), `apps/app/assets/icon.ico` (six frames), `.github/brand/icon-1024.png`,
  `.github/logo-dark.png` and `.github/logo-light.png` (1200×360 lockups, mark
  plus "Conch" in Optima Bold). `.github/brand/verification.json` lists every
  output with its pixel size. `.github/brand/DESIGN-NOTES.md` records the
  geometry: the tile is the centered 824-unit square on a 1024 canvas with
  continuous-curvature corners and a soft shadow; the shell is about 530 units
  wide and centered. Current colors are Warm Ink `#1a1614` and Amber `#f6dcc0`.
  The rasters were exported with Pillow; no script is in the repo.
- `apps/app/assets/tray-template.png` and `tray-active-template.png` are
  black-with-alpha macOS template images. They stay as they are.
- `apps/app/scripts/audit-contrast.ts` is stale: it reads
  `apps/app/src/index.css` (the file is at `src/mainview/index.css`) and
  audits `sidebar`, "dynamic island" and `json-*` pairs that no longer exist.
  Its output is `apps/app/docs/color-tokens.md`.
- Docs that describe the warm palette: `CLAUDE.md` (Brand Personality,
  Aesthetic Direction "Theme" line, Design Principle 1, the "Styling" bullet),
  `PRODUCT.md:23,30`, `DESIGN.md` (front-matter `colors:` block, lines 3–31,
  and the prose that names amber).
- Conventions that apply: Tailwind v4 tokens through `@theme inline`; color
  values in `oklch`; no code comments unless the why is non-obvious; tests
  colocated; React 19 (ref as a prop, never `forwardRef`).

## Commands you will need

| Purpose              | Command                                                              | Expected on success                                                                                             |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Install              | `bun install`                                                        | exit 0                                                                                                          |
| Typecheck            | `bun run check-types`                                                | exit 0                                                                                                          |
| Lint + format        | `bun run check` (`bun run fix` to auto-fix)                          | exit 0                                                                                                          |
| App tests            | `bun run --cwd apps/app test`                                        | all pass                                                                                                        |
| Update DOM snapshots | `bun run --cwd apps/app test:browser -- -u`                          | review the diff like code                                                                                       |
| E2E                  | `bun run --cwd apps/app e2e`                                         | all pass, except the known pre-existing `refine-flow.spec.ts` chip-label failure if it still fails on `aaa8938` |
| Contrast audit       | `bun run apps/app/scripts/audit-contrast.ts`                         | exit 0, rewrites `apps/app/docs/color-tokens.md`                                                                |
| Brand assets         | `bun run apps/app/scripts/build-brand-assets.ts` (created in Step 5) | exit 0, rewrites the rasters                                                                                    |
| Browser build        | `bun run dev:web` → http://localhost:3001                            | launcher renders                                                                                                |

## Implementation rules relevant to this plan

- Neutral means chroma 0. Do not leave a faint warm or cool tint in a gray.
- Every text pair must hold WCAG AA (4.5:1), UI marks and focus rings 3:1,
  including on the translucent panel. The values below were checked with the
  panel composited (in gamma-encoded sRGB, which is how CSS composites) over
  `#1a1a1c`, `#808080` and white for dark, and `#f0f0f1`, `#808080` and black
  for light. All pairs pass over the first two; over the opposite extreme the
  lowest results are 4.34 (dark `panel-muted` on a selected row, light
  `warning-ink` on the panel), which is accepted because
  `prefers-contrast: more` switches the panel to its solid fill.
- Red is not a status color here. Never use `brand` for errors or destructive
  actions; those keep `destructive` and `danger-ink`.
- Status hues (`destructive`, `warning`, `success`, the three `*-ink` tokens)
  and the six `--conn-*` connection colors keep their current values. They are
  already audited and users have picked connection colors by name.
- Charts lead with blue. A red first series reads as "bad" in data.
- Every animation keeps its reduced-motion path. This plan changes no motion.

## Scope

**In scope**

- `apps/app/src/mainview/index.css`
- `apps/app/src/mainview/components/ui/dialog.tsx`, `ui/tooltip.tsx`
- `apps/app/src/mainview/components/motion/progress-hairline.tsx`
- `apps/app/src/mainview/components/ask/sql-block.tsx`
- `apps/app/src/mainview/components/launcher/launcher-input.tsx`
- `apps/app/src/mainview/components/brand/conch-mark.tsx` (create, with test)
- `apps/app/src/mainview/components/launcher/views/settings/about-section.tsx`
- Comments that name "amber" in `ask/assumptions-line.tsx`,
  `actions/confirm-sheet/target-line.tsx`, `sources/draft/filled-field.tsx`
- Affected `__snapshots__/` files
- `apps/app/scripts/audit-contrast.ts`, `apps/app/docs/color-tokens.md`
- `apps/app/scripts/build-brand-assets.ts` (create)
- `apps/app/assets/icon.png`, `icon.ico`, `icon.iconset/*`
- `.github/brand/icon-1024.png`, `.github/brand/asset-review.png`,
  `.github/brand/verification.json`, `.github/brand/DESIGN-NOTES.md`,
  `.github/logo-dark.png`, `.github/logo-light.png`
- `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md` (color and brand passages only)
- `.factory/plans/README.md` (status)

**Out of scope**

- Theme switching, the Amber theme, a theme editor: plan 025.
- `apps/video/**`. `apps/video/src/theme.ts` copies the old palette for the
  Remotion videos and the real-footage cut needs new recordings. Recolor it in
  a follow-up after 025.
- `.github/banner.png`, `.github/banner.webp`: product screenshots that need a
  fresh capture, not a recolor.
- The tray template images.
- Token names consumed by components. Renaming `primary`, `panel`,
  `row-active` and friends would touch hundreds of call sites for no gain.
- The typeface, spacing, radius and motion systems.

## Git workflow

- Work on the current feature branch, or create `feat/024-neutral-palette`
  from it if the operator asks. Never commit to `main`.
- Commit only if the operator authorizes it. Message style in this repo is a
  plain sentence, for example `Recolor Conch to neutral gray with a vermilion mark (plan 024)`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Replace the palette in `index.css`

Rewrite the `:root, .light` and `.dark` color tokens with the values below.
Keep the non-color tokens in `:root` (`--radius`, `--font-*`,
`--tracking-normal`, `--launcher-footer-clearance`) untouched.

Structural changes, all in this file:

1. Add `@custom-variant dark (&:is(.dark *));` after the imports so `dark:`
   follows the class.
2. Delete the eight `--sidebar*` tokens and their eight `--color-sidebar*`
   lines in `@theme inline`.
3. Alias instead of repeating: `--card-foreground: var(--foreground);`,
   `--popover: var(--card);`, `--popover-foreground: var(--foreground);`.
   Declare them once in `:root` (they resolve per scheme).
4. Add tokens `--brand`, `--scrim` and `--shadow`, and map
   `--color-brand: var(--brand);` and `--color-scrim: var(--scrim);` in
   `@theme inline`.
5. Compose the panel shadow from the `--shadow` color, once, in `:root`:
   `--shadow-panel: 0 28px 64px -16px var(--shadow), 0 2px 8px color-mix(in oklab, var(--shadow) 50%, transparent);`
   and remove the two per-scheme `--shadow-panel` literals.
6. In `capsule-material`, replace `oklch(0 0 0 / 0.28)` with
   `color-mix(in oklab, var(--shadow) 45%, transparent)`. In `ask-shimmer`,
   replace `oklch(1 0 0 / 0.06)` with `var(--row-hover)` so the shimmer shows
   in light mode too.
7. In the `prefers-contrast: more` block, replace the two warm literal
   borders with one rule for both schemes:
   `--panel-border: color-mix(in oklab, var(--foreground) 60%, transparent);`.

Values (`oklch`, chroma 0 unless a hue is shown):

| Token                    | Dark                     | Light                     |
| ------------------------ | ------------------------ | ------------------------- |
| `--background`           | `oklch(0.2 0 0)`         | `oklch(0.975 0 0)`        |
| `--foreground`           | `oklch(0.96 0 0)`        | `oklch(0.21 0 0)`         |
| `--card`                 | `oklch(0.25 0 0)`        | `oklch(1 0 0)`            |
| `--primary`              | `oklch(0.95 0 0)`        | `oklch(0.22 0 0)`         |
| `--primary-foreground`   | `oklch(0.2 0 0)`         | `oklch(0.985 0 0)`        |
| `--secondary`            | `oklch(0.29 0 0)`        | `oklch(0.93 0 0)`         |
| `--secondary-foreground` | `oklch(0.96 0 0)`        | `oklch(0.25 0 0)`         |
| `--muted`                | `oklch(0.25 0 0)`        | `oklch(0.95 0 0)`         |
| `--muted-foreground`     | `oklch(0.74 0 0)`        | `oklch(0.47 0 0)`         |
| `--accent`               | `oklch(0.31 0 0)`        | `oklch(0.93 0 0)`         |
| `--accent-foreground`    | `oklch(0.96 0 0)`        | `oklch(0.21 0 0)`         |
| `--border`               | `oklch(1 0 0 / 0.14)`    | `oklch(0.86 0 0)`         |
| `--input`                | `oklch(0.4 0 0)`         | `oklch(0.88 0 0)`         |
| `--ring`                 | `oklch(0.9 0 0)`         | `oklch(0.35 0 0)`         |
| `--brand`                | `oklch(0.66 0.22 29)`    | `oklch(0.58 0.23 29)`     |
| `--scrim`                | `oklch(0 0 0 / 0.55)`    | `oklch(0.2 0 0 / 0.35)`   |
| `--shadow`               | `oklch(0 0 0 / 0.6)`     | `oklch(0.2 0 0 / 0.26)`   |
| `--chart-1`              | `oklch(0.72 0.13 245)`   | `oklch(0.55 0.15 250)`    |
| `--chart-2`              | `oklch(0.78 0.12 165)`   | `oklch(0.55 0.11 170)`    |
| `--chart-3`              | `oklch(0.82 0.13 85)`    | `oklch(0.6 0.13 80)`      |
| `--chart-4`              | `oklch(0.7 0.14 310)`    | `oklch(0.52 0.15 310)`    |
| `--chart-5`              | `oklch(0.74 0.14 55)`    | `oklch(0.6 0.15 50)`      |
| `--chart-6`              | `oklch(0.72 0.02 250)`   | `oklch(0.5 0.02 250)`     |
| `--panel`                | `oklch(0.2 0 0 / 0.9)`   | `oklch(0.985 0 0 / 0.9)`  |
| `--panel-solid`          | `oklch(0.21 0 0 / 0.97)` | `oklch(0.985 0 0 / 0.97)` |
| `--panel-raised`         | `oklch(0.29 0 0 / 0.88)` | `oklch(1 0 0 / 0.75)`     |
| `--panel-border`         | `oklch(1 0 0 / 0.1)`     | `oklch(0.2 0 0 / 0.12)`   |
| `--panel-highlight`      | `oklch(1 0 0 / 0.07)`    | `oklch(1 0 0 / 0.65)`     |
| `--panel-muted`          | `oklch(0.74 0 0)`        | `oklch(0.43 0 0)`         |
| `--row-hover`            | `oklch(1 0 0 / 0.06)`    | `oklch(0.2 0 0 / 0.05)`   |
| `--row-active`           | `oklch(1 0 0 / 0.1)`     | `oklch(0.2 0 0 / 0.09)`   |
| `--kbd`                  | `oklch(1 0 0 / 0.09)`    | `oklch(0.2 0 0 / 0.07)`   |
| `--control-thumb`        | `oklch(1 0 0 / 0.14)`    | `oklch(1 0 0)`            |

Unchanged (copy as they are today): `--destructive`,
`--destructive-foreground`, `--warning`, `--warning-foreground`, `--success`,
`--success-foreground`, `--danger-ink`, `--success-ink`, `--warning-ink`, and
the six `--conn-*` tokens, in both schemes.

**Evidence**: `grep -nE "oklch\([^)]* 0\.0[0-9]+ (3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-5])" apps/app/src/mainview/index.css`
matches only status and `--conn-*` lines; `grep -c sidebar apps/app/src/mainview/index.css` → 0.

### Step 2: Remove the literals and the sidebar consumer

- `ui/dialog.tsx:29`: `bg-[oklch(0.18_0.007_34/0.6)]` → `bg-scrim`.
- `ui/tooltip.tsx:50-51`: `border-sidebar-border bg-sidebar text-sidebar-foreground`
  → `border-border bg-popover text-popover-foreground`.
- Leave `board-grid.tsx` `LIFT_SHADOW` (a pure black drag shadow reads the
  same in both schemes) and the `color-swatch.tsx` check mark (it sits on a
  fixed connection color, not a theme surface).

**Evidence**: `grep -rn "sidebar" apps/app/src/mainview --include="*.tsx" --include="*.ts" --include="*.css"` → no matches.

### Step 3: Give red its three jobs

1. `motion/progress-hairline.tsx`: `bg-primary/40` → `bg-brand/40`,
   `bg-primary` → `bg-brand`.
2. `ask/sql-block.tsx:30`: the streaming rule `bg-primary` → `bg-brand`. If
   the element that carries `ask-caret` (line 79) takes its color from
   `primary`, switch that to `brand` as well.
3. `launcher/launcher-input.tsx:42`: add `caret-brand` to the input's classes.

Everything else that uses `primary` stays on `primary` and becomes neutral on
its own: focus rings, button and checkbox fills, the mode and link chips, the
one-shot pulses. Do not add `brand` anywhere else.

Reword the three comments that say a pulse or target is "amber"
(`ask/assumptions-line.tsx:19`, `actions/confirm-sheet/target-line.tsx:25`,
`sources/draft/filled-field.tsx:14`) so they do not name a color, and check
what `target-line.tsx` actually paints: if the target uses `warning-ink`,
leave it; if it uses `primary`, keep `primary`.

### Step 4: Show the mark once, in Settings → About

Create `components/brand/conch-mark.tsx`: an inline SVG with the path from
`.github/brand/conch-mark.svg`, `fill="currentColor"`, `aria-hidden`, and a
`className` prop. Render it in `settings/about-section.tsx` at 20 px with
`text-brand`, leading the Version row (for example as the row's first child
before the version text; keep `SettingRow`'s API unchanged). Add
`conch-mark.browser.test.tsx` that renders it and asserts one `<svg>` with a
`<path>`.

### Step 5: Rebuild the icon and logo lockups from the vector

Create `apps/app/scripts/build-brand-assets.ts`, a Bun script that renders SVG
strings to PNG with Playwright's Chromium (`playwright` is already a dev
dependency of `apps/app`): one page, `deviceScaleFactor: 1`, a viewport equal
to the output size, `page.setContent(svg-in-html)`, then
`page.screenshot({ omitBackground: true })`. Read the shell path from
`.github/brand/conch-mark.svg`; do not paste a second copy of it.

Outputs, exact sizes from `.github/brand/verification.json`:

- **App icon** (1024 master, then every `icon.iconset` size, `icon.png` at
  512, `.github/brand/icon-1024.png`): transparent canvas; tile is the
  centered 824-unit square (100,100)–(924,924) with continuous-curvature
  corners (a superellipse path, or `rx` ≈ 185 if a superellipse proves
  fiddly), fill `#121212`, the same soft drop shadow as today; shell about
  530 units wide, centered, fill `#fc4738`.
- **`icon.ico`**: six PNG-compressed frames. Read the frame sizes from the
  current file's ICONDIR header before overwriting it and keep the same set.
  Write the header and directory entries by hand; no new dependency.
- **`.github/logo-dark.png`** (1200×360, transparent): shell `#fc4738`,
  wordmark "Conch" in `font-family: Optima; font-weight: 700`, fill `#f2f2f2`.
- **`.github/logo-light.png`** (1200×360, transparent): shell `#e31510`,
  wordmark `#181818`.
- **`.github/brand/asset-review.png`**: a review sheet like the current one
  (large icon, the 16/32/64/128 sizes, both lockups on their backgrounds).

Match the existing lockups' proportions: open the current PNGs and keep the
mark-to-wordmark size and gap. Then update `verification.json` (same shape)
and rewrite `.github/brand/DESIGN-NOTES.md`: final colors (Ink `#121212`,
Vermilion `#fc4738`, light-surface Vermilion `#e31510`), "exported by
`apps/app/scripts/build-brand-assets.ts`", and drop the Pillow and
image-generation notes that no longer describe how the files are made.

**Evidence**: open `asset-review.png` and the 16 px iconset frame; the shell
is recognizable and red on a near-black tile. `sips -g pixelWidth -g pixelHeight`
on each output matches `verification.json`.

### Step 6: Make the contrast audit true again

Rewrite the pair table and input path in `apps/app/scripts/audit-contrast.ts`:

- Read `apps/app/src/mainview/index.css`. Resolve `var(--x)` aliases and
  skip `color-mix()` values.
- Composite translucent tokens in gamma-encoded sRGB over the reference
  wallpapers already named in the script (dark `#1a1a1c`, light `#f0f0f1`).
- Pairs (text 4.5, UI 3.0): `foreground`/`background`, `foreground`/`card`,
  `foreground`/`panel`, `foreground`/`panel-solid`, `panel-muted`/`panel`,
  `panel-muted`/`panel-raised` over `panel`, `panel-muted`/`row-active` over
  `panel`, `foreground`/`row-active` over `panel`, `primary-foreground`/`primary`,
  `secondary-foreground`/`secondary`, `muted-foreground`/`muted`,
  `muted-foreground`/`background`, `accent-foreground`/`accent`,
  `destructive-foreground`/`destructive`, `warning-foreground`/`warning`,
  `success-foreground`/`success`, `danger-ink`/`panel`, `success-ink`/`panel`,
  `warning-ink`/`panel`, `ring`/`panel` (UI), `ring`/`background` (UI),
  `brand`/`panel` (UI), `brand`/`background` (UI), `chart-1..6`/`card` (UI),
  `chart-1..6`/`panel` (UI), `conn-*`/`panel` (UI).
- Exit 1 when any pair fails. Regenerate `apps/app/docs/color-tokens.md`.

Expected ratios for the reference wallpapers, to catch a transcription slip:
dark `foreground`/`panel` ≈ 16.1, `panel-muted`/`panel` ≈ 7.8,
`brand`/`panel` ≈ 5.2, `chart-4`/`card` ≈ 5.7; light `foreground`/`panel` ≈
16.8, `panel-muted`/`panel` ≈ 7.7, `brand`/`panel` ≈ 4.6, `chart-3`/`card` ≈ 4.0.

### Step 7: Rewrite the brand docs

- `CLAUDE.md`
  - "Styling" bullet: say the palette is neutral gray `oklch` with a `--brand`
    vermilion, and name the `bg-scrim` and `--shadow` tokens.
  - Aesthetic Direction, **Theme**: "Dark-first, neutral gray close to native
    macOS, with one vermilion brand color (`oklch(0.66 0.22 29)`) kept for the
    mark, the caret and progress. Light mode exists; dark is the hero."
  - Design Principle 1 becomes: "**Calm chrome, one red.** Surfaces are
    neutral gray so the user's data carries the color. Vermilion marks the
    brand and the moment something is in flight; it is never a status color."
  - Anti-references: keep the line about purple/cyan gradients.
  - Leave the three brand words and every non-color rule alone.
- `PRODUCT.md:23,30`: the same two statements.
- `DESIGN.md`: replace the front-matter `colors:` block with the new token
  values (drop `amber-*`, `warm-*`, `json-*` and `sidebar` entries that no
  longer exist) and fix prose that calls the system warm or amber.

### Step 8: Verify

Run typecheck, lint, the app tests (update snapshots, read the diff: only
class changes from Steps 2–4 are expected), e2e, and the audit. Then look at
it: `bun run dev:web`, open the launcher in dark and light (Settings →
Appearance), and check the root list, a selected row, the footer capsules, an
ask answer with a bar chart ("signups"), a refusal ("delete users"), Settings,
and a board window. Nothing should read brown or amber, and the only red on a
neutral screen is the caret and the progress line.

## Test plan

- `components/brand/conch-mark.browser.test.tsx` (new): renders the mark.
- `components/motion/progress-hairline` and `ask/sql-block` tests: update
  class expectations and snapshots if they assert `bg-primary`.
- `components/ui/tooltip.browser.test.tsx`, `dialog.browser.test.tsx`: snapshots
  change to the new classes.
- `launcher/launcher-input.browser.test.tsx`: assert the input has `caret-brand`.
- No new e2e. Existing e2e must stay green; they assert behavior, not color.
- Model new tests on `components/ui/kbd.browser.test.tsx`.

## Done criteria

- [ ] `bun run check-types` and `bun run check` exit 0
- [ ] `bun run --cwd apps/app test` exits 0; line coverage stays at or above 80%
- [ ] `bun run --cwd apps/app e2e` shows no new failure against `aaa8938`
- [ ] `bun run apps/app/scripts/audit-contrast.ts` exits 0 and
      `apps/app/docs/color-tokens.md` lists only tokens that exist
- [ ] `grep -rn "sidebar" apps/app/src/mainview` returns nothing
- [ ] `grep -n "custom-variant dark" apps/app/src/mainview/index.css` matches
- [ ] `grep -rniE "amber|warm ink" CLAUDE.md PRODUCT.md DESIGN.md .github/brand/DESIGN-NOTES.md`
      returns nothing, apart from a sentence that says the old palette returns
      as the Amber theme
- [ ] `grep -rn "bg-brand\|text-brand\|caret-brand" apps/app/src/mainview --include="*.tsx"`
      matches only `progress-hairline.tsx`, `sql-block.tsx`,
      `launcher-input.tsx` and `about-section.tsx`
- [ ] The icon, iconset, ico and both lockups are regenerated, sizes match
      `verification.json`, and the review sheet shows a red shell on a
      near-black tile
- [ ] In `dev:web`, dark and light both read neutral gray; choosing Light on a
      dark-mode Mac no longer leaves dark-styled inputs or buttons
- [ ] `.factory/plans/README.md` row updated

## STOP conditions

- The owner asks for red on selection, buttons or focus rings after seeing
  the build. That reverses decision 1; stop and replan rather than adding
  `brand` call sites one by one.
- Playwright cannot rasterize the SVGs on this machine (no Chromium, no
  Optima). Report it; do not hand-edit PNGs or ship a mix of old and new
  assets. The palette steps can still land without Step 5.
- Adding `@custom-variant dark` breaks a `dark:` style that only worked
  because it followed the OS. Fix the component; if more than a handful of
  `ui/` files need redesign, report before going further.
- A pair in the audit fails with the values in Step 1. Recheck the
  transcription first; if it truly fails, adjust lightness by the smallest
  step that passes and record the new value in this plan's table.

## Maintenance notes

- Plan 025 moves these values out of `index.css` into theme data and adds the
  Amber theme from `git show aaa8938:apps/app/src/mainview/index.css`. Keep
  token names stable until then.
- Reviewers should look hardest at light mode (it gets less daily use), at
  focus-ring visibility on the translucent panel, and at the 16 px icon.
- Deferred: recolor `apps/video` and recapture `.github/banner.*`; consider a
  real `NSVisualEffectView` blur behind the panel (today the window is
  transparent with a CSS `backdrop-filter`, which cannot blur the desktop).
