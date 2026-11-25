// Schlanker PDF-Erzeuger ohne externe Bibliothek (funktioniert offline).
// Unterstützt: A4-Seiten, Text (Helvetica / Helvetica-Bold, deutsche Umlaute),
// Linien, gefüllte Rechtecke, Textbreite und Zeilenumbruch.
// Koordinaten: Ursprung oben links, Einheit Punkt (1/72 Zoll).

import { BREITEN } from "./pdf-metrik.js";

// Unicode → WinAnsi (cp1252) für den Bereich 0x80–0x9F
const CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const ERSATZ = { 0x2192: "->", 0x2190: "<-", 0x2713: "x", 0x00a0: " ", 0x202f: " ", 0x2009: " " };

function kodieren(text) {
  const codes = [];
  for (const ch of String(text ?? "")) {
    const cp = ch.codePointAt(0);
    if (ERSATZ[cp]) { for (const c of ERSATZ[cp]) codes.push(c.charCodeAt(0)); continue; }
    if (cp >= 32 && cp < 127) codes.push(cp);
    else if (cp >= 0xa0 && cp <= 0xff) codes.push(cp);
    else if (CP1252[cp]) codes.push(CP1252[cp]);
    else if (cp === 10 || cp === 9) codes.push(32);
    else codes.push(63); // "?"
  }
  return codes;
}

const farbe = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");
};
const zahl = (n) => (Math.round(n * 100) / 100).toString();

export class PdfDokument {
  constructor({ breite = 595.28, hoehe = 841.89 } = {}) {
    this.b = breite;
    this.h = hoehe;
    this.seiten = [];
    this.neueSeite();
  }

  get seitenzahl() { return this.seiten.length; }

  neueSeite() {
    this.seite = [];
    this.seiten.push(this.seite);
    return this.seiten.length;
  }

  aufSeite(nr) { this.seite = this.seiten[nr - 1]; }

  breite(text, groesse = 10, fett = false) {
    const t = BREITEN[fett ? "HB" : "H"];
    return kodieren(text).reduce((s, c) => s + (t[c - 32] ?? 556), 0) * groesse / 1000;
  }

  /** Bricht Text auf maxBreite um (an Leerzeichen, notfalls mitten im Wort). */
  umbrechen(text, maxBreite, groesse = 10, fett = false) {
    const zeilen = [];
    for (const absatz of String(text ?? "").split(/\n/)) {
      let zeile = "";
      for (const wort of absatz.split(/ +/)) {
        const probe = zeile ? `${zeile} ${wort}` : wort;
        if (this.breite(probe, groesse, fett) <= maxBreite) { zeile = probe; continue; }
        if (zeile) zeilen.push(zeile);
        // Sehr lange Wörter hart trennen
        let rest = wort;
        while (this.breite(rest, groesse, fett) > maxBreite && rest.length > 1) {
          let n = rest.length;
          while (n > 1 && this.breite(rest.slice(0, n), groesse, fett) > maxBreite) n--;
          zeilen.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        zeile = rest;
      }
      zeilen.push(zeile);
    }
    return zeilen;
  }

  text(x, y, text, { groesse = 10, fett = false, farbe: f = "#111111", ausrichtung = "links" } = {}) {
    let px = x;
    if (ausrichtung !== "links") {
      const w = this.breite(text, groesse, fett);
      px = ausrichtung === "rechts" ? x - w : x - w / 2;
    }
    const codes = kodieren(text);
    let s = "";
    for (const c of codes) {
      if (c === 40 || c === 41 || c === 92) s += "\\" + String.fromCharCode(c);
      else if (c > 126) s += "\\" + c.toString(8).padStart(3, "0");
      else s += String.fromCharCode(c);
    }
    // y = Oberkante der Zeile → Grundlinie ca. 0,8 × Schriftgröße darunter
    const by = this.h - y - groesse * 0.8;
    this.seite.push(`BT ${farbe(f)} rg /${fett ? "F2" : "F1"} ${zahl(groesse)} Tf ${zahl(px)} ${zahl(by)} Td (${s}) Tj ET`);
  }

  linie(x1, y1, x2, y2, { staerke = 0.5, farbe: f = "#999999" } = {}) {
    this.seite.push(`${farbe(f)} RG ${zahl(staerke)} w ${zahl(x1)} ${zahl(this.h - y1)} m ${zahl(x2)} ${zahl(this.h - y2)} l S`);
  }

  rechteck(x, y, w, h, { fuellung = "#eeeeee" } = {}) {
    this.seite.push(`${farbe(fuellung)} rg ${zahl(x)} ${zahl(this.h - y - h)} ${zahl(w)} ${zahl(h)} re f`);
  }

  /** Erzeugt die PDF-Datei als Uint8Array. */
  erzeugen({ titel = "", autor = "" } = {}) {
    const objekte = [];
    const neu = (inhalt) => { objekte.push(inhalt); return objekte.length; };
    const katalog = neu(null);
    const seitenObj = neu(null);
    const f1 = neu("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = neu("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const kinder = [];
    for (const ops of this.seiten) {
      const inhalt = ops.join("\n");
      const strom = neu(`<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`);
      kinder.push(neu(`<< /Type /Page /Parent ${seitenObj} 0 R /MediaBox [0 0 ${zahl(this.b)} ${zahl(this.h)}] `
        + `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${strom} 0 R >>`));
    }
    objekte[katalog - 1] = `<< /Type /Catalog /Pages ${seitenObj} 0 R >>`;
    objekte[seitenObj - 1] = `<< /Type /Pages /Kids [${kinder.map((k) => `${k} 0 R`).join(" ")}] /Count ${kinder.length} >>`;
    // Metadaten als UTF-16BE (korrekte Umlaute und Sonderzeichen in jedem PDF-Programm)
    const pdfText = (t) => {
      let hex = "FEFF";
      for (let i = 0; i < String(t).length; i++) hex += String(t).charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
      return `<${hex}>`;
    };
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const datum = `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const info = neu(`<< /Title ${pdfText(titel)} /Author ${pdfText(autor)} /Creator (FIRECOMMAND) /CreationDate (${datum}) >>`);

    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets = [];
    objekte.forEach((o, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objekte.length + 1} /Root ${katalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
