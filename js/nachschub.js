// Nachschub: Kraftstoff, PSA, Schaummittel, Schläuche und Armaturen, Verpflegung, Ölbindemittel.
// Die Bestände stehen direkt auf der Seite (verfügbare Mengen); Antippen öffnet die Erfassung.

import { renderNachschub } from "./dashboard.js";
import { icon } from "./symbole.js";

export function zeigeNachschub(main, ctx) {
  const d = ctx.daten();
  main.innerHTML = `
    ${ctx.einsatzLeiste()}
    <div class="seitenkopf">
      <span class="kachel-icon gross">${icon("nachschub", 26)}</span>
      <div><h1 class="seitentitel">Nachschub</h1></div>
    </div>
    ${renderNachschub(d, { nurLesen: d.einsatz.status !== "laufend" })}`;
}
