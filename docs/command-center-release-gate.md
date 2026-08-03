# Command Center accessibility release gate / Accessibility-Release-Gate

**Scope / Umfang:** universal Command Center. Record the release candidate build, browser/OS, viewport, canvas ID, and tester for every run. Mark each box **Pass / Fail / N/A**; a failure is a no-go unless Product Owner accepts it in writing.

## 1. Preflight / Vorabprüfung

- [ ] **EN:** Start from a clean checkout of the release candidate; record commit SHA and `git status --short`.
  **DE:** Mit einem sauberen Checkout des Release Candidates starten; Commit-SHA und `git status --short` protokollieren.
- [ ] **EN:** Use a seeded canvas containing at least two overlapping, selectable tasks plus an Inbox task. Test English and German once each.
  **DE:** Ein geseedetes Canvas mit mindestens zwei überlappenden, auswählbaren Aufgaben sowie einer Inbox-Aufgabe verwenden. Englisch und Deutsch jeweils einmal testen.
- [ ] **EN:** Test desktop at a width above 768 px and mobile at 768 px or below; record exact viewport/device.
  **DE:** Desktop bei mehr als 768 px und Mobil bei 768 px oder weniger testen; exakten Viewport/das Gerät notieren.

## 2. Universal availability / Universelle Verfügbarkeit

- [ ] **EN:** In a fresh browser profile, load a desktop Canvas and verify the Command Center shell and **Tidy selected** are available without local configuration.
  **DE:** In einem frischen Browserprofil ein Desktop-Canvas laden und prüfen, dass die Command-Center-Shell und **Auswahl aufräumen** ohne lokale Konfiguration verfügbar sind.
- [ ] **EN:** At 768 px or below, verify Mobile command center is available without local configuration.
  **DE:** Bei 768 px oder weniger prüfen, dass Mobiles Command Center ohne lokale Konfiguration verfügbar ist.
- [ ] **EN:** If a browser retains a stale rollout-flag value, reload and verify the same Command Center is shown; the value must not be read, replaced, or cause an error.
  **DE:** Wenn ein Browser einen veralteten Rollout-Flag-Wert behält, neu laden und prüfen, dass dasselbe Command Center gezeigt wird; der Wert darf nicht gelesen, ersetzt oder einen Fehler verursachen.

## 3. Desktop keyboard and focus / Desktop: Tastatur und Fokus

- [ ] **EN:** Use only keyboard navigation to reach navigation, global commands, canvas, and contextual rail; each visible focus indicator is perceivable and focus order is logical.
  **DE:** Ausschließlich mit der Tastatur Navigation, globale Befehle, Canvas und Kontextleiste erreichen; jeder sichtbare Fokusindikator ist erkennbar und die Fokusreihenfolge ist logisch.
- [ ] **EN:** Open the command palette with `Ctrl+K`; its search field receives focus. Use Arrow Up/Down and Enter to choose a result; press Escape to close. Focus returns to the opener (or canvas fallback) and does not disappear.
  **DE:** Die Befehlspalette mit `Strg+K` öffnen; das Suchfeld erhält Fokus. Mit Pfeil hoch/runter und Enter ein Ergebnis wählen; mit Escape schließen. Der Fokus kehrt zum Auslöser (oder Canvas-Fallback) zurück und geht nicht verloren.
- [ ] **EN:** In the open palette, Tab and Shift+Tab wrap within the modal; background controls are not reached by keyboard.
  **DE:** In der geöffneten Palette umschließen Tab und Umschalt+Tab den Modalinhalt; Hintergrund-Steuerelemente sind per Tastatur nicht erreichbar.

## 4. Mobile command center / Mobiles Command Center

At 768 px or below, open **Mobile command center** and complete all destinations:

- [ ] **EN — Capture:** Capture a non-empty task; it enters Inbox. Submit blank text; no task is created. Simulate or induce a failed request if feasible; input remains and an error is announced.
  **DE — Erfassen:** Eine nicht leere Aufgabe erfassen; sie landet in der Inbox. Leeren Text absenden; es wird keine Aufgabe erstellt. Wenn möglich einen fehlgeschlagenen Request simulieren oder auslösen; die Eingabe bleibt erhalten und ein Fehler wird angekündigt.
