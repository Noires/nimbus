# UI Polish — Agent Prompt

Copy the block below into a fresh agent session (or `claude -p`) at the repo root.

---

## The prompt

```
Load the frontend-design skill before you start.

Make the Nimbus UI visually cohesive and polished. Read CLAUDE.md first, then
frontend/src/global.css to understand the existing "Night Cartography" token
set (--nc-*).

CURRENT STATE
The design system is half-finished. global.css defines a small --nc-* token set,
but roughly 429 Tailwind color utilities and dozens of hardcoded hex literals
across ~30 files in frontend/src/components/ ignore it. Two shells coexist
(CanvasRouterLayout and SpatialCommandCenterShell). The result reads as
unfinished rather than badly designed — the fix is consolidation, not a redesign.

DIRECTION
Nimbus is a spatial task whiteboard: a deep, calm, low-luminance field where
task cards and glowing cluster bubbles are the only things that draw the eye.
Chrome (toolbar, rails, panels, modals) should recede; content should sit
forward. Target the feel of a precision instrument — Linear/Things-grade
restraint, not a neon dashboard.

SCOPE — do these in order, and stop after each phase so I can review:

1. Consolidate the design system in global.css. Extend the --nc-* tokens into a
   complete set: surface ramp, text ramp, accent + accent-muted, semantic
   priority/status colors, border, shadow scale, radius scale, type scale.
   Every value used more than once becomes a token.

2. Replace hardcoded hex values and ad-hoc Tailwind color utilities in
   frontend/src/components/*.tsx with the tokens. Grep for `#` hex literals and
   `bg-[#` / `text-[#` to find them. Keep Tailwind for layout and spacing; use
   tokens for color, elevation, and radius.

3. Unify the recurring surface patterns so they share one grammar:
   - popovers: AutopilotPopover, OrbitPopover
   - modals: CreateModal, ConnectionsModal
   - rails: InspectorRail, ReviewRail
   - docks: DayDock, InboxDock
   - the canvas toolbar
   Same border, blur, shadow, radius, and header treatment within each category.

4. Typography and rhythm: one type scale, consistent label/heading/body
   treatment, consistent vertical spacing inside panels.

5. Motion: audit Framer Motion usage for consistent easing and duration. Canvas
   pan/zoom and bubble pulse must stay GPU-cheap (transform/opacity only).

HARD CONSTRAINTS
- Do not change behavior, state, or store logic. Presentation only.
- `cd frontend && npm test` must pass. Many of the ~25 vitest files query by
  text, role, and aria-label — do not rename or remove those. If a test asserts
  a specific class, change the test only if the class was purely cosmetic, and
  tell me which ones.
- `cd frontend && npx tsc -b` must pass.
- Keep the accessibility work already in place: 3px :focus-visible rings on
  every interactive element, 44px minimum touch targets on mobile surfaces, the
  prefers-reduced-motion block, and WCAG AA contrast on text. Verify contrast
  after any color change.
- All user-facing strings go through i18n (`useT()` in components, bare `t` in
  store and module code) and must exist in both `en` and `de` in the correct
  fragment file. Don't introduce new literal strings.
- Preserve the responsive breakpoints already tuned in global.css: the
  769–1100px compact-desktop rail behavior and the <=768px mobile shell.
- Don't add a UI library or a CSS-in-JS dependency.

DELIVERABLE PER PHASE
A summary of what changed and why, the token diff, anything you deliberately
left alone, and confirmation that tests and typecheck pass.
```

---

## Notes on running it

- **Phase 1 is the highest-value change.** If you want one shot instead of five,
  run only phases 1 and 2 — token consolidation plus hex replacement. That is
  where the "looks unfinished" impression actually comes from.

- **Give the agent eyes if you can.** Without screenshots it is styling blind.
  With a Playwright or Chrome MCP server available, append:

  ```
  Run the app (docker compose up -d db, then both dev servers) and screenshot
  each destination before and after each phase.
  ```

  Otherwise expect to iterate on the visual result yourself.

- **CLAUDE.md is stale on testing.** It says "There is no test framework," but
  vitest is wired up (`frontend/package.json` → `npm test`) with 25+ test files.
  Worth fixing so an agent doesn't skip the test gate.

- **Reference files** the agent should read early:
  - `frontend/src/global.css` — the existing token set and all layout CSS
  - `frontend/src/components/AutopilotPopover.tsx` — the canonical popover pattern
  - `frontend/src/components/TaskCard.tsx` — the primary content surface
  - `frontend/src/components/NightCartography.tsx` — the destination wrapper
