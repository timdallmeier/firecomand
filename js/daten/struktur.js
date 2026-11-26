// Feste Struktur von FIRECOMMAND. Hier stehen ausschließlich Bereiche, Status,
// Kategorien und vorbereitete Wertelisten – KEINE Bestände und keine Beispieldaten.

export const SCHEMA_VERSION = 5;

export const BEREICHE = [
  { key: "kraefte", name: "Kräfte" },
  { key: "einsatzmittel", name: "Einsatzmittel" },
  { key: "versorgung", name: "Versorgung" },
];

// Status für Kategorien vom Typ "status" (Mengen je Status).
// verfuegbar: 1 = Status gilt als "sofort verfügbar"
export const STATUS = {
  kraefte: [
    { key: "im_einsatz", name: "Im Einsatz", verfuegbar: 0 },
    { key: "nachalarmiert", name: "Nachalarmiert", verfuegbar: 0 },
    { key: "auf_anmarsch", name: "Auf Anmarsch", verfuegbar: 0 },
    { key: "auf_wache", name: "Auf Wache", verfuegbar: 1 },
  ],
  einsatzmittel: [
    { key: "einsatzbereit", name: "Einsatzbereit", verfuegbar: 1 },
    { key: "im_einsatz", name: "Im Einsatz", verfuegbar: 0 },
    { key: "in_aufbereitung", name: "In Aufbereitung", verfuegbar: 0 },
    { key: "defekt", name: "Defekt / gesperrt", verfuegbar: 0 },
  ],
  versorgung: [
    { key: "auf_wache", name: "Auf Wache", verfuegbar: 1 },
    { key: "alarmierbar", name: "Alarmierbar", verfuegbar: 0 },
    { key: "angefordert", name: "Bereits angefordert", verfuegbar: 0 },
  ],
};

// Felder für Kategorien vom Typ "vorrat" (Kraftstoff, Schaummittel)
export const VORRAT_FELDER = [
  { key: "gesamt", name: "Gesamtbestand" },
  { key: "abkommandiert", name: "Abkommandiert" },
];
// Feld für Kategorien vom Typ "anzahl" (reine Stückzahl)
export const ANZAHL_FELDER = [{ key: "bestand", name: "Bestand" }];

// Fahrzeugstatus 1–9. Bezeichnungen werden HIER zentral ergänzt, sobald sie
// festgelegt sind (z. B. { wert: 2, bezeichnung: "..." }). Solange null, zeigt
// die App nur die Ziffer. STATUS_IM_EINSATZORT steuert das Whiteboard.
export const FAHRZEUGSTATUS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((wert) => ({ wert, bezeichnung: null }));
export const STATUS_WHITEBOARD = 4;
// Zulässige Status je Kategorie (Abrollbehälter ohne 5, 7, 8, 9)
export const STATUS_ERLAUBT = { fahrzeuge: [1, 2, 3, 4, 5, 6, 7, 8, 9], abrollbehaelter: [1, 2, 3, 4, 6] };

// Stärke eines Fahrzeugs: Anzahl Kräfte je Funktion (B IV / B III / B I), Gesamt wird berechnet.
export const STAERKE_FUNKTIONEN = [{ key: "b4", name: "B IV" }, { key: "b3", name: "B III" }, { key: "b1", name: "B I" }];
export const leereStaerke = () => ({ b4: 0, b3: 0, b1: 0 });
export const staerkeGesamt = (s) => (s ? (s.b4 || 0) + (s.b3 || 0) + (s.b1 || 0) : 0);
/** Stärke in der Schreibweise der Stärkemeldung: B IV / B III / B I / Gesamt, z. B. "1/1/6/8" */
export const staerkeText = (s) => { const x = s || leereStaerke(); return `${x.b4}/${x.b3}/${x.b1}/${staerkeGesamt(x)}`; };

