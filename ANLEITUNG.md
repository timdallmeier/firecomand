# FIRECOMMAND auf dem iPad – offline (Version 3)

## Neu in Version 3

* **Obere Leiste:** nur noch FIRECOMMAND und „Letzte Aktualisierung“. *Bearbeiter* und *Sicherung* stehen unten auf der Startseite.
* **Liste aller Einsätze** (vorher „Liste alter Einsätze“) – mit **Löschen** je Einsatz und Sicherheitsabfrage.
  Gelöscht werden Einsatzdaten, Zuordnungen, Einsatzabschnitte, Whiteboard und Protokoll des Einsatzes. Stammdaten bleiben.
* **Kräfte und Einsatzmittel:** Kacheln in der Reihenfolge Fahrzeuge · Abrollbehälter · Atemschutz / Kraftstoff · PSA · Schaummittel /
  Schläuche und Armaturen · Verpflegung.
* **Fahrzeuge** (eigene Seite): Bezeichnung, Funkrufname, Stärke und Status 1–9 per Auswahlleiste.
  Stärke = Anzahl Kräfte B IV / B III / B I, angezeigt als Stärkemeldung (z. B. 1/1/6/8) – antippen und mit − / + ändern.
  Initialer Stammdatensatz: **HLF 20 · 1-HLF 20-1**.
* **Abrollbehälter** (eigene Seite): Bezeichnung und Status 1, 2, 3, 4, 6. Initialer Stammdatensatz: **AB-GSG/Rüst**.
* **Startwerte in jedem neuen Einsatz:** Status 2, Stärke 0/0/0/0 (Abrollbehälter: Status 2).
* **Atemschutz** (eigene Seite): Pressluftatmer, Masken, CSA – je Liste mit Bezeichnung und Stückzahl.
* **Stammdaten** sind nur Bezeichnung und Funkrufname. Stärke und Status werden je Einsatz gespeichert.
  Beim Beenden eines Einsatzes wird der Stand festgeschrieben.

## Bedienung in Kürze (Version 2)

* **Startseite:** *Neuen Einsatz anlegen*, *Liste alter Einsätze*, *Bereitstellungsräume* (folgt – Liste wird ergänzt).
* **Neuer Einsatz:** Art wählen (*Gebundene Einsatzstelle*; *Flächenlage* folgt), Stichwort und Einsatzort eintragen,
  Startbestand wählen (*Leer starten*; *Standarddaten übernehmen* folgt).
* **Im Einsatz** erscheinen drei Kacheln:
  * **Kräfte und Einsatzmittel** – Kräfte je Funktion mit − / +, dazu Fahrzeuge, Abrollbehälter, Kraftstoff,
    Schläuche und Armaturen, Schaummittel, Pressluftatmer, PSA und Verpflegung.
  * **Einsatzabschnitte** – schwarzes Whiteboard (siehe unten).
  * **Lagebild** – folgt in einer späteren Version.
* **Fahrzeuge:** Bezeichnung, Besatzungsstärke (− / +) und Status 1–9 per Auswahlmenü. Abrollbehälter: Bezeichnung und Status.
  Die Liste gilt für alle Einsätze, Status und Besatzung je Einsatz.
* **Kraftstoff / Schaummittel:** Gesamtbestand eintragen, Mengen *abkommandieren* oder *freigeben* – verfügbar wird berechnet.
* **Lagebericht erzeugen / Protokoll / Einsatz beenden:** in der Leiste oben im Einsatz.

### Whiteboard „Einsatzabschnitte“

* **+ Abschnitt:** Art wählen (Einsatzabschnitt, Untereinsatzabschnitt, Bereitstellungsraum, Sonstiger Bereich), Bezeichnung eintragen.
* **Fahrzeuge mit Status 4** erscheinen automatisch rechts in der Leiste „Fahrzeuge Status 4“. In einen Abschnitt ziehen,
  zwischen Abschnitten verschieben oder zum Herausnehmen auf eine freie Fläche ziehen. Ein Fahrzeug ist immer höchstens einem Abschnitt zugeordnet.
  Bekommt es einen anderen Status, wird die Zuordnung automatisch aufgehoben und protokolliert.
