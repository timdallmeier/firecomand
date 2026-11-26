// Fachlogik von FIRECOMMAND – iPad-Version mit Einsätzen.
//
// Datenmodell:
//   Stammdaten  – gelten für alle Einsätze: Fahrzeugliste (Fahrzeuge, Abrollbehälter),
//                 Zähler, vorbereitete Bereitstellungsräume und Standarddatensatz.
//   Einsatz     – eigener Stand: Bestände je Kategorie, Status/Besatzung der Fahrzeuge,
//                 Whiteboard der Einsatzabschnitte, eigenes Protokoll.
//                 Beendete Einsätze sind unveränderlich.
//
// Alle Funktionen sind rein: Sie verändern die übergebenen Objekte und liefern
// Protokolleinträge zurück. Bei einem Fehler wird geworfen, BEVOR etwas geändert ist.

import {
  ABSCHNITTSARTEN, BEREICHE, BEREITSTELLUNGSRAUM_STATUS, EINSATZARTEN, FAHRZEUGSTATUS, GRUPPEN, KATEGORIEN,
  LINIENFARBEN, LINIENSTILE, STATUS, STATUS_WHITEBOARD, SYMBOLE, felder, fahrzeugstatusText, leeresBoard, leererEinsatzstand,
} from "./struktur.js";

export const MAX_MENGE = 1000000;
const MAX_TEXT = { bezeichnung: 60, standort: 120, bemerkungen: 1000, stichwort: 80, ort: 120, bemerkung: 500,
  name: 60, text: 300, label: 60, groesse: 60 };

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

const FELDNAME = { bezeichnung: "Bezeichnung", standort: "Standort", bemerkungen: "Bemerkungen", stichwort: "Einsatzstichwort",
  ort: "Einsatzort / Objekt", bemerkung: "Bemerkung", name: "Bezeichnung", text: "Text", label: "Beschriftung", groesse: "Größe" };

function text(wert, feld, pflicht = false) {
  if (wert === null || wert === undefined) wert = "";
  if (typeof wert !== "string") throw new FachFehler(`${FELDNAME[feld]}: Ungültiger Text.`);
  wert = wert.trim();
  if (pflicht && !wert) throw new FachFehler(`${FELDNAME[feld]} ist ein Pflichtfeld.`);
  if (wert.length > MAX_TEXT[feld]) throw new FachFehler(`${FELDNAME[feld]}: maximal ${MAX_TEXT[feld]} Zeichen.`);
  return wert;
}

function koordinate(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new FachFehler("Ungültige Position.");
  return Math.round(Math.max(-100000, Math.min(100000, v)));
}

const benutzerName = (b) => (b ? String(b).trim().slice(0, 60) || null : null);

export function kategorie(key) {
  const k = KATEGORIEN.find((x) => x.key === key);
  if (!k) throw new NichtGefunden(`Unbekannte Kategorie: ${key}`);
  return k;
}
const feldKeys = (kat) => felder(kat).map((s) => s.key);

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
const boardEintrag = (einsatz, ...rest) => eintrag(einsatz, "einsatzabschnitte", "einsatzabschnitte", ...rest);

function abschluss(einsatz, eintraege) {
  if (einsatz && eintraege.length) einsatz.letzte_aenderung = eintraege[eintraege.length - 1].zeitpunkt;
  return eintraege;
}

const board = (einsatz) => (einsatz.stand.board ||= leeresBoard());

