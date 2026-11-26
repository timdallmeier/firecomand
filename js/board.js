// Einsatzabschnitte – digitales Whiteboard
//
// Schwarze, frei verschiebbare und zoombare Arbeitsfläche mit:
//   • Einsatzabschnitt-Kacheln (hinzufügen, verschieben, bearbeiten, löschen)
//   • Fahrzeugen mit Status 4 – per Drag-and-drop einem Abschnitt zuordnen,
//     zwischen Abschnitten verschieben oder herausnehmen
//   • Verbindungen zwischen Elementen und Freihandlinien
//   • Textfeldern und taktischen Zeichen
// Bedienung: Touch (ein Finger = verschieben, zwei Finger = Ansicht zoomen/verschieben) und Maus.

import { api } from "./api.js";
import { ABSCHNITTSARTEN, LINIENFARBEN, LINIENSTILE, SYMBOLE, fahrzeugstatusText } from "./daten/struktur.js";
import { SYMBOL_B, SYMBOL_H, icon, zeichen, zeichenInhalt } from "./symbole.js";
import { dialog, dialogSchliessen, esc, toast, zahl } from "./ui.js";

const AB_BREITE = 250;
const AB_KOPF = 58;
const FZ_HOEHE = 38;
const TEXT_GROESSE = 18;
const farbeWert = (k) => LINIENFARBEN.find((f) => f.key === k)?.wert || LINIENFARBEN[0].wert;

