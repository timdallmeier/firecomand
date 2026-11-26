// Umstellung gespeicherter Daten auf das aktuelle Schema.
// Werte, die sich nicht eindeutig übertragen lassen, werden NICHT still gelöscht,
// sondern mit ihrem alten Wert im Protokoll dokumentiert (Aktion "verworfen").

import { START_STATUS, STATUS_ERLAUBT, initialeObjekte, leereStaerke, leeresBoard } from "./struktur.js";

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

// Schema 3 → 4: Funkrufname, Stärke und Grundwerte in den Stammdaten, initiale Stammdatensätze,
// Abrollbehälter nur Status 1–4 und 6, Atemschutz als Positionsliste.
export function migriereV3zuV4(stamm, einsaetze) {
  const eintraege = [];
  const zeit = jetzt();
  const verworfen = (einsatz, katKey, ziel, alt) => eintraege.push({
    einsatz_id: einsatz.id, zeitpunkt: zeit, bereich: "einsatzmittel", kategorie_key: katKey, ziel, aktion: "verworfen",
    alter_wert: typeof alt === "string" ? alt : JSON.stringify(alt), neuer_wert: null, benutzer: null, quelle: "migration 4" });

  for (const o of stamm.objekte || []) {
    o.funkrufname ??= "";
    o.herkunft ??= "manuell";
  }
  // Initiale Stammdatensätze ergänzen, sofern noch nicht vorhanden
  for (const neu of initialeObjekte(stamm.naechste_objekt_id)) {
    const da = stamm.objekte.some((o) => o.aktiv && o.kategorie_key === neu.kategorie_key
      && o.bezeichnung.toLocaleLowerCase("de") === neu.bezeichnung.toLocaleLowerCase("de"));
    if (da) continue;
    neu.id = stamm.naechste_objekt_id++;
    stamm.objekte.push(neu);
  }
  stamm.schema = 4;

  const STATUSNAME = { einsatzbereit: "Einsatzbereit", im_einsatz: "Im Einsatz", in_aufbereitung: "In Aufbereitung", defekt: "Defekt / gesperrt" };
  for (const e of einsaetze) {
    const st = e.stand;
    for (const [id, w] of Object.entries(st.objekt_status || {})) {
      w.staerke ??= null;
      const o = stamm.objekte.find((x) => x.id === Number(id));
      if (o?.kategorie_key === "abrollbehaelter" && w.status !== null && !STATUS_ERLAUBT.abrollbehaelter.includes(w.status)) {
        verworfen(e, "abrollbehaelter", `objekt:${o.bezeichnung}`, { status: w.status });
        w.status = null;
      }
    }
    // Beendete Einsätze: Einträge ohne Angaben bleiben unsichtbar (wie bisher)
    st.positionen ||= {};
    st.naechste_position_id ||= 1;
    for (const [katKey, name] of [["pressluftatmer", "Pressluftatmer"], ["masken", "Masken"]]) {
      const b = st.bestand?.[katKey];
      if (!b) continue;
      const werte = Object.entries(b);
      if (werte.length) {
        const summe = werte.reduce((a, [, v]) => a + (v.menge || 0), 0);
        st.positionen[katKey] = [{ id: st.naechste_position_id++, bezeichnung: name, stueck: summe }];
        verworfen(e, katKey, "aufteilung", `${name} nach Status: ${werte.map(([k, v]) => `${STATUSNAME[k] || k} ${v.menge}`).join(", ")} → übernommen als Gesamtstückzahl ${summe}`);
      }
      delete st.bestand[katKey];
    }
  }
  return eintraege;
}

// Schema 4 → 5: Stärke je Fahrzeug als Anzahl B IV / B III / B I (statt Auswahl B4/B3/B1).
// Stammdaten enthalten nur noch Bezeichnung und Funkrufname; Status und Stärke stehen je Einsatz.
export function migriereV4zuV5(stamm, einsaetze) {
  const eintraege = [];
  const zeit = jetzt();
  const verworfen = (einsatz, o, alt) => eintraege.push({
    einsatz_id: einsatz.id, zeitpunkt: zeit, bereich: "einsatzmittel", kategorie_key: o.kategorie_key, ziel: `objekt:${o.bezeichnung}`,
    aktion: "verworfen", alter_wert: JSON.stringify(alt), neuer_wert: null, benutzer: null, quelle: "migration 5" });
  const aktiv = (stamm.objekte || []).filter((o) => o.aktiv);
  for (const e of einsaetze) {
    const st = e.stand;
    st.objekt_status ||= {};
    // Laufende Einsätze: bisherige Grundwerte aus den Stammdaten als Einsatzwerte festhalten
    if (e.status === "laufend") {
      for (const o of aktiv) {
        if (st.objekt_status[o.id] || (o.status == null && o.staerke == null)) continue;
        st.objekt_status[o.id] = { status: o.status ?? START_STATUS, staerke: null, standort: "", bemerkungen: "", version: 1, am: zeit };
        if (o.staerke) verworfen(e, o, { staerke: o.staerke });
      }
    }
    for (const [id, w] of Object.entries(st.objekt_status)) {
      const o = stamm.objekte.find((x) => x.id === Number(id));
      if (typeof w.staerke === "string") { if (o) verworfen(e, o, { staerke: w.staerke }); w.staerke = null; }
      if (o?.kategorie_key === "fahrzeuge" && !w.staerke) w.staerke = leereStaerke();
    }
  }
  for (const o of stamm.objekte || []) { delete o.status; delete o.staerke; }
  stamm.schema = 5;
  return eintraege;
}