// ---- Einsätze ------------------------------------------------------------
export function einsatzAnlegen(stamm, daten, benutzer, optionen = {}) {
  benutzer = benutzerName(benutzer);
  const art = EINSATZARTEN.find((a) => a.key === daten?.art);
  if (!art) throw new FachFehler("Bitte die Art des Einsatzes wählen.");
  if (!art.verfuegbar) throw new FachFehler(`${art.name} folgt in einer späteren Version.`);
  const stichwort = text(daten.stichwort, "stichwort", true);
  const ort = text(daten.ort, "ort", true);
  const bemerkung = text(daten.bemerkung, "bemerkung");
  if (optionen.standarddaten && !stamm.standarddatensatz) throw new FachFehler("Es ist noch kein Standarddatensatz hinterlegt.");

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
 * Format: { mengen: { katKey: { feld: Zahl } }, objekte: { objektId: { status, besatzung } } }
 */
export function standarddatenAnwenden(stamm, einsatz, benutzer) {
  const sd = stamm.standarddatensatz;
  if (!sd) throw new FachFehler("Es ist noch kein Standarddatensatz hinterlegt.");
  const paket = {};
  for (const [k, werte] of Object.entries(sd.mengen || {})) {
    paket[k] = Object.fromEntries(Object.entries(werte).map(([s, v]) => [s, { neu: v, erwartet: null }]));
  }
  const eintraege = Object.keys(paket).length ? bestaendeUebernehmen(einsatz, paket, benutzer, "standarddatensatz") : [];
  for (const [id, w] of Object.entries(sd.objekte || {})) {
    const o = stamm.objekte.find((x) => x.id === Number(id) && x.aktiv);
    if (!o) continue;
    const kat = kategorie(o.kategorie_key);
    const status = w.status ?? null;
    if (status !== null && !FAHRZEUGSTATUS.some((s) => s.wert === status)) throw new FachFehler(`Standarddatensatz: ungültiger Status bei ${o.bezeichnung}.`);
    const besatzung = kat.besatzung && w.besatzung !== undefined && w.besatzung !== null ? ganzzahl(w.besatzung, "Besatzung") : null;
    einsatz.stand.objekt_status[o.id] = { status, besatzung, standort: "", bemerkungen: "", version: 1, am: jetzt() };
    eintraege.push(katEintrag(einsatz, kat, `objekt:${o.bezeichnung}`, "erfasst", null, { status, besatzung }, benutzer, "standarddatensatz"));
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
  // Aktive Objekte der Fahrzeugliste + ausgemusterte, die in diesem Einsatz Angaben haben
  return stamm.objekte.filter((o) => o.kategorie_key === katKey && (o.aktiv || einsatz.stand.objekt_status[o.id]));
}

function kategorieAuswerten(stamm, einsatz, kat) {
  const f = felder(kat);
  const keys = f.map((s) => s.key);
  const basis = { key: kat.key, name: kat.name, einheit: kat.einheit, gruppe_key: kat.gruppe, typ: kat.typ,
    erfassungsart: kat.typ === "einzeln" ? "einzeln" : "menge", untergruppe: kat.untergruppe || null };

  if (kat.typ === "einzeln") {
    const obj = einzelobjekteImEinsatz(stamm, einsatz, kat.key);
    const mitStatus = obj.filter((o) => einsatz.stand.objekt_status[o.id]?.status);
    const leer = obj.length === 0 && einsatz.stand.leer_bestaetigt[kat.key];
    const erf = leer ? "vollstaendig" : !mitStatus.length ? "nicht_erfasst" : mitStatus.length === obj.length ? "vollstaendig" : "teilweise";
    const status = Object.fromEntries(FAHRZEUGSTATUS.map((s) => [s.wert,
      mitStatus.filter((o) => einsatz.stand.objekt_status[o.id].status === s.wert).length]));
    const besatzungen = obj.map((o) => einsatz.stand.objekt_status[o.id]?.besatzung).filter((v) => v !== null && v !== undefined);
    return { ...basis, anzahl_objekte: obj.length, ohne_status: obj.length - mitStatus.length,
      status_anzahl: status, mengen: {}, erfassungsstand: erf,
      gesamt: erf === "nicht_erfasst" ? null : obj.length,
      besatzung: kat.besatzung && besatzungen.length ? besatzungen.reduce((a, b) => a + b, 0) : null,
      verfuegbar: null };
  }

  const vorhanden = mengen(einsatz, kat.key);
  const m = Object.fromEntries(keys.map((k) => [k, vorhanden[k] ?? null]));

  if (kat.typ === "vorrat") {
    const gesamt = m.gesamt;
    // Abkommandiert ist 0, solange nichts abkommandiert wurde – das ist ein Ergebnis, keine Annahme.
    const abk = gesamt === null ? null : (m.abkommandiert ?? 0);
    return { ...basis, mengen: { gesamt, abkommandiert: abk }, erfassungsstand: gesamt === null ? "nicht_erfasst" : "vollstaendig",
      gesamt, abkommandiert: abk, verfuegbar: gesamt === null ? null : gesamt - abk };
  }
  if (kat.typ === "anzahl") {
    const b = m.bestand;
    return { ...basis, mengen: m, erfassungsstand: b === null ? "nicht_erfasst" : "vollstaendig", gesamt: b, verfuegbar: b };
  }
  // status
  const verfKey = f.find((s) => s.verfuegbar)?.key;
  const n = Object.values(m).filter((v) => v !== null).length;
  const werte = Object.values(m).filter((v) => v !== null);
  return { ...basis, mengen: m,
    erfassungsstand: n === 0 ? "nicht_erfasst" : n === keys.length ? "vollstaendig" : "teilweise",
    gesamt: werte.length ? werte.reduce((a, b) => a + b, 0) : null,
    verfuegbar: verfKey ? m[verfKey] : null };
}

function gruppeAuswerten(g, kategorien, status) {
  const glieder = kategorien.filter((k) => k.gruppe_key === g.key);
  const staende = new Set(glieder.map((k) => k.erfassungsstand));
  const erf = !staende.size ? "nicht_erfasst"
    : staende.size === 1 && !staende.has("teilweise") ? [...staende][0] : "teilweise";
  const e = { key: g.key, name: g.name, unterteilung: g.unterteilung, summierbar: g.summierbar, symbol: g.symbol,
    typ: glieder[0]?.typ, kategorien: glieder.map((k) => k.key), erfassungsstand: erf };
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
  const brd = board(einsatz);
  return {
    einsatz: einsatzKurz(einsatz),
    bereiche,
    letzte_aktualisierung: einsatz.letzte_aenderung,
    letzte_sicherung: stamm.letzte_sicherung,
    standarddatensatz_vorhanden: !!stamm.standarddatensatz,
    abschnitte: { anzahl: brd.abschnitte.length, zugeordnet: Object.keys(brd.zuordnung).length },
    erfassung: {
      gruppen_gesamt: alle.length,
      gruppen_vollstaendig: alle.filter((g) => g.erfassungsstand === "vollstaendig").length,
      gruppen_teilweise: alle.filter((g) => g.erfassungsstand === "teilweise").length,
    },
  };
}

// ---- Mengen --------------------------------------------------------------
function vorratPruefen(kat, m) {
  if (kat.typ !== "vorrat") return;
  if (m.abkommandiert !== undefined && m.abkommandiert !== null && (m.gesamt === undefined || m.gesamt === null)) {
    throw new FachFehler(`${kat.name}: Bitte zuerst den Gesamtbestand eintragen.`);
  }
  if ((m.abkommandiert ?? 0) > (m.gesamt ?? 0)) {
    throw new FachFehler(`${kat.name}: Abkommandiert (${m.abkommandiert} ${kat.einheit}) darf den Gesamtbestand (${m.gesamt} ${kat.einheit}) nicht übersteigen.`);
  }
}

export function bestandSetzen(einsatz, katKey, aenderungen, benutzer, quelle = "manuell") {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(katKey);
  if (kat.typ === "einzeln") throw new FachFehler(`${kat.name} wird über die Fahrzeugliste erfasst.`);
  if (!aenderungen || typeof aenderungen !== "object" || !Object.keys(aenderungen).length) throw new FachFehler("Keine Änderungen übergeben.");
  const gueltig = feldKeys(kat);
  const aktuell = mengen(einsatz, katKey);
  const geprueft = {};
  for (const [s, a] of Object.entries(aenderungen)) {
    if (!gueltig.includes(s)) throw new FachFehler(`Unbekannter Wert: ${s}`);
    if (!a || typeof a !== "object" || !("neu" in a) || !("erwartet" in a)) throw new FachFehler("Jede Änderung braucht 'neu' und 'erwartet'.");
    if (a.neu === null) throw new FachFehler("Ein erfasster Wert kann nicht geleert werden. Bitte eine Zahl eintragen.");
    geprueft[s] = [a.erwartet === null ? null : ganzzahl(a.erwartet, "Erwarteter Wert"), ganzzahl(a.neu)];
  }
  if (Object.entries(geprueft).some(([s, [erw]]) => (aktuell[s] ?? null) !== erw)) {
    throw new Konflikt(`${kat.name}: Werte wurden zwischenzeitlich geändert. Bitte aktuelle Werte prüfen und erneut speichern.`,
      Object.fromEntries(gueltig.map((s) => [s, aktuell[s] ?? null])));
  }
  vorratPruefen(kat, { ...aktuell, ...Object.fromEntries(Object.entries(geprueft).map(([s, [, n]]) => [s, n])) });
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
export function mengeAendern(einsatz, katKey, feldKey, delta, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(katKey);
  if (kat.typ === "einzeln") throw new FachFehler(`${kat.name} wird über die Fahrzeugliste erfasst.`);
  if (!feldKeys(kat).includes(feldKey)) throw new FachFehler(`Unbekannter Wert: ${feldKey}`);
  if (delta !== 1 && delta !== -1) throw new FachFehler("Ungültige Änderung.");
  const m = mengen(einsatz, katKey);
  const alt = m[feldKey] ?? null;
  if (alt === null && delta < 0) throw new FachFehler("Noch nicht erfasst – zuerst + tippen oder einen Wert eintragen.");
  const neu = (alt ?? 0) + delta;
  if (neu < 0) throw new FachFehler("Weniger als 0 ist nicht möglich.");
  if (neu > MAX_MENGE) throw new FachFehler("Wert ist unplausibel hoch.");
  vorratPruefen(kat, { ...m, [feldKey]: neu });
  einsatz.stand.bestand[katKey] ||= {};
  einsatz.stand.bestand[katKey][feldKey] = { menge: neu, am: jetzt(), von: benutzer };
  return abschluss(einsatz, [katEintrag(einsatz, kat, `menge:${feldKey}`, alt === null ? "erfasst" : "geaendert", alt, neu, benutzer)]);
}

/** Kraftstoff / Schaummittel: Menge abkommandieren (binden) oder wieder freigeben. */
export function abkommandieren(einsatz, katKey, menge, richtung, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(katKey);
  if (kat.typ !== "vorrat") throw new FachFehler(`${kat.name} kann nicht abkommandiert werden.`);
  menge = ganzzahl(menge, "Menge");
  if (menge === 0) throw new FachFehler("Bitte eine Menge größer 0 eintragen.");
  const m = mengen(einsatz, katKey);
  if (m.gesamt === undefined) throw new FachFehler(`${kat.name}: Bitte zuerst den Gesamtbestand eintragen.`);
  const alt = m.abkommandiert ?? 0;
  let neu;
  if (richtung === "binden") {
    neu = alt + menge;
    if (neu > m.gesamt) throw new FachFehler(`${kat.name}: Es sind nur ${m.gesamt - alt} ${kat.einheit} verfügbar.`);
  } else if (richtung === "freigeben") {
    if (menge > alt) throw new FachFehler(`${kat.name}: Es sind nur ${alt} ${kat.einheit} abkommandiert.`);
    neu = alt - menge;
  } else {
    throw new FachFehler("Ungültige Aktion.");
  }
  einsatz.stand.bestand[katKey].abkommandiert = { menge: neu, am: jetzt(), von: benutzer };
  return abschluss(einsatz, [katEintrag(einsatz, kat, "menge:abkommandiert", richtung === "binden" ? "abkommandiert" : "freigegeben",
    alt, neu, benutzer)]);
}

/** Bestätigt bewusst 0 für alle noch nicht erfassten Kräfte-Status (Start mit 0 Kräften). */
export function kraefteNullBestaetigen(einsatz, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const paket = {};
  for (const k of KATEGORIEN.filter((x) => x.bereich === "kraefte")) {
    const m = mengen(einsatz, k.key);
    const offenStatus = feldKeys(k).filter((s) => m[s] === undefined);
    if (offenStatus.length) paket[k.key] = Object.fromEntries(offenStatus.map((s) => [s, { neu: 0, erwartet: null }]));
  }
  if (!Object.keys(paket).length) throw new FachFehler("Alle Kräfte sind bereits erfasst.");
  return bestaendeUebernehmen(einsatz, paket, benutzer, "manuell");
}

/** Mehrere Kategorien in einem Schritt – Grundlage für Standarddatensatz und Sammel-Erfassung. */
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
  if (kat.typ !== "status") throw new FachFehler(`${kat.name} kann nicht umgebucht werden.`);
  const gueltig = feldKeys(kat);
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
  if (kat.typ !== "einzeln") throw new FachFehler("Bei Mengenerfassung bitte 0 direkt eintragen.");
  if (einzelobjekteImEinsatz(stamm, einsatz, katKey).length) throw new FachFehler("Es sind bereits Einträge in der Liste.");
  if (einsatz.stand.leer_bestaetigt[katKey]) return [];
  einsatz.stand.leer_bestaetigt[katKey] = true;
  return abschluss(einsatz, [katEintrag(einsatz, kat, "bestand", "bestaetigt", "nicht erfasst", 0, benutzer)]);
}

// ---- Fahrzeuge und Abrollbehälter ----------------------------------------
// Version eines Objekts im Einsatz = "Stammversion.Einsatzversion"
const versionVon = (o, st) => `${o.version}.${st ? st.version : 0}`;

function objektAnsicht(o, einsatz) {
  const st = einsatz.stand.objekt_status[o.id];
  const brd = board(einsatz);
  const abschnittId = brd.zuordnung[o.id] ?? null;
  return {
    id: o.id, kategorie_key: o.kategorie_key, bezeichnung: o.bezeichnung, aktiv: o.aktiv,
    status: st?.status ?? null, besatzung: st?.besatzung ?? null,
    standort: st?.standort ?? "", bemerkungen: st?.bemerkungen ?? "",
    abschnitt_id: abschnittId,
    abschnitt_name: abschnittId !== null ? brd.abschnitte.find((a) => a.id === abschnittId)?.name ?? null : null,
    version: versionVon(o, st),
  };
}

export function objekte(stamm, einsatz, katKey) {
  if (katKey) kategorie(katKey);
  return stamm.objekte
    .filter((o) => (!katKey || o.kategorie_key === katKey) && (o.aktiv || einsatz.stand.objekt_status[o.id]))
    .map((o) => objektAnsicht(o, einsatz))
    .sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung, "de", { sensitivity: "base", numeric: true }));
}

