// Fahrzeuge und Abrollbehälter.
// Die Fahrzeugliste gilt für alle Einsätze; der Status (und Standort/Bemerkungen)
// wird je Einsatz geführt. Status per Schnellwahl mit einem Tipp.

import { api } from "./api.js";
import { dialog, dialogSchliessen, dot, esc, toast, zahl } from "./ui.js";

export async function oeffneObjekte(ctx, bereich, kat, { gefuehrt = false } = {}) {
  let objekte;
  try {
    objekte = await api.objekte(kat.key);
  } catch (e) {
    toast(e.message, "fehler");
    return;
  }
  const offen = objekte.filter((o) => !o.status_key).length;

  const liste = objekte.length
    ? `<div class="objekte">${objekte.map((o) => `
        <div class="objekt-zeile ${o.status_key ? "" : "offen"}">
          <button class="objekt-name" type="button" data-objekt="${o.id}">
            <span class="kennung">${esc(o.kennung)}</span> <span class="bez">${esc(o.bezeichnung)}</span>
            <span class="ort">${o.status_key ? (o.standort ? esc(o.standort) : "Details bearbeiten") : "Status für diesen Einsatz offen"}</span>
          </button>
          <div class="seg schnellstatus" role="group" aria-label="Status ${esc(o.kennung)}">
            ${bereich.status.map((s) => `
              <button type="button" data-schnellstatus="${o.id}|${s.key}" aria-pressed="${o.status_key === s.key}" title="${esc(s.name)}">
                ${dot(bereich.key, s.key)}<span>${esc(s.name)}</span></button>`).join("")}
          </div>
        </div>`).join("")}</div>`
    : `<div class="leer" style="margin:0">
         <p>${kat.erfassungsstand === "vollstaendig" ? "Bestand 0 bestätigt – keine vorhanden." : "Die Fahrzeugliste ist noch leer."}</p>
       </div>`;

  const leerKnopf = !objekte.length && kat.erfassungsstand !== "vollstaendig"
    ? `<button class="knopf" type="button" data-leer>Keine vorhanden – 0 bestätigen</button>` : "";

  const sheet = dialog({
    titel: kat.name,
    sub: `${zahl(objekte.length)} in der Fahrzeugliste${offen ? ` · ${zahl(offen)} ohne Status` : ""}`,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      <p class="meldung info" style="margin:0">Die Fahrzeugliste gilt für alle Einsätze. Der Status gilt nur für diesen Einsatz – einfach antippen.</p>
      ${liste}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="knopf knopf-primaer knopf-gross" type="button" data-neu>${kat.key === "fahrzeuge" ? "Fahrzeug" : "Abrollbehälter"} hinzufügen</button>
        ${leerKnopf}
      </div>`,
    fuss: gefuehrt ? `<span class="summe"></span><button class="knopf knopf-primaer" type="button" data-weiter>Weiter zur nächsten Kategorie</button>` : "",
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };

  sheet.querySelector("[data-neu]").addEventListener("click", () => oeffneFormular(ctx, bereich, kat, null, gefuehrt));
  sheet.querySelectorAll("[data-objekt]").forEach((b) => b.addEventListener("click", () => {
    oeffneFormular(ctx, bereich, kat, objekte.find((o) => o.id === Number(b.dataset.objekt)), gefuehrt);
  }));
  sheet.querySelectorAll("[data-schnellstatus]").forEach((b) => b.addEventListener("click", async () => {
    const [id, status] = b.dataset.schnellstatus.split("|");
    try {
      await api.objektStatus(Number(id), status);
      await ctx.neuLaden();
      dialogSchliessen(true);
      oeffneObjekte(ctx, bereich, ctx.kategorie(kat.key), { gefuehrt });
    } catch (e) { fehler(e.message); }
  }));
  sheet.querySelector("[data-leer]")?.addEventListener("click", async () => {
    try {
      ctx.aktualisiert(await api.leerBestaetigen(kat.key));
      toast(`${kat.name}: Bestand 0 bestätigt.`);
      dialogSchliessen(true);
      if (gefuehrt) ctx.weiterGefuehrt(bereich.key, kat.key);
    } catch (e) { fehler(e.message); }
  });
  sheet.querySelector("[data-weiter]")?.addEventListener("click", () => {
    dialogSchliessen(true);
    ctx.weiterGefuehrt(bereich.key, kat.key);
  });
}

function oeffneFormular(ctx, bereich, kat, objekt, gefuehrt) {
  const neu = !objekt;
  const o = objekt || { kennung: "", bezeichnung: "", status_key: "", standort: "", bemerkungen: "" };
  let entfernenScharf = false;
  const art = kat.key === "fahrzeuge" ? "Fahrzeug" : "Abrollbehälter";

  const sheet = dialog({
    titel: neu ? `${art} hinzufügen` : o.kennung,
    sub: neu ? "Wird in die Fahrzeugliste aufgenommen (für alle künftigen Einsätze)" : `${kat.name} · ${o.bezeichnung}`,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      <div class="zwei">
        <div class="feldgruppe"><label for="f-kennung">Kennung *</label>
          <input id="f-kennung" maxlength="40" value="${esc(o.kennung)}" autocomplete="off" placeholder="z. B. Funkrufname"></div>
        <div class="feldgruppe"><label for="f-bez">Bezeichnung *</label>
          <input id="f-bez" maxlength="120" value="${esc(o.bezeichnung)}" autocomplete="off"></div>
      </div>
      <div class="feldgruppe"><label>Status in diesem Einsatz *</label><div class="seg status" data-statusauswahl>
        ${bereich.status.map((s) => `<button type="button" data-status="${s.key}" aria-pressed="${o.status_key === s.key}">${dot(bereich.key, s.key)}${esc(s.name)}</button>`).join("")}
      </div></div>
      <div class="feldgruppe"><label for="f-ort">Standort in diesem Einsatz</label>
        <input id="f-ort" maxlength="120" value="${esc(o.standort)}" autocomplete="off"></div>
      <div class="feldgruppe"><label for="f-bem">Bemerkungen in diesem Einsatz</label>
        <textarea id="f-bem" maxlength="1000">${esc(o.bemerkungen)}</textarea></div>`,
    fuss: `
      ${neu ? '<span class="summe"></span>' : '<button class="knopf knopf-gefahr" type="button" data-entfernen>Aus Fahrzeugliste entfernen</button><span class="summe"></span>'}
      <button class="knopf" type="button" data-zurueck>Zurück</button>
      <button class="knopf knopf-primaer" type="button" data-speichern>${neu ? "Hinzufügen" : "Speichern"}</button>`,
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; meldung.scrollIntoView({ block: "nearest" }); };
  let status = o.status_key;

  sheet.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", () => {
    status = b.dataset.status;
    sheet.querySelectorAll("[data-status]").forEach((x) => x.setAttribute("aria-pressed", x === b));
  }));

  const zurueck = () => { dialogSchliessen(true); oeffneObjekte(ctx, bereich, ctx.kategorie(kat.key), { gefuehrt }); };
  sheet.querySelector("[data-zurueck]").addEventListener("click", zurueck);

  sheet.querySelector("[data-speichern]").addEventListener("click", async () => {
    const daten = {
      kategorie_key: kat.key,
      kennung: sheet.querySelector("#f-kennung").value,
      bezeichnung: sheet.querySelector("#f-bez").value,
      status_key: status,
      standort: sheet.querySelector("#f-ort").value,
      bemerkungen: sheet.querySelector("#f-bem").value,
    };
    if (!daten.kennung.trim()) return fehler("Bitte eine Kennung eintragen.");
    if (!daten.bezeichnung.trim()) return fehler("Bitte eine Bezeichnung eintragen.");
    if (!daten.status_key) return fehler("Bitte einen Status wählen.");
    try {
      if (neu) await api.objektAnlegen(daten);
      else await api.objektAendern(o.id, { ...daten, version: o.version });
      await ctx.neuLaden();
      toast(neu ? `${daten.kennung.trim()} hinzugefügt.` : `${daten.kennung.trim()} gespeichert.`);
      zurueck();
    } catch (e) {
      fehler(e.istKonflikt ? `${e.message} Bitte „Zurück“ tippen, um die aktuellen Daten zu laden.` : e.message);
    }
  });

  const btn = sheet.querySelector("[data-entfernen]");
  btn?.addEventListener("click", async () => {
    if (!entfernenScharf) {
      entfernenScharf = true;
      btn.textContent = "Wirklich entfernen?";
      btn.classList.add("bestaetigen");
      fehler("");
      meldung.className = "meldung info";
      meldung.textContent = "Das Fahrzeug erscheint dann in künftigen Einsätzen nicht mehr. Beendete Einsätze behalten ihre Angaben.";
      meldung.hidden = false;
      return;
    }
    try {
      await api.objektLoeschen(o.id, o.version);
      await ctx.neuLaden();
      toast(`${o.kennung} aus der Fahrzeugliste entfernt.`);
      zurueck();
    } catch (e) {
      meldung.className = "meldung fehler";
      fehler(e.message);
    }
  });
}
