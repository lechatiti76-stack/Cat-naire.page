/**
 * google-sheets.js — Accès à l'API Google Sheets (authentification OAuth côté
 * navigateur via Google Identity Services, lecture des 4 onglets, écriture
 * d'un nouveau contrôle + son détail par point).
 *
 * Contrairement à SharePoint, Google Sheets accepte les appels authentifiés
 * depuis n'importe quel domaine (GitHub Pages inclus) : pas besoin d'héberger
 * la page sur un domaine particulier. L'utilisateur doit simplement cliquer
 * sur "Se connecter avec Google" à chaque session.
 *
 * Schéma attendu (voir docs/08-migration-google-sheets.md) :
 *   Materiels                : NumSerie | Title | Reference | Categorie | Etat | PeriodiciteMois | Responsable | Actif
 *   TypesPointControle       : Categorie | Title (libellé du point) | Ordre
 *   Controles                : ControleId | NumSerie | DateControle | DateProchainControle | Controleur | Conforme | Statut | Observations | ActionsCorrectives | Commentaires
 *   ResultatsPointsControle  : Title | Controle (= ControleId) | Effectue | Observation | PointControle (libellé) | Rapport | Statut
 *
 * Des colonnes supplémentaires (ex. "Item Type", "Path" laissées par un export
 * SharePoint) peuvent exister sans problème : seules les colonnes ci-dessus
 * sont lues/écrites, le reste est ignoré.
 */