function bezeichnungFrei(stamm, bez, ausserId = null) {
  const k = bez.toLocaleLowerCase("de");
  if (stamm.objekte.some((o) => o.id !== ausserId && o.aktiv && o.bezeichnung.toLocaleLowerCase("de") === k)) {
    throw new FachFehler(`Die Bezeichnung „${bez}“ ist bereits vergeben.`);
  }
}

function statusWert(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (!FAHRZEUGSTATUS.some((s) => s.wert === n)) throw new FachFehler("Bitte einen Status von 1 bis 9 wählen.");
  return n;
}

function besatzungWert(kat, v) {
  if (!kat.besatzung || v === null || v === undefined || v === "") return null;
  return ganzzahl(v, "Besatzungsstärke");
}

function objektFelder(daten, kat) {
  if (!daten || typeof daten !== "object") throw new FachFehler("Ungültige Daten.");
  return {
    bezeichnung: text(daten.bezeichnung, "bezeichnung", true),
    status: statusWert(daten.status),
    besatzung: besatzungWert(kat, daten.besatzung),
    standort: text(daten.standort, "standort"),
    bemerkungen: text(daten.bemerkungen, "bemerkungen"),
  };
}

// Verlässt ein Fahrzeug den Whiteboard-Status, wird seine Zuordnung aufgehoben (konsistent, protokolliert).
function zuordnungPruefen(stamm, einsatz, o, benutzer) {
  const brd = board(einsatz);
  const abschnittId = brd.zuordnung[o.id];
  if (abschnittId === undefined) return [];
  if (einsatz.stand.objekt_status[o.id]?.status === STATUS_WHITEBOARD && o.aktiv) return [];
  delete brd.zuordnung[o.id];
  const a = brd.abschnitte.find((x) => x.id === abschnittId);
  return [boardEintrag(einsatz, `fahrzeug:${o.bezeichnung}`, "zuordnung_aufgehoben", a?.name ?? null, null, benutzer)];
}

