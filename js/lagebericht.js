// Lagebericht: Zusammenfassung aller Daten eines Einsatzes als PDF (A4).
// Enthält nur erfasste Werte – nichts wird ergänzt oder geschätzt.

import { api } from "./api.js";
import { ABSCHNITTSARTEN, SYMBOLE } from "./daten/struktur.js";
import { PdfDokument } from "./pdf.js";
import { aenderungenText, protokollFormatierer } from "./protokoll-format.js";
import { datumZeit, dauer, dialog, esc, toast } from "./ui.js";

const RAND = 40;
const FARBE = { text: "#111111", grau: "#5f6773", hell: "#8a919c", linie: "#c9ced6", band: "#f1f3f6", kopf: "#e4e8ee", rot: "#c0392b", akzent: "#e0553f" };
const nz = (v) => (v === null || v === undefined ? "—" : new Intl.NumberFormat("de-DE").format(v));

// ---- Layout-Hilfen --------------------------------------------------------
class Bericht {
  constructor(fussText) {
    this.pdf = new PdfDokument();
    this.y = RAND;
    this.fussText = fussText;
    this.innen = this.pdf.b - 2 * RAND;
    this.unten = this.pdf.h - RAND - 24;
  }

  platz(hoehe) {
    if (this.y + hoehe > this.unten) { this.pdf.neueSeite(); this.y = RAND; return true; }
    return false;
  }

  abschnitt(titel) {
    this.platz(60);
    this.y += 10;
    this.pdf.text(RAND, this.y, titel, { groesse: 12.5, fett: true });
    this.y += 18;
    this.pdf.linie(RAND, this.y, RAND + this.innen, this.y, { staerke: 0.8, farbe: FARBE.text });
    this.y += 8;
  }

  absatz(text, { groesse = 9.5, farbe = FARBE.text, fett = false } = {}) {
    for (const z of this.pdf.umbrechen(text, this.innen, groesse, fett)) {
      this.platz(groesse + 4);
      this.pdf.text(RAND, this.y, z, { groesse, farbe, fett });
      this.y += groesse + 4;
    }
  }

  /**
   * Tabelle mit automatischem Zeilenumbruch und Seitenwechsel (Kopfzeile wird wiederholt).
   * spalten: [{ titel, anteil, rechts }], zeilen: [{ zellen: [...], fett, farben: [...] }]
   */
  tabelle(spalten, zeilen, { groesse = 9 } = {}) {
    const summe = spalten.reduce((s, c) => s + c.anteil, 0);
    const breiten = spalten.map((c) => (c.anteil / summe) * this.innen);
    const pad = 5;
    const zh = groesse + 3;

    // Kopfzeile darf umbrechen (z. B. "Defekt / gesperrt")
    const kopfZeilen = spalten.map((c, i) => this.pdf.umbrechen(c.titel, breiten[i] - 2 * pad, groesse - 0.5, true));
    const kopfH = Math.max(...kopfZeilen.map((z) => z.length)) * zh + 2 * pad - 2;
    const kopf = () => {
      this.pdf.rechteck(RAND, this.y, this.innen, kopfH, { fuellung: FARBE.kopf });
      let x = RAND;
      spalten.forEach((c, i) => {
        kopfZeilen[i].forEach((t, j) => this.pdf.text(c.rechts ? x + breiten[i] - pad : x + pad, this.y + pad - 1 + j * zh, t,
          { groesse: groesse - 0.5, fett: true, farbe: FARBE.grau, ausrichtung: c.rechts ? "rechts" : "links" }));
        x += breiten[i];
      });
      this.y += kopfH;
    };

    this.platz(zh * 3 + 20);
    kopf();
    zeilen.forEach((z, zi) => {
      const umbr = z.zellen.map((t, i) => this.pdf.umbrechen(String(t ?? ""), breiten[i] - 2 * pad, groesse, z.fett));
      const h = Math.max(...umbr.map((u) => u.length)) * zh + 2 * pad - 2;
      if (this.platz(h)) kopf();
      if (zi % 2 === 1) this.pdf.rechteck(RAND, this.y, this.innen, h, { fuellung: FARBE.band });
      let x = RAND;
      umbr.forEach((u, i) => {
        u.forEach((zeile, j) => {
          this.pdf.text(spalten[i].rechts ? x + breiten[i] - pad : x + pad, this.y + pad - 1 + j * zh, zeile, {
            groesse, fett: z.fett, farbe: z.farben?.[i] || FARBE.text, ausrichtung: spalten[i].rechts ? "rechts" : "links",
          });
        });
        x += breiten[i];
      });
      this.y += h;
      this.pdf.linie(RAND, this.y, RAND + this.innen, this.y, { staerke: 0.3, farbe: FARBE.linie });
    });
    this.y += 6;
  }

