// Grafiken: Kachelsymbole (Linienicons) und taktische Zeichen für das Whiteboard.
// Alle Grafiken sind eigene, einfache SVG-Zeichnungen und beliebig skalierbar.

// ---- Kachelsymbole (24 × 24, Linienstil, Farbe über currentColor) ----------
const P = (d) => `<path d="${d}"/>`;
const ICONS = {
  kraefte: P("M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z") + P("M2.5 20c.6-3.6 3.2-6 6.5-6s5.9 2.4 6.5 6") + P("M16 4.3a3.3 3.3 0 0 1 0 6.4") + P("M18 14.3c2 .8 3.2 2.9 3.5 5.7"),
  fahrzeug: P("M2 16.5V9.5a1 1 0 0 1 1-1h9.5v8") + P("M12.5 8.5h4.2l3.3 3.6v4.4") + P("M2 16.5h20") + P("M3 6.5l9-2.5") + P("M4 6l1.5 2.5M7 5.2l1.5 3.3M10 4.4l1.5 4.1") + `<circle cx="6" cy="18" r="1.9"/><circle cx="17.5" cy="18" r="1.9"/>`,
  abrollbehaelter: `<rect x="3" y="8" width="15" height="8.5" rx=".6"/>` + P("M7 8v8.5M11 8v8.5M14.5 8v8.5") + P("M18 16.5h3V6.5h-2.5") + P("M2 19.5h20"),
  kraftstoff: P("M6 3.5h7l4 4v12.5a.8.8 0 0 1-.8.8H6.8a.8.8 0 0 1-.8-.8V4.3a.8.8 0 0 1 .8-.8Z") + P("M8.5 11.5l5 5M13.5 11.5l-5 5") + P("M17 7.5l2.5-2.5 1.5 1.5"),
  schlauch: `<circle cx="11" cy="12" r="8"/><circle cx="11" cy="12" r="5"/><circle cx="11" cy="12" r="2"/>` + P("M19 12h3.5"),
  schaum: `<circle cx="8" cy="15" r="4.5"/><circle cx="16" cy="9" r="3.5"/><circle cx="16.5" cy="17" r="2.5"/><circle cx="7.5" cy="6.5" r="2"/>`,
  atemschutz: `<rect x="7.5" y="7" width="9" height="14" rx="4.5"/>` + P("M10 7V4.5h4V7M12 4.5V2.5M10.5 2.5h3"),
  maske: P("M12 3.5c4.5 0 7.5 3 7.5 7.5 0 5-3.4 9.5-7.5 9.5S4.5 16 4.5 11c0-4.5 3-7.5 7.5-7.5Z") + P("M7.5 9.5c1.4-1 3-1.5 4.5-1.5s3.1.5 4.5 1.5") + `<circle cx="12" cy="16" r="2.2"/>` + P("M4.5 11H2.5M19.5 11h2"),
  csa: P("M9 3.5h6l1 2.5h2.5l2 6-2.5 1-1.5-3V21H7.5V10l-1.5 3-2.5-1 2-6H8Z") + `<circle cx="12" cy="7" r="1.6"/>` + P("M10 14h4"),
  psa: P("M3 16.5h18") + P("M4.5 16.5c0-5 3.3-9 7.5-9s7.5 4 7.5 9") + P("M12 7.5v4M9 8.5l1 3.5M15 8.5l-1 3.5") + P("M2.5 19h19"),
  verpflegung: P("M4 7h11v6.5A4.5 4.5 0 0 1 10.5 18h-2A4.5 4.5 0 0 1 4 13.5V7Z") + P("M15 9h1.5a2.5 2.5 0 0 1 0 5H15") + P("M3 21h14") + P("M7.5 2.5c-.8 1 .8 2 0 3M11.5 2.5c-.8 1 .8 2 0 3"),
  abschnitte: `<rect x="2.5" y="3" width="7" height="5" rx=".8"/><rect x="14.5" y="3" width="7" height="5" rx=".8"/><rect x="8.5" y="16" width="7" height="5" rx=".8"/>` + P("M6 8v3.5h12V8M12 11.5V16"),
  lagebild: P("M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3v-14Z") + P("M9 3.5v14M15 6.5v14"),
  bereitstellung: `<rect x="3" y="3" width="18" height="18" rx="2"/>` + P("M9 17V7h4a3 3 0 0 1 0 6H9"),
  einsatz: P("M12 3v4M12 17v4M3 12h4M17 12h4") + `<circle cx="12" cy="12" r="5"/>`,
  liste: P("M8 6h13M8 12h13M8 18h13") + `<circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>`,
  plus: P("M12 5v14M5 12h14"),
  muell: P("M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"),
};

