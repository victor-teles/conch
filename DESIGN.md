---
name: Conch
description: Native-calm database launcher — dark-first neutral gray with one vermilion mark.
colors:
  ink: "oklch(0.2 0 0)"
  raised: "oklch(0.25 0 0)"
  accent-surface: "oklch(0.31 0 0)"
  muted-surface: "oklch(0.25 0 0)"
  muted-text: "oklch(0.74 0 0)"
  paper: "oklch(0.975 0 0)"
  paper-raised: "oklch(1 0 0)"
  dark-border: "oklch(1 0 0 / 0.14)"
  light-border: "oklch(0.86 0 0)"
  foreground-dark: "oklch(0.96 0 0)"
  foreground-light: "oklch(0.21 0 0)"
  primary-dark: "oklch(0.95 0 0)"
  primary-light: "oklch(0.22 0 0)"
  ring-focus: "oklch(0.9 0 0)"
  brand-vermilion: "oklch(0.66 0.22 29)"
  brand-vermilion-light: "oklch(0.58 0.23 29)"
  destructive-red: "oklch(0.55 0.21 33)"
  warning-ember: "oklch(0.78 0.14 70)"
  success-moss: "oklch(0.72 0.15 145)"
  chart-1: "oklch(0.72 0.13 245)"
  chart-2: "oklch(0.78 0.12 165)"
  chart-3: "oklch(0.82 0.13 85)"
  chart-4: "oklch(0.7 0.14 310)"
  chart-5: "oklch(0.74 0.14 55)"
  chart-6: "oklch(0.72 0.02 250)"
  conn-honey: "oklch(0.78 0.11 75)"
  conn-denim: "oklch(0.65 0.09 235)"
  conn-moss: "oklch(0.68 0.07 145)"
  conn-plum: "oklch(0.62 0.09 310)"
  conn-clay: "oklch(0.7 0.12 35)"
  conn-stone: "oklch(0.6 0.02 80)"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.028em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.003em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "-0.003em"
  chrome:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.028em"
  section-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.022em"
  mono:
    fontFamily: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.003em"
    fontFeature: "'calt', 'liga' 0, 'zero', 'ss02'"
rounded:
  sm: "3.2px"
  md: "5.2px"
  lg: "7.2px"
  xl: "11.2px"
  pill: "9999px"
spacing:
  tight: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-text}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-ghost-hover:
    backgroundColor: "{colors.muted-surface}"
    textColor: "{colors.foreground-dark}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-toolbar:
    backgroundColor: "transparent"
    textColor: "{colors.muted-text}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  input-default:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
    height: "28px"
  input-focus:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.foreground-dark}"
  card-default:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "16px"
  tabs-trigger:
    backgroundColor: "transparent"
    textColor: "{colors.muted-text}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  tabs-trigger-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
  dynamic-island:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "24px"
---

# Design System: Conch

## 1. Overview

**Creative North Star: "Calm Chrome, One Red"**

Conch is a dark-first, keyboard-first database launcher built for developers who sit inside it for three-hour debugging sessions. Surfaces are neutral gray, close to the system's own, so the user's data carries the color. Surfaces are flat and tonally layered — the kind of native-calm you feel in Raycast, TablePlus, Postico, Things 3, Linear, and Arc. Typography is tight and functional; density is the point, but every group breathes.

One vermilion red belongs to the brand. It marks the shell logo, the input caret and the progress line — the moment something is in flight — and nothing else. The old warm-brown palette is retired as the default and returns as a selectable theme (plan 025).

This system explicitly rejects: bureaucratic grey admin panels (DBeaver, phpMyAdmin, pgAdmin), the generic AI-tool aesthetic (purple/cyan gradients, neon on dark, sparkle icons, "✨ AI-powered" marketing voice), and the chatbot-drawer-bolted-onto-an-IDE pattern. It also rejects ambient typography choices that every other developer tool already made (Inter, IBM Plex, Space Grotesk, Fraunces, Instrument Sans).

**Key Characteristics:**