* **Verbinden:** Werkzeug *Verbinden*, dann zwei Elemente nacheinander antippen. Linienart *Führung* (durchgezogen) oder *Kommunikation* (gestrichelt), fünf Farben.
* **Zeichnen:** Freihandlinien mit Finger oder Stift.
* **+ Text / + Symbol:** Textfelder (z. B. Funkgruppen) und taktische Zeichen (Fahrzeuge, Einsatzleitung, Einsatzzentrale, Stab,
  Abschnittsleitung, Trupp bis Verband, Gefahrenstelle, Sammelplatz, Wasserentnahme) mit Beschriftung.
* **Bedienung:** Element antippen = auswählen, ziehen = verschieben, doppelt antippen = bearbeiten. Leere Fläche ziehen = Ansicht verschieben,
  zwei Finger = zoomen. *Einpassen* zeigt alles auf einmal.
* Die taktischen Zeichen sind eine eigene, einheitliche Bibliothek, angelehnt an die Grundformen taktischer Zeichen – nicht normgeprüft, erweiterbar in `js/symbole.js`.

## Vorbereitet, aber noch nicht aktiv

* **Flächenlage:** `EINSATZARTEN` in `js/daten/struktur.js`, Ansicht in `js/flaechenlage.js`.
* **Standarddaten:** `stamm.standarddatensatz` + `standarddatenAnwenden` in `js/daten/service.js` (folgt mit der Excel-Liste).
* **Bereitstellungsräume:** Datenfelder und Prüfung (`bereitstellungsraumPruefen`), Liste folgt.
* **Lagebild:** Kachel mit Hinweis „Folgt“.
* **Bezeichnungen der Status 1–9:** zentral in `FAHRZEUGSTATUS` in `js/daten/struktur.js` eintragen – überall wird dann „Status 2 – …“ angezeigt.

## Update auf eine neue Version

1. **Vorher sichern (empfohlen):** In FIRECOMMAND *Sicherung* → *Sicherung erstellen* → in OneDrive ablegen.
2. **Dateien bei GitHub ersetzen:** Ordner `firecommand-ipad` entpacken und den **Inhalt** wie bei der Erstinstallation hochladen.
   Gleichnamige Dateien werden dabei überschrieben. In Safari ordnerweise: bei GitHub in den Ordner wechseln (z. B. `js`) →
   *Add file* → *Upload files* → alle Dateien aus dem gleichnamigen Finder-Ordner hineinziehen → *Commit changes*.
3. **1–2 Minuten warten** (GitHub veröffentlicht die Seite neu).
4. **iPad:** FIRECOMMAND über das Symbol öffnen (mit Internet). Die App lädt die neue Version und startet sich einmal selbst neu.
   Erkennbar an der neuen Startseite. Falls nicht: App ganz schließen und erneut öffnen.
5. Deine Daten bleiben erhalten. Nicht übertragbare Werte aus älteren Versionen stehen mit ihrem alten Wert im Protokoll.

Wichtig für künftige Updates: Bei jeder Änderung an Programmdateien die Zahl in `sw.js` (`VERSION = "firecommand-ipad-…"`) erhöhen –
sonst erkennt das iPad die neue Version nicht. In den gelieferten Paketen ist das bereits erledigt.

## Installation

Diese Version braucht weder Mac noch Server. Alle Daten liegen ausschließlich auf dem iPad.
Das iPad braucht nur **einmal** Internet, um die App zu laden. Danach läuft sie ohne Netz.

Damit das iPad die App offline vorhalten darf, muss sie einmal über eine **HTTPS-Adresse** geladen werden.
Am einfachsten geht das kostenlos mit GitHub Pages. Dort liegt nur der Programmcode, **keine Einsatzdaten**.

