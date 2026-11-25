# FIRECOMMAND auf dem iPad – offline

## Bedienung in Kürze

* **Startseite:** zwei Kacheln – *Neuen Einsatz anlegen* und *Liste alter Einsätze*. Laufende Einsätze stehen zusätzlich darunter.
* **Neuer Einsatz:** Art wählen (*Gebundene Einsatzstelle*; *Flächenlage* folgt), Stichwort und Einsatzort eintragen,
  Startbestand wählen (*Leer starten*; *Standarddaten übernehmen* folgt). Beginn und Einsatznummer (z. B. 2026-001) setzt die App selbst.
* **Im Einsatz:** Ressourcenübersicht wie gewohnt. Kräfte je Status und Funktion direkt mit **−** und **+** zählen.
  „Mit 0 Kräften beginnen“ bestätigt bewusst 0 für alle Felder.
* **Fahrzeuge und Abrollbehälter:** Die Fahrzeugliste gilt für alle Einsätze. Der Status wird je Einsatz mit einem Tipp gesetzt.
* **Lagebericht erzeugen:** PDF mit Einsatzdaten, Kräften, Einsatzmitteln, Fahrzeugliste, Versorgung, Hinweisen und dem
  vollständigen Änderungsprotokoll. Über *Teilen / Sichern* direkt in OneDrive, per Mail oder AirDrop weitergeben.
* **Einsatz beenden:** Danach nur noch Ansicht. Lagebericht und Protokoll bleiben abrufbar.

## Vorbereitet, aber noch nicht aktiv

* **Flächenlage:** Auswahl ist sichtbar, aber gesperrt (`js/daten/struktur.js` → `EINSATZARTEN`, Ansicht in `js/flaechenlage.js`).
* **Standarddaten:** Option ist sichtbar, aber gesperrt, solange kein Standarddatensatz hinterlegt ist
  (`stamm.standarddatensatz`, Übernahme in `standarddatenAnwenden` in `js/daten/service.js`). Wird mit der Excel-Liste befüllt.

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
