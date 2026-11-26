// Export und Import einer Sicherungsdatei (JSON) – alle Einsätze, Fahrzeugliste, Protokoll.
// Beim Import wird jeder Wert geprüft. Fehlerhafte Dateien werden vollständig
// abgelehnt, nie teilweise übernommen. Ältere Sicherungen (Schema 2) werden umgestellt.

import { migriereV2zuV3, migriereV3zuV4, migriereV4zuV5 } from "./migration.js";
import { ABSCHNITTSARTEN, EINSATZARTEN, FAHRZEUGSTATUS, KATEGORIEN, LINIENFARBEN, LINIENSTILE, SCHEMA_VERSION, STAERKE_FUNKTIONEN, STATUS_ERLAUBT,
  SYMBOLE, felder, leereStammdaten, leeresBoard, leererEinsatzstand } from "./struktur.js";
import { FachFehler, MAX_MENGE, bereitstellungsraumPruefen, jetzt } from "./service.js";

export const DATEITYP = "FIRECOMMAND-Sicherung";

export function sicherungErstellen(stamm, einsaetze, protokoll, benutzer) {
  return {
    typ: DATEITYP, schema: SCHEMA_VERSION, erstellt_am: jetzt(), erstellt_von: benutzer || null,
    stamm, einsaetze, protokoll: protokoll.slice().sort((a, b) => a.id - b.id),
  };
}

