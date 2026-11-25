// Fachlogik von FIRECOMMAND – iPad-Version mit Einsätzen.
//
// Datenmodell:
//   Stammdaten  – gelten für alle Einsätze: Fahrzeugliste (Fahrzeuge, Abrollbehälter),
//                 Zähler, vorbereiteter Standarddatensatz.
//   Einsatz     – eigener Stand: Mengen je Kategorie/Status, Status der Fahrzeuge,
//                 eigenes Protokoll. Beendete Einsätze sind unveränderlich.
//
// Alle Funktionen sind rein: Sie verändern die übergebenen Objekte und liefern
// Protokolleinträge zurück. Bei einem Fehler wird geworfen, BEVOR etwas geändert ist.

import { BEREICHE, EINSATZARTEN, GRUPPEN, KATEGORIEN, STATUS, leererEinsatzstand } from "./struktur.js";

export const MAX_MENGE = 1000000;
const MAX_TEXT = { kennung: 40, bezeichnung: 120, standort: 120, bemerkungen: 1000, stichwort: 80, ort: 120, bemerkung: 500 };

export class FachFehler extends Error { constructor(m) { super(m); this.status = 400; } }
export class NichtGefunden extends Error { constructor(m) { super(m); this.status = 404; } }
export class Konflikt extends Error { constructor(m, aktuell) { super(m); this.status = 409; this.aktuell = aktuell; } }

export const jetzt = () => new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");

// ---- Hilfen --------------------------------------------------------------
function ganzzahl(wert, feld = "Menge") {
  if (typeof wert === "string" && /^\s*\d+\s*$/.test(wert)) wert = Number(wert.trim());
  if (typeof wert !== "number" || !Number.isInteger(wert)) throw new FachFehler(`${feld}: Bitte eine ganze Zahl eingeben.`);
  if (wert < 0) throw new FachFehler(`${feld}: Negative Werte sind nicht zulässig.`);
  if (wert > MAX_MENGE) throw new FachFehler(`${feld}: Wert ist unplausibel hoch (max. 1.000.000).`);
  return wert;
}

const FELDNAME = { kennung: "Kennung", bezeichnung: "Bezeichnung", standort: "Standort", bemerkungen: "Bemerkungen",
  stichwort: "Einsatzstichwort", ort: "Einsatzort / Objekt", bemerkung: "Bemerkung" };

function text(wert, feld, pflicht = false) {
  if (wert === null || wert === undefined) wert = "";
  if (typeof wert !== "string") throw new FachFehler(`${FELDNAME[feld]}: Ungültiger Text.`);
  wert = wert.trim();
  if (pflicht && !wert) throw new FachFehler(`${FELDNAME[feld]} ist ein Pflichtfeld.`);
  if (wert.length > MAX_TEXT[feld]) throw new FachFehler(`${FELDNAME[feld]}: maximal ${MAX_TEXT[feld]} Zeichen.`);
  return wert;
}

const benutzerName = (b) => (b ? String(b).trim().slice(0, 60) || null : null);

export function kategorie(key) {
  const k = KATEGORIEN.find((x) => x.key === key);
  if (!k) throw new NichtGefunden(`Unbekannte Kategorie: ${key}`);
  return k;
}
const statusKeys = (bereich) => STATUS[bereich].map((s) => s.key);

function offen(einsatz) {
  if (!einsatz) throw new NichtGefunden("Einsatz existiert nicht.");
  if (einsatz.status !== "laufend") throw new FachFehler("Dieser Einsatz ist beendet und kann nicht mehr geändert werden.");
}

function mengen(einsatz, katKey) {
  const m = {};
  for (const [s, e] of Object.entries(einsatz.stand.bestand[katKey] || {})) m[s] = e.menge;
  return m;
}

