// Export und Import einer Sicherungsdatei (JSON) – alle Einsätze, Fahrzeugliste, Protokoll.
// Beim Import wird jeder Wert geprüft. Fehlerhafte Dateien werden vollständig
// abgelehnt, nie teilweise übernommen.

import { EINSATZARTEN, KATEGORIEN, SCHEMA_VERSION, STATUS, leereStammdaten, leererEinsatzstand } from "./struktur.js";
import { FachFehler, MAX_MENGE, jetzt } from "./service.js";

export const DATEITYP = "FIRECOMMAND-Sicherung";

export function sicherungErstellen(stamm, einsaetze, protokoll, benutzer) {
  return {
    typ: DATEITYP, schema: SCHEMA_VERSION, erstellt_am: jetzt(), erstellt_von: benutzer || null,
    stamm, einsaetze, protokoll: protokoll.slice().sort((a, b) => a.id - b.id),
  };
}

const istZahl = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_MENGE;
const istText = (v, max) => typeof v === "string" && v.length <= max;
const katVon = (key) => KATEGORIEN.find((k) => k.key === key);
const statusOk = (kat, s) => STATUS[kat.bereich].some((x) => x.key === s);
const ablehnen = (m) => { throw new FachFehler(m); };

function stammPruefen(q) {
  if (!q || typeof q !== "object") ablehnen("Sicherung enthält keine Stammdaten.");
  const s = leereStammdaten();
  const ids = new Set();
  for (const o of Array.isArray(q.objekte) ? q.objekte : []) {
    const k = katVon(o?.kategorie_key);
    if (!k || k.erfassungsart !== "einzeln" || !Number.isInteger(o.id) || ids.has(o.id)
        || !istText(o.kennung, 40) || !o.kennung.trim() || !istText(o.bezeichnung, 120)) ablehnen("Sicherung enthält ein ungültiges Fahrzeug.");
    ids.add(o.id);
    s.objekte.push({ id: o.id, kategorie_key: k.key, kennung: o.kennung, bezeichnung: o.bezeichnung,
      aktiv: o.aktiv !== false, version: Number.isInteger(o.version) ? o.version : 1 });
  }
  const maxObj = Math.max(0, ...s.objekte.map((o) => o.id));
  s.naechste_objekt_id = Math.max(maxObj + 1, Number.isInteger(q.naechste_objekt_id) ? q.naechste_objekt_id : 1);
  s.naechste_einsatz_id = Number.isInteger(q.naechste_einsatz_id) ? q.naechste_einsatz_id : 1;
  for (const [j, n] of Object.entries(q.einsatz_zaehler || {})) if (/^\d{4}$/.test(j) && Number.isInteger(n)) s.einsatz_zaehler[j] = n;
  s.standarddatensatz = q.standarddatensatz ?? null;
  s.letzte_sicherung = typeof q.letzte_sicherung === "string" ? q.letzte_sicherung : null;
  return s;
}

function einsatzPruefen(e, stamm) {
  if (!e || !Number.isInteger(e.id) || !EINSATZARTEN.some((a) => a.key === e.art)
      || !istText(e.stichwort, 80) || !istText(e.ort, 120) || !istText(e.bemerkung ?? "", 500)
      || !["laufend", "beendet"].includes(e.status) || typeof e.beginn !== "string") {
    ablehnen("Sicherung enthält einen ungültigen Einsatz.");
  }
  const stand = leererEinsatzstand();
  for (const [kk, werte] of Object.entries(e.stand?.bestand || {})) {
    const k = katVon(kk);
    if (!k) ablehnen(`Einsatz ${e.nummer}: unbekannte Kategorie ${kk}.`);
    stand.bestand[kk] = {};
    for (const [s, w] of Object.entries(werte)) {
      if (!statusOk(k, s) || !istZahl(w?.menge)) ablehnen(`Einsatz ${e.nummer}: ungültiger Bestand bei ${k.name}.`);
      stand.bestand[kk][s] = { menge: w.menge, am: String(w.am || ""), von: w.von ? String(w.von).slice(0, 60) : null };
    }
  }
  for (const [id, st] of Object.entries(e.stand?.objekt_status || {})) {
    const o = stamm.objekte.find((x) => x.id === Number(id));
    if (!o || !statusOk(katVon(o.kategorie_key), st?.status_key)) ablehnen(`Einsatz ${e.nummer}: ungültiger Fahrzeugstatus.`);
    stand.objekt_status[id] = { status_key: st.status_key, standort: String(st.standort || "").slice(0, 120),
      bemerkungen: String(st.bemerkungen || "").slice(0, 1000), version: Number.isInteger(st.version) ? st.version : 1, am: String(st.am || "") };
  }
  for (const [kk, v] of Object.entries(e.stand?.leer_bestaetigt || {})) if (katVon(kk) && v) stand.leer_bestaetigt[kk] = true;
  return {
    id: e.id, nummer: String(e.nummer || e.id), art: e.art, stichwort: e.stichwort, ort: e.ort, bemerkung: e.bemerkung || "",
    beginn: e.beginn, ende: typeof e.ende === "string" ? e.ende : null, status: e.status,
    angelegt_von: e.angelegt_von ?? null, beendet_von: e.beendet_von ?? null,
    startbestand: e.startbestand === "standarddaten" ? "standarddaten" : "leer",
    stand, letzte_aenderung: typeof e.letzte_aenderung === "string" ? e.letzte_aenderung : e.beginn,
  };
}

export function sicherungPruefen(roh) {
  let d;
  try { d = typeof roh === "string" ? JSON.parse(roh) : roh; } catch { ablehnen("Die Datei ist keine gültige Sicherung (kein JSON)."); }
  if (!d || d.typ !== DATEITYP) ablehnen("Die Datei ist keine FIRECOMMAND-Sicherung.");
  if (d.schema !== SCHEMA_VERSION) ablehnen(`Sicherung hat Version ${d.schema}, erwartet wird ${SCHEMA_VERSION}.`);
  const stamm = stammPruefen(d.stamm);
  const ids = new Set();
  const einsaetze = (Array.isArray(d.einsaetze) ? d.einsaetze : []).map((e) => {
    const g = einsatzPruefen(e, stamm);
    if (ids.has(g.id)) ablehnen("Sicherung enthält einen Einsatz doppelt.");
    ids.add(g.id);
    return g;
  });
  stamm.naechste_einsatz_id = Math.max(stamm.naechste_einsatz_id, Math.max(0, ...ids) + 1);
  const protokoll = (Array.isArray(d.protokoll) ? d.protokoll : [])
    .filter((e) => e && typeof e.zeitpunkt === "string")
    .map((e) => ({
      einsatz_id: Number.isInteger(e.einsatz_id) ? e.einsatz_id : null,
      zeitpunkt: e.zeitpunkt, bereich: String(e.bereich || ""), kategorie_key: String(e.kategorie_key || ""),
      ziel: String(e.ziel || ""), aktion: String(e.aktion || ""),
      alter_wert: e.alter_wert ?? null, neuer_wert: e.neuer_wert ?? null,
      benutzer: e.benutzer ?? null, quelle: String(e.quelle || "manuell"),
    }));
  return { stamm, einsaetze, protokoll, erstellt_am: d.erstellt_am || null, erstellt_von: d.erstellt_von || null };
}