/** Neuer Eintrag in der Fahrzeugliste (gilt für alle künftigen Einsätze) samt Angaben für diesen Einsatz. */
export function objektAnlegen(stamm, einsatz, daten, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const kat = kategorie(daten?.kategorie_key);
  if (kat.typ !== "einzeln") throw new FachFehler(`${kat.name} wird als Menge erfasst.`);
  const f = objektFelder(daten, kat);
  bezeichnungFrei(stamm, f.bezeichnung);
  const o = { id: stamm.naechste_objekt_id, kategorie_key: kat.key, bezeichnung: f.bezeichnung, aktiv: true, version: 1 };
  stamm.naechste_objekt_id += 1;
  stamm.objekte.push(o);
  einsatz.stand.objekt_status[o.id] = { status: f.status, besatzung: f.besatzung, standort: f.standort, bemerkungen: f.bemerkungen, version: 1, am: jetzt() };
  delete einsatz.stand.leer_bestaetigt[kat.key];
  return { objekt: objektAnsicht(o, einsatz),
    eintraege: abschluss(einsatz, [katEintrag(einsatz, kat, `objekt:${f.bezeichnung}`, "angelegt", null, f, benutzer)]) };
}

export function objektAendern(stamm, einsatz, id, daten, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const o = stamm.objekte.find((x) => x.id === id);
  if (!o) throw new NichtGefunden("Eintrag existiert nicht (mehr).");
  const kat = kategorie(o.kategorie_key);
  const st = einsatz.stand.objekt_status[o.id];
  if (daten?.version !== versionVon(o, st)) {
    throw new Konflikt("Der Eintrag wurde zwischenzeitlich geändert. Bitte aktuelle Daten prüfen.", objektAnsicht(o, einsatz));
  }
  const f = objektFelder(daten, kat);
  bezeichnungFrei(stamm, f.bezeichnung, id);
  const vorher = objektAnsicht(o, einsatz);
  const diffAlt = {};
  const diffNeu = {};
  for (const k of Object.keys(f)) if (vorher[k] !== f[k]) { diffAlt[k] = vorher[k]; diffNeu[k] = f[k]; }
  if (!Object.keys(diffAlt).length) return { objekt: vorher, eintraege: [] };
  if (f.bezeichnung !== o.bezeichnung) { o.bezeichnung = f.bezeichnung; o.version += 1; }
  einsatz.stand.objekt_status[o.id] = { status: f.status, besatzung: f.besatzung, standort: f.standort, bemerkungen: f.bemerkungen,
    version: (st?.version || 0) + 1, am: jetzt() };
  const aktion = Object.keys(diffAlt).length === 1 && "status" in diffAlt ? "status" : "geaendert";
  const eintraege = [katEintrag(einsatz, kat, `objekt:${vorher.bezeichnung}`, aktion, diffAlt, diffNeu, benutzer),
    ...zuordnungPruefen(stamm, einsatz, o, benutzer)];
  return { objekt: objektAnsicht(o, einsatz), eintraege: abschluss(einsatz, eintraege) };
}