const istZahl = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_MENGE;
const istText = (v, max) => typeof v === "string" && v.length <= max;
const istKoord = (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 100000;
const katVon = (key) => KATEGORIEN.find((k) => k.key === key);
const ablehnen = (m) => { throw new FachFehler(m); };

function stammPruefen(q) {
  if (!q || typeof q !== "object") ablehnen("Sicherung enthält keine Stammdaten.");
  const s = { ...leereStammdaten(), objekte: [] };
  const ids = new Set();
  for (const o of Array.isArray(q.objekte) ? q.objekte : []) {
    const k = katVon(o?.kategorie_key);
    if (!k || k.typ !== "einzeln" || !Number.isInteger(o.id) || ids.has(o.id)
        || !istText(o.bezeichnung, 60) || !o.bezeichnung.trim() || !istText(o.funkrufname ?? "", 40)) ablehnen("Sicherung enthält einen ungültigen Eintrag der Fahrzeugliste.");
    ids.add(o.id);
    s.objekte.push({ id: o.id, kategorie_key: k.key, bezeichnung: o.bezeichnung, funkrufname: o.funkrufname || "", aktiv: o.aktiv !== false,
      version: Number.isInteger(o.version) ? o.version : 1, herkunft: o.herkunft === "initial" ? "initial" : "manuell" });
  }
  const maxObj = Math.max(0, ...s.objekte.map((o) => o.id));
  s.naechste_objekt_id = Math.max(maxObj + 1, Number.isInteger(q.naechste_objekt_id) ? q.naechste_objekt_id : 1);
  s.naechste_einsatz_id = Number.isInteger(q.naechste_einsatz_id) ? q.naechste_einsatz_id : 1;
  for (const [j, n] of Object.entries(q.einsatz_zaehler || {})) if (/^\d{4}$/.test(j) && Number.isInteger(n)) s.einsatz_zaehler[j] = n;
  for (const b of Array.isArray(q.bereitstellungsraeume) ? q.bereitstellungsraeume : []) {
    if (!Number.isInteger(b?.id)) ablehnen("Sicherung enthält einen ungültigen Bereitstellungsraum.");
    s.bereitstellungsraeume.push({ id: b.id, ...bereitstellungsraumPruefen(b) });
  }
  s.standarddatensatz = q.standarddatensatz ?? null;
  s.letzte_sicherung = typeof q.letzte_sicherung === "string" ? q.letzte_sicherung : null;
  return s;
}

function boardPruefen(q, nr) {
  const b = leeresBoard();
  if (!q) return b;
  const fehler = () => ablehnen(`Einsatz ${nr}: Einsatzabschnitte sind fehlerhaft.`);
  let maxId = 0;
  const id = (v) => { if (!Number.isInteger(v)) fehler(); maxId = Math.max(maxId, v); return v; };
  for (const a of q.abschnitte || []) {
    if (!ABSCHNITTSARTEN.some((x) => x.key === a.art) || !istText(a.name, 60) || !istKoord(a.x) || !istKoord(a.y)) fehler();
    b.abschnitte.push({ id: id(a.id), art: a.art, name: a.name, x: a.x, y: a.y });
  }
  for (const t of q.texte || []) {
    if (!istText(t.text, 300) || !istKoord(t.x) || !istKoord(t.y)) fehler();
    b.texte.push({ id: id(t.id), text: t.text, x: t.x, y: t.y });
  }
  for (const s of q.symbole || []) {
    if (!SYMBOLE.some((x) => x.key === s.symbol) || !istText(s.label ?? "", 60) || !istKoord(s.x) || !istKoord(s.y)) fehler();
    b.symbole.push({ id: id(s.id), symbol: s.symbol, label: s.label || "", x: s.x, y: s.y });
  }
  const existiert = (p) => p && b[{ abschnitt: "abschnitte", text: "texte", symbol: "symbole" }[p.art]]?.some((x) => x.id === p.id);
  for (const l of q.linien || []) {
    if (!LINIENSTILE.some((x) => x.key === l.stil) || !LINIENFARBEN.some((x) => x.key === l.farbe)) fehler();
    if (l.art === "verbindung") {
      if (!existiert(l.von) || !existiert(l.nach)) continue;   // verwaiste Verbindung auslassen
      b.linien.push({ id: id(l.id), art: "verbindung", von: { art: l.von.art, id: l.von.id }, nach: { art: l.nach.art, id: l.nach.id }, stil: l.stil, farbe: l.farbe });
    } else if (l.art === "frei" && Array.isArray(l.punkte) && l.punkte.length >= 2 && l.punkte.length <= 2000
      && l.punkte.every((p) => istKoord(p?.[0]) && istKoord(p?.[1]))) {
      b.linien.push({ id: id(l.id), art: "frei", punkte: l.punkte.map((p) => [p[0], p[1]]), stil: l.stil, farbe: l.farbe });
    } else fehler();
  }
  for (const [oid, aid] of Object.entries(q.zuordnung || {})) if (b.abschnitte.some((a) => a.id === aid)) b.zuordnung[oid] = aid;
  b.naechste_id = Math.max(maxId + 1, Number.isInteger(q.naechste_id) ? q.naechste_id : 1);
  if (q.ansicht && istKoord(q.ansicht.x) && istKoord(q.ansicht.y) && q.ansicht.zoom > 0.05 && q.ansicht.zoom <= 5) b.ansicht = { ...q.ansicht };
  return b;
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
    if (!k || k.typ === "einzeln") ablehnen(`Einsatz ${e.nummer}: unbekannte Kategorie ${kk}.`);
    const erlaubt = felder(k).map((f) => f.key);
    stand.bestand[kk] = {};
    for (const [s, w] of Object.entries(werte)) {
      if (!erlaubt.includes(s) || !istZahl(w?.menge)) ablehnen(`Einsatz ${e.nummer}: ungültiger Bestand bei ${k.name}.`);
      stand.bestand[kk][s] = { menge: w.menge, am: String(w.am || ""), von: w.von ? String(w.von).slice(0, 60) : null };
    }
    if (k.typ === "vorrat" && (stand.bestand[kk].abkommandiert?.menge ?? 0) > (stand.bestand[kk].gesamt?.menge ?? 0)) {
      ablehnen(`Einsatz ${e.nummer}: bei ${k.name} ist mehr abkommandiert als vorhanden.`);
    }
  }
  for (const [id, st] of Object.entries(e.stand?.objekt_status || {})) {
    const o = stamm.objekte.find((x) => x.id === Number(id));
    const status = st?.status ?? null;
    if (!o || (status !== null && !STATUS_ERLAUBT[o.kategorie_key].includes(status))
        || (st.staerke !== null && st.staerke !== undefined && (typeof st.staerke !== "object"
          || !STAERKE_FUNKTIONEN.every((f) => st.staerke[f.key] === undefined || (istZahl(st.staerke[f.key]) && st.staerke[f.key] <= 999))))
        || (st.besatzung !== null && st.besatzung !== undefined && !istZahl(st.besatzung))) ablehnen(`Einsatz ${e.nummer}: ungültige Fahrzeugangaben.`);
    stand.objekt_status[id] = { status, staerke: st.staerke ? Object.fromEntries(STAERKE_FUNKTIONEN.map((f) => [f.key, st.staerke[f.key] || 0])) : null, besatzung: st.besatzung ?? null, standort: String(st.standort || "").slice(0, 120),
      bemerkungen: String(st.bemerkungen || "").slice(0, 1000), version: Number.isInteger(st.version) ? st.version : 1, am: String(st.am || "") };
  }
  for (const [kk, v] of Object.entries(e.stand?.leer_bestaetigt || {})) if (katVon(kk) && v) stand.leer_bestaetigt[kk] = true;
  let maxPos = 0;
  for (const [kk, liste] of Object.entries(e.stand?.positionen || {})) {
    const k = katVon(kk);
    if (!k || k.typ !== "positionen" || !Array.isArray(liste)) ablehnen(`Einsatz ${e.nummer}: ungültige Atemschutz-Angaben.`);
    stand.positionen[kk] = liste.map((p) => {
      if (!Number.isInteger(p?.id) || !istText(p.bezeichnung, 60) || !p.bezeichnung.trim() || !istZahl(p.stueck)) ablehnen(`Einsatz ${e.nummer}: ungültige Atemschutz-Angaben.`);
      maxPos = Math.max(maxPos, p.id);
      return { id: p.id, bezeichnung: p.bezeichnung, stueck: p.stueck };
    });
  }
  stand.naechste_position_id = Math.max(maxPos + 1, Number.isInteger(e.stand?.naechste_position_id) ? e.stand.naechste_position_id : 1);
  stand.board = boardPruefen(e.stand?.board, e.nummer);
  return {
    id: e.id, nummer: String(e.nummer || e.id), art: e.art, stichwort: e.stichwort, ort: e.ort, bemerkung: e.bemerkung || "",
    beginn: e.beginn, ende: typeof e.ende === "string" ? e.ende : null, status: e.status,
    angelegt_von: e.angelegt_von ?? null, beendet_von: e.beendet_von ?? null,
    bearbeiter: typeof e.bearbeiter === "string" ? e.bearbeiter.slice(0, 60) : null,
    startbestand: e.startbestand === "standarddaten" ? "standarddaten" : "leer",
    stand, letzte_aenderung: typeof e.letzte_aenderung === "string" ? e.letzte_aenderung : e.beginn,
  };
}

