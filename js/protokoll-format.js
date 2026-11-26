// Aufbereitung von Protokolleinträgen in lesbaren Text – genutzt von der
// Protokollansicht und vom PDF-Lagebericht.

import { datumZeit, zahl, zeitpunkt } from "./ui.js";

const AKTION = {
  erfasst: "erfasst", geaendert: "geändert", umgebucht: "umgebucht", angelegt: "angelegt",
  geloescht: "aus Fahrzeugliste entfernt", status: "Status geändert", bestaetigt: "Bestand 0 bestätigt",
  wiederhergestellt: "Sicherung wiederhergestellt", beendet: "beendet", lagebericht: "Lagebericht erzeugt",
  abkommandiert: "abkommandiert", freigegeben: "freigegeben", zugeordnet: "zugeordnet",
  zuordnung_aufgehoben: "Zuordnung aufgehoben", einsatz_geloescht: "Einsatz endgültig gelöscht", verworfen: "bei Umstellung entfernt (nicht übertragbar)",
};
const FELD = {
  status: "Status", besatzung: "Besatzung", staerke: "Stärke", funkrufname: "Funkrufname",
  kennung: "Kennung", bezeichnung: "Bezeichnung", status_key: "Status", standort: "Standort", bemerkungen: "Bemerkungen",
  nummer: "Nr.", art: "Art", stichwort: "Stichwort", ort: "Ort", bemerkung: "Bemerkung",
};
const SONDER = { system: "System", einsatz: "Einsatz", einsatzabschnitte: "Einsatzabschnitte",
  kraefte: "Kräfte (alt)", kraftstoff: "Kraftstoff (alt)", schlaeuche: "Schläuche und Armaturen (alt)", verpflegung: "Verpflegung (alt)" };
const FELDWERT = { gesamt: "Gesamtbestand", abkommandiert: "Abkommandiert", bestand: "Bestand" };

/** Liefert eine Funktion, die einen Eintrag in { was, aktion, aenderungen[], wer, zeit } übersetzt. */
export function protokollFormatierer(daten, { absolut = false } = {}) {
  const zeitText = absolut ? datumZeit : zeitpunkt;
  const kat = {};
  const status = {};
  for (const b of daten.bereiche) {
    for (const k of b.kategorien) {
      const g = b.gruppen.find((x) => x.key === k.gruppe_key);
      const geteilt = b.kategorien.filter((x) => x.gruppe_key === k.gruppe_key).length > 1;
      kat[k.key] = geteilt && g && g.name !== k.name ? `${g.name} · ${k.name}` : k.name;
    }
    for (const s of b.status) status[`${b.key}:${s.key}`] = s.name;
  }
  const sName = (bereich, key) => status[`${bereich}:${key}`] || key;
  const wert = (roh) => {
    if (roh === null || roh === undefined) return "nicht erfasst";
    if (/^-?\d+$/.test(roh)) return zahl(Number(roh));
    if (roh === "laufend") return "laufend";
    return roh;
  };
  const istJson = (s) => typeof s === "string" && s.startsWith("{");

  function ziel(e) {
    const [art, key] = (e.ziel || "").split(":");
    if (art === "menge") return FELDWERT[key] || sName(e.bereich, key);
    if (["objekt", "fahrzeug", "abschnitt", "symbol", "position", "einsatz"].includes(art)) return key;
    if (art === "aufteilung") return "Aufteilung";
    if (art === "text") return "Textfeld";
    if (art === "linie") return "Linie";
    if (art === "verbindung") return "Verbindung";
    return "";
  }

  return (e) => {
    let aenderungen;
    if (e.aktion === "wiederhergestellt") {
      aenderungen = [{ text: `Stand der Sicherung vom ${zeitText(e.neuer_wert) || "unbekannt"}` }];
    } else if (e.aktion === "lagebericht") {
      aenderungen = [];
    } else if (istJson(e.alter_wert) || istJson(e.neuer_wert)) {
      const a = istJson(e.alter_wert) ? JSON.parse(e.alter_wert) : {};
      const n = istJson(e.neuer_wert) ? JSON.parse(e.neuer_wert) : {};
      aenderungen = [...new Set([...Object.keys(a), ...Object.keys(n)])].filter((f) => a[f] || n[f]).map((f) => {
        const t = (v) => {
          if (v === undefined) return undefined;
          if (v && typeof v === "object" && "b4" in v) return `${v.b4}/${v.b3}/${v.b1}/${(v.b4 || 0) + (v.b3 || 0) + (v.b1 || 0)}`;
          return (f === "status_key" ? sName(e.bereich, v) : v) ?? "–";
        };
        return { feld: FELD[f] || f, alt: t(a[f]), neu: t(n[f]) };
      });
    } else {
      aenderungen = [{ alt: wert(e.alter_wert), neu: wert(e.neuer_wert), zahl: true }];
    }
    const z = ziel(e);
    return {
      zeit: zeitText(e.zeitpunkt),
      was: `${kat[e.kategorie_key] || SONDER[e.kategorie_key] || e.kategorie_key}${z ? ` · ${z}` : ""}`,
      aktion: AKTION[e.aktion] || e.aktion,
      aenderungen,
      wer: `${e.benutzer || "Bearbeiter nicht angegeben"}${e.quelle && e.quelle !== "manuell" ? ` · Quelle: ${e.quelle}` : ""}`,
    };
  };
}

/** Einzeilige Textfassung der Änderungen (für PDF). */
export function aenderungenText(f) {
  return f.aenderungen.map((a) => a.text
    || `${a.feld ? `${a.feld}: ` : ""}${a.alt !== undefined ? `${a.alt} → ` : ""}${a.neu ?? ""}`).join("; ");
}