- [ ] **EN — Inbox:** Open Inbox, change priority/workstream or clear an Inbox task, then open its inspector and return to Inbox.
  **DE — Inbox:** Inbox öffnen, Priorität/Arbeitsstrom ändern oder eine Inbox-Aufgabe entfernen, dann deren Inspector öffnen und zur Inbox zurückkehren.
- [ ] **EN — Today:** Open Today, complete or return a task to Inbox, and verify the update is reflected.
  **DE — Heute:** Heute öffnen, eine Aufgabe abschließen oder in die Inbox zurückgeben und prüfen, dass die Änderung übernommen wurde.
- [ ] **EN — Review:** Open Review; exercise one available queue action (complete, reveal, focus, Today, or Inbox) and verify its destination/result.
  **DE — Rückblick:** Rückblick öffnen; eine verfügbare Warteschlangenaktion (abschließen, zeigen, fokussieren, Heute oder Inbox) ausführen und Ziel/Ergebnis prüfen.
- [ ] **EN — Search:** Open **More**, search for a known task, open it in Inspector, return, then use **Reveal** and verify the command center closes and the canvas targets that task.
  **DE — Suche:** **Mehr** öffnen, nach einer bekannten Aufgabe suchen, sie im Inspector öffnen, zurückkehren, dann **Anzeigen** verwenden und prüfen, dass das Command Center schließt und das Canvas die Aufgabe ansteuert.
- [ ] **EN:** Verify the current destination has an announced current-page state and Close returns to the canvas.
  **DE:** Prüfen, dass das aktuelle Ziel als aktuelle Seite angekündigt wird und Schließen zum Canvas zurückkehrt.

## 5. Selected Tidy / Auswahl aufräumen

- [ ] **EN:** Select two or more overlapping tasks, choose **Tidy selected**, and verify only a preview appears: moved/unchanged/skipped counts and any skip reasons are readable; no task is persisted or moved before Apply.
  **DE:** Zwei oder mehr überlappende Aufgaben auswählen, **Auswahl aufräumen** wählen und prüfen, dass nur eine Vorschau erscheint: Anzahl verschoben/unverändert/übersprungen sowie Überspring-Gründe sind lesbar; vor Anwenden wird keine Aufgabe gespeichert oder verschoben.
- [ ] **EN:** Cancel the preview; verify no position changes. Create a new preview, Apply once, verify the expected movement, then use Undo once and verify the complete tidy operation is reverted as one action.
  **DE:** Die Vorschau abbrechen; prüfen, dass sich keine Position ändert. Eine neue Vorschau erstellen, einmal Anwenden, die erwartete Verschiebung prüfen und dann einmal Rückgängig wählen; der vollständige Aufräumvorgang muss als eine Aktion zurückgesetzt werden.
- [ ] **EN — stale case:** After previewing, change the selection or modify a previewed task from another tab/session, then attempt Apply. The stale preview must not overwrite newer state; refresh/re-preview and apply only the current result. Record the displayed feedback.
  **DE — veralteter Fall:** Nach der Vorschau die Auswahl ändern oder eine vorgeschlagene Aufgabe in einem anderen Tab/einer anderen Sitzung ändern und dann Anwenden versuchen. Die veraltete Vorschau darf keinen neueren Stand überschreiben; aktualisieren/neu vorschauen und nur das aktuelle Ergebnis anwenden. Angezeigtes Feedback protokollieren.

## 6. Accessibility names, dialogs, and focus / Accessibility-Namen, Dialoge und Fokus

- [ ] **EN:** With a screen reader or browser accessibility tree, verify meaningful accessible names for shell landmarks, Mobile command center, Close, task search, task results, Inbox triage/tasks, Today and Focus, Weekly review, Inspector, Canvas, and selected-action buttons.
  **DE:** Mit Screenreader oder Browser-Accessibility-Tree sinnvolle zugängliche Namen für Shell-Landmarks, Mobiles Command Center, Schließen, Aufgabensuche, Suchergebnisse, Inbox-Triage/-Aufgaben, Heute und Fokus, Wochenrückblick, Inspector, Canvas und Auswahl-Aktionsbuttons prüfen.