  fusszeilen() {
    const n = this.pdf.seitenzahl;
    for (let i = 1; i <= n; i++) {
      this.pdf.aufSeite(i);
      const y = this.pdf.h - RAND + 4;
      this.pdf.linie(RAND, y - 6, RAND + this.innen, y - 6, { staerke: 0.4, farbe: FARBE.linie });
      this.pdf.text(RAND, y, this.fussText, { groesse: 7.5, farbe: FARBE.hell });
      this.pdf.text(RAND + this.innen, y, `Seite ${i} von ${n}`, { groesse: 7.5, farbe: FARBE.hell, ausrichtung: "rechts" });
    }
  }
}

// ---- Inhalt ----------------------------------------------------------------
export function lageberichtErstellen({ uebersicht: d, objekte, protokoll, bearbeiter, board }) {
  const e = d.einsatz;
  const jetzt = new Date().toISOString();
  const [kr, em, vs] = d.bereiche;
  const r = new Bericht(`FIRECOMMAND · Lagebericht Einsatz ${e.nummer} · erstellt ${datumZeit(jetzt)}`);
  const pdf = r.pdf;

  // Kopf
  pdf.rechteck(RAND, r.y, 6, 6, { fuellung: FARBE.akzent });
  pdf.text(RAND + 12, r.y - 1, "FIRECOMMAND", { groesse: 8.5, fett: true, farbe: FARBE.grau });
  pdf.text(RAND + r.innen, r.y - 1, `Stand: ${datumZeit(jetzt)} Uhr`, { groesse: 8.5, farbe: FARBE.grau, ausrichtung: "rechts" });
  r.y += 16;
  pdf.text(RAND, r.y, "Lagebericht", { groesse: 22, fett: true });
  r.y += 30;

  // Einsatzdaten
  const felder = [
    ["Einsatz-Nr.", e.nummer],
    ["Art", e.art_name],
    ["Einsatzstichwort", e.stichwort],
    ["Einsatzort / Objekt", e.ort],
    ["Beginn", `${datumZeit(e.beginn)} Uhr`],
    ["Status", e.status === "laufend" ? `laufend seit ${dauer(e.beginn)}` : `beendet ${datumZeit(e.ende)} Uhr (Dauer ${dauer(e.beginn, e.ende)})`],
    ["Startbestand", e.startbestand === "standarddaten" ? "Standarddaten übernommen" : "leer, manuell erfasst"],
    ...(e.bemerkung ? [["Bemerkung", e.bemerkung]] : []),
    ["Bericht erstellt von", bearbeiter || "nicht angegeben"],
  ];
  for (const [l, v] of felder) {
    const zeilen = pdf.umbrechen(v, r.innen - 130, 10);
    r.platz(zeilen.length * 14);
    pdf.text(RAND, r.y, l, { groesse: 9, farbe: FARBE.grau });
    zeilen.forEach((z, i) => pdf.text(RAND + 130, r.y + i * 14 - 1, z, { groesse: 10, fett: i === 0 && l === "Einsatzstichwort" }));
    r.y += zeilen.length * 14 + 2;
  }

  // 1. Kräfte
  const g = kr.gruppen[0];
  r.abschnitt("1. Kräfte");
  const staerke = g.gesamt === null ? "nicht erfasst"
    : `${kr.kategorien.map((k) => nz(k.gesamt)).join(" / ")} / ${nz(g.gesamt)}`;
  r.absatz(`Stärke (${kr.kategorien.map((k) => k.name).join(" / ")} / Gesamt):  ${staerke}`, { groesse: 11, fett: true });
  r.y += 4;
  r.tabelle(
    [{ titel: "Funktion", anteil: 1.4 }, ...kr.status.map((s) => ({ titel: s.name, anteil: 1.2, rechts: true })), { titel: "Gesamt", anteil: 1, rechts: true }],
    [
      ...kr.kategorien.map((k) => ({ zellen: [k.name, ...kr.status.map((s) => nz(k.mengen[s.key])), nz(k.gesamt)] })),
      { zellen: ["Summe", ...kr.status.map((s) => nz(g.mengen[s.key])), nz(g.gesamt)], fett: true },
    ],
  );

  // 2. Fahrzeuge und Abrollbehälter
  const abschnittName = (id) => board.board.abschnitte.find((a) => a.id === id)?.name || "";
  r.abschnitt("2. Fahrzeuge und Abrollbehälter");
  if (!objekte.length) {
    r.absatz("Keine Fahrzeuge oder Abrollbehälter in der Liste.", { farbe: FARBE.grau });
  } else {
    const fzBesatzung = objekte.filter((o) => o.kategorie_key === "fahrzeuge").reduce((s2, o) => s2 + (o.besatzung || 0), 0);
    r.tabelle(
      [{ titel: "Bezeichnung", anteil: 1.7 }, { titel: "Art", anteil: 0.8 }, { titel: "Besatzung", anteil: 0.9, rechts: true },
        { titel: "Status", anteil: 0.8, rechts: true }, { titel: "Einsatzabschnitt", anteil: 1.4 }, { titel: "Standort / Bemerkungen", anteil: 2.2 }],
      [
        ...objekte.map((o) => ({
          zellen: [o.bezeichnung, o.kategorie_key === "fahrzeuge" ? "Fahrzeug" : "AB",
            o.kategorie_key === "fahrzeuge" ? nz(o.besatzung) : "", o.status === null ? "—" : String(o.status),
            o.abschnitt_id ? abschnittName(o.abschnitt_id) : "", [o.standort, o.bemerkungen].filter(Boolean).join(" · ")],
          farben: [, , , o.status === null ? FARBE.hell : FARBE.text],
        })),
        { zellen: ["Summe Besatzung Fahrzeuge", "", nz(fzBesatzung), "", "", ""], fett: true },
      ],
    );
    r.absatz("Status 1–9 als Ziffer, „—“ = kein Status vergeben.", { groesse: 8.5, farbe: FARBE.grau });
  }

  // 3. Einsatzabschnitte
  r.abschnitt("3. Einsatzabschnitte");
  const abschnitte = board.board.abschnitte;
  const freieStatus4 = board.fahrzeuge.filter((f) => f.abschnitt_id === null);
  if (!abschnitte.length) r.absatz("Keine Einsatzabschnitte angelegt.", { farbe: FARBE.grau });
  else {
    r.tabelle(
      [{ titel: "Einsatzabschnitt", anteil: 1.8 }, { titel: "Art", anteil: 1.4 }, { titel: "Zugeordnete Fahrzeuge (Status 4)", anteil: 3.2 }, { titel: "Besatzung", anteil: 0.9, rechts: true }],
      abschnitte.map((a) => {
        const fz = board.fahrzeuge.filter((f) => f.abschnitt_id === a.id);
        return { zellen: [a.name, ABSCHNITTSARTEN.find((x) => x.key === a.art)?.name || "", fz.map((f) => f.bezeichnung).join(", ") || "—",
          nz(fz.reduce((s2, f) => s2 + (f.besatzung || 0), 0))] };
      }),
    );
  }
  if (freieStatus4.length) r.absatz(`Status 4, keinem Abschnitt zugeordnet: ${freieStatus4.map((f) => f.bezeichnung).join(", ")}.`);
  const texte = board.board.texte.map((t) => t.text.replace(/\n/g, " · "));
  const symbole = board.board.symbole.map((sy) => `${SYMBOLE.find((x) => x.key === sy.symbol)?.name}${sy.label ? ` „${sy.label}“` : ""}`);
  if (texte.length) { r.y += 4; r.absatz(`Notizen: ${texte.join(" | ")}`, { groesse: 9 }); }
  if (symbole.length) { r.y += 2; r.absatz(`Taktische Zeichen: ${symbole.join(", ")}`, { groesse: 9 }); }

  // 4. Einsatzmittel
  r.abschnitt("4. Einsatzmittel");
  const vorrat = em.kategorien.filter((k) => k.typ === "vorrat");
  r.tabelle(
    [{ titel: "Kraftstoff / Schaummittel", anteil: 2.2 }, { titel: "Einheit", anteil: 0.8 }, { titel: "Gesamtbestand", anteil: 1.2, rechts: true },
      { titel: "Abkommandiert", anteil: 1.2, rechts: true }, { titel: "Verfügbar", anteil: 1.1, rechts: true }],
    vorrat.map((k) => ({ zellen: [k.gruppe_key === "kraftstoff" ? `Kraftstoff ${k.name}` : k.name, k.einheit, nz(k.gesamt), nz(k.abkommandiert), nz(k.verfuegbar)],
      farben: [, , , , k.verfuegbar === 0 ? FARBE.rot : null] })),
  );
  const anzahl = em.kategorien.filter((k) => k.typ === "anzahl");
  r.tabelle(
    [{ titel: "Schläuche und Armaturen", anteil: 2 }, { titel: "Art", anteil: 2 }, { titel: "Bestand (Stück)", anteil: 1.2, rechts: true }],
    anzahl.map((k) => ({ zellen: [k.untergruppe, k.name, nz(k.gesamt)] })),
  );
  const statusKat = em.kategorien.filter((k) => k.typ === "status");
  r.tabelle(
    [{ titel: "Atemschutz / PSA", anteil: 2 }, { titel: "Einheit", anteil: 0.8 },
      ...em.status.map((s2) => ({ titel: s2.name, anteil: 1.15, rechts: true })), { titel: "Gesamt", anteil: 0.9, rechts: true }],
    statusKat.map((k) => ({ zellen: [k.name, k.einheit, ...em.status.map((s2) => nz(k.mengen[s2.key])), nz(k.gesamt)],
      farben: [, , k.verfuegbar === 0 ? FARBE.rot : null] })),
  );

  // 5. Versorgung
  r.abschnitt("5. Verpflegung");
  r.tabelle(
    [{ titel: "Verpflegung", anteil: 2 }, { titel: "Einheit", anteil: 0.8 }, ...vs.status.map((s2) => ({ titel: s2.name, anteil: 1.3, rechts: true })),
      { titel: "Gesamt", anteil: 0.9, rechts: true }],
    vs.kategorien.map((k) => ({ zellen: [k.name, k.einheit, ...vs.status.map((s2) => nz(k.mengen[s2.key])), nz(k.gesamt)] })),
  );

  // Hinweise (nur aus erfassten Daten abgeleitet)
  const alle = d.bereiche.flatMap((b) => b.kategorien.map((k) => {
    const grp = b.gruppen.find((x) => x.key === k.gruppe_key);
    return { ...k, anzeige: grp?.key === "kraftstoff" ? `${grp.name} ${k.name}` : b.key === "kraefte" ? `Kräfte ${k.name}` : k.name, bereich: b.key };
  }));
  const hinweise = [];
  const nichtErfasst = alle.filter((k) => k.erfassungsstand === "nicht_erfasst");
  const teilweise = alle.filter((k) => k.erfassungsstand === "teilweise");
  const keineBereit = alle.filter((k) => k.bereich === "einsatzmittel" && k.verfuegbar === 0);
  if (keineBereit.length) hinweise.push(`Nichts verfügbar bzw. einsatzbereit: ${keineBereit.map((k) => k.anzeige).join(", ")}.`);
  if (teilweise.length) hinweise.push(`Nur teilweise erfasst: ${teilweise.map((k) => k.anzeige).join(", ")}.`);
  if (nichtErfasst.length) hinweise.push(`Nicht erfasst: ${nichtErfasst.map((k) => k.anzeige).join(", ")}.`);
  r.abschnitt("6. Hinweise");
  if (!hinweise.length) r.absatz("Alle Bereiche sind vollständig erfasst.");
  for (const h of hinweise) { r.absatz(`•  ${h}`); r.y += 2; }
  r.y += 2;
  r.absatz("„—“ bedeutet: nicht erfasst. Eine 0 wurde ausdrücklich eingetragen oder bestätigt.", { groesse: 8.5, farbe: FARBE.grau });

  // Änderungsprotokoll (chronologisch)
  r.abschnitt(`7. Änderungsprotokoll (${protokoll.length} Einträge)`);
  const fmt = protokollFormatierer(d, { absolut: true });
  r.tabelle(
    [{ titel: "Zeit", anteil: 1.25 }, { titel: "Bereich", anteil: 1.7 }, { titel: "Aktion", anteil: 1.15 },
      { titel: "Änderung", anteil: 2.6 }, { titel: "Bearbeiter", anteil: 1.1 }],
    protokoll.slice().sort((a, b) => a.id - b.id).map((p) => {
      const f = fmt(p);
      return { zellen: [f.zeit, f.was, f.aktion, aenderungenText(f), `${p.benutzer || "–"}${p.quelle && p.quelle !== "manuell" ? ` (${p.quelle})` : ""}`] };
    }),
    { groesse: 8 },
  );

  r.fusszeilen();
  return pdf.erzeugen({ titel: `Lagebericht Einsatz ${e.nummer} – ${e.stichwort}`, autor: bearbeiter || "FIRECOMMAND" });
}

