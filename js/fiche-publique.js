/**
 * fiche-publique.js — Page autonome (fiche.html), SANS connexion Google,
 * accessible à quiconque a le lien (ex. scanné via un QR code collé sur
 * l'équipement). Lit deux CSV publiés ("Fichier → Partager → Publier sur le
 * Web") des onglets Materiels et Controles, retrouve l'équipement demandé
 * (paramètre ?numserie=... de l'URL) et calcule les jours restants EN DIRECT
 * à chaque ouverture de la page — jamais une valeur figée. Voir docs/10 §13.
 *
 * ⚠️ Ces deux CSV publiés sont accessibles à QUICONQUE a leur URL, pas
 * seulement en scannant physiquement un QR code. Ne publiez que les onglets
 * nécessaires (Materiels, Controles) — jamais Utilisateurs (mots de passe
 * hachés) ni Journal.
 */

(function () {
  "use strict";

  function valeurParPrefixe(objet, prefixe) {
    const prefixeMin = prefixe.toLowerCase();
    const cle = Object.keys(objet).find((k) => k.toLowerCase().startsWith(prefixeMin));
    return cle ? objet[cle] : undefined;
  }

  /** Même logique que google-sheets.js normaliserDate() — voir ce fichier pour le détail des cas gérés. */
  function normaliserDate(valeur) {
    if (!valeur) return "";
    const texte = String(valeur).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(texte)) return texte.slice(0, 10);
    if (/^\d+(\.\d+)?$/.test(texte)) {
      const epoqueSheets = Date.UTC(1899, 11, 30);
      return new Date(epoqueSheets + Number(texte) * 86400000).toISOString().slice(0, 10);
    }
    const jjmmaaaa = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (jjmmaaaa) {
      const [, jour, mois, annee] = jjmmaaaa;
      return `${annee}-${mois.padStart(2, "0")}-${jour.padStart(2, "0")}`;
    }
    const analysee = new Date(texte);
    if (!Number.isNaN(analysee.getTime())) return analysee.toISOString().slice(0, 10);
    return texte;
  }

  /** Analyseur CSV minimal (gère les champs entre guillemets, virgules et retours à la ligne inclus). */
  function parserCsv(texte) {
    const lignes = [];
    let ligne = [];
    let champ = "";
    let dansGuillemets = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (dansGuillemets) {
        if (c === '"') {
          if (texte[i + 1] === '"') { champ += '"'; i++; }
          else dansGuillemets = false;
        } else champ += c;
      } else if (c === '"') {
        dansGuillemets = true;
      } else if (c === ",") {
        ligne.push(champ); champ = "";
      } else if (c === "\n") {
        ligne.push(champ); lignes.push(ligne); ligne = []; champ = "";
      } else if (c !== "\r") {
        champ += c;
      }
    }
    if (champ.length > 0 || ligne.length > 0) { ligne.push(champ); lignes.push(ligne); }

    const nonVides = lignes.filter((l) => l.some((v) => v !== ""));
    if (nonVides.length === 0) return [];
    const entetes = nonVides[0].map((h) => h.trim());
    return nonVides.slice(1).map((l) => {
      const obj = {};
      entetes.forEach((h, idx) => { obj[h] = l[idx] !== undefined ? l[idx] : ""; });
      return obj;
    });
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  /** Même logique que google-sheets.js normaliserNumSerie() — tolère casse et espaces superflus. */
  function normaliserNumSerie(valeur) {
    return String(valeur || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  async function chargerCsv(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Impossible de charger les données (HTTP " + res.status + ").");
    return parserCsv(await res.text());
  }

  async function demarrer() {
    document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "light");
    const zone = document.getElementById("ficheContenu");
    const numSerie = (new URLSearchParams(window.location.search).get("numserie") || "").trim();

    if (!numSerie) {
      zone.innerHTML = `<p class="fiche-publique__erreur">Aucun numéro de série précisé dans le lien.</p>`;
      return;
    }
    const config = (typeof GOOGLE_CONFIG !== "undefined" && GOOGLE_CONFIG.fichePublique) || {};
    if (!config.urlCsvMateriels || !config.urlCsvControles) {
      zone.innerHTML = `<p class="fiche-publique__erreur">Fiche publique non configurée. Voir docs/10 §13 (js/google-config.js, GOOGLE_CONFIG.fichePublique).</p>`;
      return;
    }

    try {
      const [materiels, controles] = await Promise.all([
        chargerCsv(config.urlCsvMateriels),
        chargerCsv(config.urlCsvControles),
      ]);

      const materiel = materiels.find((m) => {
        const val = valeurParPrefixe(m, "numserie") || valeurParPrefixe(m, "n° series") || valeurParPrefixe(m, "n° série");
        return val && normaliserNumSerie(val) === normaliserNumSerie(numSerie);
      });
      if (!materiel) {
        zone.innerHTML = `<p class="fiche-publique__erreur">Aucun matériel trouvé pour le n° de série « ${escapeHtml(numSerie)} ».</p>`;
        return;
      }

      const historique = controles
        .filter((c) => normaliserNumSerie(valeurParPrefixe(c, "numserie")) === normaliserNumSerie(numSerie))
        .sort((a, b) => normaliserDate(b.DateControle || valeurParPrefixe(b, "datecontrole")).localeCompare(normaliserDate(a.DateControle || valeurParPrefixe(a, "datecontrole"))));
      const dernier = historique[0];

      const titre = materiel.Title || valeurParPrefixe(materiel, "title") || numSerie;
      const categorie = materiel.Categorie || valeurParPrefixe(materiel, "categorie") || "";

      let joursHtml = `<p class="fiche-publique__jours fiche-publique__jours--neutre">Jamais contrôlé</p>`;
      let dateControle = "", dateProchain = "", controleur = "";
      if (dernier) {
        dateControle = normaliserDate(dernier.DateControle || valeurParPrefixe(dernier, "datecontrole"));
        dateProchain = normaliserDate(dernier.DateProchainControle || valeurParPrefixe(dernier, "dateprochaincontrole"));
        controleur = dernier.Controleur || valeurParPrefixe(dernier, "controleur") || "";
        const joursRestants = Math.ceil((new Date(dateProchain + "T00:00:00") - new Date()) / 86400000);
        let classeCouleur = "vert";
        if (joursRestants <= 7) classeCouleur = "rouge";
        else if (joursRestants <= 30) classeCouleur = "orange";
        const texteJours = joursRestants < 0
          ? `En retard de ${Math.abs(joursRestants)} jour${Math.abs(joursRestants) > 1 ? "s" : ""}`
          : `${joursRestants} jour${joursRestants > 1 ? "s" : ""} restant${joursRestants > 1 ? "s" : ""}`;
        joursHtml = `<p class="fiche-publique__jours fiche-publique__jours--${classeCouleur}">${escapeHtml(texteJours)}</p>`;
      }

      zone.innerHTML = `
        <h1>${escapeHtml(titre)}</h1>
        <p class="fiche-publique__categorie">${escapeHtml(categorie)}</p>
        ${joursHtml}
        <dl class="fiche-publique__grille">
          <div><dt>N° série</dt><dd>${escapeHtml(numSerie)}</dd></div>
          <div><dt>Date du dernier contrôle</dt><dd>${formatDate(dateControle)}</dd></div>
          <div><dt>Date du prochain contrôle</dt><dd>${formatDate(dateProchain)}</dd></div>
          <div><dt>Contrôleur</dt><dd>${escapeHtml(controleur) || "—"}</dd></div>
        </dl>
        <p class="fiche-publique__horodatage">Consulté le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
      `;
    } catch (e) {
      zone.innerHTML = `<p class="fiche-publique__erreur">Erreur de chargement : ${escapeHtml(e.message)}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", demarrer);
})();