- Dark-first hero surface; light mode exists but is secondary
- Neutral grays throughout — chroma 0, no tint
- Vermilion only on the mark, the caret and progress; never on selection, buttons, focus or charts
- Pro-density type scale (10–14px) with generous vertical rhythm between groups
- Real macOS vibrancy via `backdrop-blur-xl backdrop-saturate-200`, only where it earns its weight
- macOS system font (San Francisco via `-apple-system`) for UI, JetBrains Mono (variable, ligatures off) for SQL and data
- iOS-like springs for motion; `prefers-reduced-motion` respected fully

## 2. Colors

Neutral grays with one vermilion brand color. Grays carry no chroma, so status, chart and connection colors are the only hues on screen besides the brand mark. Token values live in the built-in themes (`packages/rpc/src/theme-builtins.ts`, Conch Dark and Conch Light here) and reach the page as inline custom properties on `<html>`; users can pick Amber or build their own in the theme editor. `apps/app/docs/color-tokens.md` is the generated contrast audit.

### Brand

- **Vermilion** (`oklch(0.66 0.22 29)` dark / `oklch(0.58 0.23 29)` light, token `--brand`): the shell logo, the launcher input caret, the streaming SQL caret and the progress hairline. It is never a status color, a selection, a focus ring or a chart series.

### Primary

- **Primary** (`oklch(0.95 0 0)` dark / `oklch(0.22 0 0)` light): a near-white or near-black neutral for primary buttons, checked controls and chips. The focus ring (`--ring`) is the same neutral family.

### Neutral

- **Ink** (`oklch(0.2 0 0)`): the dark background; the panel is Ink at 90% over the desktop.
- **Raised** (`oklch(0.25 0 0)`): cards and popovers. One tonal step up from Ink — depth is built here, not with shadows.
- **Accent surface** (`oklch(0.31 0 0)`): hover surfaces and secondary emphasis.
- **Muted text** (`oklch(0.74 0 0)`): secondary text, labels and idle icons.
- **Paper** (`oklch(0.975 0 0)`) and **Paper raised** (`oklch(1 0 0)`): light-mode background and cards.
- **Selected row** (`oklch(1 0 0 / 0.1)` dark / `oklch(0.2 0 0 / 0.09)` light): one neutral highlight that follows the pointer.
- **Dark Border** (`oklch(1 0 0 / 0.14)`): hairline dividers on dark, translucent so they inherit the surface beneath.

### Status

- **Destructive Red** (`oklch(0.55 0.21 33)`): destructive actions and error states. Shared across modes.
- **Warning Ember** (`oklch(0.78 0.14 70)` dark / `oklch(0.52 0.16 70)` light): slow-running queries, attention banners.
- **Success Moss** (`oklch(0.72 0.15 145)` dark / `oklch(0.55 0.15 145)` light): completed queries, healthy connection states.

### Charts

Six series colors that lead with blue, because a red first series reads as "bad": `oklch(0.72 0.13 245)`, `oklch(0.78 0.12 165)`, `oklch(0.82 0.13 85)`, `oklch(0.7 0.14 310)`, `oklch(0.74 0.14 55)`, `oklch(0.72 0.02 250)` in dark, darker equivalents in light.

### Connection Palette

A labeled set of six muted, hue-distinct swatches used only for tagging database connections so users can identify them at a glance.

- **Honey** `oklch(0.78 0.11 75)` · **Denim** `oklch(0.65 0.09 235)` · **Moss** `oklch(0.68 0.07 145)` · **Plum** `oklch(0.62 0.09 310)` · **Clay** `oklch(0.7 0.12 35)` · **Stone** `oklch(0.6 0.02 80)`

These are never used as chart colors or status indicators. They belong to connections only.

### Named Rules

**The Neutral Rule.** Every gray has chroma 0. If a value is neutral, it is truly neutral; hue belongs to status, charts, connections and the brand.

**The One-Red Rule.** Vermilion marks the brand and the moment something is in flight. It never means "error" (that is Destructive Red) and never marks selection, focus or the primary button.

