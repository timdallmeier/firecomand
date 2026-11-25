// Startseite, Einsatz anlegen und Einsatzliste

import { api } from "./api.js";
import { EINSATZARTEN } from "./daten/struktur.js";
import { datumZeit, dauer, esc, toast, zahl } from "./ui.js";

// ---- Startseite: genau zwei Kacheln ----------------------------------------
export async function zeigeStart(main) {
  const einsaetze = await api.einsaetze();
  const laufend = einsaetze.filter((e) => e.status === "laufend");
  main.innerHTML = `
    <section class="start">
      <a class="startkachel primaer" href="#/neu">
        <span class="startkachel-symbol" aria-hidden="true">+</span>
        <span class="startkachel-titel">Neuen Einsatz anlegen</span>
        <span class="startkachel-text">Gebundene Einsatzstelle oder Flächenlage</span>
      </a>
      <a class="startkachel" href="#/einsaetze">
        <span class="startkachel-symbol" aria-hidden="true">≡</span>
        <span class="startkachel-titel">Liste alter Einsätze</span>
        <span class="startkachel-text">${einsaetze.length
          ? `${zahl(einsaetze.length)} ${einsaetze.length === 1 ? "Einsatz" : "Einsätze"}${laufend.length ? ` · <b class="laufend-text">${zahl(laufend.length)} laufend</b>` : ""}`
          : "Noch keine Einsätze"}</span>
      </a>
    </section>
    ${laufend.length ? `
    <section class="schnellzugriff">
      <div class="bereich-kopf"><h2>Laufend</h2></div>
      ${laufend.map(einsatzKarte).join("")}
    </section>` : ""}`;
  return einsaetze;
}

function einsatzKarte(e) {
  const laufend = e.status === "laufend";
  return `
    <a class="einsatz-karte ${laufend ? "laufend" : ""}" href="#/einsatz/${e.id}">
      <span class="ek-kopf">
        <span class="ek-nr zahl">${esc(e.nummer)}</span>
        <span class="ek-status">${laufend ? "laufend" : "beendet"}</span>
      </span>
      <span class="ek-stichwort">${esc(e.stichwort)}</span>
      <span class="ek-ort">${esc(e.ort)}</span>
      <span class="ek-zeit">${esc(e.art_name)} · ${esc(datumZeit(e.beginn))}${laufend ? ` · seit ${esc(dauer(e.beginn))}` : ` – ${esc(datumZeit(e.ende))}`}</span>
    </a>`;
}

// ---- Einsatzliste ---------------------------------------------------------
export async function zeigeListe(main) {
  const einsaetze = await api.einsaetze();
  main.innerHTML = `
    <nav class="pfad"><a href="#/">← Start</a></nav>
    <div class="bereich-kopf"><h2>Einsätze</h2><span class="meta">${zahl(einsaetze.length)} gesamt</span>
      <a class="knopf knopf-primaer" href="#/neu" style="margin-left:auto">Neuen Einsatz anlegen</a></div>
    ${einsaetze.length
      ? `<div class="einsatz-liste">${einsaetze.map(einsatzKarte).join("")}</div>`
      : `<div class="leer"><p>Noch keine Einsätze angelegt.</p></div>`}`;
}

// ---- Neuer Einsatz: Schritt 1 – Art wählen ---------------------------------
export function zeigeNeuArt(main) {
  const beschreibung = {
    gebunden: "Einsatz an einem festen Objekt oder einer Anlage. Öffnet die Ressourcenübersicht.",
    flaeche: "Mehrere Einsatzstellen in einem Gebiet.",
  };
  main.innerHTML = `
    <nav class="pfad"><a href="#/">← Start</a></nav>
    <h1 class="seitentitel">Neuen Einsatz anlegen</h1>
    <p class="seitentext">Welche Art von Einsatz?</p>
    <section class="start">
      ${EINSATZARTEN.map((a) => a.verfuegbar
        ? `<a class="startkachel primaer" href="#/neu/${a.key}">
             <span class="startkachel-titel">${esc(a.name)}</span>
             <span class="startkachel-text">${esc(beschreibung[a.key])}</span></a>`
        : `<div class="startkachel gesperrt" aria-disabled="true">
             <span class="badge folgt">folgt</span>
             <span class="startkachel-titel">${esc(a.name)}</span>
             <span class="startkachel-text">${esc(beschreibung[a.key])} Wird in einer späteren Version ergänzt.</span></div>`).join("")}
    </section>`;
}

