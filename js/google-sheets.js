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
 *   Controles                : ControleId | NumSerie | DateControle | DateProchainControle | Controleur | Conforme | Statut | Observations | ActionsCorrectives | Commentaires | Photos (liens Google Drive, séparés par des virgules, facultatif — docs/10 §11)
 *   ResultatsPointsControle  : Title | Controle (= ControleId) | Effectue | Observation | PointControle (libellé) | Rapport | Statut
 *   Interventions (GMAO, optionnel, voir docs/11) : InterventionId | NumSerie | Materiel |
 *     PosteTechnique | TypeIntervention | Priorite | DateDemande | DemandePar | DateIntervention |
 *     DateFinPlanifiee | DureeHeures | Lieu | Impact | Consequences | Intervenant |
 *     CoupureCatenaire | CoupureDebut | CoupureFin | DateValidation | ValidePar | DateRealisation |
 *     Commentaires
 *     (Materiel/PosteTechnique/Priorite/DateFinPlanifiee : import d'un plan de maintenance externe
 *     type SAP — équipement hors du référentiel Materiels, fenêtre planifiée plutôt qu'un jour
 *     unique. NumSerie reste vide dans ce cas ; Materiel sert alors de titre d'affichage.)
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
          // Accès restreint aux seuls fichiers créés par l'application (photos de
          // contrôle) — pas un accès à l'ensemble du Drive de la personne connectée.
          "https://www.googleapis.com/auth/drive.file",
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
   * Normalise un N° de série pour la comparaison (espaces superflus, casse) :
   * un N° de série saisi à la main dans Controles ("ledr67 ") doit continuer à
   * correspondre à celui de Materiels ("LEDR67"), sans quoi le contrôle le plus
   * récent d'un matériel devient invisible (silencieusement ignoré) et
   * l'application retombe sur un contrôle plus ancien — voir docs/10 §9.
   */
  function normaliserNumSerie(valeur) {
    return String(valeur || "").trim().toLowerCase().replace(/\s+/g, " ");
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
    // Date localisée "JJ/MM/AAAA" (format renvoyé par l'API pour un classeur en
    // français) : traitée explicitement en JOUR/MOIS/ANNÉE, car le constructeur
    // natif new Date("JJ/MM/AAAA") l'interprète à tort comme MOIS/JOUR/ANNÉE
    // (anglo-saxon) — invalide (donc NaN) dès que le jour dépasse 12, et sinon
    // silencieusement faux (jour et mois inversés) le reste du temps.
    const jjmmaaaa = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (jjmmaaaa) {
      const [, jour, mois, annee] = jjmmaaaa;
      return `${annee}-${mois.padStart(2, "0")}-${jour.padStart(2, "0")}`;
    }
    const analysee = new Date(texte);
    if (!Number.isNaN(analysee.getTime())) return analysee.toISOString().slice(0, 10);
    return texte;
  }

  /** Convertit les lignes brutes de l'onglet Interventions (GMAO, optionnel — voir docs/11) en objets exploitables par l'application. */
  function interventionsDepuisLignes(lignes, materiels) {
    return lignesEnObjets(lignes).map((iv) => {
      const materiel = materiels.find((m) => normaliserNumSerie(m.numSerie) === normaliserNumSerie(iv.NumSerie)) || {};
      return {
        ligne: iv._ligne,
        id: iv.InterventionId || String(iv._ligne),
        materielId: materiel.id,
        // Priorité d'affichage : titre saisi/importé tel quel > nom du matériel lié > N° série brut > repère technique (voir docs/11).
        materiel: iv.Materiel || materiel.title || iv.NumSerie || iv.PosteTechnique || "",
        numSerie: iv.NumSerie || "",
        posteTechnique: iv.PosteTechnique || "",
        categorie: materiel.categorie || "",
        type: iv.TypeIntervention || "",
        priorite: iv.Priorite || "",
        dateDemande: normaliserDate(iv.DateDemande),
        demandePar: iv.DemandePar || "",
        dateIntervention: normaliserDate(iv.DateIntervention),
        dateFinPlanifiee: normaliserDate(iv.DateFinPlanifiee),
        dureeHeures: iv.DureeHeures !== "" && iv.DureeHeures !== undefined ? Number(iv.DureeHeures) : null,
        lieu: iv.Lieu || "",
        impact: iv.Impact || "",
        consequences: iv.Consequences || "",
        intervenant: iv.Intervenant || "",
        coupureCatenaire: estVrai(iv.CoupureCatenaire),
        coupureDebut: iv.CoupureDebut || "",
        coupureFin: iv.CoupureFin || "",
        dateValidation: normaliserDate(iv.DateValidation),
        validePar: iv.ValidePar || "",
        dateRealisation: normaliserDate(iv.DateRealisation),
        commentaires: iv.Commentaires || "",
        dateTheorique: normaliserDate(iv.DateTheorique),
        heureDebut: iv.HeureDebut || "",
        heureFin: iv.HeureFin || "",
      };
    });
  }

  /** Charge Materiels + TypesPointControle + Controles + ResultatsPointsControle + Utilisateurs + Ressources + Interventions. */
  async function chargerDonnees() {
    const [materielsRows, typesRows, controlesRows, resultatsRows, utilisateursRows, ressourcesRows, interventionsRows] = await Promise.all([
      obtenirValeurs(GOOGLE_CONFIG.feuilles.materiels),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.typesPointControle),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.controles),
      obtenirValeurs(GOOGLE_CONFIG.feuilles.resultatsPointsControle),
      obtenirValeursOptionnel(GOOGLE_CONFIG.feuilles.utilisateurs),
      obtenirValeursOptionnel(GOOGLE_CONFIG.feuilles.ressources),
      obtenirValeursOptionnel(GOOGLE_CONFIG.feuilles.interventions),
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
      const materiel = materiels.find((m) => normaliserNumSerie(m.numSerie) === normaliserNumSerie(c.NumSerie)) || {};
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
        photos: String(c.Photos || "").split(",").map((s) => s.trim()).filter(Boolean),
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

    const interventions = interventionsDepuisLignes(interventionsRows, materiels);

    return { materiels, typesPointControle, controles, utilisateurs, ressources, interventions };
  }

  /** Charge le journal des actions (onglet optionnel, voir docs/10 §2), le plus récent en premier. */
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

  /** Ajoute une entrée au journal des actions (voir docs/10 §2). N'échoue jamais bruyamment : un souci de journalisation ne doit pas bloquer l'action elle-même. */
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

  async function ecrireEntetes(nomFeuille, entetes) {
    const derniereColonne = String.fromCharCode(64 + entetes.length);
    const plage = `${nomFeuille}!A1:${derniereColonne}1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(plage)}?valueInputOption=USER_ENTERED`;
    await appelJson(url, { method: "PUT", body: JSON.stringify({ values: [entetes] }) });
  }

  const feuillesConfirmees = new Set();
  /**
   * Crée un onglet (avec ses en-têtes) s'il n'existe pas encore dans le
   * classeur, pour qu'un premier écriture n'échoue plus jamais avec
   * "Unable to parse range" faute d'onglet — les onglets Utilisateurs/Journal
   * sont facultatifs à la lecture (voir obtenirValeursOptionnel) mais doivent
   * exister pour pouvoir y écrire. Si l'onglet existe déjà mais que son
   * en-tête est plus court que le schéma attendu (ex. colonnes ajoutées à une
   * version ultérieure de l'appli, comme DateTheorique/HeureDebut/HeureFin —
   * voir docs/11 §11.8), complète l'en-tête manquant sans jamais toucher aux
   * lignes de données déjà présentes.
   */
  async function assurerFeuille(nomFeuille, entetes) {
    if (feuillesConfirmees.has(nomFeuille)) return;
    const feuilles = await listerFeuilles();
    if (!feuilles.includes(nomFeuille)) {
      await creerFeuille(nomFeuille);
      if (entetes && entetes.length) await ecrireEntetes(nomFeuille, entetes);
    } else if (entetes && entetes.length) {
      const ligneEntetes = await obtenirValeursOptionnel(`${nomFeuille}!1:1`);
      const entetesActuels = (ligneEntetes[0] || []).map((h) => String(h).trim());
      const incomplet = entetes.some((h, i) => entetesActuels[i] !== h);
      if (incomplet) await ecrireEntetes(nomFeuille, entetes);
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

  /** Ajoute plusieurs lignes en un seul appel réseau (plus rapide qu'un appel par ligne). Renvoie la réponse de l'API (utile pour connaître la ligne réelle où les valeurs ont atterri, voir ajouterIntervention). */
  async function ajouterLignes(feuille, lignesDeValeurs) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(feuille)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    return appelJson(url, { method: "POST", body: JSON.stringify({ values: lignesDeValeurs }) });
  }

  function ajouterMois(dateIso, nbMois) {
    const d = new Date(dateIso + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + nbMois);
    return d.toISOString().slice(0, 10);
  }

  let dossierPhotosIdCache = null;

  /** Recherche (puis crée si besoin) le dossier Google Drive dédié aux photos de contrôle. Mémorisé pour la session. Voir docs/10 §11. */
  async function assurerDossierPhotos() {
    if (dossierPhotosIdCache) return dossierPhotosIdCache;
    const nom = GOOGLE_CONFIG.dossierPhotosControles;
    const requete = `mimeType='application/vnd.google-apps.folder' and name='${nom.replace(/'/g, "\\'")}' and trashed=false`;
    const urlRecherche = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(requete)}&fields=files(id,name)`;
    const resultat = await appelJson(urlRecherche);
    if (resultat.files && resultat.files.length > 0) {
      dossierPhotosIdCache = resultat.files[0].id;
      return dossierPhotosIdCache;
    }
    const cree = await appelJson("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      body: JSON.stringify({ name: nom, mimeType: "application/vnd.google-apps.folder" }),
    });
    dossierPhotosIdCache = cree.id;
    return dossierPhotosIdCache;
  }

  function fichierEnBase64(fichier) {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(String(lecteur.result).split(",")[1] || "");
      lecteur.onerror = () => reject(new Error("Lecture du fichier impossible."));
      lecteur.readAsDataURL(fichier);
    });
  }

  /** Envoie une photo dans le dossier Drive dédié (scope drive.file : accès limité aux fichiers créés par l'application). */
  async function televerserPhoto(fichier, dossierId) {
    const base64 = await fichierEnBase64(fichier);
    const frontiere = "verifmateriel" + Date.now() + Math.random().toString(36).slice(2);
    const metadata = { name: fichier.name || `photo-${Date.now()}.jpg`, parents: [dossierId] };
    const corps =
      `--${frontiere}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${frontiere}\r\nContent-Type: ${fichier.type || "image/jpeg"}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64}\r\n` +
      `--${frontiere}--`;
    const json = await appelJson("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${frontiere}` },
      body: corps,
    });
    return json.webViewLink || `https://drive.google.com/file/d/${json.id}/view`;
  }

  /** Envoie plusieurs photos l'une après l'autre (simple et lisible côté API) ; renvoie leurs liens Drive. */
  async function televerserPhotos(fichiers, onProgression) {
    if (!fichiers || fichiers.length === 0) return [];
    const dossierId = await assurerDossierPhotos();
    const liens = [];
    for (let i = 0; i < fichiers.length; i++) {
      if (onProgression) onProgression({ index: i, total: fichiers.length });
      liens.push(await televerserPhoto(fichiers[i], dossierId));
    }
    return liens;
  }

  /**
   * Ajoute une ligne dans Controles, puis une ligne par point de contrôle
   * dans ResultatsPointsControle (docs/02 §2.6-2.7, docs/03 §3.7-3.8).
   */
  async function enregistrerControle({ materiel, dateControle, controleurNom, observations, actionsCorrectives, commentaires, points, photos, onProgressionPhotos }) {
    const conformeGlobal = points.every((p) => p.statut === "Conforme");
    const dateProchain = ajouterMois(dateControle, materiel.periodiciteMois || 6);
    const joursRestants = Math.ceil((new Date(dateProchain) - new Date(dateControle)) / 86400000);
    let statutGlobal = "Conforme";
    if (materiel.etat === "Hors service") statutGlobal = "Hors service";
    else if (!conformeGlobal) statutGlobal = "Non conforme";
    else if (joursRestants <= GOOGLE_CONFIG.seuilJours) statutGlobal = "À vérifier prochainement";

    const controleId = "C" + Date.now();
    const liensPhotos = await televerserPhotos(photos, onProgressionPhotos);

    await ajouterLigne(GOOGLE_CONFIG.feuilles.controles, [
      controleId, materiel.numSerie, dateControle, dateProchain, controleurNom,
      conformeGlobal ? "Oui" : "Non", statutGlobal, observations || "", actionsCorrectives || "", commentaires || "",
      liensPhotos.join(", "),
    ]);

    // Une ligne par point, en un seul appel réseau : Title | Controle | Effectue | Observation | PointControle | Rapport | Statut
    await ajouterLignes(
      GOOGLE_CONFIG.feuilles.resultatsPointsControle,
      points.map((point) => [
        point.libelle, controleId, "Oui", "", point.libelle,
        point.statut === "Conforme" ? "Validé" : "Non validé", point.statut,
      ])
    );

    return { id: controleId, statut: statutGlobal, conforme: conformeGlobal, dateProchainControle: dateProchain, photos: liensPhotos };
  }

  // -- Programmation GMAO : interventions/réparations (voir docs/11) --------
  const INTERVENTIONS_ENTETES = [
    "InterventionId", "NumSerie", "Materiel", "PosteTechnique", "TypeIntervention", "Priorite",
    "DateDemande", "DemandePar", "DateIntervention", "DateFinPlanifiee", "DureeHeures", "Lieu",
    "Impact", "Consequences", "Intervenant", "CoupureCatenaire", "CoupureDebut", "CoupureFin",
    "DateValidation", "ValidePar", "DateRealisation", "Commentaires",
    // Planification pratique (théorique → date réelle programmée, voir docs/11 §11.8) :
    // DateTheorique conserve la date d'origine du plan de maintenance, capturée
    // automatiquement lors de la première reprogrammation — jamais réécrite ensuite.
    "DateTheorique", "HeureDebut", "HeureFin",
  ];

  function ligneIntervention(iv) {
    return [
      iv.id, iv.numSerie || "", iv.materiel || "", iv.posteTechnique || "", iv.type || "", iv.priorite || "",
      iv.dateDemande || "", iv.demandePar || "", iv.dateIntervention || "", iv.dateFinPlanifiee || "",
      iv.dureeHeures ?? "", iv.lieu || "", iv.impact || "", iv.consequences || "", iv.intervenant || "",
      iv.coupureCatenaire ? "Oui" : "Non", iv.coupureDebut || "", iv.coupureFin || "",
      iv.dateValidation || "", iv.validePar || "", iv.dateRealisation || "", iv.commentaires || "",
      iv.dateTheorique || "", iv.heureDebut || "", iv.heureFin || "",
    ];
  }

  /**
   * Crée une demande d'intervention (étape 1 du circuit demande/validation —
   * voir docs/11). Déduit le numéro de ligne réel du classeur depuis la
   * réponse d'ajout (updatedRange) pour permettre de la valider/réaliser tout
   * de suite après, sans attendre une actualisation complète des données.
   */
  async function ajouterIntervention(iv) {
    await assurerFeuille(GOOGLE_CONFIG.feuilles.interventions, INTERVENTIONS_ENTETES);
    const id = "INT" + Date.now();
    const reponse = await ajouterLigne(GOOGLE_CONFIG.feuilles.interventions, ligneIntervention({ ...iv, id }));
    const plage = (reponse && reponse.updates && reponse.updates.updatedRange) || "";
    const correspondance = plage.match(/![A-Z]+(\d+):/);
    const ligne = correspondance ? Number(correspondance[1]) : null;
    return { id, ligne };
  }

  /**
   * Réécrit l'intégralité d'une ligne Interventions, identifiée par son
   * numéro de ligne réel dans le classeur (`ligne`, voir interventionsDepuisLignes) —
   * utilisée pour valider une demande ou la marquer réalisée (docs/11), sur le
   * même principe que modifierUtilisateur.
   */
  async function mettreAJourIntervention(ligne, iv) {
    await assurerFeuille(GOOGLE_CONFIG.feuilles.interventions, INTERVENTIONS_ENTETES);
    const derniereColonne = String.fromCharCode(64 + INTERVENTIONS_ENTETES.length); // "R"
    const plage = `${GOOGLE_CONFIG.feuilles.interventions}!A${ligne}:${derniereColonne}${ligne}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(plage)}?valueInputOption=USER_ENTERED`;
    await appelJson(url, { method: "PUT", body: JSON.stringify({ values: [ligneIntervention(iv)] }) });
  }

  /** Annule une demande d'intervention (vide sa ligne — les lignes vides sont ignorées à la lecture, comme supprimerUtilisateur). */
  async function supprimerIntervention(ligne) {
    const derniereColonne = String.fromCharCode(64 + INTERVENTIONS_ENTETES.length); // "R"
    const plage = `${GOOGLE_CONFIG.feuilles.interventions}!A${ligne}:${derniereColonne}${ligne}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.spreadsheetId}/values/${encodeURIComponent(plage)}:clear`;
    await appelJson(url, { method: "POST" });
  }

  /**
   * Convertit les lignes brutes de l'onglet "Interventions 2" (référentiel
   * équipements d'infrastructure, GMAO — voir docs/11 §11.7bis) en objets
   * exploitables. Onglet SANS ligne d'en-tête : colonne A=numéro de tri
   * (inutilisée par l'appli, sert seulement à ordonner manuellement les
   * catégories dans le classeur), B=Catégorie, C=Référence/numéro
   * d'intervention (poste technique), D=Type de maintenance, E=Matériel
   * concerné, F=(inutilisée), G=ZEP (zone), H=Conséquences.
   * Les colonnes B/C/D suivent une convention de cellule fusionnée : une ligne
   * vide y hérite de la dernière valeur non vide au-dessus, dans la même
   * colonne (confirmé avec l'utilisateur) — les colonnes A/F ne sont pas
   * utilisées par l'application.
   */
  function referentielInterventionsDepuisLignes(lignes) {
    let dernierCategorie = "", dernierReference = "", dernierType = "";
    const resultat = [];
    lignes.forEach((ligne) => {
      const categorie = String(ligne[1] || "").trim();
      const reference = String(ligne[2] || "").trim();
      const typeMaintenance = String(ligne[3] || "").trim();
      const materiel = String(ligne[4] || "").trim();
      const zep = String(ligne[6] || "").trim();
      const consequences = String(ligne[7] || "").trim();
      if (categorie) dernierCategorie = categorie;
      if (reference) dernierReference = reference;
      if (typeMaintenance) dernierType = typeMaintenance;
      if (!materiel) return; // ligne sans matériel concerné : rien à proposer dans la liste
      resultat.push({ categorie: dernierCategorie, reference: dernierReference, typeMaintenance: dernierType, materiel, zep, consequences });
    });
    return resultat;
  }

  /** Charge le référentiel équipements d'infrastructure (onglet optionnel "Interventions 2", voir docs/11 §11.7bis). */
  async function chargerReferentielInterventions() {
    const lignes = await obtenirValeursOptionnel(GOOGLE_CONFIG.feuilles.referentielInterventions);
    return referentielInterventionsDepuisLignes(lignes);
  }

  return {
    connecter, connecterSilencieux, estConnecte, deconnecter, utilisateurCourant, chargerDonnees,
    enregistrerControle, determinerRole, trouverUtilisateur,
    creerUtilisateur, modifierUtilisateur, supprimerUtilisateur,
    chargerJournal, enregistrerJournal,
    hacherMotDePasse, trouverUtilisateurParIdentifiant, verifierMotDePasse,
    ajouterIntervention, mettreAJourIntervention, supprimerIntervention,
    chargerReferentielInterventions,
  };
})();
