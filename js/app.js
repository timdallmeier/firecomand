// FIRECOMMAND (iPad) – Einstieg, Navigation, Zustand und Verdrahtung
//
// Ansichten (über die Adresse nach #):
//   #/                 Startseite mit zwei Kacheln
//   #/neu              Neuer Einsatz: Art wählen
//   #/neu/gebunden     Neuer Einsatz: Angaben + Startbestand
//   #/einsaetze        Liste aller Einsätze
//   #/einsatz/<id>              Einsatz: Übersicht mit drei Kacheln
//   #/einsatz/<id>/ressourcen   Kräfte und Einsatzmittel (beendet = nur Ansicht)
//   #/einsatz/<id>/abschnitte   Einsatzabschnitte (Whiteboard)
//   #/bereitstellungsraeume     Bereitstellungsräume (vorbereitet, folgt)

import { api, setzeBearbeiter, setzeEinsatz } from "./api.js";
import { oeffneAnzahl, oeffneVorrat } from "./bestaende.js";
import { zeigeBoard } from "./board.js";
import { renderDashboard } from "./dashboard.js";
import { icon } from "./symbole.js";
import { zeigeFlaechenlage } from "./flaechenlage.js";
import { oeffneLagebericht } from "./lagebericht.js";
import { oeffneMengen } from "./mengen.js";
import { oeffneObjekte } from "./objekte.js";
import { oeffneProtokoll } from "./protokoll.js";
import { oeffneSicherung } from "./sicherung-ui.js";
import { zeigeBereitstellungsraeume, zeigeListe, zeigeNeuArt, zeigeNeuFormular, zeigeStart } from "./start.js";
import { datumZeit, dauer, dialog, dialogOffen, dialogSchliessen, esc, toast, zeitpunkt } from "./ui.js";

const SICHERUNG_ERINNERN_TAGE = 7;
const zustand = { daten: null, einsatzId: null, ansicht: null, board: null };
const main = () => document.getElementById("inhalt");

// ---- Bearbeiter (keine Anmeldung – nur Name/Kürzel fürs Protokoll) -------
const SPEICHER_KEY = "firecommand.bearbeiter";
function ladeBearbeiter() {
  try { return localStorage.getItem(SPEICHER_KEY) || ""; } catch { return ""; }
}
function speichereBearbeiter(name) {
  try { name ? localStorage.setItem(SPEICHER_KEY, name) : localStorage.removeItem(SPEICHER_KEY); } catch { /* egal */ }
}
let bearbeiter = ladeBearbeiter();
setzeBearbeiter(bearbeiter);

function zeigeBearbeiter() {
  document.getElementById("btn-bearbeiter").textContent = bearbeiter ? `Bearbeiter: ${bearbeiter}` : "Bearbeiter festlegen";
}

function oeffneBearbeiter() {
  const sheet = dialog({
    titel: "Bearbeiter",
    sub: "Wird im Änderungsprotokoll und im Lagebericht vermerkt",
    koerper: `
      <div class="feldgruppe"><label for="b-name">Name oder Kürzel</label>
        <input id="b-name" maxlength="60" value="${esc(bearbeiter)}" autocomplete="off" placeholder="z. B. LdF Müller"></div>
      <p class="meldung info" style="margin:0">Dies ist keine Anmeldung. Der Eintrag gilt nur für dieses Gerät.</p>`,
    fuss: `<span class="summe"></span><button class="knopf" type="button" data-schliessen>Abbrechen</button>
           <button class="knopf knopf-primaer" type="button" data-ok>Übernehmen</button>`,
  });
  const input = sheet.querySelector("#b-name");
  input.focus();
  const ok = () => {
    bearbeiter = input.value.trim();
    speichereBearbeiter(bearbeiter);
    setzeBearbeiter(bearbeiter);
    zeigeBearbeiter();
    dialogSchliessen(true);
  };
  sheet.querySelector("[data-ok]").addEventListener("click", ok);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
}

// ---- Kopfbereich ---------------------------------------------------------
function setzeSystemstatus(ok, text) {
  const el = document.getElementById("systemstatus");
  el.dataset.zustand = ok ? "bereit" : "fehler";
  el.querySelector(".text").textContent = text;
}