// ---- Neuer Einsatz: Schritt 2 – Angaben und Startbestand -------------------
export async function zeigeNeuFormular(main, art, { oeffneEinsatz }) {
  const a = EINSATZARTEN.find((x) => x.key === art);
  if (!a || !a.verfuegbar) { location.hash = "#/neu"; return; }
  const info = await api.stammInfo();
  main.innerHTML = `
    <nav class="pfad"><a href="#/neu">← Art wählen</a></nav>
    <h1 class="seitentitel">${esc(a.name)}</h1>
    <form class="formular" novalidate>
      <div class="meldung fehler" data-meldung hidden></div>
      <div class="feldgruppe"><label for="n-stichwort">Einsatzstichwort *</label>
        <input id="n-stichwort" maxlength="80" autocomplete="off" placeholder="z. B. B3 Brand Industrie"></div>
      <div class="feldgruppe"><label for="n-ort">Einsatzort / Objekt *</label>
        <input id="n-ort" maxlength="120" autocomplete="off"></div>
      <div class="feldgruppe"><label for="n-bem">Bemerkung</label>
        <textarea id="n-bem" maxlength="500"></textarea></div>

      <div class="feldgruppe">
        <label>Startbestand</label>
        <div class="auswahl">
          <label class="option">
            <input type="radio" name="start" value="leer" checked>
            <span><b>Leer starten</b><br><span class="text-3">Alle Bestände werden manuell erfasst.</span></span>
          </label>
          <label class="option ${info.standarddatensatz_vorhanden ? "" : "gesperrt"}">
            <input type="radio" name="start" value="standarddaten" ${info.standarddatensatz_vorhanden ? "" : "disabled"}>
            <span><b>Standarddaten übernehmen</b> ${info.standarddatensatz_vorhanden ? "" : '<span class="badge folgt">folgt</span>'}<br>
              <span class="text-3">${info.standarddatensatz_vorhanden
                ? "Übernimmt den hinterlegten Normalbestand. Danach kann alles angepasst werden."
                : "Noch kein Standarddatensatz hinterlegt. Wird mit der Fahrzeug- und Bestandsliste ergänzt."}</span></span>
          </label>
        </div>
      </div>
      <p class="text-3" style="margin:0">Beginn (${esc(datumZeit(new Date().toISOString()))}) und Einsatznummer werden automatisch vergeben.</p>
      <button class="knopf knopf-primaer knopf-gross" type="submit">Einsatz anlegen</button>
    </form>`;
  const form = main.querySelector("form");
  const meldung = form.querySelector("[data-meldung]");
  form.querySelector("#n-stichwort").focus();
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const daten = {
      art,
      stichwort: form.querySelector("#n-stichwort").value,
      ort: form.querySelector("#n-ort").value,
      bemerkung: form.querySelector("#n-bem").value,
    };
    const standarddaten = form.querySelector('input[name="start"]:checked')?.value === "standarddaten";
    if (!daten.stichwort.trim()) { meldung.textContent = "Bitte ein Einsatzstichwort eintragen."; meldung.hidden = false; return; }
    if (!daten.ort.trim()) { meldung.textContent = "Bitte den Einsatzort / das Objekt eintragen."; meldung.hidden = false; return; }
    form.querySelector('button[type="submit"]').disabled = true;
    try {
      const e = await api.einsatzAnlegen(daten, { standarddaten });
      toast(`Einsatz ${e.nummer} angelegt.`);
      oeffneEinsatz(e.id);
    } catch (e) {
      meldung.textContent = e.message;
      meldung.hidden = false;
      form.querySelector('button[type="submit"]').disabled = false;
    }
  });
}
