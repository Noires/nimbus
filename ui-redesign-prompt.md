# Nimbus UI Redesign Prompt

A sectioned design prompt for reworking the Nimbus UI, written for an AI agent
working **inside this repository**. It follows the superdesign.dev
"default → constraint" method: every section opens with one confident default
sentence, then pins 3–6 hard, *named* constraints, and closes with an Avoid
line. Iterate with the delta prompts in §5 — never re-describe a whole screen.

---

## 0. How to use this prompt

- Load the `frontend-design` skill before starting, then read `CLAUDE.md` and
  `frontend/src/global.css` first — the token block is the constitution.
- Work section by section (§3a → §3n). After each section: run the gates
  (§6), take screenshots, **stop for review**.
- Specificity beats adjectives. When you deviate from a default, name the
  pattern you are using ("segmented control", "coach-mark spotlight",
  "sticky panel header"), not how it feels.
- Values in `[brackets]` are yours to choose; everything phrased as "must"
  is not.
- Verify visually: dev servers (`docker compose up -d db`, `cd server && npm
  run dev`, `cd frontend && npm run dev`), demo canvas
  `http://localhost:5173/canvas/clvl0demo0000`, screenshot via the
  playwright-core + Edge-headless pattern in the session scratchpad
  (`shoot*.mjs`) — never declare a section done unseen.

---

## 1. Product & identity brief

**Default:** Nimbus is a spatial task-planning whiteboard: task cards live at
world coordinates on an infinite pan/zoom canvas, nearby cards glow as
clusters ("bubbles"), and the queues (Today, Inbox, Review, Operations,
Ledger) open as sheets floating over the always-alive field.

You have **license to change the product's visual character entirely.** The
current identity ("Night Cartography": deep blue-black field, cyan accent,
precision-instrument restraint) is the starting point, not a dogma. If you
replace it, you must:

