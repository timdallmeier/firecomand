// Darstellung eines Einsatzes: Kräfte, Einsatzmittel, Versorgung
// nurLesen = beendeter Einsatz: keine Bedienelemente zum Ändern

import { FAHRZEUGSTATUS, STATUS_WHITEBOARD } from "./daten/struktur.js";
import { icon } from "./symbole.js";
import { dot, esc, farbe, zahl } from "./ui.js";

const LEER_TEXT = "Noch keine Bestände erfasst.";

function bereichKopf(b, meta) {
  return `
    <div class="bereich-kopf">
      <h2>${esc(b.name)}</h2>
      <span class="meta">${esc(meta)}</span>
    </div>`;
}

let nurLesen = false;

function leerHinweis(b) {
  if (b.erfasst) return "";
  if (nurLesen) return `<div class="leer"><p>In diesem Einsatz wurden keine Bestände erfasst.</p></div>`;
  const null0 = b.key === "kraefte"
    ? `<button class="knopf knopf-gross" type="button" data-kraefte-null>Mit 0 Kräften beginnen</button>` : "";
  return `
    <div class="leer">
      <p>${LEER_TEXT}</p>
      ${null0}
      <button class="knopf knopf-primaer knopf-gross" type="button" data-erfassen-bereich="${b.key}">Bestände jetzt erfassen</button>
    </div>`;
}

function standText(k) {
  return { nicht_erfasst: "nicht erfasst", teilweise: "teilweise erfasst", vollstaendig: "" }[k.erfassungsstand];
}

// ---- Kräfte --------------------------------------------------------------
// Gesamtwerte je Status über alle Funktionen (B IV, B III, B I).
// Stärke in der üblichen Schreibweise: B IV / B III / B I / Gesamt.
function kraefte(b) {
  const g = b.gruppen[0];
  const fkt = b.kategorien;
  const vollst = fkt.filter((k) => k.erfassungsstand === "vollstaendig").length;
  // Statuskarte: Summe + je Funktion eine Zeile mit − / +
  const karten = b.status.map((s) => {
    const v = g.mengen[s.key];
    const zeilen = fkt.map((k) => {
      const w = k.mengen[s.key];
      const stepper = nurLesen ? "" : `
          <button class="mini" type="button" data-schnell="${k.key}|${s.key}|-1" ${w ? "" : "disabled"} aria-label="${esc(k.name)} ${esc(s.name)} verringern">−</button>`;
      const plus = nurLesen ? "" : `
          <button class="mini" type="button" data-schnell="${k.key}|${s.key}|1" aria-label="${esc(k.name)} ${esc(s.name)} erhöhen">+</button>`;
      return `
        <div class="fz ${w === null ? "offen" : ""}">
          <span class="fz-name">${esc(k.name)}</span>${stepper}
          <span class="fz-wert zahl">${zahl(w)}</span>${plus}
        </div>`;
    }).join("");
    return `
      <div class="karte kraft ${v === null ? "nicht-erfasst" : ""}">
        <div class="kraft-kopf">
          <span class="label">${dot(b.key, s.key)}${esc(s.name)}</span>
          <span class="wert zahl">${zahl(v)}</span>
        </div>
        <div class="fz-liste">${zeilen}</div>
      </div>`;
  }).join("");

  const staerke = g.gesamt === null ? ""
    : `<span class="staerke zahl">${fkt.map((k) => zahl(k.gesamt)).join(" / ")} / <b>${zahl(g.gesamt)}</b></span>
       <span class="staerke-legende">${fkt.map((k) => esc(k.name)).join(" / ")} / Gesamt</span>`;
  const hinweis = g.erfassungsstand === "teilweise"
    ? `<span class="hinweis" style="color:var(--warn)">${vollst} von ${fkt.length} Funktionen vollständig erfasst</span>`
    : g.erfassungsstand === "nicht_erfasst" ? `<span class="hinweis">wird automatisch berechnet</span>` : "";

  return `
    <section>
      ${bereichKopf(b, `${vollst} von ${fkt.length} Funktionen erfasst`)}
      ${leerHinweis(b)}
      <div class="kraefte-raster">
        ${karten}
        <button class="karte karte-tap gesamt ${g.gesamt === null ? "nicht-erfasst" : ""}" type="button" data-gruppe="${g.key}">
          <span><span class="label">Gesamtstärke</span>${hinweis}</span>
          <span class="gesamt-wert"><span class="wert zahl">${zahl(g.gesamt)}</span>${staerke}</span>
        </button>
      </div>
    </section>`;
}

// ---- Einsatzmittel -------------------------------------------------------
function balkenTeile(b, k) {
  const gesamt = k.gesamt || 0;
  if (!gesamt) return "";
  return b.status.map((s) => {
    const v = k.mengen[s.key] || 0;
    return v ? `<span style="width:${(v / gesamt) * 100}%;background:${farbe(b.key, s.key)}" title="${esc(s.name)}: ${zahl(v)}"></span>` : "";
  }).join("");
}