function zeigeKopf() {
  const offline = navigator.serviceWorker?.controller ? "Offline bereit" : "Bereit";
  const d = zustand.daten;
  if (d && zustand.einsatzId !== null) {
    const e = d.erfassung;
    setzeSystemstatus(true, e.gruppen_vollstaendig === e.gruppen_gesamt
      ? `${offline} · alles erfasst` : `${offline} · ${e.gruppen_vollstaendig}/${e.gruppen_gesamt} vollständig erfasst`);
    document.getElementById("aktualisiert").textContent = `Letzte Aktualisierung: ${zeitpunkt(d.letzte_aktualisierung)}`;
  } else {
    setzeSystemstatus(true, `${offline} · Daten auf diesem Gerät`);
    document.getElementById("aktualisiert").textContent = "";
  }
}

// Erinnerung an die Sicherung, sobald Daten vorhanden sind
async function zeigeSicherungsHinweis(hatDaten) {
  const band = document.getElementById("hinweisband");
  const info = await api.stammInfo().catch(() => null);
  const alter = info?.letzte_sicherung ? (Date.now() - new Date(info.letzte_sicherung)) / 864e5 : Infinity;
  if (!hatDaten || alter < SICHERUNG_ERINNERN_TAGE) { band.hidden = true; return; }
  band.innerHTML = `<span>${info?.letzte_sicherung ? `Letzte Sicherung vor ${Math.floor(alter)} Tagen.` : "Es gibt noch keine Sicherung."}
    Die Daten liegen nur auf diesem Gerät.</span><button class="knopf" type="button" data-sichern>Jetzt sichern</button>`;
  band.hidden = false;
}

