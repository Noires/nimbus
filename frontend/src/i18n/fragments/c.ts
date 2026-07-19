// Fragment C: Canvas, InboxDock, DayDock, SelectionBar, ReviewMode, FocusTimer,
// TableView, PulsePanel, Minimap, PortalNode, PortalPeek, ShareView,
// TimelapseBar, TimeAxis. Owned by sweep agent C — filled during the i18n pass.
export const enC: Record<string, string> = {
  // Canvas
  "c.canvas.zoneHint": "drag to draw a zone · Esc cancels",
  "c.canvas.shortcutHint":
    "shift+drag: select · Ctrl+K: jump · arrows: hop · N new · Z zone · L table · Y days · T/G/H lenses",
  "c.canvas.zoneLabelPrompt": "Zone label:",

  // InboxDock
  "c.inbox.title": "Inbox",
  "c.inbox.placeholder": "Capture… try: friday 2h #api !high @Bubble title",
  "c.inbox.empty": "Nothing captured. Type above, then drag cards onto the canvas to place them.",
  "c.inbox.looksLike": "Looks like:",
  "c.inbox.done": "done",
  "c.inbox.tooltip": "Quick-capture inbox (I)",
  "c.inbox.similarTooltip": "Click to jump to the existing task instead",
  "c.inbox.dragTooltip": "Drag onto the canvas to place",
  "c.inbox.captureFailed": "Capture failed",

  // DayDock
  "c.day.overdue": "overdue",
  "c.day.today": "today",
  "c.day.dueTooltip": "{count} due · {time} — click to spotlight",
  "c.day.dropTooltip": "Drop a card here to schedule it",

  // SelectionBar
  "c.selection.count": "{count} selected",
  "c.selection.complete": "Complete",
  "c.selection.snooze": "Snooze 1w",
  "c.selection.tag": "Tag",
  "c.selection.flowFill": "Flow fill",
  "c.selection.bubbleIt": "Bubble it",
  "c.selection.merge": "Merge",
  "c.selection.focus": "Focus",
  "c.selection.delete": "Delete",
  "c.selection.clear": "Esc clear",
  "c.selection.tagPlaceholder": "tag…",
  "c.selection.bubblePrompt": "Name the new bubble:",
  "c.selection.deleteConfirm": "Delete {count} tasks permanently?",
  "c.selection.bubbled": "Bubbled {count} cards",
  "c.selection.tagged": "Tagged {count} cards with #{tag}",

  // ReviewMode
  "c.review.nothing": "Nothing to review",
  "c.review.summary": "Review done — cleared {cleared}, rescheduled {rescheduled}, archived {archived}",
  "c.review.progress": "{index} of {total}",
  "c.review.done": "done",
  "c.review.archive": "archive",
  "c.review.push": "+1 week",
  "c.review.priority": "priority",
  "c.review.skip": "skip",
  "c.review.end": "Esc end",

  // FocusTimer
  "c.focus.start": "start",
  "c.focus.resume": "resume",
  "c.focus.pause": "pause",
  "c.focus.bank": "bank {minutes}m",
  "c.focus.est": "est",
  "c.focus.act": "act",
  "c.focus.session": "{index} of {total}",
  "c.focus.nextPrev": "next/prev",
  "c.focus.done": "done",
  "c.focus.edit": "edit",
  "c.focus.exit": "exit",
  "c.focus.exitTooltip": "Exit focus and restore the previous view (Esc)",
  "c.focus.banked": "Banked {minutes} on '{title}'",

  // TableView
  "c.table.title": "Ledger — {count} tasks",
  "c.table.hint": "(click a row to fly to it · L to exit)",
  "c.table.colTitle": "Title",
  "c.table.colBubble": "Bubble",
  "c.table.colDue": "Due",
  "c.table.colPriority": "Priority",
  "c.table.colEst": "Est",
  "c.table.colTags": "Tags",
  "c.table.priorityHigh": "high",
  "c.table.priorityMedium": "medium",
  "c.table.priorityLow": "low",

  // PulsePanel
  "c.pulse.title": "Canvas Pulse — 30 days",
  "c.pulse.loading": "Reading the event log…",
  "c.pulse.done7": "done last 7d",
  "c.pulse.up": "up from {count} the week before",
  "c.pulse.down": "down from {count} the week before",
  "c.pulse.flat": "flat vs the week before",
  "c.pulse.created": "Created",
  "c.pulse.vsCompleted": "vs completed",
  "c.pulse.openTasks": "Open tasks",
  "c.pulse.churn": "Churn — touches per completion",
  "c.pulse.churnLine": "{moved} touches · {completed} completions — {verdict}",
  "c.pulse.verdictNone": "Nothing finished this month — the board is only being rearranged.",
  "c.pulse.verdictHigh": "High churn: lots of shuffling per completion. Consider a review flight (W).",
  "c.pulse.verdictModerate": "Moderate churn — healthy planning, but watch it.",
  "c.pulse.verdictLow": "Low churn: most touches lead to finishes. Solid.",
  "c.pulse.bubbles": "Bubbles",
  "c.pulse.flyToBubble": "Fly to this bubble",

  // Minimap
  "c.minimap.tooltip": "Minimap — click or drag to move the view",
  "c.minimap.waypoint": "Waypoint {slot} (press {slot})",

  // PortalNode
  "c.portal.tooltip": "Portal to '{name}' — drop a card to send it · double-click to travel",
  "c.portal.removeConfirm": "Remove this portal? (Tasks are unaffected.)",

  // PortalPeek
  "c.portalPeek.peering": "peering through…",
  "c.portalPeek.emptyBoard": "empty board",
  "c.portalPeek.open": "{count} open",
  "c.portalPeek.dueThisWeek": "{count} due this week",

  // ShareView
  "c.share.loading": "Opening shared board…",
  "c.share.error": "This share link is unknown or was revoked.",
  "c.share.viewOnly": "View only",

  // TimelapseBar
  "c.timelapse.loading": "loading…",
  "c.timelapse.pause": "Pause",
  "c.timelapse.replay": "Replay the whole range",

  // TimeAxis
  "c.timeaxis.today": "Today",
  "c.timeaxis.someday": "Someday (no date)",
  "c.timeaxis.over": "over",
};