## 1. Einmalig: App bei GitHub Pages ablegen (am Mac, ca. 10 Minuten)

1. Auf github.com ein kostenloses Konto anlegen und anmelden.
2. Oben rechts auf **+** → **New repository**.
   * Repository name: `firecommand`
   * **Public** auswählen (für GitHub Pages im kostenlosen Konto nötig)
   * Auf **Create repository** klicken.
3. Auf der neuen Seite den Link **uploading an existing file** anklicken.
4. Den Ordner `firecommand-ipad` im Finder öffnen, **alle Inhalte darin** markieren (Cmd + A) und auf die GitHub-Seite ziehen.
   Hochgeladen werden also `index.html`, `sw.js`, `manifest.webmanifest`, die Ordner `css`, `js` und `icons` usw.
   Den Ordner `firecommand-ipad` selbst nicht mit hochladen.
5. Unten auf **Commit changes** klicken.
6. Oben auf **Settings** → links **Pages**.
   Unter *Build and deployment*: Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** → **Save**.
7. 1–2 Minuten warten und die Seite neu laden. Oben erscheint die Adresse, z. B.
   `https://DEIN-NAME.github.io/firecommand/`

## 2. Einmalig: Auf dem iPad installieren

1. Am iPad in **Safari** die Adresse aus Schritt 1.7 öffnen (mit Internet).
2. Auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen** tippen.
3. Ab jetzt **nur noch über das FIRECOMMAND-Symbol** starten.
   Die App auf dem Home-Bildschirm hat einen eigenen Datenspeicher, getrennt von einem normalen Safari-Tab.
4. Test: Flugmodus einschalten und FIRECOMMAND über das Symbol öffnen. Oben steht dann „Offline bereit“.

## 3. Sicherung in OneDrive

Die Daten liegen nur auf diesem iPad. Wird das iPad zurückgesetzt, geht es verloren oder **löschst du das App-Symbol**, sind die Daten weg.

* **Sichern:** Tippe in FIRECOMMAND auf **Sicherung** → **Sicherung erstellen** → **Teilen / In Dateien sichern** → OneDrive → Ordner wählen → **Sichern**.
* **Wiederherstellen:** Tippe auf **Sicherung** → **Sicherungsdatei wählen** → Datei aus OneDrive wählen → Vorschau prüfen → **Sicherung wiederherstellen** (zweimal bestätigen).
* Sind Daten vorhanden und die letzte Sicherung ist älter als 7 Tage, erinnert die App oben im Dashboard daran.

## Updates

Neue Version: Die geänderten Dateien wieder ins Repository hochladen (Schritt 1.3–1.5).
Das iPad übernimmt das Update beim nächsten Öffnen mit Internet. Die erfassten Daten bleiben dabei erhalten.

## Am Mac ausprobieren (ohne GitHub)

```
cd ~/Downloads/firecommand-ipad
python3 -m http.server 8000
```

Dann am Mac `http://localhost:8000` öffnen. Das iPad kann diese Adresse nicht offline nutzen, dafür braucht es GitHub Pages.

## Technik in Kürze

* Reine Web-App (HTML, CSS, JavaScript) ohne externe Abhängigkeiten
* Speicherung: IndexedDB auf dem Gerät, jede Änderung als atomare Transaktion zusammen mit dem Protokolleintrag
* Offline: Service Worker hält alle Programmdateien vor (`sw.js`, bei Updates `VERSION` erhöhen)
* Fachlogik identisch zur Server-Version (`js/daten/service.js`): keine Startbestände, „nicht erfasst“ ≠ 0,
  Gesamtstärke berechnet, Umbuchen, Konfliktschutz, unveränderliches Protokoll
* Vorbereitet für den Standarddatensatz: `bestaendeUebernehmen(stand, paket, benutzer, quelle)`