// ---- Einsatzansicht -----------------------------------------------------
function einsatzLeiste(d) {
  const e = d.einsatz;
  const laufend = e.status === "laufend";
  return `
    <div class="einsatzleiste ${laufend ? "laufend" : "beendet"}">
      <a class="zurueck" href="${zustand.ansicht === "hub" ? "#/" : `#/einsatz/${e.id}`}" aria-label="${zustand.ansicht === "hub" ? "Zur Startseite" : "Zur Einsatzübersicht"}">←</a>
      <div class="el-info">
        <div class="el-titel"><span class="zahl">${esc(e.nummer)}</span> · ${esc(e.stichwort)}</div>
        <div class="el-sub">${esc(e.ort)} · ${esc(e.art_name)} · Beginn ${esc(datumZeit(e.beginn))}
          ${laufend ? `· <b class="laufend-text">laufend seit ${esc(dauer(e.beginn))}</b>` : `· beendet ${esc(datumZeit(e.ende))}`}</div>
      </div>
      <div class="el-aktionen">
        <button class="knopf" type="button" data-aktion="protokoll">Protokoll</button>
        <button class="knopf knopf-primaer" type="button" data-aktion="lagebericht">Lagebericht erzeugen</button>
        ${laufend ? `<button class="knopf knopf-gefahr" type="button" data-aktion="beenden">Einsatz beenden</button>` : ""}
      </div>
    </div>
    ${laufend ? "" : `<p class="meldung info nurlesen">Dieser Einsatz ist beendet. Die Daten sind nur noch zur Ansicht – Lagebericht und Protokoll stehen weiter zur Verfügung.</p>`}`;
}

function nurLesen() { return zustand.daten?.einsatz.status !== "laufend"; }

// Einsatzübersicht: drei Kacheln
function einsatzHub(d) {
  const e = d.einsatz;
  const ab = d.abschnitte;
  const kr = d.bereiche[0].gruppen[0];
  return `
    <section class="hub">
      <a class="hubkachel" href="#/einsatz/${e.id}/ressourcen">
        <span class="hub-icon">${icon("fahrzeug", 30)}</span>
        <span class="hub-titel">Kräfte und Einsatzmittel</span>
        <span class="hub-text">${kr.gesamt === null ? "Kräfte noch nicht erfasst" : `Stärke ${d.bereiche[0].kategorien.map((k) => k.gesamt ?? "—").join(" / ")} / ${kr.gesamt}`}
          · ${d.erfassung.gruppen_vollstaendig}/${d.erfassung.gruppen_gesamt} Bereiche vollständig</span>
      </a>
      <a class="hubkachel" href="#/einsatz/${e.id}/abschnitte">
        <span class="hub-icon">${icon("abschnitte", 30)}</span>
        <span class="hub-titel">Einsatzabschnitte</span>
        <span class="hub-text">${ab.anzahl ? `${ab.anzahl} ${ab.anzahl === 1 ? "Abschnitt" : "Abschnitte"} · ${ab.zugeordnet} Fahrzeuge zugeordnet` : "Einsatzstellenstruktur auf dem Whiteboard aufbauen"}</span>
      </a>
      <div class="hubkachel gesperrt" aria-disabled="true">
        <span class="badge folgt">folgt</span>
        <span class="hub-icon">${icon("lagebild", 30)}</span>
        <span class="hub-titel">Lagebild</span>
        <span class="hub-text">Folgt – wird in einer späteren Version ergänzt</span>
      </div>
    </section>`;
}

function darstellen() {
  const d = zustand.daten;
  if (!d) return;
  const m = main();
  if (zustand.ansicht === "abschnitte") {
    if (zustand.board) zustand.board.aktualisieren();
    zeigeKopf();
    return;
  }
  const scroll = window.scrollY;
  if (zustand.ansicht === "hub") {
    m.innerHTML = einsatzLeiste(d) + einsatzHub(d);
  } else if (d.einsatz.art === "flaeche") {
    m.innerHTML = einsatzLeiste(d);
    const platz = document.createElement("div");
    m.appendChild(platz);
    zeigeFlaechenlage(platz, d);
  } else {
    m.innerHTML = einsatzLeiste(d) + renderDashboard(d, { nurLesen: nurLesen() });
  }
  window.scrollTo(0, scroll);
  zeigeKopf();
}

async function neuLaden() {
  if (zustand.einsatzId === null) return;
  try {
    zustand.daten = await api.uebersicht();
    darstellen();
  } catch (e) {
    setzeSystemstatus(false, "Speicherfehler");
    main().innerHTML = `<p class="meldung fehler">Der Einsatz konnte nicht geladen werden: ${esc(e.message)}</p>
      <p><a class="knopf" href="#/">Zur Startseite</a></p>`;
  }
}

function aktualisiert(daten) {
  zustand.daten = daten;
  darstellen();
}

function finde(katKey) {
  for (const b of zustand.daten.bereiche) {
    const k = b.kategorien.find((x) => x.key === katKey);
    if (k) return { bereich: b, kat: k };
  }
  return null;
}

function oeffneKategorie(katKey, optionen = {}) {
  if (nurLesen()) return toast("Der Einsatz ist beendet – nur Ansicht. Details stehen im Lagebericht.");
  const t = finde(katKey);
  if (!t) return;
  if (optionen.gefuehrt) {
    const i = t.bereich.kategorien.indexOf(t.kat);
    optionen = { ...optionen, gefuehrt: t.bereich.kategorien.slice(i + 1)
      .some((k) => k.erfassungsstand === "nicht_erfasst" && !(t.kat.typ === "anzahl" && k.gruppe_key === t.kat.gruppe_key)) };
  }
  if (t.kat.typ === "einzeln") oeffneObjekte(ctx, t.bereich, t.kat, optionen);
  else if (t.kat.typ === "vorrat") oeffneVorrat(ctx, t.bereich, t.kat, optionen);
  else if (t.kat.typ === "anzahl") oeffneAnzahl(ctx, t.bereich, t.bereich.gruppen.find((g) => g.key === t.kat.gruppe_key), optionen);
  else oeffneMengen(ctx, t.bereich, t.kat, optionen);
}

function weiterGefuehrt(bereichKey, nachKatKey) {
  const b = zustand.daten.bereiche.find((x) => x.key === bereichKey);
  const start = b.kategorien.findIndex((k) => k.key === nachKatKey);
  const aktuell = b.kategorien[start];
  const naechste = b.kategorien.slice(start + 1)
    .find((k) => k.erfassungsstand === "nicht_erfasst" && !(aktuell?.typ === "anzahl" && k.gruppe_key === aktuell.gruppe_key));
  if (naechste) oeffneKategorie(naechste.key, { gefuehrt: true });
  else toast(`${b.name}: Erfassung abgeschlossen.`);
}

function geschwister(kat) {
  const { bereich } = finde(kat.key);
  return {
    gruppe: bereich.gruppen.find((g) => g.key === kat.gruppe_key),
    glieder: bereich.kategorien.filter((k) => k.gruppe_key === kat.gruppe_key),
  };
}

function oeffneGruppe(gruppeKey) {
  for (const b of zustand.daten.bereiche) {
    const g = b.gruppen.find((x) => x.key === gruppeKey);
    if (!g) continue;
    const glieder = b.kategorien.filter((k) => k.gruppe_key === g.key);
    if (g.typ === "anzahl") return nurLesen() ? toast("Der Einsatz ist beendet – nur Ansicht.") : oeffneAnzahl(ctx, b, g);
    return oeffneKategorie((glieder.find((k) => k.erfassungsstand !== "vollstaendig") || glieder[0]).key);
  }
}

function oeffneBeenden() {
  const e = zustand.daten.einsatz;
  const sheet = dialog({
    titel: "Einsatz beenden",
    sub: `${e.nummer} · ${e.stichwort}`,
    koerper: `
      <p class="meldung info" style="margin:0">Nach dem Beenden können die Daten dieses Einsatzes nicht mehr geändert werden.
        Lagebericht und Protokoll bleiben abrufbar. Ein beendeter Einsatz lässt sich nicht wieder öffnen.</p>
      <p class="text-2">Tipp: Erzeuge vorher einen letzten Lagebericht.</p>`,
    fuss: `<span class="summe"></span><button class="knopf" type="button" data-schliessen>Abbrechen</button>
           <button class="knopf knopf-gefahr bestaetigen" type="button" data-ok>Einsatz beenden</button>`,
  });
  sheet.querySelector("[data-ok]").addEventListener("click", async () => {
    try {
      const d = await api.einsatzBeenden();
      dialogSchliessen(true);
      aktualisiert(d);
      toast(`Einsatz ${e.nummer} beendet.`);
    } catch (err) { toast(err.message, "fehler"); }
  });
}

// Plus/Minus: Klicks nacheinander abarbeiten, damit schnelles Tippen nichts verliert
let warteschlange = Promise.resolve();
function schnellAendern(kat, status, delta) {
  warteschlange = warteschlange.then(async () => {
    try { aktualisiert(await api.mengeAendern(kat, status, delta)); }
    catch (e) { toast(e.message, "fehler"); }
  });
}

const ctx = {
  daten: () => zustand.daten,
  aktualisiert, neuLaden, weiterGefuehrt, geschwister, oeffneKategorie,
  bindeErfassungsart: () => {},
  kategorie: (key) => finde(key).kat,
};

// ---- Navigation ---------------------------------------------------------
async function oeffneEinsatz(id) {
  location.hash = `#/einsatz/${id}`;
}