const protokollEintrag = (e) => ({
  einsatz_id: Number.isInteger(e.einsatz_id) ? e.einsatz_id : null,
  zeitpunkt: e.zeitpunkt, bereich: String(e.bereich || ""), kategorie_key: String(e.kategorie_key || ""),
  ziel: String(e.ziel || ""), aktion: String(e.aktion || ""),
  alter_wert: e.alter_wert ?? null, neuer_wert: e.neuer_wert ?? null,
  benutzer: e.benutzer ?? null, quelle: String(e.quelle || "manuell"),
});

export function sicherungPruefen(roh) {
  let d;
  try { d = typeof roh === "string" ? JSON.parse(roh) : roh; } catch { ablehnen("Die Datei ist keine gültige Sicherung (kein JSON)."); }
  if (!d || d.typ !== DATEITYP) ablehnen("Die Datei ist keine FIRECOMMAND-Sicherung.");
  const protokollRoh = (Array.isArray(d.protokoll) ? d.protokoll : []).filter((e) => e && typeof e.zeitpunkt === "string");
  if ([2, 3, 4].includes(d.schema)) {
    // Ältere Sicherung: erst umstellen, dann wie gewohnt prüfen
    if (!d.stamm || !Array.isArray(d.einsaetze)) ablehnen("Sicherung ist unvollständig.");
    if (d.schema <= 2) protokollRoh.push(...migriereV2zuV3(d.stamm, d.einsaetze));
    if (d.schema <= 3) protokollRoh.push(...migriereV3zuV4(d.stamm, d.einsaetze));
    protokollRoh.push(...migriereV4zuV5(d.stamm, d.einsaetze));
  } else if (d.schema !== SCHEMA_VERSION) {
    ablehnen(`Sicherung hat Version ${d.schema}, erwartet wird ${SCHEMA_VERSION}.`);
  }
  const stamm = stammPruefen(d.stamm);
  const ids = new Set();
  const einsaetze = (Array.isArray(d.einsaetze) ? d.einsaetze : []).map((e) => {
    const g = einsatzPruefen(e, stamm);
    if (ids.has(g.id)) ablehnen("Sicherung enthält einen Einsatz doppelt.");
    ids.add(g.id);
    return g;
  });
  stamm.naechste_einsatz_id = Math.max(stamm.naechste_einsatz_id, Math.max(0, ...ids) + 1);
  return { stamm, einsaetze, protokoll: protokollRoh.map(protokollEintrag), erstellt_am: d.erstellt_am || null, erstellt_von: d.erstellt_von || null };
}
