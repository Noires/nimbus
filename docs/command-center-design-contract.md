# Command Center visual-system contract

## Scope and rollout

This contract applies only when localStorage key `nimbus:spatial-command-center-shell` is exactly `"true"`. Missing or any other value retains the legacy Canvas layout and behavior. It does not change trusted Arrange/Tidy previews, blocker links, zones, ledger, or their explicit confirmation paths.

## Information hierarchy and destinations

1. **Capture → Inbox/Triage** — capture is the visible primary action; Inbox makes the next decision explicit.
2. **Today/Focus** — a small, user-selected execution queue; no automatic scheduling.
3. **Review** — queues attention signals (overdue, blocked, stale, Inbox) without changing tasks until an explicit action.
4. **Operations** — read-only health/status overview with open/reveal actions.
5. **Canvas planning** — spatial planning remains the primary workspace; the mobile companion is operational, not a compressed Canvas editor.

Every destination has a named landmark/current state, a visible primary action, and an explicit empty/loading/error treatment. Status meaning uses a text label (and where supplied an icon) alongside color.

## Visual and responsive rules

- **Surface:** dark, layered shell with low-contrast panel borders; cards use clear separation rather than decorative density.
- **Spacing/type:** 0.25rem spacing rhythm; 44px minimum controls; compact labels and readable body text.
- **Focus/contrast:** visible 3px yellow focus outline for tutorial controls; command-center controls use visible focus rings. Motion is removed under `prefers-reduced-motion`.
- **Desktop (>1100px):** navigation, canvas, and contextual rail are simultaneously visible.
- **Compact desktop (769–1100px):** contextual rail becomes an overlay so Canvas remains usable.
- **Mobile (≤768px):** mobile Command Center provides Capture, Inbox, Today, Review, Operations, and search; it preserves the destination intent and does not embed Canvas editing.
- **Text expansion:** panels may wrap, scroll, and use flexible grid columns; no action relies on a fixed English-only width. Validate with German at desktop and 390px mobile widths.

## State and accessibility matrix

| State | Required presentation | Interaction rule |
| --- | --- | --- |
| Loading | named loading message | no implied completion |
| Empty | clear explanation plus next action | no mutation until action |
| Error/offline | text error and recovery path | preserve user input |
| Disabled/stale preview | explicit explanation | never apply stale data |
| Selected | named selected/current state | keyboard visible |
| Success | text confirmation/live status | no hidden follow-up mutation |

Dialogs provide an accessible name, modal semantics, Escape close, focus containment, and return focus. Keyboard and touch both reach every Command Center destination. The safe sample tutorial is client-only, persistently labelled, resettable, and never reads or writes productive data or sends telemetry.
