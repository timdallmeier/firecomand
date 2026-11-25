// Sicherung erstellen (für OneDrive / Dateien-App) und wiederherstellen

import { api } from "./api.js";
import { dialog, dialogSchliessen, esc, toast, zahl, zeitpunkt } from "./ui.js";

function dateiname() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `firecommand-sicherung-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

export async function oeffneSicherung(ctx) {
  const info = await api.stammInfo();
  const dauerhaft = await api.dauerhaftAnfordern();
  const letzte = info.letzte_sicherung ? zeitpunkt(info.letzte_sicherung) : "noch nie";

  const sheet = dialog({
    titel: "Sicherung",
    sub: "Alle Daten liegen nur auf diesem Gerät",
    koerper: `
      <div class="meldung fehler" data-meldung hidden></div>
      <div class="meldung info" style="margin:0">
        Letzte Sicherung: <b>${esc(letzte)}</b><br>
        Speicher: ${dauerhaft === true ? "dauerhaft geschützt" : dauerhaft === false
          ? "<span style=\"color:var(--warn)\">nicht dauerhaft geschützt – bitte regelmäßig sichern</span>"
          : "Schutzstatus unbekannt – bitte regelmäßig sichern"}
      </div>

      <div class="block">
        <h4>Sicherung erstellen</h4>
        <p class="text-2">Erstellt eine Datei mit allen Einsätzen, der Fahrzeugliste und dem Protokoll.
          Über „Teilen“ → „In Dateien sichern“ kannst du sie direkt in OneDrive ablegen.</p>
        <div class="knopfreihe">
          <button class="knopf knopf-primaer knopf-gross" type="button" data-erstellen>Sicherung erstellen</button>
          <button class="knopf knopf-gross" type="button" data-teilen hidden>Teilen / In Dateien sichern</button>
          <a class="knopf knopf-gross" data-laden hidden>Herunterladen</a>
        </div>
      </div>

      <div class="block">
        <h4>Sicherung wiederherstellen</h4>
        <p class="text-2">Ersetzt den kompletten aktuellen Stand auf diesem Gerät durch die gewählte Sicherung.</p>
        <label class="knopf knopf-gross" style="width:max-content">
          Sicherungsdatei wählen
          <input type="file" accept=".json,application/json" data-datei hidden>
        </label>
        <div data-vorschau></div>
      </div>`,
  });

  const meldung = sheet.querySelector("[data-meldung]");
  const fehler = (t) => { meldung.textContent = t; meldung.hidden = !t; };
  let datei = null;
  let url = null;

  sheet.querySelector("[data-erstellen]").addEventListener("click", async (ev) => {
    fehler("");
    try {
      const inhalt = await api.sicherungErstellen();
      const name = dateiname();
      const blob = new Blob([JSON.stringify(inhalt, null, 1)], { type: "application/json" });
      datei = new File([blob], name, { type: "application/json" });
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      const laden = sheet.querySelector("[data-laden]");
      laden.href = url;
      laden.download = name;
      laden.hidden = false;
      // Teilen braucht einen eigenen Tipp (Safari verlangt eine direkte Benutzeraktion)
      sheet.querySelector("[data-teilen]").hidden = !(navigator.canShare && navigator.canShare({ files: [datei] }));
      ev.target.textContent = "Sicherung erstellt ✓";
      ctx.neuLaden();
      toast(`Sicherung erstellt: ${name}`);
    } catch (e) {
      fehler(e.message);
    }
  });

  sheet.querySelector("[data-teilen]").addEventListener("click", async () => {
    try {
      await navigator.share({ files: [datei], title: "FIRECOMMAND-Sicherung" });
    } catch (e) {
      if (e?.name !== "AbortError") fehler("Teilen nicht möglich. Bitte „Herunterladen“ verwenden.");
    }
  });

  sheet.querySelector("[data-datei]").addEventListener("change", async (ev) => {
    fehler("");
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    let geprueft;
    try {
      geprueft = await api.sicherungPruefen(await f.text());
    } catch (e) {
      return fehler(`Sicherung abgelehnt: ${e.message}`);
    }
    const laufend = geprueft.einsaetze.filter((x) => x.status === "laufend").length;
    const vorschau = sheet.querySelector("[data-vorschau]");
    vorschau.innerHTML = `
      <div class="meldung info" style="margin-top:12px">
        <b>${esc(f.name)}</b><br>
        Erstellt: ${esc(geprueft.erstellt_am ? zeitpunkt(geprueft.erstellt_am) : "unbekannt")}${geprueft.erstellt_von ? ` von ${esc(geprueft.erstellt_von)}` : ""}<br>
        ${zahl(geprueft.einsaetze.length)} Einsätze (${zahl(laufend)} laufend) · ${zahl(geprueft.stamm.objekte.filter((o) => o.aktiv).length)} Fahrzeuge/AB · ${zahl(geprueft.protokoll.length)} Protokolleinträge
      </div>
      <p class="meldung fehler" style="margin:10px 0">Alle Einsätze und die Fahrzeugliste auf diesem Gerät werden vollständig ersetzt.
        Erstelle vorher eine Sicherung, falls du ihn behalten möchtest.</p>
      <button class="knopf knopf-gefahr knopf-gross" type="button" data-einspielen>Sicherung wiederherstellen</button>`;
    let scharf = false;
    const btn = vorschau.querySelector("[data-einspielen]");
    btn.addEventListener("click", async () => {
      if (!scharf) {
        scharf = true;
        btn.textContent = "Wirklich ersetzen?";
        btn.classList.add("bestaetigen");
        return;
      }
      try {
        await api.sicherungEinspielen(geprueft);
        dialogSchliessen(true);
        ctx.nachImport();
        toast("Sicherung wiederhergestellt.");
      } catch (e) {
        fehler(e.message);
      }
    });
  });
}
