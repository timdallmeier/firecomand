// Erfassung für Vorräte (Kraftstoff, Schaummittel) und Stückzahlen (Schläuche und Armaturen)

import { api } from "./api.js";
import { dialog, dialogOffen, dialogSchliessen, esc, nurZiffern, toast, zahl } from "./ui.js";

const MAX = 1000000;

function stepper(id, wert, label) {
  return `
    <div class="stepper" data-stepper="${id}">
      <button type="button" data-schritt="-1" aria-label="${esc(label)} verringern">−</button>
      <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="${esc(label)}"
             value="${wert === null || wert === undefined ? "" : wert}" placeholder="—">
      <button type="button" data-schritt="1" aria-label="${esc(label)} erhöhen">+</button>
    </div>`;
}

function stepperBinden(wurzel, beiAenderung) {
  wurzel.querySelectorAll("[data-stepper]").forEach((st) => {
    const input = st.querySelector("input");
    nurZiffern(input);
    input.addEventListener("input", beiAenderung);
    st.querySelectorAll("[data-schritt]").forEach((b) => b.addEventListener("click", () => {
      const v = input.value === "" ? null : Number(input.value);
      const d = Number(b.dataset.schritt);
      if (v === null) { if (d > 0) input.value = "1"; } else input.value = String(Math.max(0, Math.min(MAX, v + d)));
      beiAenderung();
    }));
  });
}

const wert = (input) => (input.value.trim() === "" ? null : Number(input.value));

