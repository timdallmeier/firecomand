// Fahrzeuge und Abrollbehälter – eigene Seiten mit kompakter Liste.
// Stammdaten (gelten für alle Einsätze): Bezeichnung, Funkrufname.
// Je Einsatz: Stärke (Anzahl B IV / B III / B I, nur Fahrzeuge) und Status (Auswahlleiste).
// Startwerte in jedem Einsatz: Status 2, Stärke 0/0/0/0.

import { api } from "./api.js";
import { STAERKE_FUNKTIONEN, STATUS_ERLAUBT, STATUS_WHITEBOARD, fahrzeugstatusText, staerkeGesamt, staerkeText } from "./daten/struktur.js";
import { icon } from "./symbole.js";
import { dialog, dialogSchliessen, esc, toast, zahl } from "./ui.js";

const statusLeiste = (katKey, aktuell, attr, gesperrt = false) => `
  <div class="auswahlleiste status-leiste" role="group" aria-label="Status">
    ${STATUS_ERLAUBT[katKey].map((w) => `<button type="button" ${attr}="${w}" aria-pressed="${aktuell === w}" ${gesperrt ? "disabled" : ""}
      class="${w === STATUS_WHITEBOARD && katKey === "fahrzeuge" ? "st4" : ""}" title="${esc(fahrzeugstatusText(w))}">${w}</button>`).join("")}
  </div>`;

// Stärke als Knopf in der Schreibweise B IV / B III / B I / Gesamt – öffnet die Eingabe
const staerkeKnopf = (o, gesperrt) => `
  <button class="staerke-knopf ${staerkeGesamt(o.staerke) ? "" : "null"}" type="button" data-staerke="${o.id}" ${gesperrt ? "disabled" : ""}
    aria-label="Stärke ${esc(o.bezeichnung)}: ${staerkeText(o.staerke)}">
    <span class="sk-wert zahl">${staerkeText(o.staerke)}</span>
    <span class="sk-legende">B IV / B III / B I / Ges.</span>
  </button>`;

const summe = (liste) => {
  const s = { b4: 0, b3: 0, b1: 0 };
  for (const o of liste) for (const f of STAERKE_FUNKTIONEN) s[f.key] += o.staerke?.[f.key] || 0;
  return s;
};

/** Stärke eingeben: je Funktion − / +, jede Änderung wird sofort gespeichert. */
async function staerkeDialog(ctx, o) {
  const zeichnen = (st) => `
    <div class="meldung fehler" data-meldung hidden></div>
    ${STAERKE_FUNKTIONEN.map((f) => `
      <div class="zeile">
        <div class="label">${f.name}</div>
        <div class="stepper">
          <button type="button" data-f="${f.key}" data-d="-1" ${st[f.key] ? "" : "disabled"} aria-label="${f.name} verringern">−</button>
          <span class="zahl stepper-wert gross">${st[f.key]}</span>
          <button type="button" data-f="${f.key}" data-d="1" aria-label="${f.name} erhöhen">+</button>
        </div>
      </div>`).join("")}
    <div class="zeile staerke-summe"><div class="label">Stärke (B IV / B III / B I / Gesamt)</div><b class="zahl">${staerkeText(st)}</b></div>`;
  const sheet = dialog({
    titel: `Stärke ${o.bezeichnung}`,
    sub: o.funkrufname || "Anzahl Kräfte je Funktion",
    koerper: `<div data-inhalt>${zeichnen(o.staerke)}</div>`,
    fuss: `<span class="summe"></span><button class="knopf knopf-primaer" type="button" data-fertig>Fertig</button>`,
    vorSchliessen: () => { ctx.neuLaden(true); return true; },
  });
  const inhalt = sheet.querySelector("[data-inhalt]");
  let kette = Promise.resolve();
  inhalt.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-f]");
    if (!b) return;
    kette = kette.then(async () => {
      try {
        const neu = await api.objektStaerke(o.id, { funktion: b.dataset.f, delta: Number(b.dataset.d) });
        o.staerke = neu.staerke;
        inhalt.innerHTML = zeichnen(o.staerke);
      } catch (e) {
        const m = inhalt.querySelector("[data-meldung]"); m.textContent = e.message; m.hidden = false;
      }
    });
  });
  sheet.querySelector("[data-fertig]").addEventListener("click", () => dialogSchliessen());
}