/** Status per Auswahlmenü (1–9). Besatzung, Standort und Bemerkungen bleiben erhalten. */
export function objektStatusSetzen(stamm, einsatz, id, status, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const o = stamm.objekte.find((x) => x.id === id);
  if (!o) throw new NichtGefunden("Eintrag existiert nicht (mehr).");
  const kat = kategorie(o.kategorie_key);
  status = statusWert(status);
  const st = einsatz.stand.objekt_status[o.id];
  if ((st?.status ?? null) === status) return [];
  einsatz.stand.objekt_status[o.id] = { status, besatzung: st?.besatzung ?? null, standort: st?.standort ?? "",
    bemerkungen: st?.bemerkungen ?? "", version: (st?.version || 0) + 1, am: jetzt() };
  delete einsatz.stand.leer_bestaetigt[kat.key];
  const eintraege = [katEintrag(einsatz, kat, `objekt:${o.bezeichnung}`, "status",
    { status: st?.status ?? null }, { status }, benutzer), ...zuordnungPruefen(stamm, einsatz, o, benutzer)];
  return abschluss(einsatz, eintraege);
}

/** Besatzungsstärke um +1 / −1 oder auf einen Wert setzen. */
export function objektBesatzung(stamm, einsatz, id, { delta, wert }, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const o = stamm.objekte.find((x) => x.id === id);
  if (!o) throw new NichtGefunden("Eintrag existiert nicht (mehr).");
  const kat = kategorie(o.kategorie_key);
  if (!kat.besatzung) throw new FachFehler(`${kat.name} haben keine Besatzung.`);
  const st = einsatz.stand.objekt_status[o.id];
  const alt = st?.besatzung ?? null;
  let neu;
  if (wert !== undefined) neu = ganzzahl(wert, "Besatzungsstärke");
  else if (delta === 1 || delta === -1) {
    if (alt === null && delta < 0) throw new FachFehler("Besatzung noch nicht erfasst – zuerst + tippen.");
    neu = (alt ?? 0) + delta;
    if (neu < 0) throw new FachFehler("Weniger als 0 ist nicht möglich.");
  } else throw new FachFehler("Ungültige Änderung.");
  if (neu === alt) return [];
  einsatz.stand.objekt_status[o.id] = { status: st?.status ?? null, besatzung: neu, standort: st?.standort ?? "",
    bemerkungen: st?.bemerkungen ?? "", version: (st?.version || 0) + 1, am: jetzt() };
  return abschluss(einsatz, [katEintrag(einsatz, kat, `objekt:${o.bezeichnung}`, "geaendert",
    { besatzung: alt }, { besatzung: neu }, benutzer)]);
}