// ---- Kraftstoff / Schaummittel -------------------------------------------
export function oeffneVorrat(ctx, bereich, kat) {
  const { gruppe, glieder } = ctx.geschwister(kat);
  const geteilt = glieder.length > 1;
  const gesamtAlt = kat.gesamt;
  const erfasst = gesamtAlt !== null;

  const sheet = dialog({
    titel: geteilt ? `${gruppe.name} · ${kat.name}` : kat.name,
    sub: `Angaben in ${kat.einheit}`,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      ${geteilt ? `<div class="seg" data-geschwister>${glieder.map((g) => `
        <button type="button" data-ziel="${g.key}" aria-pressed="${g.key === kat.key}">${esc(g.name)}${g.erfassungsstand === "nicht_erfasst" ? '<span class="offen-punkt"></span>' : ""}</button>`).join("")}</div>` : ""}

      <div class="vorrat-uebersicht">
        <div><span class="label">Gesamtbestand</span><b class="zahl">${erfasst ? zahl(kat.gesamt) : "—"}</b></div>
        <div><span class="label">Abkommandiert</span><b class="zahl" style="color:var(--info)">${erfasst ? zahl(kat.abkommandiert) : "—"}</b></div>
        <div><span class="label">Verfügbar</span><b class="zahl" style="color:${kat.verfuegbar === 0 ? "var(--krit)" : "var(--ok)"}">${erfasst ? zahl(kat.verfuegbar) : "—"}</b></div>
      </div>

      <div class="block">
        <h4>Gesamtbestand ${erfasst ? "ändern" : "eintragen"}</h4>
        <div class="zeile" style="border:0;padding:0"><div class="label">Vorgehaltene Menge (${esc(kat.einheit)})</div>${stepper("gesamt", gesamtAlt, "Gesamtbestand")}</div>
        <button class="knopf knopf-primaer knopf-gross" type="button" data-gesamt-speichern disabled>Gesamtbestand speichern</button>
      </div>

      <div class="block" ${erfasst ? "" : "hidden"}>
        <h4>Abkommandieren / freigeben</h4>
        <p class="text-2">Menge, die für den Einsatz gebunden ist. Verfügbar wird automatisch berechnet.</p>
        <div class="zeile" style="border:0;padding:0"><div class="label">Menge (${esc(kat.einheit)})</div>${stepper("menge", null, "Menge")}</div>
        <div class="knopfreihe">
          <button class="knopf knopf-primaer knopf-gross" type="button" data-richtung="binden">Abkommandieren</button>
          <button class="knopf knopf-gross" type="button" data-richtung="freigeben" ${kat.abkommandiert ? "" : "disabled"}>Freigeben</button>
        </div>
      </div>`,
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  const gesamtInput = sheet.querySelector('[data-stepper="gesamt"] input');
  const mengeInput = sheet.querySelector('[data-stepper="menge"] input');
  const btnGesamt = sheet.querySelector("[data-gesamt-speichern]");

  stepperBinden(sheet, () => {
    const g = wert(gesamtInput);
    btnGesamt.disabled = g === null || g === gesamtAlt || g > MAX;
    fehler("");
  });

  const neuOeffnen = () => { dialogSchliessen(true); oeffneVorrat(ctx, bereich, ctx.kategorie(kat.key)); };

  btnGesamt.addEventListener("click", async () => {
    try {
      ctx.aktualisiert(await api.bestandSetzen(kat.key, { gesamt: { neu: wert(gesamtInput), erwartet: gesamtAlt } }));
      toast(`${kat.name}: Gesamtbestand gespeichert.`);
      neuOeffnen();
    } catch (e) { fehler(e.message); if (e.istKonflikt) ctx.neuLaden(); }
  });
  sheet.querySelectorAll("[data-richtung]").forEach((b) => b.addEventListener("click", async () => {
    const m = wert(mengeInput);
    if (!m) return fehler("Bitte eine Menge größer 0 eintragen.");
    try {
      ctx.aktualisiert(await api.abkommandieren(kat.key, m, b.dataset.richtung));
      toast(`${zahl(m)} ${kat.einheit} ${kat.name} ${b.dataset.richtung === "binden" ? "abkommandiert" : "freigegeben"}.`);
      neuOeffnen();
    } catch (e) { fehler(e.message); }
  }));
  sheet.querySelectorAll("[data-geschwister] [data-ziel]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.ziel === kat.key) return;
    dialogSchliessen();
    if (!dialogOffen()) ctx.oeffneKategorie(b.dataset.ziel);
  }));
}

// ---- Schläuche und Armaturen (Stückzahlen) --------------------------------
export function oeffneAnzahl(ctx, bereich, gruppe, { gefuehrt = false } = {}) {
  const glieder = bereich.kategorien.filter((k) => k.gruppe_key === gruppe.key);
  const original = Object.fromEntries(glieder.map((k) => [k.key, k.gesamt]));
  const unter = [...new Set(glieder.map((k) => k.untergruppe))];
  let warnung = false;

  const sheet = dialog({
    titel: gruppe.name,
    sub: "Bestand in Stück",
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      ${unter.map((u) => `
        <div class="block"><h4>${esc(u)}</h4>
          ${glieder.filter((k) => k.untergruppe === u).map((k) => `
            <div class="zeile" data-kat="${k.key}">
              <div class="label"><span>${esc(k.name)}<span class="vorher">${k.gesamt === null ? "noch nicht erfasst" : `bisher ${zahl(k.gesamt)}`}</span></span></div>
              ${stepper(k.key, k.gesamt, k.name)}
            </div>`).join("")}
        </div>`).join("")}`,
    fuss: `<span class="summe"></span><button class="knopf" type="button" data-abbrechen>Abbrechen</button>
      <button class="knopf knopf-primaer" type="button" data-speichern disabled>${gefuehrt ? "Speichern und weiter" : "Speichern"}</button>`,
    vorSchliessen: () => {
      if (!geaendert().length || warnung) return true;
      warnung = true;
      fehler("Es gibt ungespeicherte Änderungen. Zum Verwerfen erneut auf „Abbrechen“ oder „Schließen“ tippen.");
      return false;
    },
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  const btn = sheet.querySelector("[data-speichern]");
  const inputs = glieder.map((k) => ({ key: k.key, input: sheet.querySelector(`[data-stepper="${k.key}"] input`) }));
  function geaendert() { return inputs.filter((i) => wert(i.input) !== original[i.key]); }
  function pruefen() {
    let f = "";
    for (const i of inputs) {
      const v = wert(i.input);
      const ungueltig = (v === null && original[i.key] !== null) || (v !== null && v > MAX);
      if (ungueltig) f = v === null ? "Ein bereits erfasster Wert kann nicht geleert werden." : "Wert ist unplausibel hoch.";
      i.input.classList.toggle("ungueltig", ungueltig);
      i.input.classList.toggle("geaendert", !ungueltig && v !== original[i.key]);
    }
    btn.disabled = !!f || !geaendert().length;
    if (f) fehler(f); else if (!warnung) fehler("");
  }
  stepperBinden(sheet, () => { warnung = false; pruefen(); });
  pruefen();
  sheet.querySelector("[data-abbrechen]").addEventListener("click", () => dialogSchliessen());
  btn.addEventListener("click", async () => {
    const paket = {};
    for (const i of geaendert()) paket[i.key] = { bestand: { neu: wert(i.input), erwartet: original[i.key] } };
    try {
      ctx.aktualisiert(await api.bestaendeSetzen(paket));
      dialogSchliessen(true);
      toast(`${gruppe.name} gespeichert.`);
      if (gefuehrt) ctx.weiterGefuehrt(bereich.key, glieder[glieder.length - 1].key);
    } catch (e) { fehler(e.message); if (e.istKonflikt) ctx.neuLaden(); }
  });
}