function eintrag(einsatz, bereich, katKey, ziel, aktion, alt, neu, benutzer, quelle = "manuell") {
  const s = (v) => (v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));
  return {
    einsatz_id: einsatz ? einsatz.id : null,
    zeitpunkt: jetzt(), bereich, kategorie_key: katKey, ziel, aktion,
    alter_wert: s(alt), neuer_wert: s(neu), benutzer, quelle,
  };
}
const katEintrag = (einsatz, kat, ...rest) => eintrag(einsatz, kat.bereich, kat.key, ...rest);

function abschluss(einsatz, eintraege) {
  if (einsatz && eintraege.length) einsatz.letzte_aenderung = eintraege[eintraege.length - 1].zeitpunkt;
  return eintraege;
}

// ---- Einsätze ------------------------------------------------------------
/**
 * Legt einen Einsatz an. `optionen.standarddaten` übernimmt den hinterlegten
 * Standarddatensatz – VORBEREITET, solange stamm.standarddatensatz leer ist, gesperrt.
 */
export function einsatzAnlegen(stamm, daten, benutzer, optionen = {}) {
  benutzer = benutzerName(benutzer);
  const art = EINSATZARTEN.find((a) => a.key === daten?.art);
  if (!art) throw new FachFehler("Bitte die Art des Einsatzes wählen.");
  if (!art.verfuegbar) throw new FachFehler(`${art.name} folgt in einer späteren Version.`);
  const stichwort = text(daten.stichwort, "stichwort", true);
  const ort = text(daten.ort, "ort", true);
  const bemerkung = text(daten.bemerkung, "bemerkung");
  if (optionen.standarddaten && !stamm.standarddatensatz) {
    throw new FachFehler("Es ist noch kein Standarddatensatz hinterlegt.");
  }

  const beginn = jetzt();
  const jahr = beginn.slice(0, 4);
  const lfd = (stamm.einsatz_zaehler[jahr] || 0) + 1;
  const einsatz = {
    id: stamm.naechste_einsatz_id,
    nummer: `${jahr}-${String(lfd).padStart(3, "0")}`,
    art: art.key, stichwort, ort, bemerkung,
    beginn, ende: null, status: "laufend",
    angelegt_von: benutzer,
    startbestand: optionen.standarddaten ? "standarddaten" : "leer",
    stand: leererEinsatzstand(),
    letzte_aenderung: beginn,
  };
  const eintraege = [eintrag(einsatz, "einsatz", "einsatz", "einsatz", "angelegt", null,
    { nummer: einsatz.nummer, art: art.name, stichwort, ort, bemerkung }, benutzer)];
  if (optionen.standarddaten) eintraege.push(...standarddatenAnwenden(stamm, einsatz, benutzer));
  stamm.naechste_einsatz_id += 1;
  stamm.einsatz_zaehler[jahr] = lfd;
  return { einsatz, eintraege: abschluss(einsatz, eintraege) };
}

/**
 * VORBEREITET für den Standarddatensatz (Excel folgt).
 * Erwartetes Format: { mengen: { katKey: { statusKey: Zahl } },
 *                      objekt_status: { objektId: statusKey } }
 */
export function standarddatenAnwenden(stamm, einsatz, benutzer) {
  const sd = stamm.standarddatensatz;
  if (!sd) throw new FachFehler("Es ist noch kein Standarddatensatz hinterlegt.");
  const paket = {};
  for (const [k, werte] of Object.entries(sd.mengen || {})) {
    paket[k] = Object.fromEntries(Object.entries(werte).map(([s, v]) => [s, { neu: v, erwartet: null }]));
  }
  const eintraege = bestaendeUebernehmen(einsatz, paket, benutzer, "standarddatensatz");
  for (const [id, statusKey] of Object.entries(sd.objekt_status || {})) {
    const o = stamm.objekte.find((x) => x.id === Number(id) && x.aktiv);
    if (!o) continue;
    const kat = kategorie(o.kategorie_key);
    if (!statusKeys(kat.bereich).includes(statusKey)) throw new FachFehler(`Standarddatensatz: ungültiger Status bei ${o.kennung}.`);
    einsatz.stand.objekt_status[o.id] = { status_key: statusKey, standort: "", bemerkungen: "", version: 1, am: jetzt() };
    eintraege.push(katEintrag(einsatz, kat, `objekt:${o.kennung}`, "status", null, { status_key: statusKey }, benutzer, "standarddatensatz"));
  }
  return eintraege;
}