async function navigieren() {
  if (dialogOffen()) dialogSchliessen(true);
  const teile = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  zustand.einsatzId = null;
  zustand.daten = null;
  zustand.ansicht = null;
  if (zustand.board) { zustand.board.beenden(); zustand.board = null; }
  document.body.classList.remove("board-modus");
  setzeEinsatz(null);
  window.scrollTo(0, 0);
  try {
    if (teile[0] === "einsatz" && /^\d+$/.test(teile[1] || "")) {
      zustand.einsatzId = Number(teile[1]);
      zustand.ansicht = { ressourcen: "ressourcen", abschnitte: "abschnitte" }[teile[2]] || "hub";
      setzeEinsatz(zustand.einsatzId);
      if (zustand.ansicht === "abschnitte") {
        zustand.daten = await api.uebersicht();
        document.body.classList.add("board-modus");
        zustand.board = await zeigeBoard(main(), { daten: zustand.daten, nurLesen: nurLesen(), neuLaden: async () => {
          zustand.daten = await api.uebersicht(); zeigeKopf();
        } });
        zeigeKopf();
        return;
      }
      await neuLaden();
      zeigeSicherungsHinweis(true);
      return;
    }
    if (teile[0] === "bereitstellungsraeume") await zeigeBereitstellungsraeume(main());
    else if (teile[0] === "neu" && teile[1]) await zeigeNeuFormular(main(), teile[1], { oeffneEinsatz });
    else if (teile[0] === "neu") zeigeNeuArt(main());
    else if (teile[0] === "einsaetze") await zeigeListe(main());
    else {
      const einsaetze = await zeigeStart(main());
      zeigeSicherungsHinweis(einsaetze.length > 0);
    }
    zeigeKopf();
  } catch (e) {
    console.error(e);
    setzeSystemstatus(false, "Speicherfehler");
    main().innerHTML = `<p class="meldung fehler">Die Daten auf diesem Gerät konnten nicht gelesen werden: ${esc(e.message)}</p>`;
  }
}

