// Erfassung und Bearbeitung von Mengen (Kräfte, mengenbasierte Einsatzmittel, Verpflegung)

import { api } from "./api.js";
import { dialog, dialogOffen, dialogSchliessen, dot, erfassungsartSchalter, esc, nurZiffern, toast, zahl } from "./ui.js";

const MAX = 1000000;

export function oeffneMengen(ctx, bereich, kat, { tab = "bestand", gefuehrt = false } = {}) {
  const status = bereich.status;
  const original = { ...kat.mengen };
  let warnungVerwerfen = false;

  const zeilen = status.map((s) => {
    const v = original[s.key];
    return `
      <div class="zeile" data-status="${s.key}">
        <div class="label">${dot(bereich.key, s.key)}<span>${esc(s.name)}
          <span class="vorher">${v === null ? "noch nicht erfasst" : `bisher ${zahl(v)}`}</span></span></div>
        <div class="stepper">
          <button type="button" data-schritt="-1" aria-label="${esc(s.name)} verringern">−</button>
          <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
                 aria-label="${esc(s.name)}" value="${v === null ? "" : v}" placeholder="—">
          <button type="button" data-schritt="1" aria-label="${esc(s.name)} erhöhen">+</button>
        </div>
      </div>`;
  }).join("");

  const istKraefte = bereich.key === "kraefte";
  const umbuchenMoeglich = kat.erfassungsstand === "vollstaendig";
  const tabs = `
    <div class="seg" data-tabs>
      <button type="button" data-tab="bestand" aria-pressed="${tab === "bestand"}">Bestand eintragen</button>
      <button type="button" data-tab="umbuchen" aria-pressed="${tab === "umbuchen"}" ${umbuchenMoeglich ? "" : "disabled"}>Umbuchen</button>
    </div>`;

  const umbuchen = `
    <div data-panel="umbuchen" ${tab === "umbuchen" ? "" : "hidden"}>
      <p class="meldung info" style="margin:0 0 14px">Verschiebt ${istKraefte ? "Kräfte" : "Mengen"} von einem Status in einen anderen.
        Die Gesamtmenge bleibt gleich – ${istKraefte ? "eine Kraft wird so nie doppelt gezählt" : "nichts wird doppelt gezählt"}.</p>
      <div class="zwei">
        <div class="feldgruppe"><label for="ub-von">Von</label>
          <select id="ub-von">${status.map((s) => `<option value="${s.key}">${esc(s.name)} (${zahl(original[s.key])})</option>`).join("")}</select></div>
        <div class="feldgruppe"><label for="ub-nach">Nach</label>
          <select id="ub-nach">${status.map((s, i) => `<option value="${s.key}" ${i === 0 ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
      </div>
      <div class="zeile" style="border:0">
        <div class="label">Anzahl</div>
        <div class="stepper" data-ub>
          <button type="button" data-schritt="-1" aria-label="Anzahl verringern">−</button>
          <input type="text" inputmode="numeric" pattern="[0-9]*" id="ub-anzahl" value="1" aria-label="Anzahl">
          <button type="button" data-schritt="1" aria-label="Anzahl erhöhen">+</button>
        </div>
      </div>
      <button class="knopf knopf-primaer knopf-gross" type="button" id="ub-los" style="width:100%">Umbuchen</button>
    </div>`;

  // Unterteilung (Funktion, Sorte, Art) – Umschalten innerhalb der Gruppe
  const { gruppe, glieder } = ctx.geschwister(kat);
  const geteilt = glieder.length > 1;
  const umschalter = geteilt ? `
    <div class="unterteilung">
      <label class="feldgruppe" style="font-size:13.5px;color:var(--text-2)">${esc(gruppe.unterteilung || "Unterteilung")}</label>
      <div class="seg" data-geschwister>${glieder.map((g) => `
        <button type="button" data-ziel="${g.key}" aria-pressed="${g.key === kat.key}">${esc(g.name)}${g.erfassungsstand !== "vollstaendig" ? '<span class="offen-punkt" title="noch nicht vollständig erfasst"></span>' : ""}</button>`).join("")}
      </div>
    </div>` : "";

  const sheet = dialog({
    titel: geteilt ? `${gruppe.name} · ${kat.name}` : kat.name,
    sub: `${bereich.name} · Einheit: ${kat.einheit}`,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      ${umschalter}
      ${erfassungsartSchalter(kat)}
      ${tabs}
      <div data-panel="bestand" ${tab === "bestand" ? "" : "hidden"}>${zeilen}</div>
      ${umbuchen}`,
    fuss: `
      <span class="summe">${istKraefte ? `Stärke ${esc(kat.name)}` : `Gesamt ${geteilt ? esc(kat.name) : ""}`}<strong class="zahl" data-summe>—</strong></span>
      <button class="knopf" type="button" data-abbrechen>Abbrechen</button>
      <button class="knopf knopf-primaer" type="button" data-speichern disabled>${gefuehrt ? "Speichern und weiter" : "Speichern"}</button>`,
    vorSchliessen: () => {
      if (!geaendert().length || warnungVerwerfen) return true;
      warnungVerwerfen = true;
      zeigeMeldung("Es gibt ungespeicherte Änderungen. Zum Verwerfen erneut auf „Abbrechen“ oder „Schließen“ tippen.");
      return false;
    },
  });

  const meldung = sheet.querySelector("[data-meldung]");
  const zeigeMeldung = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  const btnSpeichern = sheet.querySelector("[data-speichern]");
  const inputs = [...sheet.querySelectorAll('[data-panel="bestand"] .zeile')].map((z) => ({
    key: z.dataset.status, zeile: z, input: z.querySelector("input"),
  }));

  function wert(i) {
    const t = i.input.value.trim();
    return t === "" ? null : Number(t);
  }
  function geaendert() {
    return inputs.filter((i) => wert(i) !== original[i.key]);
  }
  function pruefen() {
    let fehler = "";
    for (const i of inputs) {
      const v = wert(i);
      let ungueltig = false;
      if (v === null && original[i.key] !== null) { ungueltig = true; fehler = "Ein bereits erfasster Wert kann nicht geleert werden."; }
      if (v !== null && v > MAX) { ungueltig = true; fehler = `Wert ist unplausibel hoch (max. ${zahl(MAX)}).`; }
      i.input.classList.toggle("ungueltig", ungueltig);
      i.input.classList.toggle("geaendert", !ungueltig && v !== original[i.key]);
      i.zeile.querySelector('[data-schritt="-1"]').disabled = !v;
    }
    const werte = inputs.map(wert).filter((v) => v !== null);
    sheet.querySelector("[data-summe]").textContent = werte.length ? zahl(werte.reduce((a, b) => a + b, 0)) : "—";
    btnSpeichern.disabled = !!fehler || !geaendert().length;
    if (fehler) zeigeMeldung(fehler); else if (!warnungVerwerfen) zeigeMeldung("");
    return !fehler;
  }

  for (const i of inputs) {
    nurZiffern(i.input);
    i.input.addEventListener("input", () => { warnungVerwerfen = false; pruefen(); });
    i.zeile.querySelectorAll("[data-schritt]").forEach((b) => b.addEventListener("click", () => {
      const v = wert(i);
      const schritt = Number(b.dataset.schritt);
      if (v === null) { if (schritt > 0) i.input.value = "1"; }
      else i.input.value = String(Math.max(0, Math.min(MAX, v + schritt)));
      warnungVerwerfen = false;
      pruefen();
    }));
  }
  pruefen();

  sheet.querySelector("[data-abbrechen]").addEventListener("click", () => dialogSchliessen());

  btnSpeichern.addEventListener("click", async () => {
    if (!pruefen()) return;
    const aenderungen = {};
    for (const i of geaendert()) aenderungen[i.key] = { neu: wert(i), erwartet: original[i.key] };
    btnSpeichern.disabled = true;
    try {
      const daten = await api.bestandSetzen(kat.key, aenderungen);
      dialogSchliessen(true);
      ctx.aktualisiert(daten);
      toast(`${kat.name} gespeichert.`);
      if (gefuehrt) ctx.weiterGefuehrt(bereich.key, kat.key);
    } catch (e) {
      if (e.istKonflikt && e.aktuell) {
        // Eingaben behalten, aber neue Ausgangswerte sichtbar machen – nichts wird still überschrieben.
        for (const i of inputs) {
          const neu = e.aktuell[i.key];
          if (neu !== original[i.key]) {
            i.zeile.querySelector(".vorher").innerHTML =
              `<span style="color:var(--warn)">zwischenzeitlich geändert auf ${zahl(neu)}</span>`;
          }
          original[i.key] = neu;
        }
        zeigeMeldung(`${e.message} Deine Eingaben sind noch vorhanden.`);
        ctx.neuLaden();
      } else {
        zeigeMeldung(e.message);
      }
      pruefen();
    }
  });

  // Tabs
  sheet.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    sheet.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    sheet.querySelector('[data-panel="bestand"]').hidden = b.dataset.tab !== "bestand";
    sheet.querySelector('[data-panel="umbuchen"]').hidden = b.dataset.tab !== "umbuchen";
    sheet.querySelector(".sheet-fuss").hidden = b.dataset.tab !== "bestand";
  }));
  if (tab === "umbuchen") sheet.querySelector(".sheet-fuss").hidden = true;

  // Umbuchen
  const ubAnzahl = sheet.querySelector("#ub-anzahl");
  nurZiffern(ubAnzahl);
  sheet.querySelectorAll("[data-ub] [data-schritt]").forEach((b) => b.addEventListener("click", () => {
    ubAnzahl.value = String(Math.max(1, (Number(ubAnzahl.value) || 0) + Number(b.dataset.schritt)));
  }));
  sheet.querySelector("#ub-los").addEventListener("click", async () => {
    const von = sheet.querySelector("#ub-von").value;
    const nach = sheet.querySelector("#ub-nach").value;
    const anzahl = Number(ubAnzahl.value);
    if (von === nach) return zeigeMeldung("Bitte zwei unterschiedliche Status wählen.");
    if (!anzahl) return zeigeMeldung("Bitte eine Anzahl größer 0 eintragen.");
    try {
      const daten = await api.umbuchen(kat.key, von, nach, anzahl);
      ctx.aktualisiert(daten);
      const n = (k) => status.find((s) => s.key === k).name;
      toast(`${zahl(anzahl)} von „${n(von)}“ nach „${n(nach)}“ umgebucht.`);
      dialogSchliessen(true);
    } catch (e) {
      zeigeMeldung(e.message);
    }
  });

  sheet.querySelectorAll("[data-geschwister] [data-ziel]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.ziel === kat.key) return;
    dialogSchliessen();                       // fragt bei ungespeicherten Änderungen nach
    if (!dialogOffen()) ctx.oeffneKategorie(b.dataset.ziel, { gefuehrt });
  }));

  ctx.bindeErfassungsart(sheet, kat);
}