const GoogleSheetsAPI = (() => {
  let accessToken = null;
  let tokenClient = null;
  let scriptCharge = null;

  function chargerScriptGSI() {
    if (scriptCharge) return scriptCharge;
    scriptCharge = new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Impossible de charger le script d'authentification Google."));
      document.head.appendChild(script);
    });
    return scriptCharge;
  }

  async function initTokenClient() {
    await chargerScriptGSI();
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.clientId,
        scope: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/userinfo.email",
        ].join(" "),
        callback: () => {}, // remplacé à chaque appel de connecter()
      });
    }
  }

  function connecter() {
    return new Promise(async (resolve, reject) => {
      try {
        await initTokenClient();
      } catch (e) {
        reject(e);
        return;
      }
      tokenClient.callback = (reponse) => {
        if (reponse.error) { reject(new Error(reponse.error)); return; }
        accessToken = reponse.access_token;
        resolve(accessToken);
      };
      tokenClient.requestAccessToken({ prompt: "" });
    });
  }

  function estConnecte() {
    return !!accessToken;
  }

  function deconnecter() {
    if (accessToken && window.google) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
  }

  async function appelJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const texte = await res.text().catch(() => "");
      throw new Error(`Erreur Google Sheets ${res.status}\n${texte}`);
    }
    return res.json();
  }

  async function utilisateurCourant() {
    const json = await appelJson("https://www.googleapis.com/oauth2/v3/userinfo");
    return { id: json.sub, nom: json.name || json.email, email: json.email };
  }

  async function obtenirValeurs(feuille) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(feuille)}`;
    const json = await appelJson(url);
    return json.values || [];
  }

  function lignesEnObjets(lignes) {
    if (lignes.length === 0) return [];
    const entetes = lignes[0].map((h) => String(h).trim());
    return lignes.slice(1)
      .filter((ligne) => ligne.length > 0 && ligne.some((v) => v !== ""))
      .map((ligne) => {
        const obj = {};
        entetes.forEach((h, i) => { obj[h] = ligne[i] !== undefined ? ligne[i] : ""; });
        return obj;
      });
  }

  function estVrai(valeur) {
    return ["Oui", "TRUE", "true", "1", true].includes(valeur);
  }

  /**
   * Normalise une date lue depuis Google Sheets en "AAAA-MM-JJ" quel que soit
   * son format d'origine : texte ISO déjà correct, date localisée
   * ("07/12/2026"), ou nombre de série Google Sheets (jours depuis le
   * 30/12/1899) renvoyé quand la cellule est formatée en "Nombre" au lieu de
   * "Date".
   */
  function normaliserDate(valeur) {
    if (!valeur) return "";
    const texte = String(valeur).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(texte)) return texte.slice(0, 10);
    if (/^\d+(\.\d+)?$/.test(texte)) {
      const epoqueSheets = Date.UTC(1899, 11, 30);
      return new Date(epoqueSheets + Number(texte) * 86400000).toISOString().slice(0, 10);
    }
    const analysee = new Date(texte);
    if (!Number.isNaN(analysee.getTime())) return analysee.toISOString().slice(0, 10);
    return texte;
  }

  /** Charge Materiels + TypesPointControle + Controles + ResultatsPointsControle. */
  async function chargerDonnees() {
    const [materielsRows, typesRows, controlesRows, resultatsRows] = await Promise.all([
      obtenirValeurs(GOOGLE_CONFIG.feuilles.materiels),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.typesPointControle),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.controles),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.resultatsPointsControle),
    ]);

    const materiels = lignesEnObjets(materielsRows)
      .filter((m) => !("Actif" in m) || estVrai(m.Actif) || m.Actif === "")
      .map((m, i) => ({
        id: i + 1,
        numSerie: m.NumSerie || m["N° Series"] || m["N° Série"],
        title: m.Title,
        reference: m.Reference || m.Description,
        categorie: m.Categorie,
        etat: m.Etat || m.Valeurs,
        periodiciteMois: Number(m.PeriodiciteMois) || 6,
        responsable: m.Responsable || m["Assignée à"] || "",
      }));

    const typesPointControle = {};
    lignesEnObjets(typesRows).forEach((t) => {
      const libelle = t.Title || t.Libelle;
      if (!libelle) return;
      if (!typesPointControle[t.Categorie]) typesPointControle[t.Categorie] = [];
      typesPointControle[t.Categorie].push({ libelle, ordre: Number(t.Ordre) || 0 });
    });
    Object.values(typesPointControle).forEach((arr) => arr.sort((a, b) => a.ordre - b.ordre));

    const resultatsObjs = lignesEnObjets(resultatsRows);
    const controles = lignesEnObjets(controlesRows).map((c) => {
      const materiel = materiels.find((m) => m.numSerie === c.NumSerie) || {};
      const points = resultatsObjs
        .filter((r) => (r.Controle || r.ControleId) === c.ControleId)
        .map((r) => ({
          libelle: r.PointControle || r.Libelle,
          effectue: estVrai(r.Effectue),
          rapport: r.Rapport,
          statut: r.Statut,
        }));
      return {
        id: c.ControleId,
        materielId: materiel.id,
        materiel: materiel.title || c.NumSerie,
        numSerie: c.NumSerie,
        reference: materiel.reference || "",
        categorie: materiel.categorie || "",
        etat: materiel.etat || "",
        dateControle: normaliserDate(c.DateControle),
        dateProchainControle: normaliserDate(c.DateProchainControle),
        controleur: c.Controleur,
        conforme: estVrai(c.Conforme),
        statut: c.Statut,
        observations: c.Observations || "",
        actionsCorrectives: c.ActionsCorrectives || "",
        commentaires: c.Commentaires || "",
        pointsControle: points,
      };
    });

    return { materiels, typesPointControle, controles };
  }

  async function ajouterLigne(feuille, valeurs) {
    return ajouterLignes(feuille, [valeurs]);
  }

  /** Ajoute plusieurs lignes en un seul appel réseau (plus rapide qu'un appel par ligne). */
  async function ajouterLignes(feuille, lignesDeValeurs) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(feuille)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    await appelJson(url, { method: "POST", body: JSON.stringify({ values: lignesDeValeurs }) });
  }

  function ajouterMois(dateIso, nbMois) {
    const d = new Date(dateIso + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + nbMois);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Ajoute une ligne dans Controles, puis une ligne par point de contrôle
   * dans ResultatsPointsControle (docs/02 §2.6-2.7, docs/03 §3.7-3.8).
   */
  async function enregistrerControle({ materiel, dateControle, controleurNom, observations, actionsCorrectives, commentaires, points }) {
    const conformeGlobal = points.every((p) => p.statut === "Conforme");
    const dateProchain = ajouterMois(dateControle, materiel.periodiciteMois || 6);
    const joursRestants = Math.ceil((new Date(dateProchain) - new Date(dateControle)) / 86400000);
    let statutGlobal = "Conforme";
    if (materiel.etat === "Hors service") statutGlobal = "Hors service";
    else if (!conformeGlobal) statutGlobal = "Non conforme";
    else if (joursRestants <= GOOGLE_CONFIG.seuilJours) statutGlobal = "À vérifier prochainement";

    const controleId = "C" + Date.now();

    await ajouterLigne(GOOGLE_CONFIG.feuilles.controles, [
      controleId, materiel.numSerie, dateControle, dateProchain, controleurNom,
      conformeGlobal ? "Oui" : "Non", statutGlobal, observations || "", actionsCorrectives || "", commentaires || "",
    ]);

    // Une ligne par point, en un seul appel réseau : Title | Controle | Effectue | Observation | PointControle | Rapport | Statut
    await ajouterLignes(
      GOOGLE_CONFIG.feuilles.resultatsPointsControle,
      points.map((point) => [
        point.libelle, controleId, "Oui", "", point.libelle,
        point.statut === "Conforme" ? "Validé" : "Non validé", point.statut,
      ])
    );

    return { id: controleId, statut: statutGlobal, conforme: conformeGlobal, dateProchainControle: dateProchain };
  }

  return { connecter, estConnecte, deconnecter, utilisateurCourant, chargerDonnees, enregistrerControle };
})();