**The Named-Accent Rule.** Connection swatches are for connections. Status colors are for status. Never cross the wires — a moss-colored row is not a success; a plum-tagged connection is not a warning.

## 3. Typography

**Display / UI Font:** macOS system font stack — `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`. On macOS this resolves to San Francisco; the stack degrades cleanly on other platforms.
**Mono Font:** JetBrains Mono Variable, with fallback `ui-monospace, SFMono-Regular, monospace`.

**Character:** SF Pro is the native macOS UI face — calm, neutral, and unmistakably at home in the OS chrome. The app inherits its proportions and spacing rather than competing with them. Default tracking is a whisper tight (`-0.003em`) so the UI feels deliberate at small sizes. JetBrains Mono handles SQL and result data with ligatures explicitly disabled (`liga: 0`) — SQL operators should read as operators, not as custom glyphs — and with slashed zero (`zero`) and stylistic set `ss02` for data legibility.

### Hierarchy

Sizes run small on purpose. This is a pro tool; users want information. Rhythm comes from weight contrast and vertical grouping, not from scaling type up.

- **Headline** (18px / 1.3 / medium / `-0.028em`): Route-level page titles. Rare — used once per screen at most.
- **Title** (14px / 1.4 / medium / `-0.003em`): Card titles, dialog titles, section heads inside panels.
- **Body** (12px / 1.65 / regular / `-0.003em`): The workhorse. Form fields, descriptions, general UI copy. Keep prose ≤65–75ch.
- **Chrome** (11px / 1.4 / medium / `-0.028em`): Titlebar actions, toolbar labels, the Dynamic Island.
- **Section Label** (10px / 1.2 / medium / `+0.022em` UPPERCASE): Sidebar group headings, small capitals above grouped content.
- **Mono** (13px / 1.55 / regular / `-0.003em`): SQL editor, result tables, code blocks, keyboard shortcut keys.

### Named Rules

**The Small-and-Tight Rule.** Default body is 12px with `-0.003em` tracking. Never scale the whole UI up to feel "safer" — if a surface feels cramped, add vertical space between groups, don't inflate every element.

**The Ligatures-Off Rule.** Mono renders SQL. `=>`, `!=`, `<=`, `->` are operators, not arrows. `font-feature-settings: "liga" 0, "zero"` is not optional.

**The Native-Type Rule.** The UI face is the macOS system font, not a bundled web font. Don't reach for Inter, IBM Plex, Space Grotesk, Fraunces, or Instrument Sans to "give the app personality" — personality lives in color, motion, and the Dynamic Island, not in the typeface. Letting SF do the talking is the whole point of native-calm.

## 4. Elevation

This system is **flat with tonal vibrancy**. Depth is built by stepping neutral surfaces upward in lightness (Ink → Raised → Accent surface), not by dropping shadows. Shadows exist in the Tailwind default scale but are used only in rare, specific moments — the Dynamic Island gets a gentle `shadow-sm` because it's the single hovering surface in the app, and popovers use `shadow-md` to separate from the parent surface.

Native macOS vibrancy is enabled on the window (`windowEffects: { effects: ["sidebar"] }`, with `transparent: true` and `macOSPrivateApi: true`). The sidebar background in Tauri renders through real system vibrancy — not a CSS blur fake. The Dynamic Island composites over this with `backdrop-blur-xl backdrop-saturate-200` so it inherits the ambient wallpaper.

### Shadow Vocabulary

- **`shadow-sm`** (Tailwind default): Only on the Dynamic Island pill. A soft grounding glow.
- **`shadow-md`** (Tailwind default): Popovers, dropdown menus, context menus — separating transient UI from the parent.
- **No `shadow-lg` / `shadow-xl` / `shadow-2xl`**: Forbidden. Heavier shadows belong to consumer products, not pro tooling.

### Named Rules

**The Flat-With-Vibrancy Rule.** Surfaces are flat at rest. Depth comes from tonal layering and real macOS vibrancy. Shadows are reserved for the Island and transient popovers — nothing else.

