// Fahrzeuge und Abrollbehälter.
// Die Fahrzeugliste gilt für alle Einsätze; Status (1–9), Besatzungsstärke,
// Standort und Bemerkungen werden je Einsatz geführt.

import { api } from "./api.js";
import { FAHRZEUGSTATUS, STATUS_WHITEBOARD, fahrzeugstatusText } from "./daten/struktur.js";
import { dialog, dialogSchliessen, esc, nurZiffern, toast, zahl } from "./ui.js";

const statusOptionen = (aktuell) => `<option value="" ${aktuell === null ? "selected" : ""}>Status wählen</option>`
  + FAHRZEUGSTATUS.map((s) => `<option value="${s.wert}" ${aktuell === s.wert ? "selected" : ""}>${esc(fahrzeugstatusText(s.wert))}</option>`).join("");

export async function oeffneObjekte(ctx, bereich, kat, { gefuehrt = false } = {}) {
  let objekte;
  try {
    objekte = await api.objekte(kat.key);
  } catch (e) {
    toast(e.message, "fehler");
    return;
  }
  const istFahrzeug = kat.key === "fahrzeuge";
  const wort = istFahrzeug ? "Fahrzeug" : "Abrollbehälter";
  const offen = objekte.filter((o) => o.status === null).length;
  const besatzung = objekte.reduce((s, o) => s + (o.besatzung || 0), 0);

  const liste = objekte.length
    ? `<div class="objekte">${objekte.map((o) => `
        <div class="objekt-zeile ${o.status === null ? "offen" : ""}" data-id="${o.id}">
          <button class="objekt-name" type="button" data-objekt="${o.id}">
            <span class="kennung">${esc(o.bezeichnung)}</span>
            <span class="ort">${o.abschnitt_name ? `Abschnitt: ${esc(o.abschnitt_name)}` : o.status === STATUS_WHITEBOARD && istFahrzeug ? "Status 4 – noch keinem Abschnitt zugeordnet" : o.standort ? esc(o.standort) : "Details bearbeiten"}</span>
          </button>
          ${istFahrzeug ? `
          <div class="objekt-feld"><span class="feld-label">Besatzung</span>
            <div class="stepper klein">
              <button type="button" data-besatzung="${o.id}|-1" ${o.besatzung ? "" : "disabled"} aria-label="Besatzung ${esc(o.bezeichnung)} verringern">−</button>
              <span class="zahl stepper-wert">${zahl(o.besatzung)}</span>
              <button type="button" data-besatzung="${o.id}|1" aria-label="Besatzung ${esc(o.bezeichnung)} erhöhen">+</button>
            </div>
          </div>` : ""}
          <div class="objekt-feld"><span class="feld-label">Status</span>
            <select class="status-auswahl ${o.status === STATUS_WHITEBOARD ? "st-4" : ""}" data-status-id="${o.id}" aria-label="Status ${esc(o.bezeichnung)}">${statusOptionen(o.status)}</select>
          </div>
        </div>`).join("")}</div>`
    : `<div class="leer" style="margin:0">
         <p>${kat.erfassungsstand === "vollstaendig" ? "Bestand 0 bestätigt – keine vorhanden." : `Noch keine ${istFahrzeug ? "Fahrzeuge" : "Abrollbehälter"} in der Liste.`}</p>
       </div>`;

  const leerKnopf = !objekte.length && kat.erfassungsstand !== "vollstaendig"
    ? `<button class="knopf" type="button" data-leer>Keine vorhanden – 0 bestätigen</button>` : "";

  const sheet = dialog({
    titel: kat.name,
    sub: `${zahl(objekte.length)} in der Liste${istFahrzeug ? ` · Besatzung gesamt ${zahl(besatzung)}` : ""}${offen ? ` · ${zahl(offen)} ohne Status` : ""}`,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      <p class="meldung info" style="margin:0">Die Liste gilt für alle Einsätze. Status${istFahrzeug ? " und Besatzung gelten" : " gilt"} nur für diesen Einsatz.
        ${istFahrzeug ? `Fahrzeuge mit ${fahrzeugstatusText(STATUS_WHITEBOARD, true)} erscheinen automatisch unter „Einsatzabschnitte“.` : ""}</p>
      ${liste}
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="knopf knopf-primaer knopf-gross" type="button" data-neu>${wort} hinzufügen</button>
        ${leerKnopf}
      </div>`,
    fuss: gefuehrt ? `<span class="summe"></span><button class="knopf knopf-primaer" type="button" data-weiter>Weiter zur nächsten Kategorie</button>` : "",
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  const neuOeffnen = async () => {
    await ctx.neuLaden();
    const scroll = sheet.querySelector(".sheet-koerper")?.scrollTop || 0;
    dialogSchliessen(true);
    await oeffneObjekte(ctx, bereich, ctx.kategorie(kat.key), { gefuehrt });
    const k = document.querySelector("#sheet .sheet-koerper");
    if (k) k.scrollTop = scroll;
  };

  sheet.querySelector("[data-neu]").addEventListener("click", () => oeffneFormular(ctx, bereich, kat, null, gefuehrt));
  sheet.querySelectorAll("[data-objekt]").forEach((b) => b.addEventListener("click", () => {
    oeffneFormular(ctx, bereich, kat, objekte.find((o) => o.id === Number(b.dataset.objekt)), gefuehrt);
  }));
  sheet.querySelectorAll("[data-status-id]").forEach((sel) => sel.addEventListener("change", async () => {
    if (sel.value === "") return;
    try {
      await api.objektStatus(Number(sel.dataset.statusId), Number(sel.value));
      await neuOeffnen();
    } catch (e) { fehler(e.message); }
  }));
  sheet.querySelectorAll("[data-besatzung]").forEach((b) => b.addEventListener("click", async () => {
    const [id, d] = b.dataset.besatzung.split("|").map(Number);
    try {
      await api.objektBesatzung(id, { delta: d });
      await neuOeffnen();
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
  const istFahrzeug = kat.key === "fahrzeuge";
  const o = objekt || { bezeichnung: "", status: null, besatzung: null, standort: "", bemerkungen: "" };
  let entfernenScharf = false;
  const wort = istFahrzeug ? "Fahrzeug" : "Abrollbehälter";

  const sheet = dialog({
    titel: neu ? `${wort} hinzufügen` : o.bezeichnung,
    sub: neu ? "Wird in die Liste aufgenommen (für alle künftigen Einsätze)" : kat.name,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      <div class="feldgruppe"><label for="f-bez">${istFahrzeug ? "Fahrzeugbezeichnung" : "Bezeichnung"} *</label>
        <input id="f-bez" maxlength="60" value="${esc(o.bezeichnung)}" autocomplete="off"></div>
      <div class="${istFahrzeug ? "zwei" : ""}">
        ${istFahrzeug ? `<div class="feldgruppe"><label for="f-besatzung">Besatzungsstärke</label>
          <input id="f-besatzung" type="text" inputmode="numeric" pattern="[0-9]*" value="${o.besatzung ?? ""}" placeholder="—"></div>` : ""}
        <div class="feldgruppe"><label for="f-status">Status in diesem Einsatz</label>
          <select id="f-status">${statusOptionen(o.status)}</select></div>
      </div>
      <div class="feldgruppe"><label for="f-ort">Standort in diesem Einsatz</label>
        <input id="f-ort" maxlength="120" value="${esc(o.standort)}" autocomplete="off"></div>
      <div class="feldgruppe"><label for="f-bem">Bemerkungen in diesem Einsatz</label>
        <textarea id="f-bem" maxlength="1000">${esc(o.bemerkungen)}</textarea></div>`,
    fuss: `
      ${neu ? '<span class="summe"></span>' : '<button class="knopf knopf-gefahr" type="button" data-entfernen>Aus Liste entfernen</button><span class="summe"></span>'}
      <button class="knopf" type="button" data-zurueck>Zurück</button>
      <button class="knopf knopf-primaer" type="button" data-speichern>${neu ? "Hinzufügen" : "Speichern"}</button>`,
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.className = "meldung fehler"; meldung.textContent = t; meldung.hidden = !t; meldung.scrollIntoView({ block: "nearest" }); };
  const besatzungInput = sheet.querySelector("#f-besatzung");
  if (besatzungInput) nurZiffern(besatzungInput);
  if (neu) sheet.querySelector("#f-bez").focus();

  const zurueck = () => { dialogSchliessen(true); oeffneObjekte(ctx, bereich, ctx.kategorie(kat.key), { gefuehrt }); };
  sheet.querySelector("[data-zurueck]").addEventListener("click", zurueck);

  sheet.querySelector("[data-speichern]").addEventListener("click", async () => {
    const st = sheet.querySelector("#f-status").value;
    const daten = {
      kategorie_key: kat.key,
      bezeichnung: sheet.querySelector("#f-bez").value,
      status: st === "" ? null : Number(st),
      besatzung: besatzungInput && besatzungInput.value !== "" ? Number(besatzungInput.value) : null,
      standort: sheet.querySelector("#f-ort").value,
      bemerkungen: sheet.querySelector("#f-bem").value,
    };
    if (!daten.bezeichnung.trim()) return fehler("Bitte eine Bezeichnung eintragen.");
    try {
      if (neu) await api.objektAnlegen(daten);
      else await api.objektAendern(o.id, { ...daten, version: o.version });
      await ctx.neuLaden();
      toast(neu ? `${daten.bezeichnung.trim()} hinzugefügt.` : `${daten.bezeichnung.trim()} gespeichert.`);
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
      meldung.className = "meldung info";
      meldung.textContent = `Der Eintrag erscheint dann in künftigen Einsätzen nicht mehr. Beendete Einsätze behalten ihre Angaben.${o.abschnitt_name ? ` Die Zuordnung zu „${o.abschnitt_name}“ wird aufgehoben.` : ""}`;
      meldung.hidden = false;
      return;
    }
    try {
      await api.objektLoeschen(o.id, o.version);
      await ctx.neuLaden();
      toast(`${o.bezeichnung} aus der Liste entfernt.`);
      zurueck();
    } catch (e) { fehler(e.message); }
  });
}