export function einsatzBeenden(einsatz, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  einsatz.status = "beendet";
  einsatz.ende = jetzt();
  einsatz.beendet_von = benutzer;
  return abschluss(einsatz, [eintrag(einsatz, "einsatz", "einsatz", "einsatz", "beendet", "laufend", "beendet", benutzer)]);
}

export function einsatzKurz(e) {
  const { stand, ...rest } = e;
  return { ...rest, art_name: EINSATZARTEN.find((a) => a.key === e.art)?.name || e.art };
}

// ---- Lesen / Berechnen ---------------------------------------------------
function einzelobjekteImEinsatz(stamm, einsatz, katKey) {
  // Aktive Objekte der Fahrzeugliste + ausgemusterte, die in diesem Einsatz einen Status haben
  return stamm.objekte.filter((o) => o.kategorie_key === katKey && (o.aktiv || einsatz.stand.objekt_status[o.id]));
}

function kategorieAuswerten(stamm, einsatz, kat) {
  const status = STATUS[kat.bereich];
  const keys = status.map((s) => s.key);
  const verfKey = status.find((s) => s.verfuegbar)?.key;
  let m;
  let erf;
  let anzahlObjekte = 0;
  if (kat.erfassungsart === "einzeln") {
    const obj = einzelobjekteImEinsatz(stamm, einsatz, kat.key);
    const mitStatus = obj.filter((o) => einsatz.stand.objekt_status[o.id]);
    anzahlObjekte = obj.length;
    const leer = obj.length === 0 && einsatz.stand.leer_bestaetigt[kat.key];
    if (leer) { erf = "vollstaendig"; }
    else if (!mitStatus.length) { erf = "nicht_erfasst"; }
    else { erf = mitStatus.length === obj.length ? "vollstaendig" : "teilweise"; }
    m = Object.fromEntries(keys.map((k) => [k, erf === "nicht_erfasst" ? null
      : mitStatus.filter((o) => einsatz.stand.objekt_status[o.id].status_key === k).length]));
  } else {
    const vorhanden = mengen(einsatz, kat.key);
    m = Object.fromEntries(keys.map((k) => [k, vorhanden[k] ?? null]));
    const n = Object.values(m).filter((v) => v !== null).length;
    erf = n === 0 ? "nicht_erfasst" : n === keys.length ? "vollstaendig" : "teilweise";
  }
  const werte = Object.values(m).filter((v) => v !== null);
  return {
    key: kat.key, name: kat.name, einheit: kat.einheit, gruppe_key: kat.gruppe,
    erfassungsart: kat.erfassungsart, einzeln_moeglich: false,
    anzahl_objekte: anzahlObjekte, mengen: m, erfassungsstand: erf,
    gesamt: werte.length ? werte.reduce((a, b) => a + b, 0) : null,
    verfuegbar: verfKey ? m[verfKey] : null,
  };
}

function gruppeAuswerten(g, kategorien, status) {
  const glieder = kategorien.filter((k) => k.gruppe_key === g.key);
  const staende = new Set(glieder.map((k) => k.erfassungsstand));
  const erf = !staende.size ? "nicht_erfasst"
    : staende.size === 1 && !staende.has("teilweise") ? [...staende][0] : "teilweise";
  const e = { key: g.key, name: g.name, unterteilung: g.unterteilung, summierbar: g.summierbar,
    kategorien: glieder.map((k) => k.key), erfassungsstand: erf };
  if (g.summierbar) {
    e.mengen = {};
    for (const s of status) {
      const w = glieder.map((k) => k.mengen[s.key]).filter((v) => v !== null);
      e.mengen[s.key] = w.length ? w.reduce((a, b) => a + b, 0) : null;
    }
    const ges = glieder.map((k) => k.gesamt).filter((v) => v !== null);
    e.gesamt = ges.length ? ges.reduce((a, b) => a + b, 0) : null;
  }
  return e;
}