**The No-Dropshadow-On-Cards Rule.** Cards sit inside the parent surface and step up tonally. If a card reads as floating, add tonal contrast, not shadow.

## 5. Components

### Buttons

- **Shape:** Softly rounded (`5.2px` / `rounded-md`). Icon-only xs uses `3.2px` / `rounded-sm`.
- **Height:** 28px default (`h-7`), with `xs` 20px, `sm` 24px, `lg` 32px. This is a pro app; controls are compact.
- **Primary:** Primary neutral background, Ink text (`bg-primary text-primary-foreground`). Hover drops opacity to 80%, never changing hue. Used sparingly — one primary per surface.
- **Ghost:** Transparent ground, muted text. Hover fills with the muted surface. The workhorse for toolbars and list actions.
- **Outline:** Hairline border in Dark Border. Hover fills with `input/50`. Used when a button needs to be findable without demanding attention.
- **Secondary:** Raised background, foreground text. Soft accent for non-primary actions that still need visual weight.
- **Destructive:** Red text on a 10%-tint red background. Hover deepens to 20%. Never solid red — destructive is a statement, not an assault.
- **Toolbar:** Transparent, muted text, quiet hover. The default for titlebar and tab-bar action chrome.
- **Focus:** Neutral ring (`ring-ring/50`, `ring-2`) with matching border shift. Always visible — focus rings are a feature.
- **Transition:** `150ms ease-out` on all state changes.

### Inputs

- **Style:** Raised fill at 20–30% opacity, Dark Border hairline, `rounded-md`. Height matches buttons at 28px.
- **Focus:** Border shifts to the ring color, ring expands to `ring-2 ring-ring/50`. No glow, no elevation.
- **Error:** Border and ring pick up Destructive Red (20% tint in dark, 40% in light-on-light). `aria-invalid` triggers the treatment.
- **Disabled:** 50% opacity, no pointer.

### Cards

- **Corner Style:** `rounded-lg` (7.2px) — gently curved but not soft.
- **Background:** Raised.
- **Shadow Strategy:** None by default (see Elevation). Separation is tonal.
- **Border:** 1px ring in `foreground/10` — a ghost border. Hairline, never announcing itself.
- **Internal Padding:** 16px default (`p-4`), 12px in `size="sm"`. Gap between header/content/footer is `1rem` default, `0.75rem` sm.

### Tabs

Three variants, each purposeful:

- **Default:** Muted background fill, active tab becomes Raised with a subtle border. For content-switcher tabs inside a panel.
- **Line:** Transparent list, active tab gets a 2px underline in `foreground`. For route-level navigation.
- **Segment:** Borderless grouped list with a 1px divider between triggers that fades on active. For mode switchers (e.g., Results / Explain / Schema).

All triggers: 28px default height, 12px font, medium weight, `150ms ease-out` transitions.

### Dynamic Island — Signature Component

The titlebar's centered status pill is the single most distinctive surface in the app. Treat it with outsized care.

- **Shape:** `rounded-full` pill, 24px tall, `px-2.5` horizontal padding.
- **Ground:** `bg-background/85` — the Ink background at 85% opacity — composited over real macOS vibrancy via `backdrop-blur-xl backdrop-saturate-200`.
- **Border:** 1px hairline at `border/60` — softer than the standard hairline so it reads as a single floating object.
- **Shadow:** `shadow-sm` — a single grounding note, the one place in the app that earns a shadow.
- **Typography:** Chrome (11px medium, `-0.028em`). Tabular nums for query timers and counts.
- **Motion:** Morphs between hidden → connection-status → query-status → error states via Framer Motion `layout` with a spring (`stiffness: 400, damping: 30`). Content items blur-in and blur-out on kind change (`filter: blur(4px) → blur(0px)`, easing `[0.22, 1, 0.36, 1]`, 220ms). Respects `prefers-reduced-motion` by dropping the blur and spring.
- **States:** `hidden`, `connection-ok`, `connection-error`, `query-running`, `query-ok`, `query-error`. Errors use `role="alert"` + `aria-live="assertive"`; everything else is `role="status"` + `aria-live="polite"`.