/**
 * Entfernt einen Eintrag aus der Fahrzeugliste (künftige Einsätze) und aus diesem Einsatz.
 * Beendete Einsätze behalten ihre Angaben – der Eintrag wird nur ausgemustert, nie gelöscht.
 */
export function objektAusmustern(stamm, einsatz, id, version, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  const o = stamm.objekte.find((x) => x.id === id);
  if (!o) throw new NichtGefunden("Eintrag existiert nicht (mehr).");
  const st = einsatz.stand.objekt_status[o.id];
  if (version !== versionVon(o, st)) throw new Konflikt("Der Eintrag wurde zwischenzeitlich geändert. Bitte erneut prüfen.", objektAnsicht(o, einsatz));
  const vorher = objektAnsicht(o, einsatz);
  o.aktiv = false;
  o.version += 1;
  delete einsatz.stand.objekt_status[o.id];
  const { bezeichnung, status, besatzung, standort, bemerkungen } = vorher;
  return abschluss(einsatz, [
    ...zuordnungPruefen(stamm, einsatz, o, benutzer),
    katEintrag(einsatz, kategorie(o.kategorie_key), `objekt:${bezeichnung}`, "geloescht",
      { bezeichnung, status, besatzung, standort, bemerkungen }, null, benutzer),
  ]);
}

// ---- Einsatzabschnitte (Whiteboard) --------------------------------------
const ELEMENTARTEN = { abschnitt: "abschnitte", text: "texte", symbol: "symbole", linie: "linien" };

function element(brd, art, id) {
  const liste = brd[ELEMENTARTEN[art]];
  if (!liste) throw new FachFehler("Unbekannte Elementart.");
  const e = liste.find((x) => x.id === id);
  if (!e) throw new NichtGefunden("Element existiert nicht (mehr).");
  return e;
}

function farbe(v) {
  if (v === undefined || v === null) return "weiss";
  if (!LINIENFARBEN.some((f) => f.key === v)) throw new FachFehler("Ungültige Farbe.");
  return v;
}

/** Daten für das Whiteboard: Elemente + Fahrzeuge mit Status 4 und ihre Zuordnung. */
export function boardDaten(stamm, einsatz) {
  const brd = board(einsatz);
  const fahrzeuge = objekte(stamm, einsatz, "fahrzeuge")
    .filter((o) => o.status === STATUS_WHITEBOARD && o.aktiv)
    .map((o) => ({ id: o.id, bezeichnung: o.bezeichnung, besatzung: o.besatzung, abschnitt_id: o.abschnitt_id }));
  return { board: structuredClone(brd), fahrzeuge, status_whiteboard: STATUS_WHITEBOARD };
}