export const deC: Record<string, string> = {
  // Canvas
  "c.canvas.zoneHint": "ziehen, um eine Zone zu zeichnen · Esc bricht ab",
  "c.canvas.shortcutHint":
    "Umschalt+Ziehen: auswählen · Strg+K: springen · Pfeile: hüpfen · N neu · Z Zone · L Tabelle · Y Tage · T/G/H Linsen",
  "c.canvas.zoneLabelPrompt": "Zonenbezeichnung:",

  // InboxDock
  "c.inbox.title": "Eingang",
  "c.inbox.placeholder": "Erfassen… z. B.: friday 2h #api !high @Blase Titel",
  "c.inbox.empty": "Nichts erfasst. Oben tippen, dann Karten auf die Fläche ziehen, um sie zu platzieren.",
  "c.inbox.looksLike": "Sieht aus wie:",
  "c.inbox.done": "erledigt",
  "c.inbox.tooltip": "Schnellerfassung-Eingang (I)",
  "c.inbox.similarTooltip": "Klicken, um stattdessen zur vorhandenen Aufgabe zu springen",
  "c.inbox.dragTooltip": "Auf die Fläche ziehen, um zu platzieren",
  "c.inbox.captureFailed": "Erfassen fehlgeschlagen",

  // DayDock
  "c.day.overdue": "überfällig",
  "c.day.today": "heute",
  "c.day.dueTooltip": "{count} fällig · {time} — klicken zum Hervorheben",
  "c.day.dropTooltip": "Karte hier ablegen, um sie einzuplanen",

  // SelectionBar
  "c.selection.count": "{count} ausgewählt",
  "c.selection.complete": "Erledigen",
  "c.selection.snooze": "1 Woche schlummern",
  "c.selection.tag": "Tag",
  "c.selection.flowFill": "Flow-Füllung",
  "c.selection.bubbleIt": "Einblasen",
  "c.selection.merge": "Zusammenführen",
  "c.selection.focus": "Fokus",
  "c.selection.delete": "Löschen",
  "c.selection.clear": "Esc leeren",
  "c.selection.tagPlaceholder": "Tag…",
  "c.selection.bubblePrompt": "Neue Blase benennen:",
  "c.selection.deleteConfirm": "{count} Aufgaben endgültig löschen?",
  "c.selection.bubbled": "{count} Karten eingeblasen",
  "c.selection.tagged": "{count} Karten mit #{tag} versehen",

  // ReviewMode
  "c.review.nothing": "Nichts zu überprüfen",
  "c.review.summary": "Überprüfung fertig — {cleared} erledigt, {rescheduled} verschoben, {archived} archiviert",
  "c.review.progress": "{index} von {total}",
  "c.review.done": "erledigt",
  "c.review.archive": "archivieren",
  "c.review.push": "+1 Woche",
  "c.review.priority": "Priorität",
  "c.review.skip": "überspringen",
  "c.review.end": "Esc beenden",

  // FocusTimer
  "c.focus.start": "starten",
  "c.focus.resume": "fortsetzen",
  "c.focus.pause": "pausieren",
  "c.focus.bank": "{minutes}m sichern",
  "c.focus.est": "gesch.",
  "c.focus.act": "tats.",
  "c.focus.session": "{index} von {total}",
  "c.focus.nextPrev": "vor/zurück",
  "c.focus.done": "erledigt",
  "c.focus.edit": "bearbeiten",
  "c.focus.exit": "verlassen",
  "c.focus.exitTooltip": "Fokus verlassen und die vorherige Ansicht wiederherstellen (Esc)",
  "c.focus.banked": "{minutes} auf '{title}' gesichert",

  // TableView
  "c.table.title": "Verzeichnis — {count} Aufgaben",
  "c.table.hint": "(auf eine Zeile klicken, um hinzufliegen · L zum Verlassen)",
  "c.table.colTitle": "Titel",
  "c.table.colBubble": "Blase",
  "c.table.colDue": "Fällig",
  "c.table.colPriority": "Priorität",
  "c.table.colEst": "Gesch.",
  "c.table.colTags": "Tags",
  "c.table.priorityHigh": "hoch",
  "c.table.priorityMedium": "mittel",
  "c.table.priorityLow": "niedrig",

  // PulsePanel
  "c.pulse.title": "Flächen-Puls — 30 Tage",
  "c.pulse.loading": "Ereignisprotokoll wird gelesen…",
  "c.pulse.done7": "erledigt in den letzten 7 T",
  "c.pulse.up": "mehr als {count} in der Vorwoche",
  "c.pulse.down": "weniger als {count} in der Vorwoche",
  "c.pulse.flat": "gleich wie in der Vorwoche",
  "c.pulse.created": "Erstellt",
  "c.pulse.vsCompleted": "gegen abgeschlossen",
  "c.pulse.openTasks": "Offene Aufgaben",
  "c.pulse.churn": "Umschlag — Berührungen pro Abschluss",
  "c.pulse.churnLine": "{moved} Berührungen · {completed} Abschlüsse — {verdict}",
  "c.pulse.verdictNone": "Diesen Monat nichts fertiggestellt — die Fläche wird nur umgeräumt.",
  "c.pulse.verdictHigh": "Hoher Umschlag: viel Umherschieben pro Abschluss. Erwäge einen Überprüfungsflug (W).",
  "c.pulse.verdictModerate": "Mäßiger Umschlag — gesunde Planung, aber im Blick behalten.",
  "c.pulse.verdictLow": "Geringer Umschlag: die meisten Berührungen führen zu Abschlüssen. Solide.",
  "c.pulse.bubbles": "Blasen",
  "c.pulse.flyToBubble": "Zu dieser Blase fliegen",

  // Minimap
  "c.minimap.tooltip": "Minikarte — klicken oder ziehen, um die Ansicht zu bewegen",
  "c.minimap.waypoint": "Wegpunkt {slot} ({slot} drücken)",

  // PortalNode
  "c.portal.tooltip": "Portal zu '{name}' — Karte ablegen, um sie zu senden · Doppelklick zum Reisen",
  "c.portal.removeConfirm": "Dieses Portal entfernen? (Aufgaben bleiben unberührt.)",

  // PortalPeek
  "c.portalPeek.peering": "hindurchschauen…",
  "c.portalPeek.emptyBoard": "leere Fläche",
  "c.portalPeek.open": "{count} offen",
  "c.portalPeek.dueThisWeek": "{count} diese Woche fällig",

  // ShareView
  "c.share.loading": "Geteilte Fläche wird geöffnet…",
  "c.share.error": "Dieser Freigabelink ist unbekannt oder wurde widerrufen.",
  "c.share.viewOnly": "Nur Ansicht",

  // TimelapseBar
  "c.timelapse.loading": "lädt…",
  "c.timelapse.pause": "Pausieren",
  "c.timelapse.replay": "Den gesamten Zeitraum abspielen",

  // TimeAxis
  "c.timeaxis.today": "Heute",
  "c.timeaxis.someday": "Irgendwann (kein Datum)",
  "c.timeaxis.over": "drüber",
};
