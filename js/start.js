// Startseite, Einsatz anlegen und Einsatzliste

import { api } from "./api.js";
import { EINSATZARTEN } from "./daten/struktur.js";
import { BEREITSTELLUNGSRAUM_STATUS } from "./daten/struktur.js";
import { icon } from "./symbole.js";
import { datumZeit, dauer, dialog, dialogSchliessen, esc, toast, zahl } from "./ui.js";

// ---- Startseite --------------------------------------------------------------
function bearbeiterText() {
  let b = "";
  try { b = localStorage.getItem("firecommand.bearbeiter") || ""; } catch { /* egal */ }
  return b ? `Bearbeiter: ${b}` : "Bearbeiter festlegen";
}

export async function zeigeStart(main) {
  const einsaetze = await api.einsaetze();
  const laufend = einsaetze.filter((e) => e.status === "laufend");
  const info = await api.stammInfo();
  main.innerHTML = `
    <section class="start drei">
      <a class="startkachel primaer" href="#/neu">
        <span class="startkachel-symbol" aria-hidden="true">${icon("plus", 28)}</span>
        <span class="startkachel-titel">Neuen Einsatz anlegen</span>
        <span class="startkachel-text">Gebundene Einsatzstelle oder Flächenlage</span>
      </a>
      <a class="startkachel" href="#/einsaetze">
        <span class="startkachel-symbol" aria-hidden="true">${icon("liste", 26)}</span>
        <span class="startkachel-titel">Liste aller Einsätze</span>
        <span class="startkachel-text">${einsaetze.length
          ? `${zahl(einsaetze.length)} ${einsaetze.length === 1 ? "Einsatz" : "Einsätze"}${laufend.length ? ` · <b class="laufend-text">${zahl(laufend.length)} laufend</b>` : ""}`
          : "Noch keine Einsätze"}</span>
      </a>
      <a class="startkachel" href="#/bereitstellungsraeume">
        <span class="startkachel-symbol" aria-hidden="true">${icon("bereitstellung", 26)}</span>
        ${info.bereitstellungsraeume.length ? "" : '<span class="badge folgt">folgt</span>'}
        <span class="startkachel-titel">Bereitstellungsräume</span>
        <span class="startkachel-text">${info.bereitstellungsraeume.length ? `${zahl(info.bereitstellungsraeume.length)} hinterlegt` : "Folgt – Liste wird ergänzt"}</span>
      </a>
    </section>
    <section class="werkzeuge">
      <button class="knopf" id="btn-sicherung" type="button">Sicherung</button>
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

// ---- Liste aller Einsätze -------------------------------------------------
export async function zeigeListe(main, { neuZeigen } = {}) {
  const einsaetze = await api.einsaetze();
  main.innerHTML = `
    <nav class="pfad"><a href="#/">← Start</a></nav>
    <div class="bereich-kopf"><h2>Liste aller Einsätze</h2><span class="meta">${zahl(einsaetze.length)} gesamt</span>
      <a class="knopf knopf-hell" href="#/neu" style="margin-left:auto">${icon("plus", 18)} Neuen Einsatz eröffnen</a></div>
    ${einsaetze.length
      ? `<div class="einsatz-liste">${einsaetze.map((e) => `
          <div class="einsatz-eintrag">
            ${einsatzKarte(e)}
            <button class="loeschen-knopf" type="button" data-loeschen="${e.id}" aria-label="Einsatz ${esc(e.nummer)} löschen" title="Einsatz löschen">
              ${icon("muell", 20)}<span>Löschen</span></button>
          </div>`).join("")}</div>`
      : `<div class="leer"><p>Noch keine Einsätze angelegt.</p></div>`}`;

  main.querySelectorAll("[data-loeschen]").forEach((b) => b.addEventListener("click", () => {
    const e = einsaetze.find((x) => x.id === Number(b.dataset.loeschen));
    loeschenAbfrage(e, async () => { await zeigeListe(main, { neuZeigen }); neuZeigen?.(); });
  }));
}

// Sicherheitsabfrage – gelöscht wird erst nach ausdrücklicher Bestätigung
function loeschenAbfrage(e, danach) {
  const sheet = dialog({
    titel: "Einsatz endgültig löschen?",
    sub: `${e.nummer} · ${e.stichwort} · ${e.ort}`,
    koerper: `
      <div class="meldung fehler" style="margin:0">Wenn du diesen Einsatz löschst, werden sämtliche zugehörigen Einsatzdaten,
        Ressourcen-Zuordnungen, Einsatzabschnitte, Whiteboard-Elemente und weiteren gespeicherten Informationen unwiderruflich entfernt.</div>
      ${e.status === "laufend" ? '<p class="meldung info" style="margin:0">Achtung: Dieser Einsatz läuft noch.</p>' : ""}
      <p class="text-2" style="margin:0">Fahrzeuge und Abrollbehälter in den Stammdaten bleiben erhalten.
        Tipp: Vorher einen Lagebericht erzeugen oder eine Sicherung anlegen, falls du die Daten noch brauchst.</p>`,
    fuss: `<span class="summe"></span>
      <button class="knopf knopf-gross" type="button" data-schliessen>Abbrechen</button>
      <button class="knopf knopf-gefahr bestaetigen knopf-gross" type="button" data-endgueltig>Einsatz endgültig löschen</button>`,
  });
  sheet.querySelector("[data-endgueltig]").addEventListener("click", async (ev) => {
    ev.currentTarget.disabled = true;
    try {
      await api.einsatzLoeschen(e.id);
      dialogSchliessen(true);
      toast(`Einsatz ${e.nummer} wurde endgültig gelöscht.`);
      await danach();
    } catch (err) {
      toast(err.message, "fehler");
      ev.currentTarget.disabled = false;
    }
  });
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

// ---- Bereitstellungsräume (vorbereitet) -------------------------------------
export async function zeigeBereitstellungsraeume(main) {
  const info = await api.stammInfo();
  const liste = info.bereitstellungsraeume;
  main.innerHTML = `
    <nav class="pfad"><a href="#/">← Start</a></nav>
    <h1 class="seitentitel">Bereitstellungsräume</h1>
    ${liste.length ? `
      <div class="einsatz-liste">${liste.map((b) => `
        <div class="einsatz-karte">
          <span class="ek-kopf"><span class="ek-stichwort">${esc(b.bezeichnung)}</span>
            <span class="ek-status">${esc(BEREITSTELLUNGSRAUM_STATUS.find((s) => s.key === b.status)?.name || "")}</span></span>
          <span class="ek-ort">${esc(b.standort)}</span>
          <span class="ek-zeit">${esc(b.groesse)}${b.kapazitaet_loeschzuege !== null ? ` · Kapazität ${zahl(b.kapazitaet_loeschzuege)} Löschzüge` : ""}</span>
        </div>`).join("")}</div>`
    : `
      <div class="leer folgt-hinweis"><p><span class="badge folgt">folgt</span> Folgt – Liste wird ergänzt</p></div>
      <p class="text-2">Vorbereitet sind je Bereitstellungsraum: Bezeichnung, Ort bzw. Standort, Größe,
        Kapazität in Anzahl möglicher Löschzüge und Status (${BEREITSTELLUNGSRAUM_STATUS.map((s) => esc(s.name)).join(" / ")}).</p>`}`;
}