export function uebersicht(stamm, einsatz) {
  const bereiche = BEREICHE.map((b) => {
    const status = STATUS[b.key];
    const kategorien = KATEGORIEN.filter((k) => k.bereich === b.key).map((k) => kategorieAuswerten(stamm, einsatz, k));
    const gruppen = GRUPPEN.filter((g) => g.bereich === b.key).map((g) => gruppeAuswerten(g, kategorien, status));
    return { key: b.key, name: b.name, status, kategorien, gruppen,
      erfasst: kategorien.some((k) => k.erfassungsstand !== "nicht_erfasst") };
  });
  const alle = bereiche.flatMap((b) => b.gruppen);
  return {
    einsatz: einsatzKurz(einsatz),
    bereiche,
    letzte_aktualisierung: einsatz.letzte_aenderung,
    letzte_sicherung: stamm.letzte_sicherung,
    standarddatensatz_vorhanden: !!stamm.standarddatensatz,
    erfassung: {
      gruppen_gesamt: alle.length,
      gruppen_vollstaendig: alle.filter((g) => g.erfassungsstand === "vollstaendig").length,
      gruppen_teilweise: alle.filter((g) => g.erfassungsstand === "teilweise").length,
    },
  };
}

// ---- Mengen --------------------------------------------------------------
export function bestandSetzen(einsatz, katKey, aenderungen, benutzer, quelle = "manuell") {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(katKey);
  if (kat.erfassungsart !== "menge") throw new FachFehler(`${kat.name} wird über Einzelobjekte erfasst.`);
  if (!aenderungen || typeof aenderungen !== "object" || !Object.keys(aenderungen).length) throw new FachFehler("Keine Änderungen übergeben.");
  const gueltig = statusKeys(kat.bereich);
  const aktuell = mengen(einsatz, katKey);
  const geprueft = {};
  for (const [s, a] of Object.entries(aenderungen)) {
    if (!gueltig.includes(s)) throw new FachFehler(`Unbekannter Status: ${s}`);
    if (!a || typeof a !== "object" || !("neu" in a) || !("erwartet" in a)) throw new FachFehler("Jede Änderung braucht 'neu' und 'erwartet'.");
    if (a.neu === null) throw new FachFehler("Ein erfasster Wert kann nicht geleert werden. Bitte eine Zahl eintragen.");
    geprueft[s] = [a.erwartet === null ? null : ganzzahl(a.erwartet, "Erwarteter Wert"), ganzzahl(a.neu)];
  }
  if (Object.entries(geprueft).some(([s, [erw]]) => (aktuell[s] ?? null) !== erw)) {
    throw new Konflikt(`${kat.name}: Werte wurden zwischenzeitlich geändert. Bitte aktuelle Werte prüfen und erneut speichern.`,
      Object.fromEntries(gueltig.map((s) => [s, aktuell[s] ?? null])));
  }
  const eintraege = [];
  einsatz.stand.bestand[katKey] ||= {};
  for (const [s, [alt, neu]] of Object.entries(geprueft)) {
    if (alt === neu) continue;
    einsatz.stand.bestand[katKey][s] = { menge: neu, am: jetzt(), von: benutzer };
    eintraege.push(katEintrag(einsatz, kat, `menge:${s}`, alt === null ? "erfasst" : "geaendert", alt, neu, benutzer, quelle));
  }
  return abschluss(einsatz, eintraege);
}

