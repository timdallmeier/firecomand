// Umstellung gespeicherter Daten auf das aktuelle Schema.
// Werte, die sich nicht eindeutig übertragen lassen, werden NICHT still gelöscht,
// sondern mit ihrem alten Wert im Protokoll dokumentiert (Aktion "verworfen").

import { leeresBoard } from "./struktur.js";

const jetzt = () => new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");

// Schema 2 → 3: neue Einsatzmittel-Struktur, Fahrzeugstatus 1–9, Whiteboard
const ALT_STATUSNAME = { einsatzbereit: "Einsatzbereit", im_einsatz: "Im Einsatz", in_aufbereitung: "In Aufbereitung",
  defekt: "Defekt / gesperrt", auf_wache: "Auf Wache", alarmierbar: "Alarmierbar", angefordert: "Bereits angefordert" };
const ENTFAELLT = { kraftstoff_diesel: "Kraftstoff Diesel", kraftstoff_super: "Kraftstoff Super", kraftstoff_motomix: "Kraftstoff MotoMix",
  schlaeuche: "Schläuche und Armaturen", verpflegung: "Verpflegung" };
const BEREICH = { verpflegung: "versorgung" };

export function migriereV2zuV3(stamm, einsaetze) {
  const eintraege = [];
  const zeit = jetzt();
  const verworfen = (einsatz, bereich, katKey, ziel, alt) => eintraege.push({
    einsatz_id: einsatz ? einsatz.id : null, zeitpunkt: zeit, bereich, kategorie_key: katKey, ziel, aktion: "verworfen",
    alter_wert: alt === null || alt === undefined ? null : typeof alt === "string" ? alt : JSON.stringify(alt),
    neuer_wert: null, benutzer: null, quelle: "migration 3" });

  // Fahrzeugliste: Kennung und Bezeichnung zu einer Bezeichnung zusammenführen
  const vergeben = new Set();
  for (const o of stamm.objekte || []) {
    let bez = String(o.kennung || "").trim();
    const zusatz = String(o.bezeichnung || "").trim();
    if (zusatz && zusatz !== bez) bez = bez ? `${bez} (${zusatz})` : zusatz;
    bez = (bez || `Eintrag ${o.id}`).slice(0, 60);
    if (o.aktiv) {
      let kandidat = bez;
      for (let n = 2; vergeben.has(kandidat.toLocaleLowerCase("de")); n++) kandidat = `${bez.slice(0, 55)} ${n}`;
      bez = kandidat;
      vergeben.add(bez.toLocaleLowerCase("de"));
    }
    o.bezeichnung = bez;
    delete o.kennung;
  }
  stamm.bereitstellungsraeume ||= [];
  stamm.schema = 3;

  for (const e of einsaetze) {
    const st = e.stand;
    // Alter Fahrzeugstatus (Einsatzbereit …) lässt sich nicht auf 1–9 abbilden
    for (const [id, alt] of Object.entries(st.objekt_status || {})) {
      const o = stamm.objekte.find((x) => x.id === Number(id));
      if (alt.status_key) verworfen(e, "einsatzmittel", o?.kategorie_key || "fahrzeuge", `objekt:${o?.bezeichnung ?? id}`,
        { status: ALT_STATUSNAME[alt.status_key] || alt.status_key });
      st.objekt_status[id] = { status: null, besatzung: null, standort: alt.standort || "", bemerkungen: alt.bemerkungen || "",
        version: (alt.version || 0) + 1, am: zeit };
    }
    for (const [katKey, name] of Object.entries(ENTFAELLT)) {
      for (const [feld, w] of Object.entries(st.bestand?.[katKey] || {})) {
        verworfen(e, BEREICH[katKey] || "einsatzmittel", katKey, `menge:${feld}`, `${name} · ${ALT_STATUSNAME[feld] || feld}: ${w.menge}`);
      }
      if (st.bestand) delete st.bestand[katKey];
      if (st.leer_bestaetigt) delete st.leer_bestaetigt[katKey];
    }
    st.board ||= leeresBoard();
  }
  return eintraege;
}