export async function zeigeBoard(main, { daten, nurLesen, neuLaden }) {
  const einsatz = daten.einsatz;
  let bd = await api.boardDaten();             // { board, fahrzeuge, status_whiteboard }
  let ansicht = bd.board.ansicht ? { ...bd.board.ansicht } : null;
  let modus = "auswahl";                       // auswahl | verbinden | zeichnen
  let auswahl = null;                          // { art, id }
  let verbindenStart = null;
  let farbe = "weiss";
  let stil = "fuehrung";
  let beendet = false;

  main.innerHTML = `
    <div class="board ${nurLesen ? "nurlesen" : ""}">
      <div class="board-leiste">
        <a class="zurueck" href="#/einsatz/${einsatz.id}" aria-label="Zur Einsatzübersicht">←</a>
        <div class="bl-titel"><b>Einsatzabschnitte</b><span>${esc(einsatz.nummer)} · ${esc(einsatz.stichwort)}</span></div>
        ${nurLesen ? `<span class="badge">nur Ansicht</span>` : `
        <div class="bl-gruppe" role="group" aria-label="Werkzeug">
          <button class="wz" type="button" data-modus="auswahl" aria-pressed="true" title="Auswählen und verschieben">Auswählen</button>
          <button class="wz" type="button" data-modus="verbinden" aria-pressed="false" title="Zwei Elemente nacheinander antippen">Verbinden</button>
          <button class="wz" type="button" data-modus="zeichnen" aria-pressed="false" title="Freihand zeichnen">Zeichnen</button>
        </div>
        <div class="bl-gruppe">
          <button class="wz primaer" type="button" data-neu="abschnitt">+ Abschnitt</button>
          <button class="wz" type="button" data-neu="symbol">+ Symbol</button>
          <button class="wz" type="button" data-neu="text">+ Text</button>
        </div>
        <div class="bl-gruppe" data-linienwahl>
          ${LINIENFARBEN.map((f) => `<button class="farbe" type="button" data-farbe="${f.key}" aria-pressed="${f.key === farbe}" title="${esc(f.name)}" style="--f:${f.wert}"></button>`).join("")}
          <button class="wz" type="button" data-stil title="Linienart">${stil === "fuehrung" ? "━ Führung" : "┅ Kommunikation"}</button>
        </div>
        <div class="bl-gruppe" data-auswahlaktionen hidden>
          <button class="wz" type="button" data-aktion="bearbeiten">Bearbeiten</button>
          <button class="wz gefahr" type="button" data-aktion="loeschen">Löschen</button>
        </div>`}
        <div class="bl-gruppe bl-zoom">
          <button class="wz" type="button" data-zoom="-1" aria-label="Verkleinern">−</button>
          <button class="wz" type="button" data-zoom="0" title="Alles einpassen">Einpassen</button>
          <button class="wz" type="button" data-zoom="1" aria-label="Vergrößern">+</button>
        </div>
      </div>
      <div class="board-flaeche">
        <svg class="board-svg" tabindex="0" aria-label="Whiteboard Einsatzabschnitte">
          <defs><pattern id="raster" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#1d2229"/></pattern></defs>
          <g class="welt">
            <rect x="-50000" y="-50000" width="100000" height="100000" fill="url(#raster)"/>
            <g class="ebene-linien"></g><g class="ebene-elemente"></g><g class="ebene-entwurf"></g>
          </g>
        </svg>
        <aside class="board-seite" aria-label="Fahrzeuge mit Status ${bd.status_whiteboard}"></aside>
        <div class="board-hinweis" hidden></div>
      </div>
    </div>`;

  const wurzel = main.querySelector(".board");
  const svg = wurzel.querySelector(".board-svg");
  const welt = svg.querySelector(".welt");
  const ebLinien = svg.querySelector(".ebene-linien");
  const ebElemente = svg.querySelector(".ebene-elemente");
  const ebEntwurf = svg.querySelector(".ebene-entwurf");
  const seite = wurzel.querySelector(".board-seite");
  const hinweis = wurzel.querySelector(".board-hinweis");

  // Höhe des Kopfbereichs für das Vollbild-Layout
  const hoeheSetzen = () => document.documentElement.style.setProperty("--kopf-hoehe", `${document.querySelector(".kopf").offsetHeight}px`);
  hoeheSetzen();
  window.addEventListener("resize", hoeheSetzen);

  // ---- Geometrie ----------------------------------------------------------
  const fahrzeugeIn = (aid) => bd.fahrzeuge.filter((f) => f.abschnitt_id === aid);
  const abHoehe = (a) => AB_KOPF + Math.max(1, fahrzeugeIn(a.id).length) * FZ_HOEHE + 12;
  const textZeilen = (t) => t.text.split("\n");
  const textMasse = (t) => {
    const z = textZeilen(t);
    return { w: Math.max(40, Math.max(...z.map((s) => s.length)) * TEXT_GROESSE * 0.56) + 20, h: z.length * TEXT_GROESSE * 1.3 + 14 };
  };
  function box(art, e) {
    if (art === "abschnitt") return { x: e.x, y: e.y, w: AB_BREITE, h: abHoehe(e) };
    if (art === "symbol") return { x: e.x, y: e.y, w: SYMBOL_B, h: SYMBOL_H + (e.label ? 26 : 0) };
    if (art === "text") { const m = textMasse(e); return { x: e.x, y: e.y, w: m.w, h: m.h }; }
    return null;
  }
  const liste = (art) => bd.board[{ abschnitt: "abschnitte", text: "texte", symbol: "symbole", linie: "linien" }[art]];
  const finde = (art, id) => liste(art)?.find((x) => x.id === id);
  const mitte = (art, id) => {
    const e = finde(art, id);
    const b = e && box(art, e);
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2, b } : null;
  };
  // Endpunkt am Rand des Rechtecks statt in der Mitte
  function randpunkt(m, ziel) {
    const dx = ziel.x - m.x;
    const dy = ziel.y - m.y;
    if (!dx && !dy) return m;
    const sx = (m.b.w / 2 + 4) / Math.abs(dx || 1e-9);
    const sy = (m.b.h / 2 + 4) / Math.abs(dy || 1e-9);
    const s = Math.min(sx, sy);
    return { x: m.x + dx * s, y: m.y + dy * s };
  }

  // ---- Ansicht (Verschieben / Zoomen) -------------------------------------
  const flaecheGroesse = () => svg.getBoundingClientRect();
  function ansichtAnwenden() {
    welt.setAttribute("transform", `translate(${ansicht.x} ${ansicht.y}) scale(${ansicht.zoom})`);
  }
  const zuWelt = (cx, cy) => {
    const r = flaecheGroesse();
    return { x: (cx - r.left - ansicht.x) / ansicht.zoom, y: (cy - r.top - ansicht.y) / ansicht.zoom };
  };
  function zoomen(faktor, cx, cy) {
    const r = flaecheGroesse();
    const px = cx ?? r.left + r.width / 2;
    const py = cy ?? r.top + r.height / 2;
    const w = zuWelt(px, py);
    ansicht.zoom = Math.max(0.2, Math.min(3, ansicht.zoom * faktor));
    ansicht.x = px - r.left - w.x * ansicht.zoom;
    ansicht.y = py - r.top - w.y * ansicht.zoom;
    ansichtAnwenden();
    ansichtSpeichern();
  }
  function einpassen() {
    const boxen = ["abschnitt", "text", "symbol"].flatMap((art) => liste(art).map((e) => box(art, e)));
    for (const l of bd.board.linien) if (l.art === "frei") for (const [x, y] of l.punkte) boxen.push({ x, y, w: 0, h: 0 });
    const r = flaecheGroesse();
    const nutzbar = { w: r.width - (seite.offsetWidth || 0) - 40, h: r.height - 40 };
    if (!boxen.length) { ansicht = { x: 40, y: 40, zoom: 1 }; ansichtAnwenden(); return; }
    const minX = Math.min(...boxen.map((b) => b.x));
    const minY = Math.min(...boxen.map((b) => b.y));
    const maxX = Math.max(...boxen.map((b) => b.x + b.w));
    const maxY = Math.max(...boxen.map((b) => b.y + b.h));
    const z = Math.max(0.2, Math.min(1.4, Math.min(nutzbar.w / (maxX - minX + 1), nutzbar.h / (maxY - minY + 1))));
    ansicht = { zoom: z, x: 20 + (nutzbar.w - (maxX - minX) * z) / 2 - minX * z, y: 20 + (nutzbar.h - (maxY - minY) * z) / 2 - minY * z };
    ansichtAnwenden();
    ansichtSpeichern();
  }
  let ansichtTimer;
  function ansichtSpeichern() {
    if (nurLesen) return;
    clearTimeout(ansichtTimer);
    ansichtTimer = setTimeout(() => { api.board({ typ: "ansicht", ...ansicht }).catch(() => {}); }, 800);
  }
  // Neue Elemente erscheinen in der Mitte des sichtbaren Bereichs (leicht versetzt)
  let versatz = 0;
  function neuePosition(b = 0, h = 0) {
    const r = flaecheGroesse();
    const m = zuWelt(r.left + (r.width - (seite.offsetWidth || 0)) / 2, r.top + r.height / 2);
    versatz = (versatz + 24) % 120;
    return { x: Math.round(m.x - b / 2 + versatz), y: Math.round(m.y - h / 2 + versatz) };
  }

  // ---- Darstellung ----------------------------------------------------------
  function linieSvg(l) {
    const farb = farbeWert(l.farbe);
    const dash = l.stil === "kommunikation" ? `stroke-dasharray="12 9"` : "";
    const gewaehlt = auswahl?.art === "linie" && auswahl.id === l.id;
    let d;
    if (l.art === "verbindung") {
      const a = mitte(l.von.art, l.von.id);
      const b = mitte(l.nach.art, l.nach.id);
      if (!a || !b) return "";
      const p1 = randpunkt(a, b);
      const p2 = randpunkt(b, a);
      d = `M${p1.x} ${p1.y}L${p2.x} ${p2.y}`;
    } else {
      d = l.punkte.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");
    }
    return `<g data-el="linie:${l.id}">
      <path d="${d}" fill="none" stroke="transparent" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      ${gewaehlt ? `<path d="${d}" fill="none" stroke="#5fa8f0" stroke-width="9" stroke-opacity=".35" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
      <path d="${d}" fill="none" stroke="${farb}" stroke-width="3" ${dash} stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }

  function abschnittSvg(a) {
    const art = ABSCHNITTSARTEN.find((x) => x.key === a.art);
    const fz = fahrzeugeIn(a.id);
    const h = abHoehe(a);
    const gewaehlt = auswahl?.art === "abschnitt" && auswahl.id === a.id;
    const start = verbindenStart?.art === "abschnitt" && verbindenStart.id === a.id;
    const besatzung = fz.reduce((s, f) => s + (f.besatzung || 0), 0);
    const chips = fz.length ? fz.map((f, i) => `
      <g class="fz-chip" data-fz="${f.id}" transform="translate(12 ${AB_KOPF + i * FZ_HOEHE})">
        <rect width="${AB_BREITE - 24}" height="${FZ_HOEHE - 6}" rx="7" fill="#232a34" stroke="#3a4452"/>
        <rect x="8" y="9" width="14" height="14" rx="3" fill="none" stroke="#ef5a43" stroke-width="2"/>
        <text x="32" y="${(FZ_HOEHE - 6) / 2}" dominant-baseline="central" fill="#e8ebef" font-size="15" font-weight="600">${esc(f.bezeichnung)}</text>
        ${f.besatzung !== null ? `<text x="${AB_BREITE - 36}" y="${(FZ_HOEHE - 6) / 2}" text-anchor="end" dominant-baseline="central" fill="#a9b1bd" font-size="13">${zahl(f.besatzung)} Pers.</text>` : ""}
      </g>`).join("")
      : `<text x="${AB_BREITE / 2}" y="${AB_KOPF + 16}" text-anchor="middle" dominant-baseline="central" fill="#6f7886" font-size="13">${nurLesen ? "Keine Fahrzeuge" : "Fahrzeuge hierher ziehen"}</text>`;
    return `<g data-el="abschnitt:${a.id}" transform="translate(${a.x} ${a.y})" class="el">
      <rect width="${AB_BREITE}" height="${h}" rx="12" fill="#14181e" stroke="${gewaehlt || start ? "#5fa8f0" : "#3a4350"}" stroke-width="${gewaehlt || start ? 3 : 1.5}"/>
      <rect width="${AB_BREITE}" height="${AB_KOPF - 8}" rx="12" fill="#1b2028"/>
      <rect y="${AB_KOPF - 20}" width="${AB_BREITE}" height="12" fill="#1b2028"/>
      ${art?.kuerzel ? `<rect x="12" y="14" width="${art.kuerzel.length * 9 + 14}" height="22" rx="5" fill="none" stroke="#ef5a43" stroke-width="1.6"/>
        <text x="${19 + art.kuerzel.length * 4.5}" y="25" text-anchor="middle" dominant-baseline="central" fill="#ef5a43" font-size="12" font-weight="700">${esc(art.kuerzel)}</text>` : ""}
      <text x="${art?.kuerzel ? 32 + art.kuerzel.length * 9 : 14}" y="25" dominant-baseline="central" fill="#ffffff" font-size="17" font-weight="700">${esc(a.name)}</text>
      <text x="${AB_BREITE - 12}" y="${AB_KOPF - 14}" text-anchor="end" dominant-baseline="central" fill="#8a93a2" font-size="11.5">${zahl(fz.length)} Fzg${besatzung ? ` · ${zahl(besatzung)} Pers.` : ""}</text>
      ${chips}
    </g>`;
  }

  function textSvg(t) {
    const m = textMasse(t);
    const gewaehlt = (auswahl?.art === "text" && auswahl.id === t.id) || (verbindenStart?.art === "text" && verbindenStart.id === t.id);
    return `<g data-el="text:${t.id}" transform="translate(${t.x} ${t.y})" class="el">
      <rect width="${m.w}" height="${m.h}" rx="6" fill="${gewaehlt ? "rgba(95,168,240,.12)" : "rgba(0,0,0,.001)"}" stroke="${gewaehlt ? "#5fa8f0" : "none"}" stroke-dasharray="5 4"/>
      <text x="10" y="7" fill="#f2f4f7" font-size="${TEXT_GROESSE}" font-weight="500">
        ${textZeilen(t).map((z, i) => `<tspan x="10" dy="${i ? TEXT_GROESSE * 1.3 : TEXT_GROESSE}">${esc(z) || " "}</tspan>`).join("")}
      </text></g>`;
  }

  function symbolSvg(s) {
    const gewaehlt = (auswahl?.art === "symbol" && auswahl.id === s.id) || (verbindenStart?.art === "symbol" && verbindenStart.id === s.id);
    return `<g data-el="symbol:${s.id}" transform="translate(${s.x} ${s.y})" class="el">
      <rect x="-6" y="-6" width="${SYMBOL_B + 12}" height="${SYMBOL_H + 12 + (s.label ? 26 : 0)}" rx="8" fill="${gewaehlt ? "rgba(95,168,240,.12)" : "rgba(0,0,0,.001)"}" stroke="${gewaehlt ? "#5fa8f0" : "none"}" stroke-dasharray="5 4"/>
      ${zeichenInhalt(s.symbol)}
      ${s.label ? `<text x="${SYMBOL_B / 2}" y="${SYMBOL_H + 13}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="15" font-weight="600">${esc(s.label)}</text>` : ""}
    </g>`;
  }

  function linienZeichnen() { ebLinien.innerHTML = bd.board.linien.map(linieSvg).join(""); }
  function zeichnen() {
    linienZeichnen();
    ebElemente.innerHTML = bd.board.abschnitte.map(abschnittSvg).join("") + bd.board.symbole.map(symbolSvg).join("") + bd.board.texte.map(textSvg).join("");
    seiteZeichnen();
    leisteAktualisieren();
  }

  function seiteZeichnen() {
    const frei = bd.fahrzeuge.filter((f) => f.abschnitt_id === null);
    const zugeordnet = bd.fahrzeuge.length - frei.length;
    seite.innerHTML = `
      <button class="bs-kopf" type="button" data-seite-umschalten aria-expanded="${!seite.classList.contains("zu")}">
        ${icon("fahrzeug", 20)}<b>Fahrzeuge ${esc(fahrzeugstatusText(bd.status_whiteboard, true))}</b>
        ${frei.length ? `<span class="bs-zahl">${zahl(frei.length)}</span>` : ""}<span class="bs-pfeil">▾</span></button>
      <div class="bs-sub">${zahl(frei.length)} nicht zugeordnet · ${zahl(zugeordnet)} zugeordnet</div>
      ${frei.length ? `<div class="bs-liste">${frei.map((f) => `
        <div class="bs-fz" data-fz="${f.id}" ${nurLesen ? "" : 'title="In einen Abschnitt ziehen"'}>
          <span class="bs-marke"></span><span class="bs-name">${esc(f.bezeichnung)}</span>
          ${f.besatzung !== null ? `<span class="bs-pers">${zahl(f.besatzung)}</span>` : ""}
        </div>`).join("")}</div>`
      : `<p class="bs-leer">${bd.fahrzeuge.length ? "Alle Fahrzeuge sind zugeordnet." : `Fahrzeuge mit ${esc(fahrzeugstatusText(bd.status_whiteboard, true))} erscheinen hier automatisch.<br>Status setzen unter „Kräfte und Einsatzmittel“ → Fahrzeuge.`}</p>`}
      ${!nurLesen && bd.fahrzeuge.length ? `<p class="bs-tipp">Fahrzeug in einen Abschnitt ziehen. Zum Herausnehmen aus dem Abschnitt hierher oder auf eine freie Fläche ziehen.</p>` : ""}`;
  }

  function leisteAktualisieren() {
    if (nurLesen) return;
    wurzel.querySelectorAll("[data-modus]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.modus === modus));
    wurzel.querySelectorAll("[data-farbe]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.farbe === farbe));
    wurzel.querySelector("[data-stil]").textContent = stil === "fuehrung" ? "━ Führung" : "┅ Kommunikation";
    const aktionen = wurzel.querySelector("[data-auswahlaktionen]");
    aktionen.hidden = !auswahl;
    aktionen.querySelector('[data-aktion="bearbeiten"]').hidden = auswahl?.art === "linie" && finde("linie", auswahl.id)?.art === "frei";
    const texte = { verbinden: verbindenStart ? "Jetzt das zweite Element antippen." : "Erstes Element antippen (Abschnitt, Symbol oder Text).",
      zeichnen: "Mit Finger oder Stift auf die Fläche zeichnen." };
    hinweis.textContent = texte[modus] || "";
    hinweis.hidden = !texte[modus];
  }

  // ---- Speichern ------------------------------------------------------------
  async function aktion(a, meldung) {
    try {
      bd = await api.board(a);
      if (auswahl && !finde(auswahl.art, auswahl.id)) auswahl = null;
      zeichnen();
      if (meldung) toast(meldung);
      neuLaden?.();
      return true;
    } catch (e) {
      toast(e.message, "fehler");
      bd = await api.boardDaten();
      zeichnen();
      return false;
    }
  }

  // ---- Zeiger-Bedienung -----------------------------------------------------
  const zeiger = new Map();
  let geste = null;      // { typ: pan|ziehen|pinch|strich|fz, ... }
  let letzterTipp = { zeit: 0, ziel: "" };

  const elementVon = (target) => {
    const g = target.closest?.("[data-el]");
    if (!g) return null;
    const [art, id] = g.dataset.el.split(":");
    return { art, id: Number(id), g };
  };

  svg.addEventListener("pointerdown", (ev) => {
    if (beendet) return;
    svg.focus({ preventScroll: true });
    zeiger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (zeiger.size === 2) {
      // Zwei Finger: Ansicht zoomen und verschieben (bricht andere Gesten ab)
      if (geste?.typ === "strich") ebEntwurf.innerHTML = "";
      if (geste?.typ === "ziehen") zeichnen();
      const [a, b] = [...zeiger.values()];
      geste = { typ: "pinch", abstand: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (zeiger.size > 2) return;
    svg.setPointerCapture(ev.pointerId);
    const w = zuWelt(ev.clientX, ev.clientY);
    const fzEl = ev.target.closest?.("[data-fz]");
    const el = elementVon(ev.target);

    if (modus === "zeichnen" && !nurLesen) {
      geste = { typ: "strich", punkte: [[Math.round(w.x), Math.round(w.y)]] };
      return;
    }
    if (modus === "verbinden" && !nurLesen) {
      if (el && el.art !== "linie") {
        if (!verbindenStart) { verbindenStart = { art: el.art, id: el.id }; zeichnen(); }
        else if (verbindenStart.art === el.art && verbindenStart.id === el.id) { verbindenStart = null; zeichnen(); }
        else {
          const von = verbindenStart;
          verbindenStart = null;
          aktion({ typ: "linie_neu", art: "verbindung", von, nach: { art: el.art, id: el.id }, stil, farbe }, "Verbindung erstellt.");
        }
      } else { verbindenStart = null; zeichnen(); }
      geste = { typ: "pan", sx: ev.clientX, sy: ev.clientY, ax: ansicht.x, ay: ansicht.y, bewegt: false };
      return;
    }
    if (fzEl && !nurLesen) {
      fzZiehenStart(ev, Number(fzEl.dataset.fz));
      return;
    }
    if (el) {
      const vorher = auswahl;
      auswahl = { art: el.art, id: el.id };
      if (!vorher || vorher.art !== el.art || vorher.id !== el.id) {
        zeichnen();
        el.g = svg.querySelector(`[data-el="${el.art}:${el.id}"]`);   // nach dem Neuzeichnen neu holen
      }
      const e = finde(el.art, el.id);
      geste = el.art === "linie" || nurLesen
        ? { typ: "pan", sx: ev.clientX, sy: ev.clientY, ax: ansicht.x, ay: ansicht.y, bewegt: false, tippEl: el }
        : { typ: "ziehen", el, sx: w.x, sy: w.y, ox: e.x, oy: e.y, bewegt: false };
      return;
    }
    if (auswahl) { auswahl = null; zeichnen(); }
    geste = { typ: "pan", sx: ev.clientX, sy: ev.clientY, ax: ansicht.x, ay: ansicht.y, bewegt: false };
  });

  svg.addEventListener("pointermove", (ev) => {
    if (!zeiger.has(ev.pointerId) || !geste) return;
    zeiger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (geste.typ === "pinch" && zeiger.size >= 2) {
      const [a, b] = [...zeiger.values()];
      const abstand = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ansicht.x += mx - geste.mx;
      ansicht.y += my - geste.my;
      geste.mx = mx; geste.my = my;
      if (geste.abstand > 0) zoomen(abstand / geste.abstand, mx, my);
      geste.abstand = abstand;
      ansichtAnwenden();
      return;
    }
    if (geste.typ === "pan") {
      const dx = ev.clientX - geste.sx;
      const dy = ev.clientY - geste.sy;
      if (Math.hypot(dx, dy) > 4) geste.bewegt = true;
      ansicht.x = geste.ax + dx;
      ansicht.y = geste.ay + dy;
      ansichtAnwenden();
      return;
    }
    const w = zuWelt(ev.clientX, ev.clientY);
    if (geste.typ === "ziehen") {
      const dx = w.x - geste.sx;
      const dy = w.y - geste.sy;
      if (!geste.bewegt && Math.hypot(dx, dy) * ansicht.zoom < 5) return;
      geste.bewegt = true;
      const e = finde(geste.el.art, geste.el.id);
      e.x = Math.round(geste.ox + dx);
      e.y = Math.round(geste.oy + dy);
      geste.el.g.setAttribute("transform", `translate(${e.x} ${e.y})`);
      linienZeichnen();
      return;
    }
    if (geste.typ === "strich") {
      const p = [Math.round(w.x), Math.round(w.y)];
      const l = geste.punkte[geste.punkte.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 3 / ansicht.zoom) return;
      if (geste.punkte.length < 2000) geste.punkte.push(p);
      ebEntwurf.innerHTML = `<path d="${geste.punkte.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("")}" fill="none"
        stroke="${farbeWert(farbe)}" stroke-width="3" ${stil === "kommunikation" ? 'stroke-dasharray="12 9"' : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  });

  const ende = (ev) => {
    zeiger.delete(ev.pointerId);
    if (!geste) return;
    if (geste.typ === "pinch") { if (zeiger.size === 0) { geste = null; ansichtSpeichern(); } return; }
    const g = geste;
    geste = null;
    if (g.typ === "pan") {
      if (g.bewegt) ansichtSpeichern();
      else if (g.tippEl) doppeltipp(g.tippEl);
      return;
    }
    if (g.typ === "ziehen") {
      if (g.bewegt) {
        const e = finde(g.el.art, g.el.id);
        aktion({ typ: "verschieben", art: g.el.art, id: g.el.id, x: e.x, y: e.y });
      } else doppeltipp(g.el);
      return;
    }
    if (g.typ === "strich") {
      ebEntwurf.innerHTML = "";
      if (g.punkte.length >= 2) aktion({ typ: "linie_neu", art: "frei", punkte: g.punkte, stil, farbe });
    }
  };
  svg.addEventListener("pointerup", ende);
  svg.addEventListener("pointercancel", ende);

  function doppeltipp(el) {
    const ziel = `${el.art}:${el.id}`;
    const t = Date.now();
    if (letzterTipp.ziel === ziel && t - letzterTipp.zeit < 400 && !nurLesen) bearbeiten();
    letzterTipp = { zeit: t, ziel };
  }

  // Mausrad / Trackpad: zoomen
  svg.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    if (ev.ctrlKey || Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) zoomen(Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY);
  }, { passive: false });

  // ---- Fahrzeuge ziehen (Seitenleiste ↔ Abschnitte) -----------------------
  function fzZiehenStart(ev, fzId) {
    ev.preventDefault();
    const f = bd.fahrzeuge.find((x) => x.id === fzId);
    if (!f) return;
    const geist = document.createElement("div");
    geist.className = "fz-geist";
    geist.textContent = f.bezeichnung;
    document.body.appendChild(geist);
    const setzen = (x, y) => { geist.style.transform = `translate(${x - 20}px, ${y - 22}px)`; };
    setzen(ev.clientX, ev.clientY);
    let ziel = null;
    const markieren = (x, y) => {
      const w = zuWelt(x, y);
      const r = flaecheGroesse();
      const ueberSeite = seite.getBoundingClientRect();
      const inSeite = x >= ueberSeite.left && x <= ueberSeite.right && y >= ueberSeite.top && y <= ueberSeite.bottom;
      const imBoard = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      ziel = !imBoard || inSeite ? null : bd.board.abschnitte.find((a) => { const b = box("abschnitt", a); return w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h; }) || null;
      ebElemente.querySelectorAll("[data-el^='abschnitt:'] > rect:first-child").forEach((rect) => {
        const id = Number(rect.parentNode.dataset.el.split(":")[1]);
        rect.setAttribute("stroke", ziel?.id === id ? "#4fc28a" : "#3a4350");
        rect.setAttribute("stroke-width", ziel?.id === id ? 3 : 1.5);
      });
    };
    const bewegen = (e) => { setzen(e.clientX, e.clientY); markieren(e.clientX, e.clientY); };
    const los = () => {
      document.removeEventListener("pointermove", bewegen);
      document.removeEventListener("pointerup", los);
      document.removeEventListener("pointercancel", los);
      geist.remove();
      zeiger.clear();
      const neuId = ziel ? ziel.id : null;
      if (neuId === f.abschnitt_id) { zeichnen(); return; }
      aktion({ typ: "zuordnen", objekt_id: f.id, abschnitt_id: neuId },
        neuId === null ? `${f.bezeichnung} aus dem Abschnitt genommen.` : `${f.bezeichnung} → ${ziel.name}`);
    };
    document.addEventListener("pointermove", bewegen);
    document.addEventListener("pointerup", los);
    document.addEventListener("pointercancel", los);
  }
  // Seitenleiste ein-/ausklappen (auf schmalen Bildschirmen anfangs eingeklappt)
  if (window.innerWidth <= 900) seite.classList.add("zu");
  seite.addEventListener("click", (ev) => {
    if (!ev.target.closest("[data-seite-umschalten]")) return;
    seite.classList.toggle("zu");
    seiteZeichnen();
  });
  seite.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest("[data-fz]");
    if (el && !nurLesen) fzZiehenStart(ev, Number(el.dataset.fz));
  });

  // ---- Werkzeugleiste -------------------------------------------------------
  wurzel.querySelector(".board-leiste").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.modus) { modus = b.dataset.modus; verbindenStart = null; zeichnen(); }
    else if (b.dataset.farbe) {
      farbe = b.dataset.farbe;
      if (auswahl?.art === "linie") aktion({ typ: "linie_aendern", id: auswahl.id, farbe });
      leisteAktualisieren();
    } else if (b.dataset.stil !== undefined) {
      stil = stil === "fuehrung" ? "kommunikation" : "fuehrung";
      if (auswahl?.art === "linie") aktion({ typ: "linie_aendern", id: auswahl.id, stil });
      leisteAktualisieren();
    } else if (b.dataset.zoom !== undefined) {
      const z = Number(b.dataset.zoom);
      if (z === 0) einpassen(); else zoomen(z > 0 ? 1.25 : 0.8);
    } else if (b.dataset.neu === "abschnitt") neuerAbschnitt();
    else if (b.dataset.neu === "symbol") neuesSymbol();
    else if (b.dataset.neu === "text") textDialog(null);
    else if (b.dataset.aktion === "bearbeiten") bearbeiten();
    else if (b.dataset.aktion === "loeschen") loeschen();
  });

  svg.addEventListener("keydown", (ev) => {
    if ((ev.key === "Delete" || ev.key === "Backspace") && auswahl && !nurLesen) { ev.preventDefault(); loeschen(); }
    if (ev.key === "Escape") { auswahl = null; verbindenStart = null; zeichnen(); }
  });

  // ---- Dialoge --------------------------------------------------------------
  function neuerAbschnitt() {
    let art = "ea";
    const vorschlag = (k) => {
      const a = ABSCHNITTSARTEN.find((x) => x.key === k);
      const n = bd.board.abschnitte.filter((x) => x.art === k).length + 1;
      return a.kuerzel ? `${a.kuerzel} ${n}` : "";
    };
    const sheet = dialog({
      titel: "Einsatzabschnitt hinzufügen",
      koerper: `
        <div class="meldung fehler" data-meldung hidden></div>
        <div class="feldgruppe"><label>Art</label><div class="seg status" data-art>
          ${ABSCHNITTSARTEN.map((a) => `<button type="button" data-k="${a.key}" aria-pressed="${a.key === art}">${esc(a.name)}</button>`).join("")}
        </div></div>
        <div class="feldgruppe"><label for="ab-name">Bezeichnung *</label>
          <input id="ab-name" maxlength="60" value="${esc(vorschlag(art))}" autocomplete="off"></div>
        <p class="text-2" style="margin:0">Die Kachel erscheint in der Mitte der Ansicht und lässt sich danach frei verschieben.</p>`,
      fuss: `<span class="summe"></span><button class="knopf" type="button" data-schliessen>Abbrechen</button>
        <button class="knopf knopf-primaer" type="button" data-ok>Hinzufügen</button>`,
    });
    const input = sheet.querySelector("#ab-name");
    let geaendert = false;
    input.addEventListener("input", () => { geaendert = true; });
    sheet.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => {
      art = b.dataset.k;
      sheet.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      if (!geaendert) input.value = vorschlag(art);
    }));
    const ok = async () => {
      const p = neuePosition(AB_BREITE, AB_KOPF + FZ_HOEHE);
      const m = sheet.querySelector("[data-meldung]");
      if (!input.value.trim()) { m.textContent = "Bitte eine Bezeichnung eintragen."; m.hidden = false; return; }
      dialogSchliessen(true);
      if (await aktion({ typ: "abschnitt_neu", art, name: input.value, ...p })) {
        const neu = bd.board.abschnitte[bd.board.abschnitte.length - 1];
        auswahl = { art: "abschnitt", id: neu.id };
        modus = "auswahl";
        zeichnen();
      }
    };
    sheet.querySelector("[data-ok]").addEventListener("click", ok);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
    input.select();
  }

  function neuesSymbol() {
    const gruppen = [...new Set(SYMBOLE.map((s) => s.gruppe))];
    const sheet = dialog({
      titel: "Taktisches Zeichen hinzufügen",
      sub: "Eigene Symbolbibliothek, angelehnt an taktische Zeichen",
      koerper: `${gruppen.map((g) => `
        <div class="block"><h4>${esc(g)}</h4><div class="symbol-raster">
          ${SYMBOLE.filter((s) => s.gruppe === g).map((s) => `
            <button class="symbol-wahl" type="button" data-symbol="${s.key}">${zeichen(s.key, 72)}<span>${esc(s.name)}</span></button>`).join("")}
        </div></div>`).join("")}`,
    });
    sheet.querySelectorAll("[data-symbol]").forEach((b) => b.addEventListener("click", () => {
      const s = SYMBOLE.find((x) => x.key === b.dataset.symbol);
      symbolBeschriften(s, null);
    }));
  }

  function symbolBeschriften(s, vorhanden) {
    const sheet = dialog({
      titel: vorhanden ? "Zeichen bearbeiten" : s.name,
      koerper: `
        <div class="symbol-vorschau">${zeichen(s.key, 120)}</div>
        <div class="feldgruppe"><label for="sy-label">Beschriftung</label>
          <input id="sy-label" maxlength="60" value="${esc(vorhanden?.label || "")}" autocomplete="off" placeholder="z. B. Funkrufname oder Bezeichnung"></div>`,
      fuss: `${vorhanden ? '<button class="knopf knopf-gefahr" type="button" data-weg>Löschen</button>' : ""}<span class="summe"></span>
        <button class="knopf" type="button" data-schliessen>Abbrechen</button>
        <button class="knopf knopf-primaer" type="button" data-ok>${vorhanden ? "Speichern" : "Hinzufügen"}</button>`,
    });
    const input = sheet.querySelector("#sy-label");
    input.focus();
    const ok = async () => {
      dialogSchliessen(true);
      if (vorhanden) await aktion({ typ: "symbol_aendern", id: vorhanden.id, label: input.value });
      else if (await aktion({ typ: "symbol_neu", symbol: s.key, label: input.value, ...neuePosition(SYMBOL_B, SYMBOL_H) })) {
        auswahl = { art: "symbol", id: bd.board.symbole[bd.board.symbole.length - 1].id };
        modus = "auswahl";
        zeichnen();
      }
    };
    sheet.querySelector("[data-ok]").addEventListener("click", ok);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
    sheet.querySelector("[data-weg]")?.addEventListener("click", () => { dialogSchliessen(true); loeschen(true); });
  }

  function textDialog(vorhanden) {
    const sheet = dialog({
      titel: vorhanden ? "Textfeld bearbeiten" : "Textfeld hinzufügen",
      sub: "Zum Beispiel Funkgruppe, Kommunikationskanal oder Hinweis",
      koerper: `<div class="meldung fehler" data-meldung hidden></div>
        <div class="feldgruppe"><label for="tx-text">Text *</label>
          <textarea id="tx-text" maxlength="300">${esc(vorhanden?.text || "")}</textarea></div>`,
      fuss: `${vorhanden ? '<button class="knopf knopf-gefahr" type="button" data-weg>Löschen</button>' : ""}<span class="summe"></span>
        <button class="knopf" type="button" data-schliessen>Abbrechen</button>
        <button class="knopf knopf-primaer" type="button" data-ok>${vorhanden ? "Speichern" : "Hinzufügen"}</button>`,
    });
    const input = sheet.querySelector("#tx-text");
    input.focus();
    sheet.querySelector("[data-ok]").addEventListener("click", async () => {
      if (!input.value.trim()) { const m = sheet.querySelector("[data-meldung]"); m.textContent = "Bitte einen Text eintragen."; m.hidden = false; return; }
      dialogSchliessen(true);
      if (vorhanden) await aktion({ typ: "text_aendern", id: vorhanden.id, text: input.value });
      else if (await aktion({ typ: "text_neu", text: input.value, ...neuePosition(160, 40) })) {
        auswahl = { art: "text", id: bd.board.texte[bd.board.texte.length - 1].id };
        modus = "auswahl";
        zeichnen();
      }
    });
    sheet.querySelector("[data-weg]")?.addEventListener("click", () => { dialogSchliessen(true); loeschen(true); });
  }

  function abschnittDialog(a) {
    let art = a.art;
    const fzListe = () => bd.fahrzeuge.map((f) => {
      const hier = f.abschnitt_id === a.id;
      const woanders = f.abschnitt_id !== null && !hier ? bd.board.abschnitte.find((x) => x.id === f.abschnitt_id)?.name : null;
      return `<div class="zuordnung-zeile">
        <span><b>${esc(f.bezeichnung)}</b>${f.besatzung !== null ? ` · ${zahl(f.besatzung)} Pers.` : ""}
          <span class="text-3">${hier ? " · in diesem Abschnitt" : woanders ? ` · in ${esc(woanders)}` : " · nicht zugeordnet"}</span></span>
        <button class="knopf ${hier ? "" : "knopf-primaer"}" type="button" data-fz-zu="${f.id}" data-ziel="${hier ? "" : a.id}">${hier ? "Herausnehmen" : woanders ? "Hierher verschieben" : "Zuordnen"}</button>
      </div>`;
    }).join("");
    const sheet = dialog({
      titel: a.name,
      sub: ABSCHNITTSARTEN.find((x) => x.key === a.art)?.name,
      koerper: `
        <div class="meldung fehler" data-meldung hidden></div>
        <div class="feldgruppe"><label for="ab-name">Bezeichnung *</label>
          <input id="ab-name" maxlength="60" value="${esc(a.name)}" autocomplete="off"></div>
        <div class="feldgruppe"><label>Art</label><div class="seg status" data-art>
          ${ABSCHNITTSARTEN.map((x) => `<button type="button" data-k="${x.key}" aria-pressed="${x.key === art}">${esc(x.name)}</button>`).join("")}
        </div></div>
        <div class="block"><h4>Fahrzeuge ${esc(fahrzeugstatusText(bd.status_whiteboard, true))}</h4>
          ${bd.fahrzeuge.length ? `<div class="zuordnung-liste">${fzListe()}</div>`
            : `<p class="text-2">Derzeit hat kein Fahrzeug ${esc(fahrzeugstatusText(bd.status_whiteboard, true))}.</p>`}
        </div>`,
      fuss: `<button class="knopf knopf-gefahr" type="button" data-weg>Abschnitt löschen</button><span class="summe"></span>
        <button class="knopf" type="button" data-schliessen>Schließen</button>
        <button class="knopf knopf-primaer" type="button" data-ok>Speichern</button>`,
    });
    sheet.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => {
      art = b.dataset.k;
      sheet.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    sheet.querySelectorAll("[data-fz-zu]").forEach((b) => b.addEventListener("click", async () => {
      const ziel = b.dataset.ziel === "" ? null : Number(b.dataset.ziel);
      if (await aktion({ typ: "zuordnen", objekt_id: Number(b.dataset.fzZu), abschnitt_id: ziel })) {
        dialogSchliessen(true);
        abschnittDialog(finde("abschnitt", a.id));
      }
    }));
    sheet.querySelector("[data-ok]").addEventListener("click", async () => {
      const name = sheet.querySelector("#ab-name").value;
      if (!name.trim()) { const m = sheet.querySelector("[data-meldung]"); m.textContent = "Bitte eine Bezeichnung eintragen."; m.hidden = false; return; }
      dialogSchliessen(true);
      await aktion({ typ: "abschnitt_aendern", id: a.id, name, art });
    });
    sheet.querySelector("[data-weg]").addEventListener("click", () => { dialogSchliessen(true); loeschen(); });
  }

  function linienDialog(l) {
    const sheet = dialog({
      titel: l.art === "verbindung" ? "Verbindung" : "Linie",
      koerper: `
        <div class="feldgruppe"><label>Linienart</label><div class="seg" data-stilwahl>
          ${LINIENSTILE.map((s) => `<button type="button" data-k="${s.key}" aria-pressed="${s.key === l.stil}">${esc(s.name)}</button>`).join("")}</div></div>
        <div class="feldgruppe"><label>Farbe</label><div class="farbreihe">
          ${LINIENFARBEN.map((f) => `<button class="farbe gross" type="button" data-f="${f.key}" aria-pressed="${f.key === l.farbe}" title="${esc(f.name)}" style="--f:${f.wert}"></button>`).join("")}</div></div>`,
      fuss: `<button class="knopf knopf-gefahr" type="button" data-weg>Löschen</button><span class="summe"></span>
        <button class="knopf" type="button" data-schliessen>Schließen</button>`,
    });
    sheet.querySelectorAll("[data-stilwahl] [data-k]").forEach((b) => b.addEventListener("click", async () => {
      await aktion({ typ: "linie_aendern", id: l.id, stil: b.dataset.k });
      sheet.querySelectorAll("[data-stilwahl] [data-k]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    sheet.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", async () => {
      await aktion({ typ: "linie_aendern", id: l.id, farbe: b.dataset.f });
      sheet.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
    sheet.querySelector("[data-weg]").addEventListener("click", () => { dialogSchliessen(true); loeschen(true); });
  }

  function bearbeiten() {
    if (!auswahl || nurLesen) return;
    const e = finde(auswahl.art, auswahl.id);
    if (!e) return;
    if (auswahl.art === "abschnitt") abschnittDialog(e);
    else if (auswahl.art === "text") textDialog(e);
    else if (auswahl.art === "symbol") symbolBeschriften(SYMBOLE.find((s) => s.key === e.symbol), e);
    else if (auswahl.art === "linie") linienDialog(e);
  }

  function loeschen(ohneRueckfrage = false) {
    if (!auswahl || nurLesen) return;
    const e = finde(auswahl.art, auswahl.id);
    if (!e) return;
    const loesche = () => {
      const a = auswahl;
      auswahl = null;
      aktion({ typ: "loeschen", art: a.art, id: a.id }, "Gelöscht.");
    };
    if (auswahl.art === "abschnitt") {
      const n = fahrzeugeIn(e.id).length;
      const sheet = dialog({
        titel: `„${e.name}“ löschen?`,
        koerper: `<p class="meldung info" style="margin:0">${n ? `${zahl(n)} zugeordnete ${n === 1 ? "Fahrzeug wird" : "Fahrzeuge werden"} wieder als „nicht zugeordnet“ geführt. ` : ""}Verbindungen zu diesem Abschnitt werden entfernt. Die Löschung wird protokolliert.</p>`,
        fuss: `<span class="summe"></span><button class="knopf" type="button" data-schliessen>Abbrechen</button>
          <button class="knopf knopf-gefahr bestaetigen" type="button" data-ok>Löschen</button>`,
      });
      sheet.querySelector("[data-ok]").addEventListener("click", () => { dialogSchliessen(true); loesche(); });
      return;
    }
    if (ohneRueckfrage || auswahl.art === "linie") return loesche();
    loesche();
  }

  // ---- Start ----------------------------------------------------------------
  zeichnen();
  if (ansicht) ansichtAnwenden(); else { ansicht = { x: 40, y: 40, zoom: 1 }; einpassen(); }

  return {
    async aktualisieren() {
      bd = await api.boardDaten();
      if (auswahl && !finde(auswahl.art, auswahl.id)) auswahl = null;
      zeichnen();
    },
    beenden() {
      beendet = true;
      clearTimeout(ansichtTimer);
      window.removeEventListener("resize", hoeheSetzen);
    },
  };
}
