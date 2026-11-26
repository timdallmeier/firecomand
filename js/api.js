// Lokale Schnittstelle der iPad-Version. Alle Daten bleiben auf dem Gerät (IndexedDB).
// Einsatzbezogene Aufrufe arbeiten auf dem aktuell geöffneten Einsatz (setzeEinsatz).

import * as svc from "./daten/service.js";
import * as speicher from "./daten/speicher.js";
import { sicherungErstellen, sicherungPruefen } from "./daten/sicherung.js";

export class ApiFehler extends Error {
  constructor(meldung, status, aktuell) {
    super(meldung);
    this.status = status;
    this.aktuell = aktuell;
  }
  get istKonflikt() { return this.status === 409; }
}

let bearbeiter = null;
let einsatzId = null;
export function setzeBearbeiter(name) { bearbeiter = name || null; }
export function setzeEinsatz(id) { einsatzId = id; }

async function ausfuehren(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiFehler) throw e;
    if (e?.status) throw new ApiFehler(e.message, e.status, e.aktuell);
    console.error(e);
    throw new ApiFehler(`Speichern auf dem Gerät fehlgeschlagen – nichts wurde geändert. (${e?.message || e})`, 500);
  }
}

async function lesenEinsatz() {
  const { stamm, einsatz } = await speicher.lesen(einsatzId);
  if (!einsatz) throw new svc.NichtGefunden("Einsatz existiert nicht.");
  return { stamm, einsatz };
}

// Im aktuellen Einsatz schreiben, danach die neue Übersicht liefern
const imEinsatz = (fn) => ausfuehren(async () => {
  await speicher.schreiben(einsatzId, ({ stamm, einsatz }) => {
    if (!einsatz) throw new svc.NichtGefunden("Einsatz existiert nicht.");
    return { eintraege: fn(stamm, einsatz) };
  });
  const { stamm, einsatz } = await lesenEinsatz();
  return svc.uebersicht(stamm, einsatz);
});

const objektAktion = (fn) => ausfuehren(() => speicher.schreiben(einsatzId, ({ stamm, einsatz }) => {
  if (!einsatz) throw new svc.NichtGefunden("Einsatz existiert nicht.");
  const r = fn(stamm, einsatz);
  return Array.isArray(r) ? { eintraege: r } : { eintraege: r.eintraege, ergebnis: r.objekt };
}));