- [ ] **EN:** Verify the command palette exposes a modal dialog name, `aria-modal`, initial focus, Escape close, and focus restoration. Verify Capture automatically focuses its input, errors use an alert, and selection/Tidy status is announced politely.
  **DE:** Prüfen, dass die Befehlspalette einen benannten modalen Dialog, `aria-modal`, Initialfokus, Escape zum Schließen und Fokuswiederherstellung bietet. Prüfen, dass Erfassen das Eingabefeld automatisch fokussiert, Fehler als Alert ausgegeben werden und Auswahl-/Aufräumstatus höflich angekündigt wird.

## 7. Build, Docker smoke, and release commands / Build-, Docker-Smoke- und Release-Befehle

Run from the repository root and save complete output with the evidence:

```bash
npm ci
npm run test
cd frontend && npm run build && cd ..
cd server && npx tsc --noEmit && cd ..
npm run docker:smoke
```

**EN:** For deployment, set a non-empty `POSTGRES_PASSWORD` in the deployment environment, then run `npm run docker:up` and wait for `docker compose ps` to report healthy `db` and `server` (and successful `migrate`). Smoke only runs on a temporary local stack and is not a production deployment.

**DE:** Für das Deployment in der Deployment-Umgebung ein nicht leeres `POSTGRES_PASSWORD` setzen, dann `npm run docker:up` ausführen und warten, bis `docker compose ps` für `db` und `server` healthy (und für `migrate` erfolgreich) meldet. Der Smoke-Test läuft nur gegen einen temporären lokalen Stack und ist kein Produktionsdeployment.

## 8. Evidence and decision / Nachweise und Entscheidung

- [ ] **EN:** Attach console/test output, Docker-smoke output, viewport/device/browser/OS, commit SHA, and screenshots or short recordings proving universal Command Center availability in a fresh browser profile and with a stale retired rollout value, keyboard palette focus restoration, each mobile destination, Tidy preview/cancel/apply/undo/stale case, and accessibility-tree/screen-reader checks. Redact task content or identifiers if required.
  **DE:** Konsolen-/Testausgabe, Docker-Smoke-Ausgabe, Viewport/Gerät/Browser/OS, Commit-SHA sowie Screenshots oder kurze Aufzeichnungen als Nachweis für die universelle Command-Center-Verfügbarkeit in einem frischen Browserprofil und mit einem veralteten Rollout-Wert, Tastatur-Paletten-Fokuswiederherstellung, jedes mobile Ziel, Aufräumen-Vorschau/Abbruch/Anwenden/Rückgängig/veralteter Fall und Accessibility-Tree-/Screenreader-Prüfungen anhängen. Aufgabeninhalte oder Kennungen bei Bedarf schwärzen.
- [ ] **GO / FREIGABE:** **EN:** Every applicable item passes, required evidence is attached, and there are no unresolved blocking accessibility, data-loss, rollback, build, or smoke failures. **DE:** Jeder zutreffende Punkt besteht, die erforderlichen Nachweise sind angehängt und es gibt keine ungelösten blockierenden Accessibility-, Datenverlust-, Rollback-, Build- oder Smoke-Fehler.
- [ ] **NO-GO / KEINE FREIGABE:** **EN:** Any applicable item fails, evidence is missing, an accessibility name/dialog/focus failure remains, Tidy can persist before Apply or overwrite newer data, rollback fails, or build/smoke fails. Escalate to the Product Owner only for an explicit, recorded risk acceptance. **DE:** Jeder fehlgeschlagene zutreffende Punkt, fehlende Nachweise, ein verbleibender Fehler bei zugänglichem Namen/Dialog/Fokus, vor Anwenden gespeichertes Aufräumen oder Überschreiben neuerer Daten, fehlgeschlagener Rollback oder fehlgeschlagener Build/Smoke ist ein No-Go. Nur mit ausdrücklich dokumentierter Risikoakzeptanz an den Product Owner eskalieren.