/** Schnelländerung um +1 / −1 (Plus-/Minus-Knöpfe). Liest den aktuellen Wert selbst – kein Konflikt möglich. */
export function mengeAendern(einsatz, katKey, statusKey, delta, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(katKey);
  if (kat.erfassungsart !== "menge") throw new FachFehler(`${kat.name} wird über Einzelobjekte erfasst.`);
  if (!statusKeys(kat.bereich).includes(statusKey)) throw new FachFehler(`Unbekannter Status: ${statusKey}`);
  if (delta !== 1 && delta !== -1) throw new FachFehler("Ungültige Änderung.");
  const alt = mengen(einsatz, katKey)[statusKey] ?? null;
  if (alt === null && delta < 0) throw new FachFehler("Noch nicht erfasst – zuerst + tippen oder einen Wert eintragen.");
  const neu = (alt ?? 0) + delta;
  if (neu < 0) throw new FachFehler("Weniger als 0 ist nicht möglich.");
  if (neu > MAX_MENGE) throw new FachFehler("Wert ist unplausibel hoch.");
  einsatz.stand.bestand[katKey] ||= {};
  einsatz.stand.bestand[katKey][statusKey] = { menge: neu, am: jetzt(), von: benutzer };
  return abschluss(einsatz, [katEintrag(einsatz, kat, `menge:${statusKey}`, alt === null ? "erfasst" : "geaendert", alt, neu, benutzer)]);
}

/** Bestätigt bewusst 0 für alle noch nicht erfassten Kräfte-Status (Start mit 0 Kräften). */
export function kraefteNullBestaetigen(einsatz, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const paket = {};
  for (const k of KATEGORIEN.filter((x) => x.bereich === "kraefte")) {
    const m = mengen(einsatz, k.key);
    const offenStatus = statusKeys("kraefte").filter((s) => m[s] === undefined);
    if (offenStatus.length) paket[k.key] = Object.fromEntries(offenStatus.map((s) => [s, { neu: 0, erwartet: null }]));
  }
  if (!Object.keys(paket).length) throw new FachFehler("Alle Kräfte sind bereits erfasst.");
  return bestaendeUebernehmen(einsatz, paket, benutzer, "manuell");
}

/** Mehrere Kategorien in einem Schritt – Grundlage für den Standarddatensatz. */
export function bestaendeUebernehmen(einsatz, paket, benutzer, quelle = "manuell") {
  if (!paket || typeof paket !== "object" || !Object.keys(paket).length) throw new FachFehler("Keine Änderungen übergeben.");
  const kopie = structuredClone(einsatz);
  const eintraege = [];
  for (const [k, a] of Object.entries(paket)) eintraege.push(...bestandSetzen(kopie, k, a, benutzer, quelle));
  Object.assign(einsatz, kopie);
  return eintraege;
}

export function umbuchen(einsatz, katKey, von, nach, anzahl, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  anzahl = ganzzahl(anzahl, "Anzahl");
  if (anzahl === 0) throw new FachFehler("Anzahl muss größer als 0 sein.");
  if (von === nach) throw new FachFehler("Quell- und Zielstatus müssen sich unterscheiden.");
  const kat = kategorie(katKey);
  if (kat.erfassungsart !== "menge") throw new FachFehler(`${kat.name} wird über Einzelobjekte erfasst.`);
  const gueltig = statusKeys(kat.bereich);
  if (!gueltig.includes(von) || !gueltig.includes(nach)) throw new FachFehler("Unbekannter Status.");
  const m = mengen(einsatz, katKey);
  if (m[von] === undefined || m[nach] === undefined) throw new FachFehler("Umbuchen ist erst möglich, wenn beide Status erfasst sind.");
  if (m[von] < anzahl) throw new FachFehler(`Im Quellstatus sind nur ${m[von]} vorhanden.`);
  const eintraege = [];
  for (const [s, neu] of [[von, m[von] - anzahl], [nach, m[nach] + anzahl]]) {
    einsatz.stand.bestand[katKey][s] = { menge: neu, am: jetzt(), von: benutzer };
    eintraege.push(katEintrag(einsatz, kat, `menge:${s}`, "umgebucht", m[s], neu, benutzer));
  }
  return abschluss(einsatz, eintraege);
}

