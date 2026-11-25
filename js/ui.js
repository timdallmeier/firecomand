// Gemeinsame UI-Hilfen: Escaping, Formatierung, Farben, Dialog, Toast

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const zahlFormat = new Intl.NumberFormat("de-DE");
export const zahl = (n) => (n === null || n === undefined ? "—" : zahlFormat.format(n));

export const FARBEN = {
  kraefte: { im_einsatz: "var(--krit)", nachalarmiert: "var(--warn)", auf_anmarsch: "var(--info)", auf_wache: "var(--ok)" },
  einsatzmittel: { einsatzbereit: "var(--ok)", im_einsatz: "var(--info)", in_aufbereitung: "var(--warn)", defekt: "var(--krit)" },
  versorgung: { auf_wache: "var(--ok)", alarmierbar: "var(--info)", angefordert: "var(--warn)" },
};
export const farbe = (bereich, status) => FARBEN[bereich]?.[status] || "var(--text-3)";
export const dot = (bereich, status) => `<span class="dot" style="background:${farbe(bereich, status)}"></span>`;

export function zeitpunkt(iso, mitDatum = true) {
  if (!iso) return "";
  const d = new Date(iso);
  const heute = new Date();
  const zeit = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (!mitDatum) return zeit;
  const gleicherTag = d.toDateString() === heute.toDateString();
  return gleicherTag ? `heute ${zeit}` : `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })} ${zeit}`;
}

/** Absolutes Datum mit Uhrzeit, z. B. "25.11.2026, 13:45" */
export function datumZeit(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Dauer zwischen zwei Zeitpunkten, z. B. "2 h 15 min" */
export function dauer(vonIso, bisIso) {
  const min = Math.max(0, Math.round((new Date(bisIso || Date.now()) - new Date(vonIso)) / 60000));
  const t = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return [t ? `${t} d` : "", h ? `${h} h` : "", `${m} min`].filter(Boolean).join(" ");
}

// ---- Toast ---------------------------------------------------------------
let toastTimer;
export function toast(text, art = "info") {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.className = `toast ${art === "fehler" ? "fehler" : ""}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, art === "fehler" ? 6000 : 3200);
}

// ---- Dialog (Sheet) ------------------------------------------------------
// Ein Dialog gleichzeitig. `vorSchliessen` darf false liefern (z. B. ungespeicherte Änderungen).
let aktuell = null;

export function dialogOffen() { return aktuell !== null; }

export function dialog({ titel, sub = "", koerper = "", fuss = "", vorSchliessen = null }) {
  const huelle = document.getElementById("sheet-huelle");
  const sheet = document.getElementById("sheet");
  sheet.innerHTML = `
    <div class="sheet-kopf">
      <div><h3 id="sheet-titel">${esc(titel)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
      <button class="knopf knopf-flach" type="button" data-schliessen aria-label="Schließen">Schließen</button>
    </div>
    <div class="sheet-koerper">${koerper}</div>
    ${fuss ? `<div class="sheet-fuss">${fuss}</div>` : ""}`;
  huelle.hidden = false;
  document.body.style.overflow = "hidden";
  aktuell = { vorSchliessen };
  return sheet;
}

export function dialogSchliessen(erzwingen = false) {
  if (!aktuell) return;
  if (!erzwingen && aktuell.vorSchliessen && aktuell.vorSchliessen() === false) return;
  document.getElementById("sheet-huelle").hidden = true;
  document.getElementById("sheet").innerHTML = "";
  document.body.style.overflow = "";
  aktuell = null;
  document.dispatchEvent(new CustomEvent("dialog-geschlossen"));
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-schliessen]")) dialogSchliessen();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && aktuell) dialogSchliessen();
});

// Umschalter Menge / Einzeln (nur für Kategorien, die beides erlauben)
export function erfassungsartSchalter(kat) {
  if (!kat.einzeln_moeglich) return "";
  const a = kat.erfassungsart;
  return `
    <div class="feldgruppe">
      <label>Erfassungsart</label>
      <div class="seg" data-erfassungsart>
        <button type="button" data-art="menge" aria-pressed="${a === "menge"}">Als Menge</button>
        <button type="button" data-art="einzeln" aria-pressed="${a === "einzeln"}">Einzelobjekte</button>
      </div>
    </div>`;
}

// Nur Ziffern zulassen (keine Vorzeichen, keine Dezimalstellen)
export function nurZiffern(input) {
  input.addEventListener("input", () => {
    const sauber = input.value.replace(/\D+/g, "").replace(/^0+(?=\d)/, "");
    if (sauber !== input.value) input.value = sauber;
  });
}
