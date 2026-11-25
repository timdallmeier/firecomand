// Feste Struktur von FIRECOMMAND (entspricht den Server-Migrationen 001 + 002).
// Hier stehen ausschließlich Bereiche, Status und Kategorien – KEINE Bestände.

export const BEREICHE = [
  { key: "kraefte", name: "Kräfte" },
  { key: "einsatzmittel", name: "Einsatzmittel" },
  { key: "versorgung", name: "Versorgung" },
];

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

export const GRUPPEN = [
  { key: "kraefte", bereich: "kraefte", name: "Kräfte", unterteilung: "Funktion", summierbar: true },
  { key: "pressluftatmer", bereich: "einsatzmittel", name: "Pressluftatmer", unterteilung: "Art", summierbar: false },
  { key: "kraftstoff", bereich: "einsatzmittel", name: "Kraftstoff", unterteilung: "Sorte", summierbar: false },
  { key: "fahrzeuge", bereich: "einsatzmittel", name: "Fahrzeuge", unterteilung: null, summierbar: false },
  { key: "abrollbehaelter", bereich: "einsatzmittel", name: "Abrollbehälter", unterteilung: null, summierbar: false },
  { key: "psa", bereich: "einsatzmittel", name: "PSA", unterteilung: null, summierbar: false },
  { key: "schlaeuche", bereich: "einsatzmittel", name: "Schläuche und Armaturen", unterteilung: null, summierbar: false },
  { key: "verpflegung", bereich: "versorgung", name: "Verpflegung", unterteilung: null, summierbar: false },
];

// erfassungsart: Voreinstellung; einzeln_moeglich: Umstellung erlaubt
export const KATEGORIEN = [
  { key: "kraefte_b4", bereich: "kraefte", gruppe: "kraefte", name: "B IV", einheit: "Kräfte", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "kraefte_b3", bereich: "kraefte", gruppe: "kraefte", name: "B III", einheit: "Kräfte", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "kraefte_b1", bereich: "kraefte", gruppe: "kraefte", name: "B I", einheit: "Kräfte", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "pressluftatmer", bereich: "einsatzmittel", gruppe: "pressluftatmer", name: "Pressluftatmer", einheit: "Stück", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "masken", bereich: "einsatzmittel", gruppe: "pressluftatmer", name: "Masken", einheit: "Stück", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "kraftstoff_diesel", bereich: "einsatzmittel", gruppe: "kraftstoff", name: "Diesel", einheit: "Liter", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "kraftstoff_super", bereich: "einsatzmittel", gruppe: "kraftstoff", name: "Super", einheit: "Liter", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "kraftstoff_motomix", bereich: "einsatzmittel", gruppe: "kraftstoff", name: "MotoMix", einheit: "Liter", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "fahrzeuge", bereich: "einsatzmittel", gruppe: "fahrzeuge", name: "Fahrzeuge", einheit: "Fahrzeuge", erfassungsart: "einzeln", einzeln_moeglich: false },
  { key: "abrollbehaelter", bereich: "einsatzmittel", gruppe: "abrollbehaelter", name: "Abrollbehälter", einheit: "AB", erfassungsart: "einzeln", einzeln_moeglich: false },
  { key: "psa", bereich: "einsatzmittel", gruppe: "psa", name: "PSA", einheit: "Sätze", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "schlaeuche", bereich: "einsatzmittel", gruppe: "schlaeuche", name: "Schläuche und Armaturen", einheit: "Stück", erfassungsart: "menge", einzeln_moeglich: false },
  { key: "verpflegung", bereich: "versorgung", gruppe: "verpflegung", name: "Verpflegung", einheit: "Stück", erfassungsart: "menge", einzeln_moeglich: false },
];

export const SCHEMA_VERSION = 2;

// Einsatzarten. "flaeche" ist vorbereitet und wird in einer späteren Version gebaut.
export const EINSATZARTEN = [
  { key: "gebunden", name: "Gebundene Einsatzstelle", verfuegbar: true },
  { key: "flaeche", name: "Flächenlage", verfuegbar: false },
];

// Stammdaten: gelten für alle Einsätze (Fahrzeugliste, Zähler, Sicherung).
export function leereStammdaten() {
  return {
    schema: SCHEMA_VERSION,
    objekte: [],              // Fahrzeuge / Abrollbehälter: { id, kategorie_key, kennung, bezeichnung, aktiv, version }
    naechste_objekt_id: 1,
    naechste_einsatz_id: 1,
    einsatz_zaehler: {},      // { "2026": 3 } für laufende Einsatznummern je Jahr
    standarddatensatz: null,  // VORBEREITET: wird später (Excel) befüllt. Solange null, ist die Übernahme gesperrt.
    letzte_sicherung: null,
  };
}

// Stand eines einzelnen Einsatzes. Startet leer – keine Bestände.
export function leererEinsatzstand() {
  return {
    bestand: {},              // { katKey: { statusKey: { menge, am, von } } } – fehlend = nicht erfasst
    objekt_status: {},        // { objektId: { status_key, standort, bemerkungen, version, am } }
    leer_bestaetigt: {},      // { katKey: true } – Bestand 0 bei Einzelerfassung bestätigt
  };
}
