// Anzeige des Änderungsprotokolls des geöffneten Einsatzes

import { api } from "./api.js";
import { protokollFormatierer } from "./protokoll-format.js";
import { dialog, esc, toast, zahl } from "./ui.js";

export async function oeffneProtokoll(daten) {
  let eintraege;
  try { eintraege = await api.protokoll(500); } catch (e) { return toast(e.message, "fehler"); }
  const fmt = protokollFormatierer(daten);

  const diff = (f) => f.aenderungen.map((a) => {
    if (a.text) return esc(a.text);
    const alt = a.alt !== undefined ? `<span class="alt">${esc(a.alt)}</span> → ` : "";
    const neu = a.zahl ? `<b class="zahl">${esc(a.neu)}</b>` : esc(a.neu ?? "");
    return `${a.feld ? `${esc(a.feld)}: ` : ""}${alt}${neu}`;
  }).join("<br>");

  const html = eintraege.length
    ? `<div class="protokoll">${eintraege.map((e) => {
      const f = fmt(e);
      return `
        <div class="eintrag">
          <div class="zeit zahl">${esc(f.zeit)}</div>
          <div>
            <div class="was">${esc(f.was)}<span style="color:var(--text-3);font-weight:400"> – ${esc(f.aktion)}</span></div>
            ${f.aenderungen.length ? `<div class="diff">${diff(f)}</div>` : ""}
            <div class="wer">${esc(f.wer)}</div>
          </div>
        </div>`;
    }).join("")}</div>`
    : `<p class="meldung info" style="margin:0">Noch keine Änderungen protokolliert.</p>`;

  dialog({
    titel: "Änderungsprotokoll",
    sub: `Einsatz ${daten.einsatz.nummer} · ${zahl(eintraege.length)} Einträge · unveränderlich`,
    koerper: html,
  });
}
