// Dauerhafte Speicherung auf dem Gerät (IndexedDB).
//
// Speicher:  stamm      – ein Datensatz "stamm" (Fahrzeugliste, Zähler, Standarddatensatz)
//            einsaetze  – ein Datensatz je Einsatz (keyPath id)
//            protokoll  – Änderungsprotokoll (autoIncrement, Index einsatz_id)
//
// Jede Schreiboperation liest Stammdaten und Einsatz, ändert sie und schreibt
// beides samt Protokolleinträgen in EINER Transaktion.

import { migriereV2zuV3 } from "./migration.js";
import { SCHEMA_VERSION, leereStammdaten } from "./struktur.js";

const DB_NAME = "firecommand";
const DB_VERSION = 2;

let dbPromise = null;

function oeffnen() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in self)) return reject(new Error("Dieser Browser kann keine Daten dauerhaft speichern."));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      // Version 1 (ohne Einsätze) wurde nie produktiv genutzt und wird ersetzt.
      if (ev.oldVersion < 2) {
        for (const n of [...db.objectStoreNames]) db.deleteObjectStore(n);
        db.createObjectStore("stamm");
        db.createObjectStore("einsaetze", { keyPath: "id" });
        const p = db.createObjectStore("protokoll", { keyPath: "id", autoIncrement: true });
        p.createIndex("einsatz", "einsatz_id");
      }
    };
    req.onsuccess = () => schemaAktualisieren(req.result).then(() => resolve(req.result), reject);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Datenspeicher ist blockiert. Bitte andere FIRECOMMAND-Fenster schließen."));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Hebt gespeicherte Daten einmalig auf das aktuelle Schema – in EINER Transaktion. */
function schemaAktualisieren(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["stamm", "einsaetze", "protokoll"], "readwrite");
    const done = fertig(tx);
    const s = tx.objectStore("stamm").get("stamm");
    s.onsuccess = () => {
      const stamm = s.result;
      if (!stamm || (stamm.schema || 2) >= SCHEMA_VERSION) return;
      const e = tx.objectStore("einsaetze").getAll();
      e.onsuccess = () => {
        try {
          const einsaetze = e.result;
          const eintraege = migriereV2zuV3(stamm, einsaetze);
          tx.objectStore("stamm").put(stamm, "stamm");
          for (const x of einsaetze) tx.objectStore("einsaetze").put(x);
          for (const x of eintraege) tx.objectStore("protokoll").add(x);
        } catch (err) {
          tx.abort();
          reject(err);
        }
      };
    };
    done.then(resolve, reject);
  });
}

function fertig(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Speichern abgebrochen."));
  });
}

export async function lesen(einsatzId = null) {
  const db = await oeffnen();
  const tx = db.transaction(["stamm", "einsaetze"], "readonly");
  const s = tx.objectStore("stamm").get("stamm");
  const e = einsatzId !== null ? tx.objectStore("einsaetze").get(einsatzId) : null;
  await fertig(tx);
  return { stamm: s.result || leereStammdaten(), einsatz: e ? e.result || null : null };
}

export async function einsaetzeLesen() {
  const db = await oeffnen();
  const tx = db.transaction("einsaetze", "readonly");
  const r = tx.objectStore("einsaetze").getAll();
  await fertig(tx);
  return r.result;
}

/**
 * Führt `aendern({ stamm, einsatz })` atomar aus. `aendern` ist synchron, darf
 * beide Objekte verändern und gibt { eintraege, ergebnis, neuerEinsatz } zurück.
 * Wirft `aendern`, wird nichts gespeichert.
 */
export async function schreiben(einsatzId, aendern) {
  const db = await oeffnen();
  const tx = db.transaction(["stamm", "einsaetze", "protokoll"], "readwrite");
  const stammStore = tx.objectStore("stamm");
  const einsatzStore = tx.objectStore("einsaetze");
  const protokoll = tx.objectStore("protokoll");
  const done = fertig(tx);
  let fehler = null;
  let ergebnis;
  let stamm;
  let einsatz = null;
  let offen = einsatzId !== null ? 2 : 1;

  const weiter = () => {
    if (--offen > 0) return;
    try {
      const r = aendern({ stamm, einsatz }) || {};
      ergebnis = r.ergebnis;
      stammStore.put(stamm, "stamm");
      if (einsatz) einsatzStore.put(einsatz);
      if (r.neuerEinsatz) einsatzStore.add(r.neuerEinsatz);
      for (const e of r.eintraege || []) protokoll.add(e);
    } catch (e) {
      fehler = e;
      tx.abort();
    }
  };
  const s = stammStore.get("stamm");
  s.onsuccess = () => { stamm = s.result || leereStammdaten(); weiter(); };
  if (einsatzId !== null) {
    const e = einsatzStore.get(einsatzId);
    e.onsuccess = () => { einsatz = e.result || null; weiter(); };
  }
  try {
    await done;
  } catch (e) {
    throw fehler || e;
  }
  return ergebnis;
}

export async function protokollLesen(einsatzId = undefined, limit = Infinity) {
  const db = await oeffnen();
  const tx = db.transaction("protokoll", "readonly");
  const store = tx.objectStore("protokoll");
  const req = einsatzId === undefined ? store.getAll() : store.index("einsatz").getAll(einsatzId);
  await fertig(tx);
  return req.result.sort((a, b) => b.id - a.id).slice(0, limit);
}

/** Ersetzt den kompletten Datenbestand (Wiederherstellen einer Sicherung). */
export async function ersetzen(stamm, einsaetze, eintraege) {
  const db = await oeffnen();
  const tx = db.transaction(["stamm", "einsaetze", "protokoll"], "readwrite");
  const done = fertig(tx);
  tx.objectStore("stamm").put(stamm, "stamm");
  const es = tx.objectStore("einsaetze");
  es.clear();
  for (const e of einsaetze) es.put(e);
  const p = tx.objectStore("protokoll");
  p.clear();
  for (const e of eintraege) {
    const { id, ...rest } = e;
    p.add(rest);
  }
  await done;
}

/** Bittet das Betriebssystem, die Daten nicht automatisch zu löschen. */
export async function dauerhaftAnfordern() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