const kopf = (g, rechts = "") => `
  <span class="kachel-kopf"><span class="kachel-icon">${icon(g.symbol)}</span><span class="name">${esc(g.name)}</span>${rechts}</span>`;

// Fahrzeuge / Abrollbehälter: Anzahl, Besatzung, Verteilung auf Status 1–9
function kachelEinzeln(b, g, k) {
  const leer = k.anzahl_objekte === 0;
  const verteilung = FAHRZEUGSTATUS.filter((s) => k.status_anzahl[s.wert])
    .map((s) => `<span class="st-chip ${s.wert === STATUS_WHITEBOARD ? "st-4" : ""}"><b>${s.wert}</b>${zahl(k.status_anzahl[s.wert])}</span>`).join("");
  return `
    <button class="kachel" type="button" data-kategorie="${k.key}">
      ${kopf(g, `<span class="badge">Liste</span>`)}
      ${leer && k.erfassungsstand !== "vollstaendig"
        ? `<span class="kachel-wert"><span class="wert zahl">—</span><span class="einheit">${esc(k.einheit)}</span></span>
           <span class="unter">Liste noch leer</span><span class="erfassen">Hinzufügen</span>`
        : `<span class="kachel-wert"><span class="wert zahl">${zahl(k.anzahl_objekte)}</span>
             <span class="einheit">${esc(k.einheit)}${k.besatzung !== null ? ` · Besatzung <b class="zahl">${zahl(k.besatzung)}</b>` : ""}</span></span>
           <span class="unter">${k.ohne_status ? `<span style="color:var(--warn)">${zahl(k.ohne_status)} ohne Status</span>` : "Status je Eintrag erfasst"}</span>
           <span class="st-verteilung">${verteilung || '<span class="text-3">Noch kein Status vergeben</span>'}</span>`}
    </button>`;
}

// Kraftstoff / Schaummittel: verfügbar = Gesamt − abkommandiert
function vorratZeile(k, mitName) {
  const offen = k.erfassungsstand === "nicht_erfasst";
  const anteil = !offen && k.gesamt ? (k.abkommandiert / k.gesamt) * 100 : 0;
  return `
    <button class="gz vorrat ${offen ? "nicht-erfasst" : ""}" type="button" data-kategorie="${k.key}">
      ${mitName ? `<span class="gz-name">${esc(k.name)}</span>` : ""}
      <span class="gz-wert">
        <span class="wert zahl ${k.verfuegbar === 0 ? "null-krit" : ""}">${zahl(offen ? null : k.verfuegbar)}</span>
        <span class="gz-unter">${offen ? "nicht erfasst" : `${esc(k.einheit)} verfügbar · ${zahl(k.gesamt)} gesamt · ${zahl(k.abkommandiert)} abkommandiert`}</span>
      </span>
      <span class="balken gz-balken">${offen ? "" : `<span style="width:${100 - anteil}%;background:var(--ok)"></span><span style="width:${anteil}%;background:var(--info)"></span>`}</span>
    </button>`;
}

function kachelVorrat(g, glieder) {
  const mehrere = glieder.length > 1;
  return `
    <div class="kachel kachel-gruppe">
      ${kopf(g, `<span class="badge">${esc(glieder[0].einheit)}</span>`)}
      <div class="gz-liste">${glieder.map((k) => vorratZeile(k, mehrere)).join("")}</div>
    </div>`;
}

// Schläuche und Armaturen: Stückzahlen nach Materialart
function kachelAnzahl(g, glieder) {
  const unter = [...new Set(glieder.map((k) => k.untergruppe))];
  return `
    <button class="kachel" type="button" data-gruppe="${g.key}">
      ${kopf(g, `<span class="badge">Stück</span>`)}
      <span class="anzahl-tabelle">
        ${unter.map((u) => `
          <span class="at-zeile"><span class="at-titel">${esc(u)}</span>
            ${glieder.filter((k) => k.untergruppe === u).map((k) => `
              <span class="at-wert ${k.gesamt === null ? "offen" : ""}"><span>${esc(k.name.replace(/-Schläuche|-Strahlrohre/, ""))}</span><b class="zahl">${zahl(k.gesamt)}</b></span>`).join("")}
          </span>`).join("")}
      </span>
      ${g.erfassungsstand === "nicht_erfasst" ? '<span class="erfassen">Erfassen</span>' : ""}
    </button>`;
}