export function leerBestaetigen(stamm, einsatz, katKey, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(katKey);
  if (kat.erfassungsart !== "einzeln") throw new FachFehler("Bei Mengenerfassung bitte 0 direkt eintragen.");
  if (einzelobjekteImEinsatz(stamm, einsatz, katKey).length) throw new FachFehler("Es sind bereits Objekte in der Liste.");
  if (einsatz.stand.leer_bestaetigt[katKey]) return [];
  einsatz.stand.leer_bestaetigt[katKey] = true;
  return abschluss(einsatz, [katEintrag(einsatz, kat, "bestand", "bestaetigt", "nicht erfasst", 0, benutzer)]);
}

// ---- Einzelobjekte (Fahrzeugliste + Status im Einsatz) -------------------
// Version eines Objekts im Einsatz = "Stammversion.Statusversion"
const versionVon = (o, st) => `${o.version}.${st ? st.version : 0}`;

function objektAnsicht(o, einsatz) {
  const st = einsatz.stand.objekt_status[o.id];
  return {
    id: o.id, kategorie_key: o.kategorie_key, kennung: o.kennung, bezeichnung: o.bezeichnung, aktiv: o.aktiv,
    status_key: st?.status_key ?? null, standort: st?.standort ?? "", bemerkungen: st?.bemerkungen ?? "",
    version: versionVon(o, st),
  };
}

export function objekte(stamm, einsatz, katKey) {
  if (katKey) kategorie(katKey);
  return stamm.objekte
    .filter((o) => (!katKey || o.kategorie_key === katKey) && (o.aktiv || einsatz.stand.objekt_status[o.id]))
    .map((o) => objektAnsicht(o, einsatz))
    .sort((a, b) => a.kennung.localeCompare(b.kennung, "de", { sensitivity: "base", numeric: true }));
}

function kennungFrei(stamm, kennung, ausserId = null) {
  const k = kennung.toLocaleLowerCase("de");
  const dabei = stamm.objekte.find((o) => o.id !== ausserId && o.aktiv && o.kennung.toLocaleLowerCase("de") === k);
  if (dabei) throw new FachFehler(`Die Kennung „${kennung}“ ist bereits vergeben.`);
}

function objektFelder(daten, kat) {
  if (!daten || typeof daten !== "object") throw new FachFehler("Ungültige Daten.");
  if (!statusKeys(kat.bereich).includes(daten.status_key)) throw new FachFehler("Bitte einen Status für diesen Einsatz wählen.");
  return {
    kennung: text(daten.kennung, "kennung", true),
    bezeichnung: text(daten.bezeichnung, "bezeichnung", true),
    status_key: daten.status_key,
    standort: text(daten.standort, "standort"),
    bemerkungen: text(daten.bemerkungen, "bemerkungen"),
  };
}

/** Neues Fahrzeug / neuer AB: kommt in die Fahrzeugliste (für alle künftigen Einsätze) und bekommt einen Status in diesem Einsatz. */
export function objektAnlegen(stamm, einsatz, daten, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(daten?.kategorie_key);
  if (kat.erfassungsart !== "einzeln") throw new FachFehler(`${kat.name} wird als Menge erfasst.`);
  const f = objektFelder(daten, kat);
  kennungFrei(stamm, f.kennung);
  const o = { id: stamm.naechste_objekt_id, kategorie_key: kat.key, kennung: f.kennung, bezeichnung: f.bezeichnung, aktiv: true, version: 1 };
  stamm.naechste_objekt_id += 1;
  stamm.objekte.push(o);
  einsatz.stand.objekt_status[o.id] = { status_key: f.status_key, standort: f.standort, bemerkungen: f.bemerkungen, version: 1, am: jetzt() };
  delete einsatz.stand.leer_bestaetigt[kat.key];
  return { objekt: objektAnsicht(o, einsatz), eintraege: abschluss(einsatz, [katEintrag(einsatz, kat, `objekt:${f.kennung}`, "angelegt", null, f, benutzer)]) };
}