// Startwerte jedes Fahrzeugs bzw. Abrollbehälters in einem neuen Einsatz
export const START_STATUS = 2;
export function fahrzeugstatusText(wert, kurz = false) {
  if (wert === null || wert === undefined) return "kein Status";
  const s = FAHRZEUGSTATUS.find((x) => x.wert === wert);
  return s?.bezeichnung && !kurz ? `Status ${wert} – ${s.bezeichnung}` : `Status ${wert}`;
}

// Typen:
//   status  – Mengen je Status (Kräfte, Pressluftatmer, PSA, Verpflegung)
//   vorrat  – Gesamtbestand + abkommandiert, verfügbar wird berechnet
//   anzahl  – eine Stückzahl
//   einzeln    – Einträge aus den Stammdaten (Fahrzeuge, Abrollbehälter) mit Status
//   positionen – frei angelegte Positionen mit Bezeichnung und Stückzahl (Atemschutz),
//                erweiterbar um weitere Felder (z. B. Größe, Zustand, Prüfintervall)
export const GRUPPEN = [
  { key: "kraefte", bereich: "kraefte", name: "Kräfte", unterteilung: "Funktion", summierbar: true, symbol: "kraefte" },
  // Reihenfolge = Reihenfolge der Kacheln (1. Reihe, 2. Reihe, weitere Bereiche)
  { key: "fahrzeuge", bereich: "einsatzmittel", name: "Fahrzeuge", unterteilung: null, summierbar: false, symbol: "fahrzeug" },
  { key: "abrollbehaelter", bereich: "einsatzmittel", name: "Abrollbehälter", unterteilung: null, summierbar: false, symbol: "abrollbehaelter" },
  { key: "atemschutz", bereich: "einsatzmittel", name: "Atemschutz", unterteilung: "Bereich", summierbar: false, symbol: "atemschutz" },
  { key: "kraftstoff", bereich: "einsatzmittel", name: "Kraftstoff", unterteilung: "Sorte", summierbar: false, symbol: "kraftstoff" },
  { key: "psa", bereich: "einsatzmittel", name: "PSA", unterteilung: null, summierbar: false, symbol: "psa" },
  { key: "schaummittel", bereich: "einsatzmittel", name: "Schaummittel", unterteilung: null, summierbar: false, symbol: "schaum" },
  { key: "schlaeuche", bereich: "einsatzmittel", name: "Schläuche und Armaturen", unterteilung: "Material", summierbar: false, symbol: "schlauch" },
  { key: "verpflegung", bereich: "versorgung", name: "Verpflegung", unterteilung: "Art", summierbar: false, symbol: "verpflegung" },
];

const k = (key, bereich, gruppe, name, einheit, typ, extra = {}) => ({ key, bereich, gruppe, name, einheit, typ, ...extra });