// ---- Bedienung --------------------------------------------------------------
function dateiname(e) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `Lagebericht_${e.nummer}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.pdf`;
}

export async function oeffneLagebericht(ctx) {
  const sheet = dialog({
    titel: "Lagebericht",
    sub: "PDF mit allen Daten dieses Einsatzes",
    koerper: `<div class="meldung fehler" data-meldung hidden></div><p class="meldung info" style="margin:0" data-stand>Lagebericht wird erstellt …</p>
      <div class="knopfreihe" data-aktionen hidden>
        <button class="knopf knopf-primaer knopf-gross" type="button" data-teilen hidden>Teilen / Sichern</button>
        <a class="knopf knopf-gross" data-oeffnen target="_blank" rel="noopener">Öffnen</a>
        <a class="knopf knopf-gross" data-laden>Herunterladen</a>
      </div>`,
  });
  const meldung = sheet.querySelector("[data-meldung]");
  try {
    const daten = await api.lageberichtDaten();
    const bytes = lageberichtErstellen(daten);
    const name = dateiname(daten.uebersicht.einsatz);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const datei = new File([blob], name, { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    await api.lageberichtProtokollieren();
    ctx.neuLaden();

    sheet.querySelector("[data-stand]").innerHTML = `<b>${esc(name)}</b><br>${new Intl.NumberFormat("de-DE").format(Math.ceil(bytes.length / 1024))} KB · erstellt ${esc(datumZeit(new Date().toISOString()))} Uhr`;
    sheet.querySelector("[data-aktionen]").hidden = false;
    const oeffnen = sheet.querySelector("[data-oeffnen]");
    oeffnen.href = url;
    const laden = sheet.querySelector("[data-laden]");
    laden.href = url;
    laden.download = name;
    const teilen = sheet.querySelector("[data-teilen]");
    if (navigator.canShare && navigator.canShare({ files: [datei] })) {
      teilen.hidden = false;
      teilen.addEventListener("click", async () => {
        try { await navigator.share({ files: [datei], title: name }); } catch (e) {
          if (e?.name !== "AbortError") { meldung.textContent = "Teilen nicht möglich. Bitte „Öffnen“ oder „Herunterladen“ verwenden."; meldung.hidden = false; }
        }
      });
    }
    document.addEventListener("dialog-geschlossen", () => setTimeout(() => URL.revokeObjectURL(url), 60000), { once: true });
  } catch (e) {
    console.error(e);
    sheet.querySelector("[data-stand]").hidden = true;
    meldung.textContent = `Lagebericht konnte nicht erstellt werden: ${e.message}`;
    meldung.hidden = false;
    toast("Lagebericht fehlgeschlagen.", "fehler");
  }
}
