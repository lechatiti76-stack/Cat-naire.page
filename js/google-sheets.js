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

  /**
   * Tentative de reconnexion sans clic explicite (appelée automatiquement au
   * chargement si l'utilisateur s'était déjà connecté lors d'une session
   * précédente). Fonctionne si le navigateur a encore une session Google
   * active et le consentement déjà accordé ; échoue silencieusement sinon
   * (l'appelant doit alors simplement laisser le bouton "Se connecter"
   * visible). Google Identity Services ne garantit pas une reconnexion
   * totalement invisible dans tous les navigateurs — un bref flash de la
   * fenêtre de compte Google est possible.
   */
  function connecterSilencieux() {
    return connecter();
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
      // L'API Google renvoie {"error": {"code":400, "message": "...", "status": "..."}} :
      // on extrait ce message précis plutôt que de se limiter au code HTTP.
      let messagePrecis = "";
      try {
        const json = JSON.parse(texte);
        messagePrecis = (json.error && json.error.message) || "";
      } catch (e) { /* réponse non-JSON, on garde le texte brut ci-dessous */ }
      throw new Error(`Erreur Google Sheets ${res.status}${messagePrecis ? " — " + messagePrecis : ""}${!messagePrecis && texte ? "\n" + texte : ""}`);
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

  /** Comme obtenirValeurs(), mais renvoie [] si l'onglet n'existe pas encore (onglets optionnels Utilisateurs/Ressources). */
  async function obtenirValeursOptionnel(feuille) {
    try {
      return await obtenirValeurs(feuille);
    } catch (e) {
      return [];
    }
  }

  /** Convertit les lignes brutes en objets {Colonne: valeur}, en gardant le numéro de ligne réel du classeur (_ligne, 1-based) même après avoir écarté les lignes vides — nécessaire pour modifier/supprimer une ligne précise (voir modifierUtilisateur/supprimerUtilisateur). */
  function lignesEnObjets(lignes) {
    if (lignes.length === 0) return [];
    const entetes = lignes[0].map((h) => String(h).trim());
    return lignes.slice(1)
      .map((ligne, i) => ({ ligne, numeroLigne: i + 2 }))
      .filter((x) => x.ligne.length > 0 && x.ligne.some((v) => v !== ""))
      .map(({ ligne, numeroLigne }) => {
        const obj = { _ligne: numeroLigne };
        entetes.forEach((h, i) => { obj[h] = ligne[i] !== undefined ? ligne[i] : ""; });
        return obj;
      });
  }

  function estVrai(valeur) {
    return ["Oui", "TRUE", "true", "1", true].includes(valeur);
  }

  /**
   * Retrouve la valeur d'une colonne à partir du DÉBUT de son en-tête plutôt
   * que son nom exact (ex. "Role (Role = Administrateur/Contrôleur/...)."
   * correspond au préfixe "role") — évite de dépendre d'un intitulé de
   * colonne rigide quand quelqu'un ajoute des précisions dans l'en-tête.
   */
  function valeurParPrefixe(objet, prefixe) {
    const prefixeMin = prefixe.toLowerCase();
    const cle = Object.keys(objet).find((k) => k.toLowerCase().startsWith(prefixeMin));
    return cle ? objet[cle] : undefined;
  }

  /**
   * Fait correspondre le texte saisi dans la colonne Role (quels que soient
   * la casse ou les espaces superflus, ex. "administrateur ", "ADMIN") à l'un
   * des rôles connus de ROLES_CONFIG. Retombe sur ROLE_PAR_DEFAUT si aucune
   * correspondance (cellule vide, faute de frappe...).
   */
  function normaliserRole(valeur) {
    const texte = String(valeur || "").trim().toLowerCase();
    if (!texte) return ROLE_PAR_DEFAUT;
    const trouve = Object.keys(ROLES_CONFIG).find((r) => r.toLowerCase() === texte);
    return trouve || ROLE_PAR_DEFAUT;
  }

  /**
   * Hache un mot de passe avec SHA-256 (Web Crypto API, native au navigateur —
   * aucune bibliothèque tierce). Le sel est l'identifiant lui-même : suffisant
   * pour éviter de stocker un mot de passe en clair et pour que deux personnes
   * avec le même mot de passe n'aient pas le même hash, mais ça reste une
   * protection de confort côté navigateur, pas une sécurité de coffre-fort
   * serveur (voir docs/10 §1bis).
   */
  async function hacherMotDePasse(identifiant, motDePasse) {
    const texte = String(identifiant || "").trim().toLowerCase() + ":" + String(motDePasse || "");
    const octets = new TextEncoder().encode(texte);
    const empreinte = await crypto.subtle.digest("SHA-256", octets);
    return [...new Uint8Array(empreinte)].map((o) => o.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Calcule les permissions effectives d'une personne : si la colonne
   * "Permissions" de l'onglet Utilisateurs contient une liste (séparée par
   * des virgules) de clés reconnues (voir PERMISSIONS_CONFIG), on l'utilise
   * telle quelle ; sinon on retombe sur les permissions par défaut du rôle.
   */
  function analyserPermissions(texte, role) {
    const clesConnues = new Set(PERMISSIONS_CONFIG.map((p) => p.cle));
    const brut = String(texte || "").trim();
    if (!brut) return (ROLES_CONFIG[role] || ROLES_CONFIG[ROLE_PAR_DEFAUT]).permissions.slice();
    return brut.split(",").map((c) => c.trim()).filter((c) => clesConnues.has(c));
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

  /** Charge Materiels + TypesPointControle + Controles + ResultatsPointsControle + Utilisateurs + Ressources. */
  async function chargerDonnees() {
    const [materielsRows, typesRows, controlesRows, resultatsRows, utilisateursRows, ressourcesRows] = await Promise.all([
      obtenirValeurs(GOOGLE_CONFIG.feuilles.materiels),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.typesPointControle),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.controles),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.resultatsPointsControle),
      obtenirValeursOptionnel(GOOGLE_CONFIG.feuilles.utilisateurs),
      obtenirValeursOptionnel(GOOGLE_CONFIG.feuilles.ressources),
    ]);

    const materiels = lignesEnObjets(materielsRows)
      .filter((m) => !("Actif" in m) || estVrai(m.Actif) || m.Actif === "")
      .map((m, i) => ({
        id: i + 1,
        numSerie: m.NumSerie || m["N° Series"] || m["N° Série"] || valeurParPrefixe(m, "n° series") || valeurParPrefixe(m, "n° série") || valeurParPrefixe(m, "numserie"),
        title: m.Title || valeurParPrefixe(m, "title"),
        reference: m.Reference || m.Description || valeurParPrefixe(m, "reference") || valeurParPrefixe(m, "description"),
        categorie: m.Categorie || valeurParPrefixe(m, "categorie"),
        etat: m.Etat || m.Valeurs || valeurParPrefixe(m, "etat") || valeurParPrefixe(m, "valeurs"),
        periodiciteMois: Number(m.PeriodiciteMois || valeurParPrefixe(m, "periodicitemois")) || 6,
        responsable: m.Responsable || m["Assignée à"] || valeurParPrefixe(m, "responsable") || valeurParPrefixe(m, "assignée") || "",
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

    const utilisateurs = lignesEnObjets(utilisateursRows)
      .map((u) => {
        const role = normaliserRole(valeurParPrefixe(u, "role"));
        const permissionsTexte = valeurParPrefixe(u, "permission") || "";
        return {
          ligne: u._ligne,
          email: (valeurParPrefixe(u, "email") || "").trim().toLowerCase(),
          nom: valeurParPrefixe(u, "nom") || valeurParPrefixe(u, "name") || valeurParPrefixe(u, "email") || "",
          role,
          permissions: analyserPermissions(permissionsTexte, role),
          identifiant: valeurParPrefixe(u, "identifiant") || "",
          motDePasseHash: valeurParPrefixe(u, "motdepasse") || valeurParPrefixe(u, "mot de passe") || "",
        };
      })
      .filter((u) => u.email);

    const ressources = lignesEnObjets(ressourcesRows)
      .map((r) => ({ titre: r.Titre || r.Title, lien: r.Lien || r.Link || r.URL, categorie: r.Categorie || "" }))
      .filter((r) => r.titre && r.lien);

    return { materiels, typesPointControle, controles, utilisateurs, ressources };
  }

  /** Charge le journal des actions (onglet optionnel, voir docs/10 §4), le plus récent en premier. */
  async function chargerJournal() {
    const lignes = await obtenirValeursOptionnel(GOOGLE_CONFIG.feuilles.journal);
    return lignesEnObjets(lignes)
      .map((j) => ({
        date: j.Date || "", heure: j.Heure || "", utilisateur: j.Utilisateur || "",
        action: j.Action || "", ip: j["Adresse IP"] || j.IP || "",
      }))
      .reverse();
  }

  let adresseIpCache = null;
  /**
   * Best-effort : le navigateur ne connaît pas sa propre adresse IP publique
   * sans interroger un service tiers. On utilise l'API gratuite ipify (pas de
   * clé requise) avec un délai court ; en cas d'échec (réseau, service
   * indisponible), on journalise quand même l'action sans IP plutôt que de la
   * bloquer. Cette IP reste déclarative : un utilisateur technique pourrait
   * la falsifier, ce n'est pas une preuve légale.
   */
  async function obtenirAdresseIp() {
    if (adresseIpCache !== null) return adresseIpCache;
    try {
      const controleur = new AbortController();
      const timeout = setTimeout(() => controleur.abort(), 2500);
      const res = await fetch("https://api.ipify.org?format=json", { signal: controleur.signal });
      clearTimeout(timeout);
      const json = await res.json();
      adresseIpCache = json.ip || "";
    } catch (e) {
      adresseIpCache = "";
    }
    return adresseIpCache;
  }

  /** Ajoute une entrée au journal des actions (voir docs/10 §4). N'échoue jamais bruyamment : un souci de journalisation ne doit pas bloquer l'action elle-même. */
  async function enregistrerJournal({ utilisateur, action }) {
    try {
      await assurerFeuille(GOOGLE_CONFIG.feuilles.journal, ["Date", "Heure", "Utilisateur", "Action", "Adresse IP"]);
      const maintenant = new Date();
      const date = maintenant.toISOString().slice(0, 10);
      const heure = maintenant.toTimeString().slice(0, 8);
      const ip = await obtenirAdresseIp();
      await ajouterLigne(GOOGLE_CONFIG.feuilles.journal, [date, heure, utilisateur || "", action || "", ip]);
    } catch (e) {
      console.warn("Journal des actions : échec de l'enregistrement (non bloquant)", e);
    }
  }

  async function listerFeuilles() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}?fields=sheets.properties.title`;
    const json = await appelJson(url);
    return (json.sheets || []).map((s) => s.properties.title);
  }

  async function creerFeuille(nom) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}:batchUpdate`;
    await appelJson(url, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: nom } } }] }) });
  }

  const feuillesConfirmees = new Set();
  /**
   * Crée un onglet (avec ses en-têtes) s'il n'existe pas encore dans le
   * classeur, pour qu'un premier écriture n'échoue plus jamais avec
   * "Unable to parse range" faute d'onglet — les onglets Utilisateurs/Journal
   * sont facultatifs à la lecture (voir obtenirValeursOptionnel) mais doivent
   * exister pour pouvoir y écrire.
   */
  async function assurerFeuille(nomFeuille, entetes) {
    if (feuillesConfirmees.has(nomFeuille)) return;
    const feuilles = await listerFeuilles();
    if (!feuilles.includes(nomFeuille)) {
      await creerFeuille(nomFeuille);
      if (entetes && entetes.length) {
        const derniereColonne = String.fromCharCode(64 + entetes.length);
        const plage = `${nomFeuille}!A1:${derniereColonne}1`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(plage)}?valueInputOption=USER_ENTERED`;
        await appelJson(url, { method: "PUT", body: JSON.stringify({ values: [entetes] }) });
      }
    }
    feuillesConfirmees.add(nomFeuille);
  }

  /** Détermine le rôle d'un utilisateur à partir de l'onglet Utilisateurs (absent/vide => rôle par défaut, voir docs/09). */
  function determinerRole(email, utilisateurs) {
    if (!email || !utilisateurs || utilisateurs.length === 0) return ROLE_PAR_DEFAUT;
    const trouve = utilisateurs.find((u) => u.email === email.trim().toLowerCase());
    return trouve ? trouve.role : ROLE_PAR_DEFAUT;
  }

  /** Retrouve la ligne Utilisateurs d'un e-mail (pour afficher le nom déclaré, ex. "PATON ROMUALD", plutôt que le nom du compte Google). */
  function trouverUtilisateur(email, utilisateurs) {
    if (!email || !utilisateurs) return null;
    return utilisateurs.find((u) => u.email === email.trim().toLowerCase()) || null;
  }

  /** Retrouve la ligne Utilisateurs d'un identifiant de connexion (écran Administration, voir docs/10 §1bis). */
  function trouverUtilisateurParIdentifiant(identifiant, utilisateurs) {
    if (!identifiant || !utilisateurs) return null;
    const cle = String(identifiant).trim().toLowerCase();
    return utilisateurs.find((u) => u.identifiant && u.identifiant.trim().toLowerCase() === cle) || null;
  }

  /** Vérifie un identifiant/mot de passe individuel contre l'onglet Utilisateurs. Renvoie la personne si correct, sinon null. */
  async function verifierMotDePasse(identifiant, motDePasse, utilisateurs) {
    const u = trouverUtilisateurParIdentifiant(identifiant, utilisateurs);
    if (!u || !u.motDePasseHash) return null;
    const hash = await hacherMotDePasse(identifiant, motDePasse);
    return hash === u.motDePasseHash ? u : null;
  }

  /** Ajoute un utilisateur dans l'onglet Utilisateurs (écran Administration). */
  async function creerUtilisateur({ email, nom, role, permissions, identifiant, motDePasseHash }) {
    await assurerFeuille(GOOGLE_CONFIG.feuilles.utilisateurs, ["Email", "Nom", "Role", "Permissions", "Identifiant", "MotDePasseHash"]);
    await ajouterLigne(GOOGLE_CONFIG.feuilles.utilisateurs, [email, nom, role, (permissions || []).join(","), identifiant || "", motDePasseHash || ""]);
  }

  /** Modifie un utilisateur existant (identifié par son numéro de ligne réel dans le classeur). */
  async function modifierUtilisateur(ligne, { email, nom, role, permissions, identifiant, motDePasseHash }) {
    const plage = `${GOOGLE_CONFIG.feuilles.utilisateurs}!A${ligne}:F${ligne}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(plage)}?valueInputOption=USER_ENTERED`;
    await appelJson(url, { method: "PUT", body: JSON.stringify({ values: [[email, nom, role, (permissions || []).join(","), identifiant || "", motDePasseHash || ""]] }) });
  }

  /** Supprime un utilisateur (vide sa ligne — les lignes vides sont ignorées à la lecture). */
  async function supprimerUtilisateur(ligne) {
    const plage = `${GOOGLE_CONFIG.feuilles.utilisateurs}!A${ligne}:F${ligne}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(plage)}:clear`;
    await appelJson(url, { method: "POST" });
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

  return {
    connecter, connecterSilencieux, estConnecte, deconnecter, utilisateurCourant, chargerDonnees,
    enregistrerControle, determinerRole, trouverUtilisateur,
    creerUtilisateur, modifierUtilisateur, supprimerUtilisateur,
    chargerJournal, enregistrerJournal,
    hacherMotDePasse, trouverUtilisateurParIdentifiant, verifierMotDePasse,
  };
})();
