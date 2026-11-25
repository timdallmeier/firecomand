// VORBEREITET: Flächenlage
//
// Die Auswahl „Flächenlage“ ist bereits im Ablauf „Neuen Einsatz anlegen“ vorhanden,
// aber noch gesperrt (EINSATZARTEN in daten/struktur.js: verfuegbar = false).
//
// Für den Ausbau:
//   1. In struktur.js bei "flaeche" verfuegbar: true setzen.
//   2. Hier die Ansicht der Flächenlage bauen (z. B. mehrere Einsatzabschnitte,
//      je Abschnitt eigene Kräfte/Einsatzmittel).
//   3. app.js ruft für Einsätze mit art === "flaeche" diese Funktion auf.

import { esc } from "./ui.js";

export function zeigeFlaechenlage(main, uebersicht) {
  main.innerHTML = `
    <div class="leer"><p>Einsatz ${esc(uebersicht.einsatz.nummer)}: Die Ansicht für Flächenlagen folgt in einer späteren Version.</p></div>`;
}