export function objektAendern(stamm, einsatz, id, daten, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const o = stamm.objekte.find((x) => x.id === id);
  if (!o) throw new NichtGefunden("Objekt existiert nicht (mehr).");
  const kat = kategorie(o.kategorie_key);
  const st = einsatz.stand.objekt_status[o.id];
  if (daten?.version !== versionVon(o, st)) {
    throw new Konflikt("Das Objekt wurde zwischenzeitlich geändert. Bitte aktuelle Daten prüfen.", objektAnsicht(o, einsatz));
  }
  const f = objektFelder(daten, kat);
  kennungFrei(stamm, f.kennung, id);
  const vorher = objektAnsicht(o, einsatz);
  const diffAlt = {};
  const diffNeu = {};
  for (const k of Object.keys(f)) if (vorher[k] !== f[k]) { diffAlt[k] = vorher[k]; diffNeu[k] = f[k]; }
  if (!Object.keys(diffAlt).length) return { objekt: vorher, eintraege: [] };

  if (f.kennung !== o.kennung || f.bezeichnung !== o.bezeichnung) {
    o.kennung = f.kennung;
    o.bezeichnung = f.bezeichnung;
    o.version += 1;
  }
  if (!st || st.status_key !== f.status_key || st.standort !== f.standort || st.bemerkungen !== f.bemerkungen) {
    einsatz.stand.objekt_status[o.id] = { status_key: f.status_key, standort: f.standort, bemerkungen: f.bemerkungen,
      version: (st?.version || 0) + 1, am: jetzt() };
  }
  const aktion = !st ? "erfasst" : Object.keys(diffAlt).length === 1 && "status_key" in diffAlt ? "status" : "geaendert";
  return { objekt: objektAnsicht(o, einsatz),
    eintraege: abschluss(einsatz, [katEintrag(einsatz, kat, `objekt:${vorher.kennung}`, aktion, diffAlt, diffNeu, benutzer)]) };
}

/**
 * Entfernt ein Objekt aus der Fahrzeugliste (künftige Einsätze) und aus diesem Einsatz.
 * Beendete Einsätze behalten ihre Angaben – das Objekt wird nur ausgemustert, nie gelöscht.
 */
export function objektAusmustern(stamm, einsatz, id, version, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const o = stamm.objekte.find((x) => x.id === id);
  if (!o) throw new NichtGefunden("Objekt existiert nicht (mehr).");
  const st = einsatz.stand.objekt_status[o.id];
  if (version !== versionVon(o, st)) throw new Konflikt("Das Objekt wurde zwischenzeitlich geändert. Bitte erneut prüfen.", objektAnsicht(o, einsatz));
  const vorher = objektAnsicht(o, einsatz);
  o.aktiv = false;
  o.version += 1;
  delete einsatz.stand.objekt_status[o.id];
  const { kennung, bezeichnung, status_key, standort, bemerkungen } = vorher;
  return abschluss(einsatz, [katEintrag(einsatz, kategorie(o.kategorie_key), `objekt:${kennung}`, "geloescht",
    { kennung, bezeichnung, status_key, standort, bemerkungen }, null, benutzer)]);
}

/** Schnellwahl des Status in der Fahrzeugliste (ein Tipp). Standort/Bemerkungen bleiben erhalten. */
export function objektStatusSetzen(stamm, einsatz, id, statusKey, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const o = stamm.objekte.find((x) => x.id === id);
  if (!o) throw new NichtGefunden("Objekt existiert nicht (mehr).");
  const kat = kategorie(o.kategorie_key);
  if (!statusKeys(kat.bereich).includes(statusKey)) throw new FachFehler("Ungültiger Status.");
  const st = einsatz.stand.objekt_status[o.id];
  if (st?.status_key === statusKey) return [];
  einsatz.stand.objekt_status[o.id] = { status_key: statusKey, standort: st?.standort ?? "", bemerkungen: st?.bemerkungen ?? "",
    version: (st?.version || 0) + 1, am: jetzt() };
  delete einsatz.stand.leer_bestaetigt[kat.key];
  return abschluss(einsatz, [katEintrag(einsatz, kat, `objekt:${o.kennung}`, st ? "status" : "erfasst",
    st ? { status_key: st.status_key } : null, { status_key: statusKey }, benutzer)]);
}
