// Darstellung eines Einsatzes: Kräfte, Einsatzmittel, Versorgung
// nurLesen = beendeter Einsatz: keine Bedienelemente zum Ändern

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

// Fahrzeuge, Abrollbehälter, Atemschutz: reine Schaltflächen, öffnen eigene Seiten
function knopfKachel(g, einsatzId) {
  const ziel = { fahrzeuge: "fahrzeuge", abrollbehaelter: "abrollbehaelter", atemschutz: "atemschutz" }[g.key];
  return `
    <a class="knopfkachel" href="#/einsatz/${einsatzId}/${ziel}">
      <span class="kk-icon">${icon(g.symbol, 34)}</span>
      <span class="kk-titel">${esc(g.name)}</span>
    </a>`;
}

// Verpflegung als kompakte Kachel (je Art: Auf Wache / Alarmierbar / Angefordert)
function kachelVerpflegung(vs) {
  const g = vs.gruppen[0];
  return `
    <div class="kachel kachel-gruppe verpflegung-kachel">
      ${kopf(g, '<span class="badge">Stück</span>')}
      <div class="vk-kopf"><span></span>${vs.status.map((s) => `<span title="${esc(s.name)}">${dot(vs.key, s.key)}${esc(s.name.replace("Bereits ", ""))}</span>`).join("")}</div>
      ${vs.kategorien.map((k) => `
        <button class="vk-zeile ${k.erfassungsstand === "nicht_erfasst" ? "nicht-erfasst" : ""}" type="button" data-kategorie="${k.key}">
          <span class="vk-name">${esc(k.name)}</span>
          ${vs.status.map((s) => `<span class="vk-wert zahl">${zahl(k.mengen[s.key])}</span>`).join("")}
        </button>`).join("")}
    </div>`;
}

function einsatzmittel(b, vs, einsatzId) {
  const kacheln = b.gruppen.map((g) => {
    const glieder = b.kategorien.filter((k) => k.gruppe_key === g.key);
    if (["fahrzeuge", "abrollbehaelter", "atemschutz"].includes(g.key)) return knopfKachel(g, einsatzId);
    if (g.typ === "vorrat") return kachelVorrat(g, glieder);
    if (g.typ === "anzahl") return kachelAnzahl(g, glieder);
    return glieder.length === 1 ? kachelStatus(b, glieder[0], g) : kachelStatusGruppe(b, g, glieder);
  }).join("") + kachelVerpflegung(vs);
  return `
    <section>
      <div class="bereich-kopf"><h2>Einsatzmittel und Versorgung</h2></div>
      <div class="mittel-raster v3">${kacheln}</div>
    </section>`;
}

export function renderDashboard(daten, optionen = {}) {
  nurLesen = !!optionen.nurLesen;
  const [kr, em, vs] = daten.bereiche;
  return kraefte(kr) + einsatzmittel(em, vs, daten.einsatz.id);
}