### SQL Editor (CodeMirror)

- **Theme:** GitHub Dark, overridden so `.cm-editor`, `.cm-gutters`, and `.cm-activeLineGutter` stay transparent and inherit the Ink parent.
- **Font:** Mono role (13px JetBrains Mono Variable, ligatures off, slashed zero, `ss02`).
- **Completion icons:** Custom glyphs for semantic weight — `◫` (table, teal), `◱` (view, plum), `○` (column, honey), `◇` (keyword, clay, 700 weight). These replace the default CodeMirror icons entirely.

### Named Rules

**The Compact-Control Rule.** Default interactive controls (buttons, inputs, tabs) are 28px tall. Don't inflate to 36/40px — the whole system's rhythm depends on this density.

**The Ghost-Border Rule.** Cards use a 1px ring at `foreground/10`. Never use a visible 1px solid border on cards — hairlines announce themselves; ghost borders separate without shouting.

**The Signature Rule.** The Dynamic Island is the one place `backdrop-blur-xl` and `shadow-sm` earn their keep. Don't scatter blur or shadow elsewhere "to match".

## 6. Do's and Don'ts

### Do:

- **Do** keep every neutral at chroma 0. Hue belongs to status, charts, connections and the brand.
- **Do** reserve vermilion for the mark, the caret and progress.
- **Do** build depth through tonal surface layering (Ink → Raised → Accent surface).
- **Do** use the macOS system font (`-apple-system`) for UI and JetBrains Mono for SQL and data — with ligatures off on mono.
- **Do** keep default controls at 28px (`h-7`) and body text at 12px. Density is the point.
- **Do** use real macOS vibrancy via `windowEffects: ["sidebar"]` on the Tauri window, and `backdrop-blur-xl backdrop-saturate-200` on the Dynamic Island.
- **Do** put iOS-like springs (`stiffness: 400, damping: 30`) on morphing elements and exponential ease-outs on state transitions (`150ms ease-out`).
- **Do** keep focus rings visible — 2px, always. Focus is a feature.
- **Do** respect `prefers-reduced-motion` by dropping springs, blurs, and exit animations.

### Don't:

- **Don't** use vermilion for errors, selection, focus, buttons or chart series.
- **Don't** use purple or cyan gradients, neon accents on dark, or sparkle iconography. This is not a "✨ AI-powered" product.
- **Don't** build a chatbot drawer bolted onto the IDE. AI output lands in the editor like a colleague pasted it — not like a product feature.
- **Don't** imitate DBeaver / phpMyAdmin / pgAdmin chrome — dense, icon-heavy toolbars and default widget chrome, zero personality. That's the anti-brand.
- **Don't** use Inter, IBM Plex, Space Grotesk, Fraunces, or Instrument Sans. The macOS system font is the UI face — let it disappear into the OS.
- **Don't** scale controls up to 36/40px to feel "safer". The system's rhythm breaks.
- **Don't** use `border-left` / `border-right` greater than 1px as a colored accent stripe on cards, list items, or callouts. Rewrite with full borders, tonal backgrounds, or leading icons.
- **Don't** use `background-clip: text` with gradients. Emphasis is weight and size.
- **Don't** use `shadow-lg` / `xl` / `2xl` on anything. Heavy drop shadows belong to consumer products.
- **Don't** drop shadows on cards. Cards step up tonally.
- **Don't** use the connection palette for charts or status — connections only.
- **Don't** use ligatures on SQL — `=>` / `!=` / `<=` / `->` are operators, not glyphs.
- **Don't** animate CSS layout properties. Animate `transform`, `opacity`, `filter`, or use Framer `layout`.
- **Don't** imitate macOS widgets. Inherit the discipline — keyboard-first, quiet chrome, real vibrancy — not the skin.