// ---- Ereignisse ----------------------------------------------------------
document.getElementById("inhalt").addEventListener("click", async (e) => {
  const aktion = e.target.closest("[data-aktion]");
  if (aktion) {
    if (aktion.dataset.aktion === "protokoll") return oeffneProtokoll(zustand.daten);
    if (aktion.dataset.aktion === "lagebericht") return oeffneLagebericht(ctx);
    if (aktion.dataset.aktion === "beenden") return oeffneBeenden();
  }
  if (zustand.einsatzId === null) return;
  const schnell = e.target.closest("[data-schnell]");
  if (schnell) {
    const [kat, status, delta] = schnell.dataset.schnell.split("|");
    return schnellAendern(kat, status, Number(delta));
  }
  if (e.target.closest("[data-kraefte-null]")) {
    try { aktualisiert(await api.kraefteNull()); toast("Alle Kräfte mit 0 bestätigt."); } catch (err) { toast(err.message, "fehler"); }
    return;
  }
  const erfassen = e.target.closest("[data-erfassen-bereich]");
  if (erfassen) {
    const b = zustand.daten.bereiche.find((x) => x.key === erfassen.dataset.erfassenBereich);
    const erste = b.kategorien.find((k) => k.erfassungsstand === "nicht_erfasst") || b.kategorien[0];
    return oeffneKategorie(erste.key, { gefuehrt: true });
  }
  const gruppe = e.target.closest("[data-gruppe]");
  if (gruppe) return oeffneGruppe(gruppe.dataset.gruppe);
  const kachel = e.target.closest("[data-kategorie]");
  if (kachel) oeffneKategorie(kachel.dataset.kategorie);
});
document.getElementById("btn-bearbeiter").addEventListener("click", oeffneBearbeiter);
document.getElementById("btn-sicherung").addEventListener("click", () => oeffneSicherung({ neuLaden: async () => { await neuLaden(); }, nachImport: () => navigieren() }));
document.getElementById("hinweisband").addEventListener("click", (e) => {
  if (e.target.closest("[data-sichern]")) oeffneSicherung({ neuLaden: async () => { await neuLaden(); }, nachImport: () => navigieren() });
});
document.querySelector(".marke").addEventListener("click", () => { location.hash = "#/"; });
window.addEventListener("hashchange", navigieren);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !dialogOffen() && zustand.einsatzId !== null && zustand.ansicht !== "abschnitte") neuLaden();
});
document.addEventListener("dialog-geschlossen", () => { if (zustand.daten && zustand.ansicht !== "abschnitte") darstellen(); });

// Offline-Fähigkeit: Programmdateien auf dem Gerät vorhalten
if ("serviceWorker" in navigator) {
  // Neue Version: Sobald sie bereitsteht, wird sie geladen (nicht während eine Eingabe offen ist).
  let hatteVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Offline-Modus nicht verfügbar:", e));
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hatteVersion) {
      if (!dialogOffen()) location.reload();
      else toast("Neue Version geladen – sie ist nach dem Schließen dieses Fensters aktiv.");
      document.addEventListener("dialog-geschlossen", () => location.reload(), { once: true });
    }
    hatteVersion = true;
    zeigeKopf();
  });
}
api.dauerhaftAnfordern();

zeigeBearbeiter();
navigieren();
