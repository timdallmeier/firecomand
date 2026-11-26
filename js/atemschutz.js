// Atemschutz: Seite mit drei Kacheln (Pressluftatmer, Masken, CSA) und je einer
// einfachen Bestandsliste aus Bezeichnung und Stückzahl.
// Erweiterbar: Positionen können später weitere Felder erhalten (Größe, Zustand, Prüfintervall).

import { api } from "./api.js";
import { icon } from "./symbole.js";
import { dialog, dialogSchliessen, esc, nurZiffern, toast, zahl } from "./ui.js";

export function zeigeAtemschutz(main, ctx) {
  const d = ctx.daten();
  const em = d.bereiche[1];
  const kats = em.kategorien.filter((k) => k.typ === "positionen");
  main.innerHTML = `
    ${ctx.einsatzLeiste()}
    <div class="seitenkopf">
      <span class="kachel-icon gross">${icon("atemschutz", 26)}</span>
      <div><h1 class="seitentitel">Atemschutz</h1><p class="text-3" style="margin:2px 0 0">Bestände in Stück</p></div>
    </div>
    <section class="knopfkacheln drei">
      ${kats.map((k) => `
        <button class="knopfkachel" type="button" data-kategorie="${k.key}">
          <span class="kk-icon">${icon(k.symbol, 34)}</span>
          <span class="kk-titel">${esc(k.name)}</span>
        </button>`).join("")}
    </section>`;
  main.querySelectorAll("[data-kategorie]").forEach((b) => b.addEventListener("click", () => {
    oeffneBestand(ctx, kats.find((k) => k.key === b.dataset.kategorie));
  }));
}

export async function oeffneBestand(ctx, kat) {
  const nurLesen = ctx.daten().einsatz.status !== "laufend";
  let liste;
  try { liste = await api.positionen(kat.key); } catch (e) { return toast(e.message, "fehler"); }
  const summe = liste.reduce((a, p) => a + p.stueck, 0);
  const sheet = dialog({
    titel: kat.name,
    sub: `${kat.langname !== kat.name ? `${kat.langname} · ` : ""}Bestand gesamt: ${zahl(summe)} Stück`,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      ${liste.length ? `<div class="positionen">${liste.map((p) => `
        <div class="position" data-id="${p.id}">
          <button class="pos-name" type="button" data-umbenennen="${p.id}" ${nurLesen ? "disabled" : ""}>${esc(p.bezeichnung)}</button>
          <div class="stepper klein">
            <button type="button" data-delta="-1" ${p.stueck && !nurLesen ? "" : "disabled"} aria-label="${esc(p.bezeichnung)} verringern">−</button>
            <span class="zahl stepper-wert">${zahl(p.stueck)}</span>
            <button type="button" data-delta="1" ${nurLesen ? "disabled" : ""} aria-label="${esc(p.bezeichnung)} erhöhen">+</button>
          </div>
        </div>`).join("")}</div>`
        : `<p class="meldung info" style="margin:0">Noch keine Positionen. Lege eine Position mit Bezeichnung und Stückzahl an.</p>`}
      ${nurLesen ? "" : `
      <div class="block"><h4>Position hinzufügen</h4>
        <div class="pos-neu">
          <input id="p-bez" maxlength="60" placeholder="Bezeichnung, z. B. ${esc(kat.key === "masken" ? "Maske Größe M" : kat.key === "csa" ? "CSA Typ 1a" : "Pressluftatmer")}" autocomplete="off">
          <input id="p-stueck" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Stück" autocomplete="off">
          <button class="knopf knopf-primaer" type="button" data-hinzufuegen>Hinzufügen</button>
        </div></div>`}`,
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  const neu = async () => { await ctx.neuLaden(true); dialogSchliessen(true); oeffneBestand(ctx, ctx.kategorie(kat.key)); };
  const stueck = sheet.querySelector("#p-stueck");
  if (stueck) nurZiffern(stueck);

  sheet.querySelectorAll(".position").forEach((z) => {
    const id = Number(z.dataset.id);
    z.querySelectorAll("[data-delta]").forEach((b) => b.addEventListener("click", async () => {
      try { await api.positionAendern(kat.key, id, { delta: Number(b.dataset.delta) }); await neu(); } catch (e) { fehler(e.message); }
    }));
  });
  sheet.querySelectorAll("[data-umbenennen]").forEach((b) => b.addEventListener("click", () => {
    const p = liste.find((x) => x.id === Number(b.dataset.umbenennen));
    positionBearbeiten(ctx, kat, p);
  }));
  sheet.querySelector("[data-hinzufuegen]")?.addEventListener("click", async () => {
    const bez = sheet.querySelector("#p-bez").value;
    if (!bez.trim()) return fehler("Bitte eine Bezeichnung eintragen.");
    try {
      await api.positionAnlegen(kat.key, { bezeichnung: bez, stueck: stueck.value === "" ? 0 : Number(stueck.value) });
      toast(`${bez.trim()} hinzugefügt.`);
      await neu();
    } catch (e) { fehler(e.message); }
  });
}

function positionBearbeiten(ctx, kat, p) {
  let scharf = false;
  const sheet = dialog({
    titel: p.bezeichnung,
    sub: kat.name,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      <div class="zwei">
        <div class="feldgruppe"><label for="pb-bez">Bezeichnung *</label><input id="pb-bez" maxlength="60" value="${esc(p.bezeichnung)}"></div>
        <div class="feldgruppe"><label for="pb-st">Stückzahl</label><input id="pb-st" type="text" inputmode="numeric" pattern="[0-9]*" value="${p.stueck}"></div>
      </div>`,
    fuss: `<button class="knopf knopf-gefahr" type="button" data-weg>Position löschen</button><span class="summe"></span>
      <button class="knopf" type="button" data-zurueck>Zurück</button>
      <button class="knopf knopf-primaer" type="button" data-ok>Speichern</button>`,
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  nurZiffern(sheet.querySelector("#pb-st"));
  const zurueck = async () => { await ctx.neuLaden(true); dialogSchliessen(true); oeffneBestand(ctx, ctx.kategorie(kat.key)); };
  sheet.querySelector("[data-zurueck]").addEventListener("click", zurueck);
  sheet.querySelector("[data-ok]").addEventListener("click", async () => {
    const st = sheet.querySelector("#pb-st").value;
    if (st === "") return fehler("Bitte eine Stückzahl eintragen.");
    try { await api.positionAendern(kat.key, p.id, { bezeichnung: sheet.querySelector("#pb-bez").value, stueck: Number(st) }); await zurueck(); }
    catch (e) { fehler(e.message); }
  });
  const weg = sheet.querySelector("[data-weg]");
  weg.addEventListener("click", async () => {
    if (!scharf) { scharf = true; weg.textContent = "Wirklich löschen?"; weg.classList.add("bestaetigen"); return; }
    try { await api.positionLoeschen(kat.key, p.id); await zurueck(); } catch (e) { fehler(e.message); }
  });
}