export const KATEGORIEN = [
  k("kraefte_b4", "kraefte", "kraefte", "B IV", "Kräfte", "status"),
  k("kraefte_b3", "kraefte", "kraefte", "B III", "Kräfte", "status"),
  k("kraefte_b1", "kraefte", "kraefte", "B I", "Kräfte", "status"),

  k("fahrzeuge", "einsatzmittel", "fahrzeuge", "Fahrzeuge", "Fahrzeuge", "einzeln", { staerke: true, funkrufname: true }),
  k("abrollbehaelter", "einsatzmittel", "abrollbehaelter", "Abrollbehälter", "AB", "einzeln", { staerke: false, funkrufname: false }),
  k("pressluftatmer", "einsatzmittel", "atemschutz", "Pressluftatmer", "Stück", "positionen", { symbol: "atemschutz" }),
  k("masken", "einsatzmittel", "atemschutz", "Masken", "Stück", "positionen", { symbol: "maske" }),
  k("csa", "einsatzmittel", "atemschutz", "CSA", "Stück", "positionen", { symbol: "csa", langname: "Chemikalienschutzanzüge" }),
  k("kraftstoff_diesel", "einsatzmittel", "kraftstoff", "Diesel", "Liter", "vorrat"),
  k("kraftstoff_super", "einsatzmittel", "kraftstoff", "Super", "Liter", "vorrat"),
  k("kraftstoff_motomix", "einsatzmittel", "kraftstoff", "Motomix", "Liter", "vorrat"),
  k("schlauch_a", "einsatzmittel", "schlaeuche", "A-Schläuche", "Stück", "anzahl", { untergruppe: "Schläuche" }),
  k("schlauch_b", "einsatzmittel", "schlaeuche", "B-Schläuche", "Stück", "anzahl", { untergruppe: "Schläuche" }),
  k("schlauch_c", "einsatzmittel", "schlaeuche", "C-Schläuche", "Stück", "anzahl", { untergruppe: "Schläuche" }),
  k("strahlrohr_b", "einsatzmittel", "schlaeuche", "B-Strahlrohre", "Stück", "anzahl", { untergruppe: "Strahlrohre" }),
  k("strahlrohr_c", "einsatzmittel", "schlaeuche", "C-Strahlrohre", "Stück", "anzahl", { untergruppe: "Strahlrohre" }),
  k("schaumrohr_s4", "einsatzmittel", "schlaeuche", "S4", "Stück", "anzahl", { untergruppe: "Schaumrohre" }),
  k("schaumrohr_s8", "einsatzmittel", "schlaeuche", "S8", "Stück", "anzahl", { untergruppe: "Schaumrohre" }),
  k("schaummittel", "einsatzmittel", "schaummittel", "Schaummittel", "Liter", "vorrat"),
  k("psa", "einsatzmittel", "psa", "PSA", "Sätze", "status"),

  k("essen_warm", "versorgung", "verpflegung", "Essen warm", "Stück", "status"),
  k("essen_kalt", "versorgung", "verpflegung", "Essen kalt", "Stück", "status"),
  k("trinken_iso", "versorgung", "verpflegung", "Trinken isotonisch", "Stück", "status"),
  k("trinken_wasser", "versorgung", "verpflegung", "Trinken Wasser", "Stück", "status"),
];

/** Gültige Felder (Status bzw. Werte) einer Kategorie. */
export function felder(kat) {
  if (kat.typ === "positionen" || kat.typ === "einzeln") return [];
  if (kat.typ === "vorrat") return VORRAT_FELDER;
  if (kat.typ === "anzahl") return ANZAHL_FELDER;
  return STATUS[kat.bereich];
}

// Einsatzarten. "flaeche" ist vorbereitet und wird in einer späteren Version gebaut.
export const EINSATZARTEN = [
  { key: "gebunden", name: "Gebundene Einsatzstelle", verfuegbar: true },
  { key: "flaeche", name: "Flächenlage", verfuegbar: false },
];

// Einsatzabschnitte: Auswahl beim Hinzufügen (Bezeichnung frei änderbar)
export const ABSCHNITTSARTEN = [
  { key: "ea", name: "Einsatzabschnitt", kuerzel: "EA" },
  { key: "uea", name: "Untereinsatzabschnitt", kuerzel: "UEA" },
  { key: "brr", name: "Bereitstellungsraum", kuerzel: "BR" },
  { key: "sonst", name: "Sonstiger Bereich", kuerzel: "" },
];

// VORBEREITET: Bereitstellungsräume (Liste folgt). Felder und Statuswerte:
export const BEREITSTELLUNGSRAUM_STATUS = [
  { key: "verfuegbar", name: "Verfügbar" },
  { key: "nicht_verfuegbar", name: "Nicht verfügbar" },
];

// Initiale Stammdatensätze (keine Einsatzdaten). Stammdaten = Bezeichnung und Funkrufname.
// Stärke und Status werden je Einsatz geführt (Start: Status 2, Stärke 0/0/0/0).
export const INITIALE_STAMMDATEN = [
  { kategorie_key: "fahrzeuge", bezeichnung: "HLF 20", funkrufname: "1-HLF 20-1" },
  { kategorie_key: "abrollbehaelter", bezeichnung: "AB-GSG/Rüst", funkrufname: "" },
];