/**
 * Alle Änderungen am Whiteboard. Verschieben und Ansicht werden nicht protokolliert
 * (reine Anordnung), alles Inhaltliche schon.
 */
export function boardAktion(stamm, einsatz, a, benutzer) {
  benutzer = benutzerName(benutzer);
  offen(einsatz);
  if (!a || typeof a !== "object") throw new FachFehler("Ungültige Aktion.");
  const brd = board(einsatz);
  const neueId = () => brd.naechste_id++;
  const log = (...r) => abschluss(einsatz, [boardEintrag(einsatz, ...r, benutzer)]);

  switch (a.typ) {
    case "abschnitt_neu": {
      const art = ABSCHNITTSARTEN.find((x) => x.key === a.art);
      if (!art) throw new FachFehler("Bitte eine Abschnittsart wählen.");
      const name = text(a.name, "name", true);
      const e = { id: neueId(), art: art.key, name, x: koordinate(a.x), y: koordinate(a.y) };
      brd.abschnitte.push(e);
      return log(`abschnitt:${name}`, "angelegt", null, { art: art.name, name });
    }
    case "abschnitt_aendern": {
      const e = element(brd, "abschnitt", a.id);
      const name = text(a.name, "name", true);
      const art = a.art !== undefined ? ABSCHNITTSARTEN.find((x) => x.key === a.art) : ABSCHNITTSARTEN.find((x) => x.key === e.art);
      if (!art) throw new FachFehler("Ungültige Abschnittsart.");
      if (name === e.name && art.key === e.art) return [];
      const alt = { name: e.name };
      e.name = name;
      e.art = art.key;
      return log(`abschnitt:${alt.name}`, "geaendert", alt, { name });
    }
    case "verschieben": {
      const e = element(brd, a.art, a.id);
      if (a.art === "linie") throw new FachFehler("Linien werden über ihre Endpunkte verschoben.");
      e.x = koordinate(a.x);
      e.y = koordinate(a.y);
      return [];
    }
    case "loeschen": {
      const e = element(brd, a.art, a.id);
      brd[ELEMENTARTEN[a.art]] = brd[ELEMENTARTEN[a.art]].filter((x) => x !== e);
      // Verbindungen zu diesem Element entfernen
      if (a.art !== "linie") brd.linien = brd.linien.filter((l) => !(l.art === "verbindung" && [l.von, l.nach].some((p) => p.art === a.art && p.id === a.id)));
      const eintraege = [];
      if (a.art === "abschnitt") {
        for (const [oid, aid] of Object.entries(brd.zuordnung)) {
          if (aid === e.id) {
            delete brd.zuordnung[oid];
            const o = stamm.objekte.find((x) => x.id === Number(oid));
            eintraege.push(boardEintrag(einsatz, `fahrzeug:${o?.bezeichnung ?? oid}`, "zuordnung_aufgehoben", e.name, null, benutzer));
          }
        }
        eintraege.push(boardEintrag(einsatz, `abschnitt:${e.name}`, "geloescht", { name: e.name }, null, benutzer));
      } else if (a.art === "text") eintraege.push(boardEintrag(einsatz, "text", "geloescht", e.text, null, benutzer));
      else if (a.art === "symbol") eintraege.push(boardEintrag(einsatz, `symbol:${SYMBOLE.find((s) => s.key === e.symbol)?.name}`, "geloescht", e.label || null, null, benutzer));
      else eintraege.push(boardEintrag(einsatz, "linie", "geloescht", null, null, benutzer));
      return abschluss(einsatz, eintraege);
    }
    case "zuordnen": {
      const o = stamm.objekte.find((x) => x.id === a.objekt_id && x.aktiv);
      if (!o || o.kategorie_key !== "fahrzeuge") throw new NichtGefunden("Fahrzeug existiert nicht.");
      if (einsatz.stand.objekt_status[o.id]?.status !== STATUS_WHITEBOARD) {
        throw new FachFehler(`${o.bezeichnung} hat nicht ${fahrzeugstatusText(STATUS_WHITEBOARD, true)} und kann keinem Abschnitt zugeordnet werden.`);
      }
      const altId = brd.zuordnung[o.id] ?? null;
      const neuId = a.abschnitt_id ?? null;
      const altA = altId !== null ? brd.abschnitte.find((x) => x.id === altId) : null;
      const neuA = neuId !== null ? element(brd, "abschnitt", neuId) : null;
      if (altId === neuId) return [];
      // Ein Fahrzeug ist immer höchstens EINEM Abschnitt zugeordnet (eine Zuordnung je Fahrzeug).
      if (neuId === null) delete brd.zuordnung[o.id];
      else brd.zuordnung[o.id] = neuId;
      return log(`fahrzeug:${o.bezeichnung}`, neuId === null ? "zuordnung_aufgehoben" : "zugeordnet", altA?.name ?? null, neuA?.name ?? null);
    }
    case "text_neu": {
      const t = text(a.text, "text", true);
      brd.texte.push({ id: neueId(), text: t, x: koordinate(a.x), y: koordinate(a.y) });
      return log("text", "angelegt", null, t);
    }
    case "text_aendern": {
      const e = element(brd, "text", a.id);
      const t = text(a.text, "text", true);
      if (t === e.text) return [];
      const alt = e.text;
      e.text = t;
      return log("text", "geaendert", alt, t);
    }
    case "symbol_neu": {
      const s = SYMBOLE.find((x) => x.key === a.symbol);
      if (!s) throw new FachFehler("Unbekanntes Symbol.");
      const label = text(a.label, "label");
      brd.symbole.push({ id: neueId(), symbol: s.key, label, x: koordinate(a.x), y: koordinate(a.y) });
      return log(`symbol:${s.name}`, "angelegt", null, label || null);
    }
    case "symbol_aendern": {
      const e = element(brd, "symbol", a.id);
      const label = text(a.label, "label");
      if (label === e.label) return [];
      const alt = e.label;
      e.label = label;
      return log(`symbol:${SYMBOLE.find((s) => s.key === e.symbol)?.name}`, "geaendert", alt || null, label || null);
    }
    case "linie_neu": {
      const stil = a.stil ?? "fuehrung";
      if (!LINIENSTILE.some((s) => s.key === stil)) throw new FachFehler("Ungültige Linienart.");
      const f = farbe(a.farbe);
      if (a.art === "verbindung") {
        const pruefen = (p) => {
          if (!p || !["abschnitt", "text", "symbol"].includes(p.art)) throw new FachFehler("Ungültiger Verbindungspunkt.");
          element(brd, p.art, p.id);
          return { art: p.art, id: p.id };
        };
        const von = pruefen(a.von);
        const nach = pruefen(a.nach);
        if (von.art === nach.art && von.id === nach.id) throw new FachFehler("Bitte zwei verschiedene Elemente verbinden.");
        brd.linien.push({ id: neueId(), art: "verbindung", von, nach, stil, farbe: f });
        return log("verbindung", "angelegt", null, null);
      }
      if (a.art === "frei") {
        if (!Array.isArray(a.punkte) || a.punkte.length < 2 || a.punkte.length > 2000) throw new FachFehler("Ungültige Linie.");
        const punkte = a.punkte.map((p) => [koordinate(p?.[0]), koordinate(p?.[1])]);
        brd.linien.push({ id: neueId(), art: "frei", punkte, stil, farbe: f });
        return log("linie", "angelegt", null, null);
      }
      throw new FachFehler("Ungültige Linienart.");
    }
    case "linie_aendern": {
      const e = element(brd, "linie", a.id);
      if (a.stil !== undefined) {
        if (!LINIENSTILE.some((s) => s.key === a.stil)) throw new FachFehler("Ungültige Linienart.");
        e.stil = a.stil;
      }
      if (a.farbe !== undefined) e.farbe = farbe(a.farbe);
      return [];
    }
    case "ansicht": {
      const z = Number(a.zoom);
      if (!Number.isFinite(z) || z < 0.1 || z > 5) throw new FachFehler("Ungültige Ansicht.");
      brd.ansicht = { x: koordinate(a.x), y: koordinate(a.y), zoom: Math.round(z * 1000) / 1000 };
      return [];
    }
    default:
      throw new FachFehler("Unbekannte Aktion.");
  }
}

// ---- VORBEREITET: Bereitstellungsräume (Liste folgt) ----------------------
/** Prüft einen Bereitstellungsraum. Wird genutzt, sobald die Liste ergänzt wird. */
export function bereitstellungsraumPruefen(d) {
  if (!d || typeof d !== "object") throw new FachFehler("Ungültige Daten.");
  const status = d.status ?? "verfuegbar";
  if (!BEREITSTELLUNGSRAUM_STATUS.some((s) => s.key === status)) throw new FachFehler("Ungültiger Status.");
  return {
    bezeichnung: text(d.bezeichnung, "bezeichnung", true),
    standort: text(d.standort, "standort"),
    groesse: text(d.groesse, "groesse"),
    kapazitaet_loeschzuege: d.kapazitaet_loeschzuege === null || d.kapazitaet_loeschzuege === undefined || d.kapazitaet_loeschzuege === ""
      ? null : ganzzahl(d.kapazitaet_loeschzuege, "Kapazität (Löschzüge)"),
    status,
  };
}