/** Seite „Fahrzeuge“ bzw. „Abrollbehälter“ im Einsatz. */
export async function zeigeObjektSeite(main, ctx, katKey) {
  const d = ctx.daten();
  const e = d.einsatz;
  const nurLesen = e.status !== "laufend";
  const istFz = katKey === "fahrzeuge";
  const titel = istFz ? "Fahrzeuge" : "Abrollbehälter";
  let liste;
  try { liste = await api.objekte(katKey); } catch (err) { toast(err.message, "fehler"); return; }
  const ohne = liste.filter((o) => o.status === null).length;

  main.innerHTML = `
    ${ctx.einsatzLeiste()}
    <div class="seitenkopf">
      <span class="kachel-icon gross">${icon(istFz ? "fahrzeug" : "abrollbehaelter", 26)}</span>
      <div><h1 class="seitentitel">${titel}</h1>
        <p class="text-3" style="margin:2px 0 0">${zahl(liste.length)} in der Liste${ohne ? ` · ${zahl(ohne)} ohne Status` : ""}
          ${istFz ? ` · Stärke gesamt ${staerkeText(summe(liste))} · ${fahrzeugstatusText(STATUS_WHITEBOARD, true)} erscheint unter „Einsatzabschnitte“` : ` · zulässig: Status ${STATUS_ERLAUBT[katKey].join(", ")}`}</p></div>
      ${nurLesen ? "" : `<button class="knopf knopf-hell" type="button" data-neu style="margin-left:auto">${icon("plus", 18)} ${istFz ? "Fahrzeug" : "Abrollbehälter"} hinzufügen</button>`}
    </div>
    <div class="meldung fehler" data-meldung hidden></div>
    ${liste.length ? `
    <div class="liste-tabelle ${istFz ? "fzliste" : "abliste"}" role="table" aria-label="${titel}">
      <div class="lt-kopf" role="row">
        <span>Bezeichnung</span>${istFz ? "<span>Funkrufname</span><span>Stärke</span>" : ""}<span>Status</span>
      </div>
      ${liste.map((o) => `
      <div class="lt-zeile ${o.status === null ? "offen" : ""}" role="row" data-id="${o.id}">
        <button class="lt-name" type="button" data-bearbeiten="${o.id}" ${nurLesen ? "disabled" : ""}>
          <b>${esc(o.bezeichnung)}</b>
          ${o.abschnitt_name ? `<span class="lt-zusatz">Abschnitt: ${esc(o.abschnitt_name)}</span>` : o.herkunft === "initial" ? `<span class="lt-zusatz">Stammdatensatz</span>` : ""}
        </button>
        ${istFz ? `<span class="lt-funk">${esc(o.funkrufname) || '<span class="text-3">—</span>'}</span>
          ${staerkeKnopf(o, nurLesen)}` : ""}
        ${statusLeiste(katKey, o.status, "data-status", nurLesen)}
      </div>`).join("")}
    </div>`
    : `<div class="leer"><p>Noch keine ${titel} in der Liste.</p></div>`}`;

  const meldung = main.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  const neuZeigen = async () => { await ctx.neuLaden(true); };

  main.querySelector("[data-neu]")?.addEventListener("click", () => formular(ctx, katKey, null));
  main.querySelectorAll(".lt-zeile").forEach((z) => {
    const id = Number(z.dataset.id);
    z.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", async () => {
      try { await api.objektStatus(id, Number(b.dataset.status)); await neuZeigen(); } catch (err) { fehler(err.message); }
    }));
    z.querySelector("[data-staerke]")?.addEventListener("click", () => {
      staerkeDialog(ctx, liste.find((o) => o.id === id));
    });
  });
  main.querySelectorAll("[data-bearbeiten]").forEach((b) => b.addEventListener("click", () => {
    formular(ctx, katKey, liste.find((o) => o.id === Number(b.dataset.bearbeiten)));
  }));
}

