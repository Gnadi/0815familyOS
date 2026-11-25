# Performance-Messpaket

Reproduziert die Browser-Messreihe aus `docs/performance-review-2026-11-24.md` (Abschnitt 3 und 10) gegen lokale Firebase-Emulatoren. Es werden keine Produktionsdaten oder -dienste verwendet.

## Ablauf

1. **Zwei Build-Kopien** anlegen, z. B. mit `git worktree add`: eine für den Vergleichsstand und eine für den zu prüfenden Stand. In jeder Kopie:
   - `.env.local` mit Dummy-Werten anlegen: `VITE_FIREBASE_PROJECT_ID=demo-faos-review`, `VITE_FIREBASE_API_KEY=demo-key`, übrige `VITE_FIREBASE_*` beliebig.
   - Nach `export const db = createDb();` die Zeile `connectFirestoreEmulator(db, '127.0.0.1', 8080)` ergänzen (nur im Browser, nicht bei SSR).
   - Nach `export const auth = createAuth();` die Zeile `connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })` ergänzen. Ab Commit `8a1a707` steht `auth` in `src/lib/firebaseApp.js`.
   - `npm run build` ausführen.
2. **Emulatoren starten:** `firebase emulators:start --only firestore,auth --project demo-faos-review` mit `firebase.emulators.json` als `firebase.json`, daneben `firestore.rules` und `firestore.indexes.json` aus dem Repository.
3. **Daten erzeugen:** `node seed.mjs` legt die Profile klein, mittel und groß an (84 / 1.299 / 4.304 Dokumente in den fünf Dashboard-Abfragen). `node seed-feed.mjs` legt eine kleine Familie mit zwei Kalenderabos an.
4. **Server starten:** `node server.cjs <kopie>/dist 4301` (Vergleichsstand) und `... 4302` (neuer Stand). Der Server bildet die Vercel-Rewrites und -Header aus der `vercel.json` der jeweiligen Kopie nach, sendet ohne eigene Header `max-age=0, must-revalidate` und unterstützt ETag/304 sowie gzip über HTTP/1.1. `server2.cjs` ergänzt einen Stub für `/api/ics-fetch` mit einstellbarer Verzögerung (`/__delay?ms=`).
5. **Messen:**
   - `NODE_PATH=$(npm root -g) ./series.sh`: je 6 Kaltläufe pro Profil und Version in rotierender Reihenfolge. Ergebnis in `results.ndjson`.
   - `node controls.cjs <port> feed|housekeeping|board`: die Kontrollversuche. Sie laufen gegen `server2.cjs`.

Browser-Einstellungen wie im Review: 393 × 852 CSS-Pixel, DPR 2, 4-fache CPU-Drosselung, 60 ms Latenz, 8 Mbit/s Download, 1,5 Mbit/s Upload, Service Worker blockiert, für jeden Kaltlauf ein neuer Kontext, aus dem nur der Anmeldestatus übernommen wird.

## Ergänzende Skripte (Befund 1)

- `seed-stale.mjs` legt die Familie `stale` mit Grenzfällen an: eine wöchentliche Serie, die vor einem Jahr begann, ein mehrtägiger Termin, der vor 10 Tagen begann und noch läuft, und Tracker-Einträge, die alle älter als 10 Tage sind.
- `compare.cjs` vergleicht den Dashboard-Text zwischen zwei Builds (Ports 4321/4322) für alle Testfamilien.
- `history.cjs <port> <profil> "<titel>"` misst vom Wechsel Dashboard → Kalender bis ein alter Termin über die Suche gefunden wird.
- `results-2026-11-24-bounded.ndjson` enthält die Rohdaten der Messreihe aus Abschnitt 11 (`243ef52` gegen `f17b4b6`).

## Ergänzende Skripte (Befund 2)

- `bench3.cjs`: wie `bench.cjs`, zusätzlich mit dem Messpunkt `toTasksFull`, also bis das Archiv geladen ist.
- `tasks-direct.cjs <port> <profil> <läufe> <out>`: kalter Direkteinstieg auf `/tasks`. Gemessen wird, bis alle offenen Karten angelegt sind (`tasksOpen`) und bis die Spalte „Erledigt“ die volle Anzahl zeigt (`tasksFull`).
- `compare-tasks.cjs` vergleicht den Board-Text zwischen zwei Builds: zugeklappt, aufgeklappt und mit Suche.
- `live-drag.cjs` zieht eine Aufgabe nach „Erledigt“ und zurück und protokolliert Spaltenzählung und Effizienz.
