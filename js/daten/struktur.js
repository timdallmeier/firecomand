// Feste Struktur von FIRECOMMAND. Hier stehen ausschließlich Bereiche, Status,
// Kategorien und vorbereitete Wertelisten – KEINE Bestände und keine Beispieldaten.

export const SCHEMA_VERSION = 3;

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
export function fahrzeugstatusText(wert, kurz = false) {
  if (wert === null || wert === undefined) return "kein Status";
  const s = FAHRZEUGSTATUS.find((x) => x.wert === wert);
  return s?.bezeichnung && !kurz ? `Status ${wert} – ${s.bezeichnung}` : `Status ${wert}`;
}

// Typen:
//   status  – Mengen je Status (Kräfte, Pressluftatmer, PSA, Verpflegung)
//   vorrat  – Gesamtbestand + abkommandiert, verfügbar wird berechnet
//   anzahl  – eine Stückzahl
//   einzeln – Einzelobjekte aus der Fahrzeugliste mit Status 1–9
export const GRUPPEN = [
  { key: "kraefte", bereich: "kraefte", name: "Kräfte", unterteilung: "Funktion", summierbar: true, symbol: "kraefte" },
  { key: "fahrzeuge", bereich: "einsatzmittel", name: "Fahrzeuge", unterteilung: null, summierbar: false, symbol: "fahrzeug" },
  { key: "abrollbehaelter", bereich: "einsatzmittel", name: "Abrollbehälter", unterteilung: null, summierbar: false, symbol: "abrollbehaelter" },
  { key: "kraftstoff", bereich: "einsatzmittel", name: "Kraftstoff", unterteilung: "Sorte", summierbar: false, symbol: "kraftstoff" },
  { key: "schlaeuche", bereich: "einsatzmittel", name: "Schläuche und Armaturen", unterteilung: "Material", summierbar: false, symbol: "schlauch" },
  { key: "schaummittel", bereich: "einsatzmittel", name: "Schaummittel", unterteilung: null, summierbar: false, symbol: "schaum" },
  { key: "pressluftatmer", bereich: "einsatzmittel", name: "Pressluftatmer", unterteilung: "Art", summierbar: false, symbol: "atemschutz" },
  { key: "psa", bereich: "einsatzmittel", name: "PSA", unterteilung: null, summierbar: false, symbol: "psa" },
  { key: "verpflegung", bereich: "versorgung", name: "Verpflegung", unterteilung: "Art", summierbar: false, symbol: "verpflegung" },
];

const k = (key, bereich, gruppe, name, einheit, typ, extra = {}) => ({ key, bereich, gruppe, name, einheit, typ, ...extra });

export const KATEGORIEN = [
  k("kraefte_b4", "kraefte", "kraefte", "B IV", "Kräfte", "status"),
  k("kraefte_b3", "kraefte", "kraefte", "B III", "Kräfte", "status"),
  k("kraefte_b1", "kraefte", "kraefte", "B I", "Kräfte", "status"),

  k("fahrzeuge", "einsatzmittel", "fahrzeuge", "Fahrzeuge", "Fahrzeuge", "einzeln", { besatzung: true }),
  k("abrollbehaelter", "einsatzmittel", "abrollbehaelter", "Abrollbehälter", "AB", "einzeln", { besatzung: false }),
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
  k("pressluftatmer", "einsatzmittel", "pressluftatmer", "Pressluftatmer", "Stück", "status"),
  k("masken", "einsatzmittel", "pressluftatmer", "Masken", "Stück", "status"),
  k("psa", "einsatzmittel", "psa", "PSA", "Sätze", "status"),

  k("essen_warm", "versorgung", "verpflegung", "Essen warm", "Stück", "status"),
  k("essen_kalt", "versorgung", "verpflegung", "Essen kalt", "Stück", "status"),
  k("trinken_iso", "versorgung", "verpflegung", "Trinken isotonisch", "Stück", "status"),
  k("trinken_wasser", "versorgung", "verpflegung", "Trinken Wasser", "Stück", "status"),
];

/** Gültige Felder (Status bzw. Werte) einer Kategorie. */
export function felder(kat) {
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

// Stammdaten: gelten für alle Einsätze.
export function leereStammdaten() {
  return {
    schema: SCHEMA_VERSION,
    objekte: [],              // Fahrzeuge / AB: { id, kategorie_key, bezeichnung, aktiv, version }
    naechste_objekt_id: 1,
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
    objekt_status: {},        // { objektId: { status (1–9), besatzung, standort, bemerkungen, version, am } }
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