function formular(ctx, katKey, objekt) {
  const neu = !objekt;
  const istFz = katKey === "fahrzeuge";
  const wort = istFz ? "Fahrzeug" : "Abrollbehälter";
  const o = objekt || { bezeichnung: "", funkrufname: "", standort: "", bemerkungen: "" };
  let entfernenScharf = false;

  const sheet = dialog({
    titel: neu ? `${wort} hinzufügen` : o.bezeichnung,
    sub: neu ? "Stammdatensatz – gilt für alle künftigen Einsätze" : wort,
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      <div class="${istFz ? "zwei" : ""}">
        <div class="feldgruppe"><label for="f-bez">Bezeichnung *</label>
          <input id="f-bez" maxlength="60" value="${esc(o.bezeichnung)}" autocomplete="off" placeholder="${istFz ? "z. B. HLF 20" : "z. B. AB-GSG/Rüst"}"></div>
        ${istFz ? `<div class="feldgruppe"><label for="f-funk">Funkrufname</label>
          <input id="f-funk" maxlength="40" value="${esc(o.funkrufname)}" autocomplete="off" placeholder="z. B. 1-HLF 20-1"></div>` : ""}
      </div>
      ${neu ? `<p class="text-3" style="margin:0">Startwerte im Einsatz: Status 2${istFz ? ", Stärke 0/0/0/0" : ""}. Anpassen direkt in der Liste.</p>` : `
      <div class="feldgruppe"><label for="f-ort">Standort in diesem Einsatz</label>
        <input id="f-ort" maxlength="120" value="${esc(o.standort)}" autocomplete="off"></div>
      <div class="feldgruppe"><label for="f-bem">Bemerkungen in diesem Einsatz</label>
        <textarea id="f-bem" maxlength="1000">${esc(o.bemerkungen)}</textarea></div>`}`,
    fuss: `
      ${neu ? '<span class="summe"></span>' : '<button class="knopf knopf-gefahr" type="button" data-entfernen>Aus Liste entfernen</button><span class="summe"></span>'}
      <button class="knopf" type="button" data-schliessen>Abbrechen</button>
      <button class="knopf knopf-primaer" type="button" data-speichern>${neu ? "Hinzufügen" : "Speichern"}</button>`,
  });
  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.className = "meldung fehler"; meldung.textContent = t; meldung.hidden = !t; meldung.scrollIntoView({ block: "nearest" }); };
  if (neu) sheet.querySelector("#f-bez").focus();

  sheet.querySelector("[data-speichern]").addEventListener("click", async () => {
    const daten = {
      kategorie_key: katKey,
      bezeichnung: sheet.querySelector("#f-bez").value,
      funkrufname: sheet.querySelector("#f-funk")?.value ?? "",
      standort: sheet.querySelector("#f-ort")?.value ?? o.standort ?? "",
      bemerkungen: sheet.querySelector("#f-bem")?.value ?? o.bemerkungen ?? "",
    };
    if (!neu) { daten.status = o.status; daten.staerke = o.staerke; }
    if (!daten.bezeichnung.trim()) return fehler("Bitte eine Bezeichnung eintragen.");
    try {
      if (neu) await api.objektAnlegen(daten);
      else await api.objektAendern(o.id, { ...daten, version: o.version });
      dialogSchliessen(true);
      toast(neu ? `${daten.bezeichnung.trim()} hinzugefügt.` : `${daten.bezeichnung.trim()} gespeichert.`);
      await ctx.neuLaden(true);
    } catch (e) {
      fehler(e.message);
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
      dialogSchliessen(true);
      toast(`${o.bezeichnung} aus der Liste entfernt.`);
      await ctx.neuLaden(true);
    } catch (e) { fehler(e.message); }
  });
}