export function initialeObjekte(startId = 1) {
  return INITIALE_STAMMDATEN.map((d, i) => ({ id: startId + i, ...d, aktiv: true, version: 1, herkunft: "initial" }));
}

// Stammdaten: gelten für alle Einsätze.
export function leereStammdaten() {
  const objekte = initialeObjekte(1);
  return {
    schema: SCHEMA_VERSION,
    // Fahrzeuge / AB: { id, kategorie_key, bezeichnung, funkrufname, aktiv, version, herkunft }
    objekte,
    naechste_objekt_id: objekte.length + 1,
    naechste_einsatz_id: 1,
    einsatz_zaehler: {},
    bereitstellungsraeume: [], // VORBEREITET: { id, bezeichnung, standort, groesse, kapazitaet_loeschzuege, status }
    standarddatensatz: null,  // VORBEREITET: Vorlage für neue Einsätze (folgt mit Excel)
    letzte_sicherung: null,
  };
}

export function leeresBoard() {
  return { abschnitte: [], texte: [], symbole: [], linien: [], zuordnung: {}, naechste_id: 1, ansicht: null };
}

// Stand eines einzelnen Einsatzes. Startet leer – keine Bestände.
export function leererEinsatzstand() {
  return {
    bestand: {},              // { katKey: { feld: { menge, am, von } } } – fehlend = nicht erfasst
    objekt_status: {},        // { objektId: { status, staerke: { b4, b3, b1 }, standort, bemerkungen, version, am } }
    positionen: {},           // { katKey: [{ id, bezeichnung, stueck }] } – Atemschutz
    naechste_position_id: 1,
    leer_bestaetigt: {},      // { katKey: true }
    board: leeresBoard(),     // Einsatzabschnitte / Whiteboard
  };
}

// Taktische Symbole für das Whiteboard. Die Darstellung steht in js/symbole.js.
// Eigene, einheitliche Bibliothek, angelehnt an die Grundformen taktischer
// Zeichen – erweiterbar, nicht normgeprüft.
export const SYMBOLE = [
  { key: "fahrzeug", name: "Fahrzeug", gruppe: "Fahrzeuge" },
  { key: "loeschfahrzeug", name: "Löschfahrzeug", gruppe: "Fahrzeuge" },
  { key: "hubrettung", name: "Hubrettungsfahrzeug", gruppe: "Fahrzeuge" },
  { key: "wechsellader", name: "Wechsellader / AB", gruppe: "Fahrzeuge" },
  { key: "einsatzleitung", name: "Einsatzleitung", gruppe: "Führung" },
  { key: "einsatzzentrale", name: "Einsatzzentrale", gruppe: "Führung" },
  { key: "stab", name: "Stab", gruppe: "Führung" },
  { key: "abschnittsleitung", name: "Abschnittsleitung", gruppe: "Führung" },
  { key: "trupp", name: "Trupp", gruppe: "Einheiten" },
  { key: "staffel", name: "Staffel", gruppe: "Einheiten" },
  { key: "gruppe", name: "Gruppe", gruppe: "Einheiten" },
  { key: "zug", name: "Zug", gruppe: "Einheiten" },
  { key: "verband", name: "Verband", gruppe: "Einheiten" },
  { key: "gefahr", name: "Gefahrenstelle", gruppe: "Sonstige" },
  { key: "sammelplatz", name: "Sammelplatz", gruppe: "Sonstige" },
  { key: "wasser", name: "Wasserentnahme", gruppe: "Sonstige" },
];

export const LINIENFARBEN = [
  { key: "weiss", name: "Weiß", wert: "#e8ebef" },
  { key: "rot", name: "Rot", wert: "#ef5a43" },
  { key: "gelb", name: "Gelb", wert: "#f0c24b" },
  { key: "blau", name: "Blau", wert: "#5fa8f0" },
  { key: "gruen", name: "Grün", wert: "#4fc28a" },
];
export const LINIENSTILE = [
  { key: "fuehrung", name: "Führung / Struktur (durchgezogen)" },
  { key: "kommunikation", name: "Kommunikation (gestrichelt)" },
];