// Pressluftatmer, Masken, PSA: Mengen je Status
function kachelStatus(b, k, g) {
  if (k.erfassungsstand === "nicht_erfasst") {
    return `
      <button class="kachel nicht-erfasst" type="button" data-kategorie="${k.key}">
        ${kopf(g)}
        <span class="kachel-wert"><span class="wert zahl">—</span><span class="einheit">${esc(k.einheit)}</span></span>
        <span class="unter">Noch nicht erfasst</span>
        <span class="erfassen">Erfassen</span>
      </button>`;
  }
  const legende = b.status.map((s) => `<span>${dot(b.key, s.key)}${esc(s.name)} <b class="zahl">${zahl(k.mengen[s.key])}</b></span>`).join("");
  const verf = k.verfuegbar;
  return `
    <button class="kachel" type="button" data-kategorie="${k.key}">
      ${kopf(g)}
      <span>
        <span class="kachel-wert">
          <span class="wert zahl ${verf === 0 ? "null-krit" : ""}">${zahl(verf)}</span>
          <span class="einheit">${esc(k.einheit)} einsatzbereit</span>
        </span>
        <span class="unter">${verf === 0 ? "Keine einsatzbereiten Mittel · " : ""}${zahl(k.gesamt)} gesamt${k.erfassungsstand === "teilweise" ? " · teilweise erfasst" : ""}</span>
      </span>
      <span class="balken">${balkenTeile(b, k)}</span>
      <span class="legende">${legende}</span>
    </button>`;
}

function kachelStatusGruppe(b, g, glieder) {
  const zeilen = glieder.map((k) => {
    const offen = k.erfassungsstand === "nicht_erfasst";
    const v = k.verfuegbar;
    return `
      <button class="gz ${offen ? "nicht-erfasst" : ""}" type="button" data-kategorie="${k.key}">
        <span class="gz-name">${esc(k.name)}</span>
        <span class="gz-wert">
          <span class="wert zahl ${v === 0 ? "null-krit" : ""}">${zahl(offen ? null : v)}</span>
          <span class="gz-unter">${offen ? "nicht erfasst" : `einsatzbereit · ${zahl(k.gesamt)} gesamt${k.erfassungsstand === "teilweise" ? " · teilweise" : ""}`}</span>
        </span>
        <span class="balken gz-balken">${balkenTeile(b, k)}</span>
      </button>`;
  }).join("");
  return `
    <div class="kachel kachel-gruppe">
      ${kopf(g, `<span class="badge">${esc(glieder[0].einheit)}</span>`)}
      <div class="gz-liste">${zeilen}</div>
    </div>`;
}

function einsatzmittel(b) {
  const erfasst = b.gruppen.filter((g) => g.erfassungsstand !== "nicht_erfasst").length;
  const kacheln = b.gruppen.map((g) => {
    const glieder = b.kategorien.filter((k) => k.gruppe_key === g.key);
    if (g.typ === "einzeln") return kachelEinzeln(b, g, glieder[0]);
    if (g.typ === "vorrat") return kachelVorrat(g, glieder);
    if (g.typ === "anzahl") return kachelAnzahl(g, glieder);
    return glieder.length === 1 ? kachelStatus(b, glieder[0], g) : kachelStatusGruppe(b, g, glieder);
  }).join("");
  return `
    <section>
      ${bereichKopf(b, `${erfasst} von ${b.gruppen.length} Kategorien erfasst`)}
      ${leerHinweis(b)}
      <div class="mittel-raster">${kacheln}</div>
    </section>`;
}

// ---- Versorgung ----------------------------------------------------------
function versorgung(b) {
  const g = b.gruppen[0];
  const zeilen = b.kategorien.map((k) => `
    <button class="vt-zeile" type="button" data-kategorie="${k.key}">
      <span class="vt-name">${esc(k.name)}<span class="vt-einheit">${esc(k.einheit)}${standText(k) ? ` · ${standText(k)}` : ""}</span></span>
      ${b.status.map((s) => {
        const v = k.mengen[s.key];
        return `<span class="vt-wert zahl ${v === null ? "offen" : ""}">${zahl(v)}</span>`;
      }).join("")}
    </button>`).join("");
  const erfasst = b.kategorien.filter((k) => k.erfassungsstand === "vollstaendig").length;
  return `
    <section>
      ${bereichKopf(b, `${erfasst} von ${b.kategorien.length} Arten vollständig erfasst`)}
      ${leerHinweis(b)}
      <div class="kachel versorgung-tabelle">
        ${kopf(g)}
        <div class="vt-kopf"><span></span>${b.status.map((s) => `<span>${dot(b.key, s.key)}${esc(s.name)}</span>`).join("")}</div>
        ${zeilen}
      </div>
    </section>`;
}

export function renderDashboard(daten, optionen = {}) {
  nurLesen = !!optionen.nurLesen;
  const [kr, em, vs] = daten.bereiche;
  return kraefte(kr) + einsatzmittel(em) + versorgung(vs);
}