export function icon(name, groesse = 24) {
  return `<svg class="icon" viewBox="0 0 24 24" width="${groesse}" height="${groesse}" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

// ---- Taktische Zeichen (80 × 60) -------------------------------------------
// Rot = Feuerwehr. Grundformen: Rechteck (Einheit/Fahrzeug), Räder (Fahrzeug),
// Fahne (Führung), Punkte/Striche über dem Rechteck (Größe der Einheit).
export const SYMBOL_B = 80;
export const SYMBOL_H = 60;
const ROT = "#ef5a43";
const t = (x, y, s, gr = 15) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central"
  font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="${gr}" fill="#ffffff">${s}</text>`;
const fahrzeug = (inhalt = "") => `<rect x="10" y="10" width="60" height="32" rx="1" fill="#1a1012"/>`
  + `<circle cx="24" cy="49" r="5"/><circle cx="56" cy="49" r="5"/>${inhalt ? t(40, 26, inhalt) : ""}`;
const fuehrung = (inhalt) => `<rect x="18" y="18" width="54" height="30" rx="1" fill="#1a1012"/>`
  + `<path d="M18 48V4"/><path d="M18 4l20 6-20 6" fill="${ROT}"/>${t(45, 33, inhalt, inhalt.length > 3 ? 12 : 14)}`;
const einheit = (marker) => `<rect x="10" y="16" width="60" height="34" rx="1" fill="#1a1012"/>${marker}`;
const punkte = (n) => Array.from({ length: n }, (_, i) => `<circle cx="${40 + (i - (n - 1) / 2) * 11}" cy="8" r="3.2" fill="${ROT}"/>`).join("");
const striche = (n) => Array.from({ length: n }, (_, i) => `<path d="M${40 + (i - (n - 1) / 2) * 9} 2v11"/>`).join("");

const ZEICHEN = {
  fahrzeug: fahrzeug(),
  loeschfahrzeug: fahrzeug("LF"),
  hubrettung: fahrzeug("DL"),
  wechsellader: fahrzeug("WLF"),
  einsatzleitung: fuehrung("EL"),
  einsatzzentrale: fuehrung("EZ"),
  stab: fuehrung("Stab"),
  abschnittsleitung: fuehrung("EAL"),
  trupp: einheit(punkte(1)),
  staffel: einheit(punkte(2)),
  gruppe: einheit(punkte(3)),
  zug: einheit(striche(1)),
  verband: einheit(striche(2)),
  gefahr: `<path d="M40 5l32 50H8Z" fill="#1a1012"/>${t(40, 38, "!", 22)}`,
  sammelplatz: `<circle cx="40" cy="30" r="24" fill="#1a1012"/>${t(40, 30, "S", 20)}`,
  wasser: `<circle cx="40" cy="30" r="24" fill="#1a1012"/><path d="M24 30c4-4 8 4 12 0s8 4 12 0 8 4 8 0"/>`,
};

/** SVG-Inhalt eines Zeichens (ohne äußeres <svg>), Ursprung oben links. */
export function zeichenInhalt(key) {
  return `<g fill="none" stroke="${ROT}" stroke-width="3" stroke-linejoin="round">${ZEICHEN[key] || ZEICHEN.fahrzeug}</g>`;
}

/** Vollständiges SVG eines Zeichens, z. B. für die Auswahlliste. */
export function zeichen(key, breite = 64) {
  return `<svg viewBox="0 0 ${SYMBOL_B} ${SYMBOL_H}" width="${breite}" height="${(breite * SYMBOL_H) / SYMBOL_B}" aria-hidden="true">${zeichenInhalt(key)}</svg>`;
}