1. State a **thesis** in one sentence before touching code (e.g. "Nimbus is
   [a nautical chart room / a printed field notebook / an observatory
   console] — and every surface derives from that").
2. Design exactly **one signature element** that could not belong to any
   other app, and keep everything around it quiet.
3. Derive every color, type and shape decision from the thesis — no
   decisions "because it looks nice".
4. Calibrate against the three known AI default looks and reject them
   (see §4 Avoid bank).

**Avoid:** a mood board without a thesis; two competing signatures; changing
character in some surfaces but not others (the 2026-08 consolidation exists
precisely because two palettes once coexisted — never reintroduce that).

---

## 2. Hard rails (non-negotiable, regardless of direction)

These encode this repo's contracts. Layout and character are free; these are
not.

**Token mechanics.** All color, elevation, radius and type flows through the
`--nc-*` custom properties in `frontend/src/global.css` and their Tailwind
bridge (`@theme inline` → utilities like `bg-nc-raised`, `text-nc-muted`,
`border-nc-line`, `rounded-nc-lg`, `shadow-nc-md`, `text-2xs`). You may
change every **value**, rename ramps, add tokens — but components never use
raw palette classes (`bg-cyan-400`) or hex literals. Exceptions that stay:
task-color data (`task.color`, the CreateModal swatch palette, `#8b5cf6`/
`#6366f1` fallbacks), Minimap canvas-2D fills, the white swatch-picker
selection ring.

**Test policy.** Structural tests may be rewritten *in the same commit as the
change they pin*: `commandCenterLayout.test.ts` (regex over global.css),
`SpatialCommandCenterShell.test.tsx`, `TopBar/CanvasToolbar.test.tsx`,
tour tests, `CanvasRouter.test.tsx`. Feature tests must pass **untouched**:
- `OperationsView.test.tsx`: `>Open in Inspector<` / `>Reveal<` — the label
  is the button's only child; the markup must never contain the substring
  `form` (bans `transform`, `transition-transform`; `transition-colors` is
  fine). `ui/Button.test.tsx` guards this for the Button primitive.
- `WorkstreamsPanel.test.tsx`: the literal attribute string
  `type="checkbox" role="switch" checked=""` and the strings "Pinned",
  "Protected", "Durable, explicit task membership".
- `NightCartography.test.tsx`: the surface title stays a `<p>`; the canvas
  surface contains no heading; `data-workspace*` attributes stay.
- Rail buttons keep their exact `textContent` via `sr-only` spans (icons are
  SVG and contribute nothing to textContent — keep it that way).

**i18n.** Every user-facing string goes through `useT()` (components) or bare
`t` (modules), with the key present in **both** `en` and `de` blocks of the
same fragment file (`parity.test.ts`, `tutorialParity.test.ts` enforce this).
Never hardcode UI copy; never let a design-system name leak into visible UI.

**Accessibility.** One focus indicator app-wide: the global 3px
`--nc-focus` `:focus-visible` outline (currently yellow — recolor freely,
never duplicate with per-component rings/borders). Programmatic heading
focus shows no ring (`[tabindex="-1"]` rule). 44px touch targets on mobile
surfaces. `prefers-reduced-motion` must neutralize CSS animations (global
block) **and** framer springs (`useReducedMotion`, pattern in
`DestinationSheet.tsx`). Text meets WCAG AA against the darkest surface it
appears on; document the contrast floor in the token block header the way
the current `--nc-text-faint` note does.

**Canvas performance.** Pan/zoom stays a single `translate(...) scale(...)`
transform. Bubble pulse and any ambient canvas animation stay
transform/opacity-only. Backdrop blurs over the canvas stay small or static.

**Architecture facts you inherit.** The canvas never unmounts; destinations
are `DestinationSheet` overlays; chrome = TopBar (global) + floating
CanvasToolbar (canvas-only) + 3.5rem NavigationRail + collapsible right rail;
`MobileCommandCenter` is a separate shell — style it, don't merge it. The
guided tour anchors real selectors (see §3n) — if you rename/remove one, fix
`guidedTourSteps.ts` and its tests in the same change.

**Gates after every section:** `cd frontend && npx tsc -b` · `npx vitest run`
(all green; only declared structural rewrites differ) · `npm run build` ·
screenshot pass.

---

## 3. Section prompts

### 3a. Design language & tokens

*Current state:* `global.css` defines a 6-step blue-dark surface ramp, a
4-step text ramp, cyan accent / violet select / semantic status ramps, a
3-step shadow scale, 4-step radius scale, and a type scale — all bridged to
Tailwind via `@theme inline`.

**Default:** One coherent design language expressed entirely as a token
system: a [dark/light/dual] surface ramp of 5–6 luminance steps, one
interactive accent family (base/strong/muted/border/surface), one selection/
CTA family, semantic status colors reserved for real states, and scales for
radius, elevation, spacing and type.

**Constraints:**
1. Every value used more than once becomes a token; components consume only
   the Tailwind bridge utilities.
2. Semantic discipline survives any recolor: [warning hue] means time
   pressure only; [selection hue] means selection/primary-create only;
   priorities render neutral except HIGH. You may re-assign the hues, never
   blur the meanings.
3. Elevation is a 3-step shadow scale plus one directional drawer shadow;
   overlays use the two scrim tokens (modal + light-over-canvas).
4. Keep the contrast notes in the token block header up to date (AA floor
   per text step, checked against the darkest surface it sits on).
5. Radius scale stays 4 steps + full; name them by role (controls / buttons
   / panels / modals), not by size adjectives.

**Avoid:** parallel ad-hoc alpha values (`/10`, `/40`…) for the same purpose
where a `-muted`/`-border` token exists; more than two non-semantic hues.

### 3b. Typography

*Current state:* `Nunito, Quicksand, Poppins, system-ui` stack; scale
`text-2xs (0.65rem)` → `display clamp(...)`; micro-label grammar
`text-2xs font-medium uppercase tracking-wider text-nc-muted`; row titles
`text-sm`, buttons/meta `text-xs`.

**Default:** A two-face system — one characterful face for titles/display
used with restraint, one workhorse for UI text — with a 6-step scale and one
micro-label (eyebrow) treatment reused everywhere.

**Constraints:**
1. Faces are chosen for the thesis (§1) and self-hosted or system — no
   external font CDN (CSP/no-dependency rule).
2. Minimum sizes hold: interactive labels ≥ `text-xs` (12px); `text-2xs`
   only for eyebrows and dense metadata.
3. Exactly one eyebrow/label treatment (`rail-section__label` today) across
   rail sections, sheet sections, and dialog headers.
4. Line length in list destinations stays a readable measure (Today/Review
   64rem, tables 92rem today — retune, don't abolish).

**Avoid:** a third typeface; letter-spacing on body text; sizes below 10px.

### 3c. App shell & layout

*Current state:* grid shell — 3.5rem icon `NavigationRail` left, 3rem
`TopBar` (wordmark, `CanvasSwitcher` popover, search, eye/undo icons, count,
DE/EN, ⋯ More), main = always-mounted canvas with sheets over it, right
`command-center-shell__rail` (Werkzeuge/Inspector, collapsible, compact-mode
modal drawer with a focus-trap contract).

**Default:** The field is the app; chrome is at most two slim zones and
every panel is either anchored to an edge or floats over the canvas with a
stated reason.

**Constraints:**
1. You may re-architect the shell (merge TopBar into the rail, bottom
   command bar, floating-everything…) — but budget it: every shell change
   requires coordinated rewrites of the shell/CSS-regex tests and must keep
   the compact-desktop (769–1100px) drawer behavior and its focus contract
   (or replace it with an equally tested contract).
2. The canvas keeps ≥ [85]% of the viewport on a 1600×900 screen.
3. Destination surfaces must keep the "field stays alive underneath"
   quality — whatever replaces sheets must not unmount the canvas.
4. The rail's close/open affordances always do something meaningful (no
   dead buttons — collapse, deselect, or open).
5. Keyboard reachability: every zone reachable in DOM order rail → top bar
   → main → panel.

**Avoid:** reintroducing a wide labeled nav column or a tall commands band
(both were removed deliberately); more than one floating toolbar family.

### 3d. The spatial canvas

*Current state:* dot-grid background synced to the view transform; cards as
absolute-positioned motion divs; union-find proximity bubbles (SVG, hue per
cluster, opacity pulse); zones as labeled rects with auto-tags; dependency
edges (SVG paths, success/neutral); time axis lens with capacity bands;
minimap bottom-right (canvas 2D); gravity/heat lens halos via box-shadow.

**Default:** The field reads as [your thesis's substrate — chart, star map,
drafting table…]: a deep, calm background where cards and bubbles are the
brightest things, and every canvas ornament (grid, zones, edges, halos)
derives from one substrate metaphor.

**Constraints:**
1. Grid/background must stay a single cheap layer (one background-image or
   equivalent), synced to pan/zoom as today.
2. Bubbles remain the emotional centerpiece: recolor/reshape freely but keep
   the glow animation opacity-only and the per-cluster hue seeded from data.
3. Zones, edges and lens halos each get a distinct, thesis-derived visual
   channel — a user must distinguish "zone", "dependency", "urgency halo"
   at a glance.
4. Lens states (time/gravity/heat) must be visually announced beyond the
   toolbar label — [tint the field / change the grid / badge the corner].
5. Minimap stays canvas-2D (no CSS vars inside) — pick its colors as
   literals mirroring the tokens, with a comment linking them.

**Avoid:** parallax or continuous ambient animation on the field; more than
one glow language.

### 3e. The task card

*Current state:* 256px card, id-seeded gradient accent strip on top, title +
priority label (only HIGH colored), meta row (due/estimate/checklist ring),
tags, mark-done line, icon action footer (pencil/archive/clock/trash),
dependency port on the right edge, three semantic density levels + mini row
mode, selection/focus/flash rings, drag spring.

**Default:** The card is the product's atom: a compact, deeply considered
object with one strong personality detail [the accent strip / a corner tab /
a ticket edge], readable at three densities.

**Constraints:**
1. All three density levels and mini mode keep working (`semanticDensity`,
   `--semantic-card-scale` inline var, `data-tour="task-card"` attribute).
2. State ring hierarchy stays distinct and ordered: flashing > focused >
   selected > overdue-border > archived-dashed.
3. Due/overdue is the only warning-colored element on a resting card.
4. The action footer stays icon-only with `aria-label`+`title` from the
   existing `b.card.*` keys; "mark done" keeps a text affordance.
5. Card motion keeps `taskCardTransition` semantics (springs for movement,
   instant while dragging, reduced-motion → duration 0).

**Avoid:** more than two font sizes inside the card; badges that repeat what
the strip/ring already says.

### 3f. Destination sheets & list grammar

*Current state:* `DestinationSheet` (scrim + centered panel, enter-only
spring, "← Back to canvas" button, rail-aware width, 64/92rem measures);
lists use `NightCartographyTaskRow` (title `text-sm` wrapping, right badge,
wrapping meta line, wrapping action bar of ghost `NightCartographyRowAction`
buttons); Inbox is a table; Ledger is filters + table.

**Default:** Every queue is the same instrument in a different mode: one
sheet chrome, one row grammar, one filter-control grammar — only the data
and one mode-specific affordance differ per destination.

**Constraints:**
1. One shared row component remains the only row implementation; text wraps,
   never clips (`overflow-wrap:anywhere` on titles, no `truncate` on
   user content).
2. Row action labels stay statically rendered text (test-pinned) — restyle,
   don't hide behind menus.
3. Tables (Inbox, Ledger, Operations') controls use the `ui/` primitives;
   selects/date inputs must fully fit their longest localized label
   ("Arbeitsstrom zuweisen", `TT.MM.JJJJ`).
4. The sheet keeps an always-visible route-back affordance and never
   requires horizontal body scroll.
5. Per-view identity is allowed exactly one signature touch each [e.g. a
   review-queue color chip system], on top of the shared grammar.

**Avoid:** re-diverging row layouts per view; double titles (sheet header +
identical section header) — pick one owner per name.

### 3g. The right rail (tools & inspector)

*Current state:* header row (eyebrow title + docked sticky × icon button),
hairline-divided sections (task search, density segmented control,
workstreams panel), inspector replaces directory on selection (title,
status Chip, dl grid, blocker controls, activity), collapsible with a
wrench-icon opener; compact mode = modal drawer with focus trap.

**Default:** A single side instrument with a sticky header row and
hairline-sectioned body; the inspector is a mode of the same panel, not a
different design.

**Constraints:**
1. The close button stays first-in-DOM (focus contract) and keeps its
   sr-only textContent labels.
2. One section-label treatment (§3b constraint 3) heads every section.
3. The segmented control pattern stays for 2–4-way mode switches
   (`nc-segmented` — restyle freely).
4. Inspector fields stay a two-column definition grid; long titles wrap.
5. Content and edge paddings align to one inset (16px today) across
   directory and inspector modes.

**Avoid:** prose paragraphs as section fillers; accent-colored section
headings (chrome recedes, content carries color).

### 3h. Toolbars, menus & switcher

*Current state:* TopBar (`data-topbar` × 5 contract), floating CanvasToolbar
(`data-toolbar-primary` × 5: new-task/lens/view/arrange/tools, icon+text
triggers), shared `useMenuSet` keyboard grammar + `MenuPanel` scale-pop,
`CanvasSwitcher` popover with inline rename/create and alertdialog delete.

**Default:** Two toolbars, one voice: identical trigger anatomy
[icon + label / icon-only + tooltip], identical menu panel (one shell, one
item style, one label style), and the canvas toolbar disappears under
sheets.

**Constraints:**
1. The `data-topbar` / `data-toolbar-primary` attribute contracts and their
   counts survive (tests pin exactly 5 + 5) unless you rewrite those tests
   in the same commit with a stated new contract.
2. Menu keyboard behavior (roving focus, Home/End, Escape-restores-trigger)
   is shared code (`toolbarMenu.tsx`) — extend it, never fork it.
3. The lens trigger carries its state in its label ("Lens: Time") or an
   equally glanceable state signal.
4. The "+ New" CTA is the single solid-[selection-hue] button in the chrome.
5. Menus stay enter-only animated (`menuPop`), reduced-motion aware.

**Avoid:** menu items with icons for some entries and not others; a second
overflow menu inside the same toolbar.

### 3i. Overlays: modals, palette, docks, bars, toasts

*Current state:* one modal grammar (`rounded-nc-xl bg-nc-raised/95 blur-xl
border-nc-line shadow-nc-lg` + fading scrim, reduced-motion-aware
`dialogSpring`); palette with inset focus ring; bottom floating-bar family
(SelectionBar, DayDock, FocusTimer, TimelapseBar, ReviewHud) sharing
`rounded-nc-lg raised/95 blur-md` + per-mode accent border; InboxDock right
tab; Toast bottom-center.

**Default:** Three overlay families, each with one grammar: dialogs (center,
scrim), floating mode-bars (bottom-center, accent-coded border per mode),
and edge docks — nothing else floats.

**Constraints:**
1. Every scrim fades (`quickFade`), every dialog spring is reduced-motion
   aware — no exceptions when adding overlays.
2. Mode-bars keep per-mode accent borders as their identity; pick the coding
   scheme deliberately and document it in a comment.
3. The palette input focus ring stays inside the clipped panel
   (`.command-palette__input` rule) — one visible ring, never a clipped bar.
4. z-order ladder stays documented and monotonic: canvas chrome 50–60 <
   sheet 70 < bars 70–90 < modals 100–150 < tour 150 < toast 200.
5. Toasts stay single-line, bottom-center, pointer-events-none.

**Avoid:** overlay-on-overlay stacks deeper than two; bespoke shadows per
overlay.

### 3j. Icons & wayfinding

*Current state:* hand-drawn 20×20 stroke-1.6 SVG set in `ui/icons.tsx`
(always `aria-hidden`; owning control carries the name), NavigationRail
icons + gliding active pill, icon-only conversions with `aria-label`+`title`
throughout chrome.

**Default:** One hand-drawn icon set with a single stroke weight and corner
language derived from the thesis; icons replace text only where meaning is
universal, and every icon-only control is named.

**Constraints:**
1. No icon dependency — extend `ui/icons.tsx` (the `Icon` wrapper contract:
   sizes 16/20, `aria-hidden`, "form"-free markup, guarded by
   `icons.test.tsx`).
2. Icon-only requires `aria-label` + `title`; app-specific concepts (lens,
   arrange, workstreams) keep icon+text.
3. The rail's active indicator remains a moving shared-layout element
   (`layoutId`) or an equally alive equivalent; static fallback under
   reduced motion.
4. Decorative glyphs next to text are `aria-hidden`.

**Avoid:** emoji as UI icons (Windows renders flag/many emoji as letter
pairs — the "DE DE" bug class); mixed stroke weights.

### 3k. Motion

*Current state:* shared vocabulary in `utils/motion.ts` — `dialogSpring`
380/30, `chromeSpring` 360/32, `menuPop` 520/32, `quickFade` .15s,
`ambientFade` .35s; CSS enter animations for rail/badges; content springs in
TaskCard/PortalNode; ~everything enter-only.

**Default:** A small named motion vocabulary (3 springs + 2 fades today —
retune values freely) where every surface family uses exactly one entry, and
motion exists to explain spatial relationships, not to decorate.

**Constraints:**
1. All new motion routes through named exports in `utils/motion.ts` — no
   inline transition objects in components.
2. Transform/opacity only; anything animating over the canvas must not
   trigger full-viewport repaints per frame.
3. Enter-only remains the default; exits only where the object visually
   persists (toasts, bars) — route changes stay instant.
4. Every framer surface honors `useReducedMotion`; every CSS animation is
   covered by the global reduced-motion block.
5. One signature moment maximum [e.g. the rail pill glide, or a bubble
   coalesce] — everything else stays utilitarian.

**Avoid:** staggered list entrances on every open; springs on hover.

### 3l. States: empty, loading, error

*Current state:* `CommandCenterState` card (accent/danger border, icon
circle, title/detail/action) for router-level states; per-view text lines
("Loading Today…", role=alert errors, "Inbox is clear…"); many state strings
are test-pinned.

**Default:** Empty states are invitations, loading states are quiet, errors
name the fix — all three rendered in one shared state-card grammar with the
view's icon.

**Constraints:**
1. Keep every existing state string (test-pinned) — restyle containers, not
   copy; new copy goes through i18n en+de.
2. Empty states name the action that fills them and offer it as a button
   where a handler exists.
3. Loading is text or a quiet shimmer — never a spinner zoo; respect
   reduced motion.
4. Errors keep `role="alert"` and describe recovery.

**Avoid:** illustrations that need maintenance; humor in error copy.

### 3m. Mobile companion

*Current state:* separate `MobileCommandCenter` shell (header + content +
4-tab bar), card-based triage grammar, 44px targets, own BEM CSS block in
global.css; desktop chrome hidden ≤768px.

**Default:** The companion is a focused operational remote — capture, Today,
Inbox, More — restyled to the new language but never a shrunken desktop.

**Constraints:**
1. It remains a separate shell; the desktop grid gains no ≤768px reflow
   (test-pinned absence of that media query).
2. 44px minimum targets throughout; the `mobile-*` BEM class names are
   partially test-pinned — keep names, restyle rules.
3. The tab bar keeps `aria-current="page"` semantics.
4. The guided tour stays desktop-only.

**Avoid:** hover-dependent affordances; the canvas minimap (already hidden —
keep it out).

### 3n. Guided tour & help

*Current state:* spotlight tour over the real UI (`CommandCenterTutorial`,
interceptor scrim, ring + tooltip card, 7 steps, auto-skip fallback chains,
storage `nimbus:guided-tour-v1`); anchors:
`[data-tour="task-card"]`, `.night-cartography--canvas`,
`.navigation-rail__button--capture`, `.navigation-rail`, `.canvas-toolbar`,
`.command-center-shell__rail`(+`-open`); tour starts force-navigate to the
canvas route; HelpPanel catalog of ~80 features.

**Default:** The tour is the new design's first impression: the spotlight
ring, tooltip card and offer card are flagship instances of the token
system, and the step copy matches the redesigned UI word-for-word.

**Constraints:**
1. Anchor selectors are a contract: any rename in the redesign updates
   `guidedTourSteps.ts` + tour tests in the same commit.
2. The interceptor/read-only guarantee stays (full-viewport pointer catch).
3. After any chrome redesign, re-verify all 7 steps live from both the
   canvas route and a sheet route (the step-5 regression class).
4. HelpPanel catalog copy is re-audited against the final UI: every entry
   names controls by their visible label and current shortcut.

**Avoid:** tour copy describing internal names; more than 8 steps.

---

## 4. Global avoid bank

- The three AI default looks: warm-cream + serif + terracotta; near-black +
  single acid-green/vermilion accent; broadsheet hairlines + zero radius.
- Generic dark-SaaS dashboard (slate-800 cards, indigo buttons, glow
  gradients on KPI numbers).
- Glassmorphism inflation — blur is budgeted (canvas perf rail).
- Neon overload: if everything glows, bubbles stop mattering.
- Semantic blur: warning-colored default states, selection-colored
  decorations (the 2026-08 color diet must survive any recolor).
- Double focus indicators, double titles, double borders — one owner per
  signal.
- Unlabeled icon-only controls; emoji as icons.
- Dead chrome: any button that sometimes does nothing.

---

## 5. Delta prompt library (iterate with these, don't re-describe)

- "Retune only the surface ramp tokens for [more depth / less blue] —
  values in `global.css :root` only, zero component edits."
- "Swap the accent family to [hue] across tokens; verify AA notes and the
  focus outline still contrasts on every surface."
- "Tighten density on [view]: reduce row padding one step, keep 44px mobile
  targets and wrapping titles."
- "Give [surface] the signature treatment from §1 thesis; touch only that
  surface's component + tokens it already uses."
- "Raise [text step] to AA+ (7:1) against `--nc-raised`; update the token
  header notes."
- "Restyle [overlay family] to the new grammar without changing its motion
  entry or z-index."
- "Re-anchor tour step [n] to [selector]; update `guidedTourSteps.ts` and
  the interactions test in the same commit."
- "Screenshot [routes] at 1600×900 and 1000×800, before/after, and report
  deltas before proceeding."

---

## 6. Verification per phase

After every section from §3:

1. `cd frontend && npx tsc -b`
2. `npx vitest run` — all green; structural test rewrites only as declared
   in §2, in the same commit as the change they re-pin.
3. `npm run build`
4. Screenshot pass (playwright-core + Edge headless, dev server, demo canvas
   `clvl0demo0000`): canvas, all five sheets, rail both modes, one modal,
   one menu open, mobile 390×844, compact 1000×800; German locale for at
   least one pass (longest strings).
5. Contrast spot-check of any changed text/surface pair; note the result in
   the token header.
6. Tour walkthrough (all 7 steps, from canvas *and* from a sheet) whenever
   chrome or selectors changed.

Stop after each section and present: what changed, the token diff, what was
deliberately left alone, and the screenshots.