export const api = {
  // ---- Einsätze ----
  einsaetze: () => ausfuehren(async () => (await speicher.einsaetzeLesen())
    .map(svc.einsatzKurz)
    .sort((a, b) => (a.status === b.status ? b.beginn.localeCompare(a.beginn) : a.status === "laufend" ? -1 : 1))),
  stammInfo: () => ausfuehren(async () => {
    const { stamm } = await speicher.lesen();
    return { standarddatensatz_vorhanden: !!stamm.standarddatensatz, letzte_sicherung: stamm.letzte_sicherung,
      fahrzeuge: stamm.objekte.filter((o) => o.aktiv).length, bereitstellungsraeume: stamm.bereitstellungsraeume || [] };
  }),
  einsatzAnlegen: (daten, optionen) => ausfuehren(() => speicher.schreiben(null, ({ stamm }) => {
    const r = svc.einsatzAnlegen(stamm, daten, bearbeiter, optionen);
    return { eintraege: r.eintraege, neuerEinsatz: r.einsatz, ergebnis: svc.einsatzKurz(r.einsatz) };
  })),
  einsatzBeenden: () => imEinsatz((stamm, e) => svc.einsatzBeenden(stamm, e, bearbeiter)),
  // Löscht den Einsatz mit allen zugehörigen Daten (Stand, Whiteboard, Zuordnungen, Protokoll)
  einsatzLoeschen: (id) => ausfuehren(async () => {
    const { einsatz } = await speicher.lesen(id);
    if (!einsatz) throw new svc.NichtGefunden("Einsatz existiert nicht (mehr).");
    await speicher.einsatzLoeschen(id, { einsatz_id: null, zeitpunkt: svc.jetzt(), bereich: "system", kategorie_key: "system",
      ziel: `einsatz:${einsatz.nummer}`, aktion: "einsatz_geloescht", alter_wert: `${einsatz.nummer} · ${einsatz.stichwort}`,
      neuer_wert: null, benutzer: bearbeiter, quelle: "manuell" });
    return { nummer: einsatz.nummer };
  }),
  letzteAenderung: () => ausfuehren(async () => {
    const liste = await speicher.einsaetzeLesen();
    return liste.map((e) => e.letzte_aenderung).filter(Boolean).sort().pop() || null;
  }),

  // ---- im aktuellen Einsatz ----
  uebersicht: () => ausfuehren(async () => { const { stamm, einsatz } = await lesenEinsatz(); return svc.uebersicht(stamm, einsatz); }),
  bestandSetzen: (kat, aenderungen) => imEinsatz((s, e) => svc.bestandSetzen(e, kat, aenderungen, bearbeiter)),
  mengeAendern: (kat, status, delta) => imEinsatz((s, e) => svc.mengeAendern(e, kat, status, delta, bearbeiter)),
  bestaendeSetzen: (paket) => imEinsatz((s, e) => svc.bestaendeUebernehmen(e, paket, bearbeiter)),
  abkommandieren: (kat, menge, richtung) => imEinsatz((s, e) => svc.abkommandieren(e, kat, menge, richtung, bearbeiter)),
  kraefteNull: () => imEinsatz((s, e) => svc.kraefteNullBestaetigen(e, bearbeiter)),
  umbuchen: (kat, von, nach, anzahl) => imEinsatz((s, e) => svc.umbuchen(e, kat, von, nach, anzahl, bearbeiter)),
  erfassungsart: () => Promise.reject(new ApiFehler("Die Erfassungsart ist fest vorgegeben.", 400)),
  leerBestaetigen: (kat) => imEinsatz((s, e) => svc.leerBestaetigen(s, e, kat, bearbeiter)),
  objekte: (kat) => ausfuehren(async () => { const { stamm, einsatz } = await lesenEinsatz(); return svc.objekte(stamm, einsatz, kat); }),
  objektAnlegen: (daten) => objektAktion((s, e) => svc.objektAnlegen(s, e, daten, bearbeiter)),
  objektAendern: (id, daten) => objektAktion((s, e) => svc.objektAendern(s, e, id, daten, bearbeiter)),
  objektStatus: (id, status) => objektAktion((s, e) => svc.objektStatusSetzen(s, e, id, status, bearbeiter)),
  objektStaerke: (id, aenderung) => ausfuehren(async () => {
    await speicher.schreiben(einsatzId, ({ stamm, einsatz }) => {
      if (!einsatz) throw new svc.NichtGefunden("Einsatz existiert nicht.");
      return { eintraege: svc.objektStaerkeSetzen(stamm, einsatz, id, aenderung, bearbeiter) };
    });
    const { stamm, einsatz } = await lesenEinsatz();
    return svc.objekte(stamm, einsatz).find((o) => o.id === id);
  }),
  positionen: (kat) => ausfuehren(async () => { const { einsatz } = await lesenEinsatz(); return svc.positionenLesen(einsatz, kat); }),
  positionAnlegen: (kat, daten) => imEinsatz((s, e) => svc.positionAnlegen(e, kat, daten, bearbeiter)),
  positionAendern: (kat, id, daten) => imEinsatz((s, e) => svc.positionAendern(e, kat, id, daten, bearbeiter)),
  positionLoeschen: (kat, id) => imEinsatz((s, e) => svc.positionLoeschen(e, kat, id, bearbeiter)),

  // ---- Einsatzabschnitte (Whiteboard) ----
  boardDaten: () => ausfuehren(async () => { const { stamm, einsatz } = await lesenEinsatz(); return svc.boardDaten(stamm, einsatz); }),
  board: (aktion) => ausfuehren(async () => {
    await speicher.schreiben(einsatzId, ({ stamm, einsatz }) => {
      if (!einsatz) throw new svc.NichtGefunden("Einsatz existiert nicht.");
      return { eintraege: svc.boardAktion(stamm, einsatz, aktion, bearbeiter) };
    });
    const { stamm, einsatz } = await lesenEinsatz();
    return svc.boardDaten(stamm, einsatz);
  }),
  objektLoeschen: (id, version) => objektAktion((s, e) => svc.objektAusmustern(s, e, id, version, bearbeiter)),
  protokoll: (limit = 300) => ausfuehren(() => speicher.protokollLesen(einsatzId, limit)),

  // ---- Lagebericht: alle Daten des Einsatzes ----
  lageberichtDaten: () => ausfuehren(async () => {
    const { stamm, einsatz } = await lesenEinsatz();
    return {
      uebersicht: svc.uebersicht(stamm, einsatz),
      objekte: svc.objekte(stamm, einsatz),
      board: svc.boardDaten(stamm, einsatz),
      protokoll: await speicher.protokollLesen(einsatzId),
      bearbeiter,
    };
  }),
  lageberichtProtokollieren: () => ausfuehren(() => speicher.schreiben(einsatzId, ({ einsatz }) => ({
    eintraege: [{ einsatz_id: einsatz.id, zeitpunkt: svc.jetzt(), bereich: "einsatz", kategorie_key: "einsatz",
      ziel: "lagebericht", aktion: "lagebericht", alter_wert: null, neuer_wert: null, benutzer: bearbeiter, quelle: "manuell" }],
  }))),

  // ---- Sicherung (alle Einsätze) ----
  sicherungErstellen: () => ausfuehren(async () => {
    const zeit = svc.jetzt();
    await speicher.schreiben(null, ({ stamm }) => { stamm.letzte_sicherung = zeit; return {}; });
    const { stamm } = await speicher.lesen();
    return sicherungErstellen(stamm, await speicher.einsaetzeLesen(), await speicher.protokollLesen(), bearbeiter);
  }),
  sicherungPruefen: (text) => ausfuehren(async () => sicherungPruefen(text)),
  sicherungEinspielen: (g) => ausfuehren(async () => {
    const eintrag = { einsatz_id: null, zeitpunkt: svc.jetzt(), bereich: "system", kategorie_key: "system", ziel: "sicherung",
      aktion: "wiederhergestellt", alter_wert: null, neuer_wert: g.erstellt_am, benutzer: bearbeiter, quelle: "sicherung" };
    await speicher.ersetzen(g.stamm, g.einsaetze, [...g.protokoll, eintrag]);
  }),
  dauerhaftAnfordern: () => speicher.dauerhaftAnfordern(),
};
