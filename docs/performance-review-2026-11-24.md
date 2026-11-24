# Performance-Review für den Kundenrollout von 0815familyOS

**24. November 2026 · myFAOS · Prüfstand `main`, Commit `243ef52845c9cd0728384aef23b2ac7d7cbb0218`**

> **Ergänzt am 24. November 2026 nach einer Code-Review.** Alle sechs Befunde wurden im Quellcode nachvollzogen und bestätigt. Präzisierungen stehen als *Ergänzung* direkt bei den Befunden. Abschnitt 8 enthält Befunde, die mit dem Messaufbau (lokaler HTTP/1.1-Server, deaktivierter Service Worker) strukturell nicht sichtbar waren. Abschnitt 9 dokumentiert die umgesetzten Änderungen. Die Messwerte in den Abschnitten 3 und 5 beziehen sich weiterhin auf den ursprünglichen Commit und müssen nach den Änderungen neu erhoben werden.

**Entscheidung. Den breiten Rollout zurückstellen.** Ein begleiteter Pilot mit wenigen neu angelegten Familien ist unter den unten genannten Bedingungen vertretbar. Schon eine einzelne Familie mit gewachsener Historie überschreitet im mobilen Labortest das Ziel für die Startzeit. Die dringendsten Änderungen betreffen die Datenmenge des Dashboards und die Zahl der Aufgabenkarten, die der Browser beim Öffnen anlegt. Mehr Infrastruktur allein würde die Arbeit im Browser kaum reduzieren. [Geprüfter Quellstand](https://github.com/Gnadi/0815familyOS/tree/243ef52845c9cd0728384aef23b2ac7d7cbb0218)

## 1. Vorab festgelegter Prüfplan

1. Den Release-Kandidaten fixieren, den Produktionsbuild aus dem Lockfile erstellen und von der öffentlich sichtbaren Startseite bis zum angemeldeten Datenzugriff prüfen.
2. Vor der Messung als vorläufige Produktziele festlegen: Dashboard mit Familiendaten bei p95 innerhalb von **3,0 s**, sichtbare Reaktion auf eine Kalenderaktion bei p95 innerhalb von **500 ms**. Für den Datenzugriff zusätzlich prüfen, ob die Arbeit für die heutige Ansicht mit einer längeren Historie wächst. Die Ziele sind Review-Annahmen. Kunden-SLAs und eine Lastprognose wurden nicht vorgegeben.
3. Mit identischer Familienstruktur drei Datenbestände vergleichen. Kaltstart, Wiederaufruf, Navigation und Änderungen aus einer zweiten Sitzung getrennt betrachten. Einen langsamen Kalenderanbieter als eigenen Fall testen.
4. Die Zahl gleichzeitig startender Clients unabhängig vom Datenalter variieren. Messungen mit Codepfaden, Build-Artefakten und den dokumentierten Grenzen externer Dienste abgleichen.
5. Über Pilot und breite Freigabe getrennt entscheiden. Offene Produktionsnachweise und eine prüfbare Abnahme je kritischem Befund festhalten.

## 2. Messaufbau und Aussagekraft

**Geprüft wurde der angemeldete Produktpfad.** Ein echter Chromium-Prozess bediente den Produktionsbuild mit dem Web-SDK, lokalen Auth- und Firestore-Emulatoren und den Firestore-Regeln des Repositories. Die synthetischen Konten meldeten sich zunächst über das Loginformular an. Für die Zeitmessungen wurde nur der Anmeldestatus übernommen. Jeder Kaltlauf begann mit einem neuen Browserkontext ohne HTTP- und Firestore-Datencache. Der Warmwert ist ein direkter Reload desselben Kontexts. Die App lief außerhalb des eingebauten Demomodus.

| Einstellung | Ausführung |
|---|---|
| Build | Node 24.22.3, npm 11.19.1, `npm ci`, `npm run build`. SSG für Landingpage und Rechtstexte, eigener HTML-Einstieg für geschützte Routen. 482 von 482 Unit-Tests in 23 Dateien bestanden. |
| Firebase | Lokales Projekt `demo-faos-review`, Firebase SDK 12.19.0, Firestore-Emulator 1.22.0, Firebase CLI 15.34.2, Java 21. Dummy-Konfiguration. Eine isolierte Build-Kopie setzt nur Firestore-Host und TLS für Loopback. Auth nutzt den Emulator. Der öffentliche Kontrolllauf verwendet den unveränderten Quellstand. |
| Browser und Transport | Chromium Headless Shell 153.0.8010.0, Playwright 1.62.0, 393 × 852 CSS-Pixel, DPR 2, 4-fache CPU-Drosselung. CDP-Netzprofil mit 60 ms konfigurierter Latenz, 8 Mbit/s Download und 1,5 Mbit/s Upload. Lokaler HTTP/1.1-Server mit gzip. Sprache Englisch, Zeitzone Wien. |
| Wiederholungen | Je sechs unabhängige Kaltläufe pro Datenprofil in rotierender Reihenfolge. Je ein Warmstart und dieselbe Folge von Routenwechseln pro Lauf. In der Hauptserie war der Service Worker deaktiviert, damit sein eigener Cache den Vergleich nicht verändert. Ein separater Lauf prüfte den aktivierten Service Worker. |
| Endpunkte der Messung | Dashboard ab Navigationsbeginn, bis der heutige Termin, die heutige Aufgabe, der Tracker- und der Gesundheitsbereich im DOM vorhanden waren, plus zwei Animationsframes. Kalender bis Wochenansicht mit heutigem Termin, Monatswechsel bis gerendertem Monatsraster, Board bis alle erwarteten Karten angelegt waren. Die Klickmessung beginnt beim Auslösen des DOM-Klicks. |
| Statistik | Median und, wo angegeben, Minimum–Maximum. Sechs Läufe reichen, um große Unterschiede zu erkennen. Ein belastbares Feld-p95 erfordert mehr reale Sitzungen. Ein DOM-/Frame-Messpunkt ist ein Näherungswert für die Nutzbarkeit und umfasst keine Eingabe vor der Klickzustellung. |
| Grenzen | Keine Produktionsdaten oder Kundenkonten, keine Vercel-/Cloudinary-Live-Last und kein physisches Mobilgerät. Emulatorlatenz, HTTP/1.1, synthetisches CPU-Profil, Emulator-Hinweisbanner und der verfügbare Rechner beeinflussen absolute Zeiten. Ein echter CDN-/HTTP/2- oder HTTP/3-Pfad kann abweichen. |

Alle Familien haben **zwei Mitgliedskonten, zwei Kinder, drei gemeinsame Tracker und einen Impfeintrag**. Pro Profil gibt es genau einen Termin heute und eine für heute geplante Aufgabe. Ältere Termine sind Einzeltermine an aufeinanderfolgenden Tagen. 90 % der Aufgaben sind erledigt. Für Tracker wird alle sechs Stunden ein Eintrag angelegt. Die drei Größen sind bewusst gewählte Testprofile. Ihre Häufigkeit bei Kunden ist unbekannt.

| Profil | Termine | Aufgaben | Tracker-Einträge | Dokumente aus fünf Dashboard-Abfragen |
|---|---:|---:|---:|---:|
| Klein | 30 | 20 | 30 | 84 |
| Mittel | 365 | 200 | 730 | 1.299 |
| Groß | 1.200 | 600 | 2.500 | 4.304 |

Die fünf Abfragen betreffen Termine, Aufgaben, Tracker-Definitionen, Tracker-Einträge und Impfungen. Nutzer- und Familiendokumente, Mitgliedsprofile sowie mögliche Regel- oder Wartungszugriffe kommen hinzu. Die Fixture enthält kurze Texte und keine Anhänge, Serien, Zusatzfelder für erledigte Aufgaben oder Feed-Ereignisse. Für externe Kalender gibt es einen eigenen Lauf.

## 3. Ergebnisse im Browser

| Messpunkt | Kleine Familie | Mittlere Familie | Große Familie |
|---|---:|---:|---:|
| Dashboard kalt · Median | 2,51 s | 6,33 s | 16,15 s |
| Dashboard kalt · Spanne | 2,32–2,84 s | 5,65–6,81 s | 14,99–18,34 s |
| Dashboard warm · Median | 1,26 s | 2,12 s | 3,86 s |
| Dashboard → Kalender mit Tagesereignis · Median | 311 ms | 288 ms | 436 ms |
| Woche → Monatsraster · Median | 70 ms | 58 ms | 57 ms |
| Kalender → Aufgabenboard · Median | 0,54 s | 3,11 s | 9,70 s |
| Kalender → Aufgabenboard · Spanne | 0,35–0,60 s | 2,85–3,69 s | 4,62–11,14 s |
| DOM-Elemente beim Board-Messpunkt | 814 | 5.397 | 15.677 |

**Alle sechs Kaltstarts** des kleinen Profils blieben unter drei Sekunden. Im mittleren und großen Profil überschritten **alle zwölf Kaltstarts** das Ziel. Auch alle sechs Warmstarts der großen Familie dauerten länger als drei Sekunden. Der Wechsel vom Dashboard in den großen Kalender lag in drei von sechs Durchgängen über 500 ms (bis 1.080 ms). Die Umschaltung in die Monatsansicht blieb bei allen Profilen unter 100 ms. Das trennt den Aufwand beim Bereitstellen der Daten vom Wechsel der bereits versorgten Ansicht.

**Öffentlicher Einstieg und PWA.** Die Landingpage am Originalbuild erreichte bei fünf frischen Aufrufen einen LCP-Median von **540 ms** (524–632 ms). Das größte Element war jeweils das Dashboard-Bild. Im beobachteten Zeitfenster ergab sich ein CLS von 0. Bis 1,7 s nach dem Load-Ereignis wurden 343.234 Byte komprimiertes JavaScript aus sieben Asset-Requests erfasst. Mit aktivem und vor dem Reload nachweislich steuerndem Service Worker ergab ein separater Kontrolllauf **2,83 s kalt / 1,27 s warm** für das kleine und **15,52 s kalt / 3,78 s warm** für das große Profil. Ein Einzelpaar je Profil erlaubt eine Plausibilitätskontrolle. Die große Differenz zwischen öffentlicher Startseite und angemeldeter Ansicht ist für die Freigabe wesentlich. Die öffentliche Seite kann bereits aus vorgerendertem HTML erscheinen, während die Arbeitsansicht auf mehrere Datenquellen wartet. Feld-INP wurde nicht ermittelt. Für Feldmessungen gelten als etablierte Orientierungswerte LCP ≤ 2,5 s, INP ≤ 200 ms und CLS ≤ 0,1, jeweils bei p75 getrennt nach Mobil- und Desktopnutzung. [Google Web Vitals](https://web.dev/articles/vitals)

## 4. Priorisierte Befunde

### 1 · Hoch · Das Dashboard lädt die Historie einer Familie für eine Tagesübersicht

Der gemeinsame Event-Listener beschränkt sich auf `familyId` und sortiert nach Datum. Aufgaben, Tracker-Einträge und Impfungen verwenden ebenfalls familienweite Abfragen. Der vorhandene Index erlaubt die Sortierung, begrenzt aber die Ergebnismenge nicht. Die Tages- und Wochenansicht wählen die benötigten Einträge erst im Browser aus. Der Tracker-Bereich zeigt höchstens vier Zeilen. Für die Berechnung filtert und sortiert er die Historie je Kind und Tracker erneut, auch beim 30-Sekunden-Takt. Ein neuer Snapshot wird aus `snap.docs` erneut verarbeitet. Das beschreibt lokale CPU-Arbeit. Bei einem laufenden Listener wird dadurch nicht automatisch jedes Dokument erneut über das Netz übertragen. [Termine](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/events.js#L111) · [Aufgaben](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/tasks.js#L57) · [Tracker-Abfragen](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/trackers.js#L75) · [Tracker-Widget](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/dashboard/ActiveTrackers.jsx#L37) · [Statusberechnung](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/utils/tracker.js#L79) · [Impfungen](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/vaccinations.js#L63)

**Auswirkung.** Für weitgehend unveränderten sichtbaren Tagesinhalt wächst die Ergebnismenge im großen Profil auf das 51-Fache des kleinen. Das mittlere Profil überschreitet das Startbudget bereits bei einer einzelnen Sitzung. Einen Teil der Kosten verdeckt der lokale IndexedDB-Cache bei unmittelbar wiederkehrenden Nutzern. Beim initialen Aufbau sendet Firestore die vollständige passende Ergebnismenge. Bei aktivierter Offline-Persistenz kann eine Unterbrechung von mehr als 30 Minuten für die Abrechnung wieder wie eine neue Abfrage behandelt werden. [Firestore-Listener](https://firebase.google.com/docs/firestore/real-time_queries_at_scale) · [Abrechnung](https://firebase.google.com/docs/firestore/pricing)

**Änderung und Abnahme.** Für die Tagesansicht fällige/offene Aufgaben und ein begrenztes Terminfenster abonnieren. Mehrtagestermine, alte Serienmaster und deren Ausnahmen gesondert berücksichtigen, damit laufende Serien und über Mitternacht reichende Termine erhalten bleiben. Für Tracker letzte Erfassung und Tageswerte pro Kind/Tracker bereitstellen, die Historie bei Nachfrage seitenweise laden. Gleichzeitige Einträge, Änderungen, Löschungen und rückdatierte Erfassungen gehören in den Vergleichstest. Als technisches Ziel bei identischem Tagesinhalt höchstens 10 % zusätzliche Ergebnisdokumente gegenüber dem kleinen Profil zulassen. Die gewachsene Familie muss zusätzlich das 3-s-Nutzbarkeitsziel erreichen.

*Ergänzung.* Ein Teil der 16 s im großen Profil ist wahrscheinlich lokale CPU-Arbeit und kein Netztransfer. `trackerStatus` filtert und sortiert für jede Kombination aus Kind und Tracker die gesamte Eintragsliste. Bei 2 Kindern, 3 Trackern und 2.500 Einträgen sind das sechs Durchläufe mit Sortierung, alle 30 s und bei jedem Snapshot. Unter 4-facher CPU-Drosselung wiegt das schwer. Der Bericht trennt Netz- und CPU-Anteil nicht. Für die Wiederholungsmessung einen Performance-Trace mit Long Tasks (> 50 ms) je Profil erfassen. Unabhängig davon lädt nur der Termin-Listener geteilt. Aufgaben, Tracker, Rezepte, Mahlzeiten und Einkauf bauen bei jedem Seitenwechsel einen neuen Listener auf. Außerdem liest `useFamilyMembers` jedes Mitglied einzeln und ohne Cache. [Tracker-Status](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/utils/tracker.js#L79) · [Mitglieder](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/hooks/useFamilyMembers.js#L23)

### 2 · Hoch · Das Aufgabenboard baut auch das gesamte Archiv beim Öffnen auf

Alle vier Statusspalten sind standardmäßig ausgeklappt. Jede passende Aufgabe erhält eine Karte mit Drag-and-drop-Anbindung. Die Datenquelle lädt auch erledigte Aufgaben vollständig und sortiert sie auf dem Client. Bei 600 Aufgaben entstehen im Versuch mehr als 15.000 DOM-Elemente auf der Seite. Die Board-Messung bildet den kombinierten Aufwand von Datenbereitstellung, JavaScript, React und Browser-Layout ab. Die jeweilige Zeit einzelner Phasen wurde nicht getrennt gemessen.

**Kontrollversuch mit bereits geladenen Daten.** Auf demselben Board mit 600 Aufgaben wurde nur die Spalte mit 540 erledigten Aufgaben geschlossen und wieder geöffnet. Die Zahl der DOM-Elemente stieg von **1.747 auf 16.868**. Das erneute Öffnen dauerte in vier Wiederholungen **1,02–2,42 s**, Median **1,76 s**. Dafür war keine neue Aufgabenabfrage nötig. Die Elementzahl wurde in diesem Kontrollversuch nach der initialen Stabilisierung erfasst und kann vom früheren Messpunkt beim Routenwechsel abweichen. [Board](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/pages/TasksPage.jsx#L137) · [Statusspalten](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/tasks/ColumnSection.jsx#L16) · [Karten](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/tasks/TaskCard.jsx) · [Datendienst](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/tasks.js#L57)

**Änderung und Abnahme.** Offene Aufgaben zuerst anzeigen, erledigte Aufgaben als Anzahl zusammenfassen und das Archiv seitenweise öffnen. Umfangreiche offene Spalten bei Bedarf virtualisieren. Für Kennzahlen auf dem Board gesonderte Aggregationen oder begrenzte Eingaben vorsehen. Als vorgeschlagenes Abnahmekriterium gilt der Klick bis zur bedienbaren ersten Aufgabenliste bei p95 ≤ 1 s im großen Profil. Archivsuche und Drag-and-drop müssen weiterhin funktionieren. Performance-Test bei konstanten offenen Aufgaben mit 0, 200 und 600 zusätzlichen erledigten Aufgaben wiederholen.

*Ergänzung.* Das Board legt nicht nur viele Elemente an, es rendert sie auch oft neu. Jede der vier Spalten filtert bei jedem Render die *gesamte* Aufgabenliste und berechnet ihre Zusammenfassung neu. `TaskCard` ist nicht memoisiert. Damit rendert jeder Tastendruck in der Aufgabensuche und jeder Drag-Start alle Karten neu, auch die 540 erledigten. Das betrifft INP, das der Bericht nicht gemessen hat. Für die Abnahme zusätzlich messen: Eingabe in die Aufgabensuche im großen Profil, INP ≤ 200 ms. [Spaltenfilter](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/tasks/ColumnSection.jsx#L27)

### 3 · Hoch für Familien mit Kalenderabos · Ein langsamer Anbieter verzögert auch die eigenen Termine

Bei einem über 30 Minuten alten Feedcache wartet `loadFeed` vor der Rückgabe auf den Netzwerkversuch. `loadAllFeeds` sammelt anschließend alle Abos mit `Promise.allSettled`. Der Hook verknüpft den Ladezustand der Familienereignisse und der Abos. Währenddessen verwenden Kalender sowie Tages- und Wochenvorschau einen Ladezustand. Ein frischer Cache, ETag/Last-Modified und das Teilen laufender Anfragen sind bereits vorhanden. [Feed laden](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/calendarFeeds.js#L152) · [Alle Feeds](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/calendarFeeds.js#L219) · [Zusammengeführter Status](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/hooks/useEvents.js#L192) · [Kalenderansicht](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/pages/CalendarPage.jsx#L318)

**Kontrollversuch.** Eine angemeldete kleine Familie hatte zwei Abos mit veraltetem Cache. Beide lokalen Proxyantworten meldeten „unverändert“. Ab dem Request des variierten Feeds dauerte es im Median **57 ms**, bis der eigene heutige Termin bei abgeschlossenem Laden sichtbar war. Bei genau 2.500 ms künstlicher Verzögerung waren es **2.563 ms** (je drei Läufe, Browser ohne CPU-/Netzdrosselung). Der Versuch isoliert die Auswirkung des Wartens im Client. Die Dauer realer Google-, iCloud- oder Schulkalenderabrufe bleibt offen.

**Änderung und Abnahme.** Eigene Termine und frische oder veraltete Cache-Daten sofort anzeigen, Aktualisierungen und Fehler je Abo einblenden. Eine absichtlich um zehn Sekunden verzögerte Aboantwort darf die Anzeige eigener Termine gegenüber dem Lauf ohne Abo höchstens um 200 ms verschieben. Zusätzlich die Antwortgröße prüfen: Der Proxy akzeptiert bis zu 8 MiB und sendet den ICS-Text in einer gepufferten JSON-Antwort. Vercel dokumentiert für nicht gestreamte Antworten ein Limit von 4,5 MB. Ein ausreichend großer, noch vom Code akzeptierter Feed kann daher beim Hosting scheitern. *Ergänzung:* Da der ICS-Text als JSON-String übertragen wird, werden Zeilenumbrüche und Anführungszeichen escaped. Die tatsächliche Grenze liegt deshalb spürbar unter 4,5 MB Rohtext.

*Ergänzung zum Kalender.* Der Kommentar in `calendarFeeds.js` verspricht ausdrücklich „sofort aus dem Cache, Aktualisierung im Hintergrund“, der Code wartet aber. Zwei weitere Kalenderkosten fallen auch ohne Abos an. Erstens setzt `useEvents` bei jedem Kalenderaufruf und jedem Sync kurz `loading: true`, auch wenn das Ergebnis schon im Speicher liegt. Das Raster wird dadurch jedes Mal neu aufgebaut. Das erklärt plausibel einen Teil der Ausreißer bis 1.080 ms beim Wechsel vom Dashboard in den Kalender. Zweitens sind zwei Ereignisformulare dauerhaft gemountet, eines in der App-Shell und eines in der Kalenderseite. Jedes hält eine eigene `useEvents`-Instanz und rechnet bei jedem Snapshot mit. Die Kalendersuche läuft ohne Verzögerung bei jedem Tastendruck und expandiert passende Serien über ±365 Tage. [Ladezustand](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/hooks/useEvents.js#L164) · [Suche](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/utils/eventSearch.js#L21) [Proxy](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/api/ics-fetch.js#L23) · [Antwortpfad](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/api/ics-fetch.js#L100) · [Vercel-Limits](https://vercel.com/docs/functions/limitations)

### 4 · Hoch für große Tresor-Dateien · Upload-Grenze und Übertragungsverfahren passen nicht zusammen

Der Dateidialog akzeptiert zulässige Dokumenttypen bis **2 GiB**. Im verschlüsselten Pfad liest die App die gesamte Datei als ArrayBuffer, verschlüsselt sie, legt einen zusätzlichen Ausgabepuffer für IV und Chiffretext an und erstellt einen Upload-Blob. Anschließend sendet sie einen einzigen Multipart-Request direkt an Cloudinary. Cloudinary verlangt für Dateien über 100 MB einen in Teile aufgeteilten Upload. Die tatsächliche Kontogrenze kann zusätzlich niedriger sein. Damit kann eine Familie eine Datei auswählen, Wartezeit und Arbeitsspeicher investieren und erst beim Upload scheitern. Es wurde kein Cloudinary-Kundenkonto belastet. Die genaue Abbruchgröße und der Speicherhöchststand auf echten Smartphones sind offen. [Validierung und Upload](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/cloudinary.js#L7) · [Verschlüsselung](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/utils/encryption.js#L24) · [Cloudinary-Vorgaben](https://cloudinary.com/documentation/upload_images#chunked_asset_upload)

**Änderung und Abnahme.** Kurzfristig die akzeptierte Größe an die getestete Gerätegrenze und das Cloudinary-Konto anpassen. Zu große Dateien müssen vor dem vollständigen Einlesen abgewiesen werden. Falls große Dokumente Produktumfang sind, Upload, Wiederaufnahme und verschlüsselte Verarbeitung gemeinsam für große Dateien entwerfen. Grenzwert minus/plus ein Byte und Wiederherstellung nach Netzunterbrechung auf Android und iOS prüfen.

*Ergänzung.* Der Speicherbedarf ist höher als beschrieben. `encryptBlob` hält gleichzeitig den Klartext-Puffer, den Chiffretext und die zusammengesetzte Ergebniskopie im Speicher, danach entsteht der Upload-Blob. Das sind etwa das Drei- bis Vierfache der Dateigröße. Auf Smartphones ist daher ein Absturz des Tabs vor dem Upload wahrscheinlicher als ein sauberer Fehler. AES-GCM über WebCrypto verschlüsselt in einem Schritt und kann nicht streamen. Ein Entwurf für große Dateien braucht deshalb eine Aufteilung in Blöcke mit eigenem IV je Block. Die Cloudinary-Grenze für einzelne Dateien hängt vom Plan ab und liegt bei kleineren Plänen deutlich unter 100 MB.

### 5 · Mittel · Die Kalenderwartung kann auf fachfremden Routen das gesamte Archiv lesen

Vier Sekunden nach dem Laden der Familie versucht die App-Shell zwei Wartungsschritte. Ein vorhandener, fertiger Kalender-Listener ermöglicht bei bereinigten Familien einen schnellen Ausstieg. Auf einem direkten Einstieg etwa in den Einkauf ohne aktiven Event-Listener oder bei einem noch ausstehenden ersten Snapshot liefert `peekEvents` hingegen `null`. Migration und Bereinigung können dann nacheinander je ein familienweites `getDocs` ausführen. Für die Bereinigung setzt der zweite Abruf eine erfolgreiche serverseitige Familienabfrage voraus. Bei 1.200 Terminen sind in diesem Zweig bis zu **2.400 zurückgegebene Termindokumente** möglich. Das ist eine Code-Ableitung, separat vom gemessenen Dashboard. [Timer](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/layout/AppShell.jsx#L61) · [Listener-Zustand](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/hooks/useEvents.js#L70) · [Fallback und Migration](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/calendarSubscriptions.js#L144)

**Änderung und Abnahme.** Migration je Familie versionieren oder gezielt nach Legacy-Dokumenten suchen. Den normalen Einstieg von dieser Arbeit entkoppeln. Den Direkteinstieg in den Einkauf sechs Sekunden beobachten: Bei bereits migrierter Familie sollen dabei null Termindokumente für Wartungszwecke gelesen werden. Legacy-Familien in einem eigenen Migrationstest prüfen.

*Ergänzung.* Die Wartung läuft dank `tidiedThisSession` einmal pro Sitzung und Familie, nicht bei jedem Routenwechsel. Der beschriebene Worst Case bleibt richtig. Ein verwandtes Muster gibt es beim ICS-Import: Für die Duplikatprüfung liest er alle Termine der Familie. [ICS-Import](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/calendarSubscriptions.js#L304)

### 6 · Mittel · Öffentliche Seiten und der Impfpass laden verschiebbare JavaScript-Anteile

Die statisch vorgerenderte Startseite erscheint früh. Nach der Hydration importiert ihr globaler AuthProvider jedoch Auth und Firestore auch bei Besuchern ohne Anmeldung. Im unveränderten Produktionsbuild misst der App-Chunk **132,61 kB gzip**, der Firebase-Chunk **156,83 kB gzip**. Beide Zahlen verwenden dezimale kB. Für das Dashboard wurden im Emulator-Browser bis zur definierten Nutzbarkeit **394.345 Byte** komprimierte JavaScript-Response-Bodys in 37 Ressourcen erfasst. CSS, HTML, Bilddateien, Netzwerkheader und Firestore-Daten sind darin nicht enthalten. Im Impfpass steckt der statische jsPDF-Import im Routen-Bundle von **133,38 kB gzip**. Schon das Öffnen der Ansicht lädt diesen Chunk. [AuthProvider](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/context/AuthContext.jsx#L48) · [Routen](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/routes.jsx#L14) · [Impfpass](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/pages/VaccinationPage.jsx#L5)

**Änderung und Abnahme.** Den PDF-Import erst beim Export auslösen. Bei Änderungen am öffentlichen Einstieg die automatische Rückkehr angemeldeter Nutzer und Einladungen mitprüfen. Komprimierte Route-Größen im Build und die tatsächlich angeforderten Ressourcen im Browser verfolgen. Dies folgt in der Priorität auf Dashboard und Board.

## 5. Parallelität, Schreibpfad und Mengenplanung

Fünf parallele Query-Listener je unabhängigem SDK-Client entsprachen den fünf fachlichen Dashboard-Abfragen der mittleren Familie. Alle Clients griffen mit derselben synthetischen Mitgliedsidentität auf dieselbe Familie zu. Gemessen wurde bis zum ersten vom Emulator bestätigten Snapshot aller fünf Abfragen. Fünf Runden je Parallelitätsstufe, ein gesonderter Aufwärmlauf.

| Gleichzeitig gestartete Clients | Abgeschlossene Clients | Ergebnisdokumente je Startwelle | Dauer je Client, Median | Dauer je Client, Spanne |
|---:|---:|---:|---:|---:|
| 1 | 5 | 1.299 | 346 ms | 196–559 ms |
| 5 | 25 | 6.495 | 1.714 ms | 1.080–2.102 ms |
| 10 | 50 | 12.990 | 2.014 ms | 1.193–2.839 ms |

Alle **80 Clientstarts** schlossen mit der erwarteten Dokumentzahl ab. Die separaten SDK-Prüfungen der kleinen und großen Familie bestätigten 84 bzw. 4.304 Dokumente. Die Wellen zeigen, welche Datenmenge identische Startvorgänge auslösen. Der Test umfasst einen lokalen Emulator und einen gemeinsamen Node-Prozess für die Clients. Region, Produktionskapazität, Lastverteilung über viele Familien, CDN und ein längerer Dauerbetrieb bleiben offen.

**Schreibbestätigung und zweite Sitzung.** Zwei unabhängige SDK-Clients der mittleren Familie änderten bzw. beobachteten die Beschreibung eines vorhandenen Termins. Bei 15 seriellen Änderungen nach einem Aufwärmlauf lag die Bestätigung beim Schreiber im Median bei **811 ms**, das Eintreffen des passenden serverbestätigten Snapshots beim zweiten Client bei **812 ms** (jeweils 636–1.387 ms). Alle 15 Änderungen kamen an. Die Messung endet am SDK-Callback und enthält keine mobilen Renderzeiten. Sie gilt für diese lokale Testkonfiguration.

**Was das für die Planung bedeutet.** Eine Zahl angemeldeter Familien allein beschreibt die Last schlecht. Für das mittlere Profil ergibt ein vollständiger Neuaufbau der fünf fachlichen Abfragen 1.299 Ergebnisdokumente. Unter der *Beispielannahme* von zwei solchen vollständigen Neuaufbauten je aktiver Familie und Tag ergeben sich folgende Größen. Die Annahme meint zwei unabhängige, vollständige Neuaufbauten. Ein sofortiger Reload aus dem Cache zählt in dieser Rechnung nicht automatisch als solcher.

| Aktive Familien | Vollständige Neuaufbauten am Tag | Ergebnisdokumente am Tag aus fünf Abfragen |
|---:|---:|---:|
| 50 | 100 | 129.900 |
| 250 | 500 | 649.500 |
| 1.000 | 2.000 | 2.598.000 |

Diese Mengenschätzung bildet weder die Rechnung des Anbieters noch eine Belastungsgrenze ab. Zusätzliche Regel- und Profilzugriffe, Wartung, Listener-Updates sowie aktive Geräte verändern die Gesamtkosten. Für den Pilot sind Ergebnisdokumente je Start, tatsächlich abgerechnete Reads und eine Hochrechnung je aktiver Familie aussagekräftiger als die Zahl der Registrierungen. [Firestore-Abrechnung](https://firebase.google.com/docs/firestore/pricing)

*Ergänzung.* Falls das Projekt im kostenlosen Spark-Plan läuft, ist das Tageskontingent von 50.000 Reads schon nach rund 38 vollständigen Neuaufbauten einer mittleren Familie erreicht. Das betrifft bereits den Pilot. Vor dem Pilot klären, welcher Plan aktiv ist, und ein Budget-Alarm setzen.

## 6. Weitere geprüfte Pfade und bestehende Stärken

| Pfad | Beleg und Bedeutung |
|---|---|
| Kalender und wiederkehrende Termine | Der Event-Listener wird je Familie geteilt und beim Routenwechsel 15 Sekunden gehalten. Die Kalenderansicht expandiert Serien in einem Dreimonatsfenster und verwendet die Ergebnisse beim Blättern innerhalb desselben Monats erneut. Für tägliche und wöchentliche Serien überspringt der Algorithmus ältere Intervalle. Die Monatsumschaltung war im Browser entsprechend günstig. Die drei Messprofile bestanden aus Einzelterminen. [Listener](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/hooks/useEvents.js#L15) · [Ansicht](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/pages/CalendarPage.jsx#L97) · [Serienlogik](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/utils/recurrence.js#L235) |
| Mitgliederzugriffe | Tagesvorschau, Arbeitsverteilung und das bereits montierte, geschlossene Ereignisformular fordern im Dashboard jeweils Mitglieder an. Der Hook ruft pro Mitglied `getDoc` auf. Das ergibt bei zwei Mitgliedern bis zu sechs logische SDK-Aufrufe allein aus diesen drei Stellen. Die Zahl abgerechneter Reads hängt unter anderem von Cache und SDK ab. Einen gemeinsamen Mitgliederzustand bzw. spätes Montieren des Formulars prüfen. [Mitglieder-Hook](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/hooks/useFamilyMembers.js#L12) · [Formular](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/calendar/EventFormModal.jsx#L195) · [App-Shell](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/layout/AppShell.jsx#L111) |
| Einkauf und Mahlzeiten | Die Historie pro Produkt wird bereits begrenzt. Der aktivierte Wochenvorschlag zieht Rezepte und die gesamte Mahlzeitenhistorie zusätzlich heran. `FoodPage` lädt diese beiden Mengen ebenfalls. Die tatsächliche Bedienzeit bei umfangreicher Rezeptsammlung bleibt offen. [Produkte](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/shoppingProducts.js#L32) · [Wochenvorschlag](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/hooks/useWeeklyProposal.js#L19) · [Mahlzeiten](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/services/mealPlan.js#L45) |
| Export und Import | Der JSON-Familienexport lädt neun Sammlungen parallel und erzeugt aus dem gesamten Ergebnis im Speicher einen formatierten JSON-Blob. Für einen seltenen Export kann das vertretbar sein. Spitzenspeicher, Abschlusszeit und Abbruchverhalten bei großen Familien sind offen. Der Rezeptimport begrenzt den externen Abruf auf 4 MiB und 10 s. Für ICS sind es 8 MiB und 10 s. Externe Netzzeiten und Vercel-Kaltstarts wurden nicht gemessen. [Export](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/utils/exportFamily.js#L31) · [Rezeptimport](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/api/recipe-import.js#L19) · [ICS](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/api/ics-fetch.js#L23) |
| Offline und Auslieferung | Persistenter IndexedDB-Cache mit Mehrtab-Verwaltung, selbst gehostete Schrift, getrennte Feature-Routen und SSG sind umgesetzt. Der Service Worker wird nach dem Laden registriert. Ein Wechsel vom Hintergrund ins Mobilnetz nach längerer Offlinezeit ist ein eigener Abnahmetest. [Firestore](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/lib/firebase.js#L35) · [Service Worker](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/public/sw.js) · [Registrierung](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/utils/registerSW.js) · [SSG](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/vite.config.js) |

## 7. Freigabe und Abnahme

| Stufe | Entscheidung und Bedingungen |
|---|---|
| Begleiteter Pilot | **Bedingtes Go für beispielsweise 5–10 neu angelegte Familien.** Vor Einladung den kleinen Datensatz auf mindestens einem echten Android-Gerät und einem iPhone im Zieldeployment prüfen. Im Pilot gezielt neue und wiederkehrende Nutzer beobachten, zeitgleiche Nutzung zweier Geräte einschließen und zunächst große Kalenderimporte oder große Tresor-Dateien aus dem zugesagten Funktionsumfang nehmen. Ist ein solcher Import Kern des Piloten, zuerst Befund 1 bzw. 3 oder 4 abnehmen. |
| Breiter Kundenrollout | **Freigabe zurückstellen.** Dashboard und Board im mittleren und großen Profil überarbeiten und erneut messen. Für zugesagte Kalenderabos und Tresorgrößen die genannten Funktionstests bestehen. Der Freigabebeschluss braucht Messdaten aus der tatsächlichen Hosting- und Firebase-Region mit produktionsgleichem Build. |
| Belastbare Bestätigung | Für einen ersten Staging-Nachweis mindestens 30 kontrollierte Starts je Profil, Cachezustand und Geräteklasse verteilen. Im Pilot z. B. 100 relevante Sitzungen je wichtigem Segment sammeln, Verteilung und Fallzahlen veröffentlichen und bei dünner Basis den Beobachtungszeitraum verlängern. Neben p95 alle Fehler und unvollständigen Starts mitzählen. Für reale Geräte Android-Chrome und iOS-Safari/PWA getrennt auswerten. |
| Aktionen und Parallelität | Kalenderaktion p95 ≤ 500 ms, bedienbare erste Aufgabenliste p95 ≤ 1 s und Dashboard p95 ≤ 3 s. Als ergänzendes Produktziel für zwei Geräte eine bestätigte Änderung auf Gerät B bei p95 ≤ 2 s. In isoliertem Staging mit der erwarteten Zahl aktiver Geräte sowie mit einem begründeten Ansturm testen. Verschiedene Familien und mehrere Geräte derselben Familie getrennt belasten. |
| Beobachtung und Stopp | Versionsbezogene technische Zeiten für Dashboard-Datenbereitschaft, Aufgabenliste, Feed-Verzögerung und Schreibbestätigung erheben. Dazu Fehlerquote, Reads je Start und Budget je aktiver Familie betrachten. Die Datenschutzaussagen der App bei der Wahl der Messmethode berücksichtigen, für den Pilot genügen auch einwilligende Testgeräte und synthetische Messungen. Bei reproduzierbarer Zielverletzung oder fehlschlagendem Kernablauf weitere Einladungen pausieren. Vergleichswerte vom vorherigen Release für eine Rückkehr bereithalten. |

**Entscheidender Nachweis für die nächste Freigabe:** Die Familie mit 1.200 Terminen und 2.500 Tracker-Einträgen muss ihre Tagesübersicht mit begrenzter Ergebnismenge öffnen können. Ihre 540 erledigten Aufgaben dürfen das Öffnen der aktiven Liste nicht um Sekunden verzögern. Erst anschließend lohnt es sich, aus Staging- und Pilotdaten eine tragfähige Zahl gleichzeitig aktiver Familien abzuleiten.

Der Generator für die synthetischen Daten, Rohwerte im NDJSON-Format, Messskripte, Build-Auszug und Reproduktionsanleitung liegen im begleitenden Messpaket. Alle dauerhaften Quelldateiverweise im Bericht zeigen auf den geprüften Commit.

## 8. Ergänzende Befunde aus der Code-Review

Die folgenden Punkte waren mit dem Messaufbau aus Abschnitt 2 nicht oder nur eingeschränkt sichtbar. Lokaler HTTP/1.1-Server, deaktivierter Service Worker in der Hauptserie und eigene Cache-Header des Testservers blenden Auslieferung und Caching des Produktivbetriebs aus. Für die Wiederholungsmessung wird deshalb zusätzlich ein Lauf auf einem Vercel-Preview-Deployment mit HTTP/2 und aktivem Service Worker empfohlen.

### 8.1 · Hoch · Gehashte Assets werden im Produktivbetrieb nicht dauerhaft gecacht

`vercel.json` definiert keine `Cache-Control`-Header. Vercel liefert statische Dateien ohne eigene Header mit `max-age=0, must-revalidate` aus. Jeder Warmstart prüft damit rund 1,3 MB JavaScript erneut beim Server. Die Warmwerte aus Abschnitt 3 dürften für den echten Betrieb zu optimistisch sein. **Änderung:** `/assets/*` mit `public, max-age=31536000, immutable`, HTML und `sw.js` mit `no-cache`. **Abnahme:** Ein Warmstart erzeugt für `/assets/*` keine Requests an den Server mehr.

### 8.2 · Hoch · Service Worker hilft beim Start kaum

Der Kontrolllauf mit Service Worker (15,52 s gegenüber 16,15 s kalt im großen Profil) passt zum Code:
- Vorab gecacht wird `/` (Landingpage), nicht `/app.html`. Offline erscheint auf App-Routen die Landingpage.
- Für gehashte Assets gilt Stale-While-Revalidate. Jeder Start erzeugt dadurch Netz-Requests, und alte Chunks sammeln sich ohne Grenze an, weil `CACHE_VERSION` fest auf `v1` steht.
- Navigationen gehen zuerst ans Netz und haben keinen Timeout. Eine installierte PWA wartet im schwachen Mobilnetz auf die volle Antwort.

**Änderung:** Cache-first für `/assets/*`, `/app.html` als App-Shell vorab cachen, Navigation mit Timeout von etwa 3 s und Rückfall auf den Cache, Aufräumen alter Caches beim Aktivieren. [Service Worker](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/public/sw.js)

### 8.3 · Mittel · Sequenzielle Ladekette bis zum Dashboard

Die Kette lautet `app.js` → Hydration → Auth- und Firestore-Chunk → `onAuthStateChanged` → Nutzerdokument → Familiendokument → Layout-Chunk → Seiten-Chunk → Daten. Zusätzlich liest `ensureUserDoc` das Nutzerdokument parallel zum Listener noch einmal.

`app.html` enthält weder `modulepreload` für die benötigten Chunks noch `preconnect` zu `firestore.googleapis.com`, `identitytoolkit.googleapis.com` und `securetoken.googleapis.com`. Stattdessen lädt sie das Hero-Bild der Landingpage mit `fetchpriority=high` vor, das dort nicht gebraucht wird und mit dem JavaScript um Bandbreite konkurriert.

Beide Sprachdateien liegen im Einstiegs-Chunk (zusammen ca. 30 kB gzip). [AuthProvider](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/context/AuthContext.jsx#L51) · [App-Shell-HTML](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/scripts/emit-app-shell.mjs)

### 8.4 · Mittel · Re-Renders der gesamten App

Die App-Shell erzeugt bei jedem Render ein neues Outlet-Context-Objekt und eine neue FAB-Funktion. Dadurch rendern alle Seiten, die `useOutletContext()` nutzen, und jede TopBar mit. Jede Änderung am Familiendokument rendert alle Nutzer von `useAuth()` neu, praktisch die ganze App. Außerhalb des Kalenders nutzt keine Komponente `React.memo`.

Die abgeleiteten Werte der Dashboard-Widgets (Filter, Sortierung, Gruppierung) sind teilweise nicht memoisiert. Das gilt auch für die Einkaufsliste, deren Eingabefeld bei jedem Tastendruck die ganze Seite neu rendert, und für den Wochenplan (`entries.find` je Zelle). [App-Shell](https://github.com/Gnadi/0815familyOS/blob/243ef52845c9cd0728384aef23b2ac7d7cbb0218/src/components/layout/AppShell.jsx#L102)

### 8.5 · Mittel · Listener ohne Fehlerbehandlung

Außer dem Termin-Listener hat kein `onSnapshot` einen Fehler-Callback. Betroffen sind Aufgaben, Einkauf, Rezepte, Mahlzeiten, Tracker, Geschenke, Dokumente, Impfungen, Nutzer und Familie. Bei einem Regel-, Index- oder Netzfehler bleibt der Ladezustand dauerhaft bestehen. Für Nutzer wirkt das wie „die App ist langsam“, statistisch erscheint es als unvollständiger Start. Für die Abnahme in Abschnitt 7 gehören solche Starts ausdrücklich zu den Fehlern.

### 8.6 · Niedrig · Grafik-Kosten auf Mobilgeräten

TopBar und BottomNav verwenden `backdrop-blur-xl` (24 px). Zwei bildschirmbreite Filter werden bei jedem Scroll-Frame neu zusammengesetzt. Auf Android-Geräten der Mittelklasse kann das beim Scrollen ruckeln. Physische Geräte waren laut Abschnitt 2 nicht Teil der Messung.

### 8.7 · Ergänzungen zum Messplan

- **INP messen:** Eingabe in die Aufgabensuche (großes Profil), erster Buchstabe in der Kalendersuche, Abhaken in der Einkaufsliste.
- **CPU und Netz trennen:** Long Tasks je Messpunkt aus einem Performance-Trace erfassen.
- **Produktionsnahen Lauf ergänzen:** Vercel-Preview mit HTTP/2, aktivem Service Worker und Warmstart nach 24 h, um Cache-Header und Service Worker zu prüfen.
- **Fehlerpfad testen:** Einen Listener gezielt mit einem Regelfehler scheitern lassen. Die Oberfläche muss innerhalb von 2 s einen Fehlerzustand statt eines Ladezustands zeigen.

## 9. Umsetzungsstand (Branch `ccr-dab476d9-vjffn1`)

Die folgenden Änderungen sind umgesetzt. Danach liefen 510 von 510 Unit-Tests in 27 Dateien und der Produktionsbuild erfolgreich durch. Ein Browser-Smoke-Test im Demomodus mit Vercel-gleichen Rewrites lief ohne Konsolenfehler. Er umfasste alle App-Routen, Kalender (Woche/Monat, Tag antippen, Suche, Termin bearbeiten), FAB-Formulare auf vier Seiten, Aufgabenboard und Einkauf. **Die Messreihe aus Abschnitt 3 wurde noch nicht wiederholt.** Die Abnahmekriterien aus Abschnitt 4 und 7 gelten unverändert.

| Befund | Umsetzung | Status |
|---|---|---|
| 1 Dashboard-Historie | Ein gemeinsamer Listener je Collection und Familie (`src/hooks/sharedCollection.js`, 15 s Nachlauf, Startwert aus dem Cache) für Aufgaben, Einkauf, Rezepte, Mahlzeiten, Tracker, Impfungen, Dokumente, Geschenke. Tracker-Einträge werden einmal je Änderung nach Tracker und Kind indiziert, der 30-s-Takt liest nur noch Buckets. `useFamilyMembers` mit Sitzungscache und Deduplizierung. Der Termin-Listener verwendet unveränderte Objekte über `docChanges()` weiter. Widgets memoisiert. | Teilweise. **Offen:** Begrenzte Abfragen (Terminfenster plus Serienmaster, Tracker-Zusammenfassung pro Kind). Bewusst nicht umgesetzt, weil Verlauf, „zuletzt gegeben“ und laufende Serien sonst falsch angezeigt würden. Das braucht ein Datenmodell mit vorberechneten Feldern. |
| 2 Aufgabenboard | „Erledigt“ standardmäßig eingeklappt. Gruppierung nach Status einmal je Änderung. Spalten rendern seitenweise je 50 Karten. `TaskCard` und die Kennzahlenkarten memoisiert. Suche über `useDeferredValue`. | Umgesetzt. Seitenweises Laden des Archivs aus Firestore offen. |
| 3 Kalenderabos | Stale-While-Revalidate. Veraltete Feeds erscheinen sofort, die Aktualisierung läuft im Hintergrund und meldet sich nur bei Änderungen. Der Ladezustand des Rasters hängt nur noch an Firestore. Bereits geladene Feeds werden synchron übernommen (kein Lade-Frame). Proxy-Limit auf 3,5 MiB gesenkt (Vercel 4,5 MB inkl. JSON-Escaping). Suche verzögert und zunächst im ±31-Tage-Fenster. Konfliktprüfung mit Vorfilter. Formular nur bei Bedarf gemountet. | Umgesetzt. ICS-Parsing im Web Worker offen. |
| 4 Tresor | Grenze auf 50 MB gesenkt, Prüfung vor dem Einlesen, Texte DE/EN angepasst, Test für Grenzwert ±1 Byte. | Kurzfristig umgesetzt. Upload großer Dateien in Blöcken offen. |
| 5 Kalenderwartung | Merker je Familie und Aufgabe in `localStorage` (7 Tage) nach einem Lauf ohne Befund. Spätere Sitzungen lesen ohne Listener nicht mehr die ganze Collection. ICS-Import fragt nur `source == 'import'` ab. | Umgesetzt. |
| 6 Bundle | jsPDF erst beim Export (Impfpass 133,4 → 3,4 kB gzip). Firebase aufgeteilt in Auth (`firebaseApp.js`) und Firestore. Öffentliche Seiten ohne Login-Hinweis laden kein Firestore und Auth erst im Leerlauf. Deutsche Sprachdatei als eigener Chunk. | Umgesetzt. |
| 8.1 Cache-Header | `/assets/*` immutable (1 Jahr), Fonts 30 Tage, Icons/Screenshots 7 Tage, HTML und `sw.js` `no-cache`. | Umgesetzt. |
| 8.2 Service Worker | Version v2 mit Aufräumen. Cache-first für gehashte Assets (max. 120 Einträge). `/app.html` als App-Shell. Navigation mit 3-s-Timeout. Beim Build werden 49 Start-Assets vorab gecacht. | Umgesetzt. |
| 8.3 Ladekette | `modulepreload` (aus dem Vite-Manifest) und `preconnect` in `app.html`. Hero-Preload entfernt. Auth, Nutzer- und Familienservice in einem parallelen Import. Zusätzlicher `ensureUserDoc`-Read entfällt. | Umgesetzt. `familyId`-Cache für parallelen Datenstart offen. |
| 8.4 Re-Renders | App-Shell mit stabilem Outlet-Context und FAB-Registry per Ref. Formular-Modals nur bei Bedarf gemountet. Einkaufs-Eingabe als eigene Komponente. Wochenplan indiziert. | Teilweise. **Offen:** Aufteilung des `AuthContext` in Nutzer- und Familienkontext. |
| 8.5 Fehlerbehandlung | `onError` an allen `onSnapshot`-Aufrufen. Hooks beenden den Ladezustand und geben `error` zurück. | Umgesetzt. Anzeige eines Fehlerzustands je Seite offen. |
| 8.6 Blur | iOS-Skin `backdrop-blur-md` statt `-xl`, Material-TopBar deckend ohne Blur. | Umgesetzt. |

**Nächster Schritt:** Die Messreihe aus Abschnitt 3 mit unverändertem Aufbau sowie den Lauf aus 8.7 (Vercel-Preview, Service Worker aktiv, INP) auf diesem Stand wiederholen. Erst danach über die offenen Datenmodell-Änderungen für Befund 1 entscheiden.
