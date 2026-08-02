/**
 * app.js — Logique de l'interface du registre de vérifications.
 * Accueil à vignettes par catégorie, vue catégorie, tableau général,
 * fiche matériel avec historique, écran de contrôle avec écriture
 * Google Sheets réelle après connexion (ou simulation locale en mode
 * démonstration, actif par défaut avant connexion).
 */

(function () {
  "use strict";

  const STATUT_LABELS = {
    conforme:    { label: "Conforme",                 badge: "badge--ok",      row: "status-ok" },
    bientot:     { label: "À vérifier prochainement", badge: "badge--warn",    row: "status-warn" },
    nonconforme: { label: "Non conforme",              badge: "badge--danger", row: "status-danger" },
    hs:          { label: "Hors service",              badge: "badge--neutral", row: "status-neutral" },
  };
  const STATUT_CLE_PAR_LABEL = {
    "Conforme": "conforme", "À vérifier prochainement": "bientot",
    "Non conforme": "nonconforme", "Hors service": "hs",
  };

  // Programmation GMAO des interventions/réparations (voir docs/11).
  const INTERVENTION_STATUT_LABELS = {
    attente_validation: { label: "En attente de validation", badge: "badge--neutral" },
    planifiee:          { label: "Planifiée",                 badge: "badge--ok" },
    imminente:          { label: "Imminente",                 badge: "badge--warn" },
    retard:             { label: "En retard",                 badge: "badge--danger" },
    realisee:           { label: "Réalisée",                  badge: "badge--neutral" },
  };

  const state = {
    materiels: [],
    typesPointControle: {},
    controles: [],
    utilisateurs: [],
    ressources: [],
    photos: [],
    interventions: [],
    controleurs: [],
    journal: [],
    role: ROLE_PAR_DEFAUT,
    permissions: [],
    modeDemo: true,
    utilisateur: null,
    vue: "accueil",
    categorieCourante: null,
    materielControleCourant: null,
    pointsControleCourants: [],
    photosControleCourant: [],
    moisCalendrier: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    adminDeverrouille: false,
    adminUtilisateurCourant: null,
  };

  let currentSort = { key: "dateControle", dir: "desc" };
  const diaporama = { index: 0, enLecture: true, minuteur: null };
  // Mémorise quel contenu est affiché dans la fenêtre modale (#modalOverlay), pour
  // pouvoir le rafraîchir si les données changent pendant qu'elle est ouverte
  // (actualisation automatique en arrière-plan, bouton "Actualiser") — sans quoi la
  // fenêtre reste figée sur un instantané périmé alors que le reste de la page se
  // met à jour (voir docs/10 §9).
  let modalActuel = null;

  /** Vérifie une permission élémentaire (voir PERMISSIONS_CONFIG, js/google-config.js). */
  function aPermission(cle) {
    return state.permissions.includes(cle);
  }
  // Alias conservés pour lisibilité aux points d'appel les plus fréquents.
  function peutControler() { return aPermission("nouveauControle"); }

  /** Journalise une action (voir docs/10 §2) — silencieux en mode démonstration. */
  function journaliser(action) {
    const nomUtilisateur = (state.utilisateur && (state.utilisateur.nom || state.utilisateur.email)) || "Anonyme";
    if (state.modeDemo) {
      state.journal.unshift({ date: new Date().toISOString().slice(0, 10), heure: new Date().toTimeString().slice(0, 8), utilisateur: nomUtilisateur, action, ip: "(mode démonstration)" });
      return;
    }
    GoogleSheetsAPI.enregistrerJournal({ utilisateur: nomUtilisateur, action });
  }

  const CLE_DEJA_CONNECTE = "gsheets_deja_connecte";
  const CLE_DERNIERE_SAUVEGARDE = "derniere_sauvegarde_locale";
  const CLE_HISTORIQUE_SAUVEGARDES = "historique_sauvegardes_locales";

  // -- Durcissement sécurité (docs/10 §7) : anti-brute-force + expiration de session --
  const CLE_ECHECS_LOGIN_ADMIN = "admin_login_echecs";
  const MAX_TENTATIVES_LOGIN_ADMIN = 5;
  const DUREE_BLOCAGE_LOGIN_ADMIN_MS = 60 * 1000;
  const DUREE_INACTIVITE_ADMIN_MS = 10 * 60 * 1000;
  let minuteurInactiviteAdmin = null;

  function etatEchecsLoginAdmin() {
    try { return JSON.parse(localStorage.getItem(CLE_ECHECS_LOGIN_ADMIN)) || { compte: 0, dernierEchec: 0 }; }
    catch (e) { return { compte: 0, dernierEchec: 0 }; }
  }
  function enregistrerEchecLoginAdmin() {
    const etat = etatEchecsLoginAdmin();
    etat.compte += 1;
    etat.dernierEchec = Date.now();
    localStorage.setItem(CLE_ECHECS_LOGIN_ADMIN, JSON.stringify(etat));
  }
  function reinitialiserEchecsLoginAdmin() {
    localStorage.removeItem(CLE_ECHECS_LOGIN_ADMIN);
  }
  /** Renvoie le nombre de secondes de blocage restantes (0 = pas de blocage). Anti-brute-force léger — voir docs/10 §7. */
  function secondesBlocageLoginAdmin() {
    const etat = etatEchecsLoginAdmin();
    if (etat.compte < MAX_TENTATIVES_LOGIN_ADMIN) return 0;
    const restant = DUREE_BLOCAGE_LOGIN_ADMIN_MS - (Date.now() - etat.dernierEchec);
    if (restant <= 0) { reinitialiserEchecsLoginAdmin(); return 0; }
    return Math.ceil(restant / 1000);
  }

  /** Reprogramme le verrouillage automatique de l'écran Administration après inactivité (voir docs/10 §7). */
  function reinitialiserInactiviteAdmin() {
    clearTimeout(minuteurInactiviteAdmin);
    if (!state.adminDeverrouille) return;
    minuteurInactiviteAdmin = setTimeout(() => {
      if (!state.adminDeverrouille) return;
      journaliser(`Verrouillage automatique de l'écran Administration (inactivité) — ${(state.adminUtilisateurCourant || {}).nom || ""}`);
      state.adminDeverrouille = false;
      state.adminUtilisateurCourant = null;
      if (state.vue === "administration") afficherVue("accueil");
      afficherBanniere("🔒 Écran Administration verrouillé après 10 minutes d'inactivité.", "info");
    }, DUREE_INACTIVITE_ADMIN_MS);
  }
  const els = {};

  document.addEventListener("DOMContentLoaded", demarrer);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Best effort : l'application reste utilisable sans installation PWA ni mode hors-ligne.
      });
    });
  }

  ["mousemove", "keydown", "click", "touchstart", "scroll"].forEach((evt) =>
    document.addEventListener(evt, reinitialiserInactiviteAdmin, { passive: true })
  );

  async function demarrer() {
    cacherElements();
    lierEvenements();
    chargerDemo();
    peuplerFiltresTableau();
    peuplerFiltresInterventions();
    afficherVue("accueil");
    chargerPhotos();

    // Reconnexion automatique si l'utilisateur s'était déjà connecté lors
    // d'une session précédente sur ce navigateur (voir docs/09).
    if (localStorage.getItem(CLE_DEJA_CONNECTE) === "1" && GOOGLE_CONFIG.spreadsheetId !== "COLLEZ_ICI_L_ID_DE_VOTRE_CLASSEUR") {
      try {
        await connecterGoogle({ silencieux: true });
      } catch (e) {
        // Échec silencieux : on reste en mode démonstration, bouton "Se connecter" visible.
      }
    }
  }

  function cacherElements() {
    Object.assign(els, {
      bannerEtat: document.getElementById("bannerEtat"),
      headerSubtitle: document.getElementById("headerSubtitle"),
      breadcrumb: document.getElementById("breadcrumb"),
      crumbAccueil: document.getElementById("crumbAccueil"),
      crumbSep: document.getElementById("crumbSep"),
      crumbCourant: document.getElementById("crumbCourant"),
      viewAccueil: document.getElementById("viewAccueil"),
      viewCategorie: document.getElementById("viewCategorie"),
      viewTableau: document.getElementById("viewTableau"),
      viewControle: document.getElementById("viewControle"),
      viewCalendrier: document.getElementById("viewCalendrier"),
      viewRessources: document.getElementById("viewRessources"),
      viewAdministration: document.getElementById("viewAdministration"),
      adminLoginCarte: document.getElementById("adminLoginCarte"),
      adminContenu: document.getElementById("adminContenu"),
      formAdminLogin: document.getElementById("formAdminLogin"),
      adminIdentifiant: document.getElementById("adminIdentifiant"),
      adminMotDePasse: document.getElementById("adminMotDePasse"),
      btnMotDePasseOublie: document.getElementById("btnMotDePasseOublie"),
      motDePasseOublieTexte: document.getElementById("motDePasseOublieTexte"),
      adminConnecteEnTantQue: document.getElementById("adminConnecteEnTantQue"),
      btnVerrouillerAdmin: document.getElementById("btnVerrouillerAdmin"),
      formChangerMotDePasse: document.getElementById("formChangerMotDePasse"),
      changerNouveauMdp: document.getElementById("changerNouveauMdp"),
      changerNouveauMdpConfirm: document.getElementById("changerNouveauMdpConfirm"),
      administrationTableau: document.getElementById("administrationTableau"),
      btnExporterSauvegarde: document.getElementById("btnExporterSauvegarde"),
      fichierSauvegarde: document.getElementById("fichierSauvegarde"),
      sauvegardeApercu: document.getElementById("sauvegardeApercu"),
      sauvegardeHistorique: document.getElementById("sauvegardeHistorique"),
      formUtilisateur: document.getElementById("formUtilisateur"),
      nouvelEmail: document.getElementById("nouvelEmail"),
      nouveauNom: document.getElementById("nouveauNom"),
      nouveauRole: document.getElementById("nouveauRole"),
      nouvelIdentifiant: document.getElementById("nouvelIdentifiant"),
      nouveauMotDePasse: document.getElementById("nouveauMotDePasse"),
      nouvellesPermissions: document.getElementById("nouvellesPermissions"),
      journalTableau: document.getElementById("journalTableau"),
      tilesGrid: document.getElementById("tilesGrid"),
      cardsGrid: document.getElementById("cardsGrid"),
      roleBadge: document.getElementById("roleBadge"),
      calendrierGrille: document.getElementById("calendrierGrille"),
      calendrierTitre: document.getElementById("calendrierTitre"),
      btnMoisPrecedent: document.getElementById("btnMoisPrecedent"),
      btnMoisSuivant: document.getElementById("btnMoisSuivant"),
      ressourcesListe: document.getElementById("ressourcesListe"),
      viewGalerie: document.getElementById("viewGalerie"),
      galerieVide: document.getElementById("galerieVide"),
      galerieGrille: document.getElementById("galerieGrille"),
      galerieDiaporama: document.getElementById("galerieDiaporama"),
      galerieScene: document.getElementById("galerieScene"),
      galerieImage: document.getElementById("galerieImage"),
      galerieCompteur: document.getElementById("galerieCompteur"),
      btnGaleriePrecedent: document.getElementById("btnGaleriePrecedent"),
      btnGalerieLecture: document.getElementById("btnGalerieLecture"),
      btnGalerieSuivant: document.getElementById("btnGalerieSuivant"),
      galerieVitesse: document.getElementById("galerieVitesse"),
      btnGalerieZoom: document.getElementById("btnGalerieZoom"),
      btnGaleriePleinEcran: document.getElementById("btnGaleriePleinEcran"),
      btnGalerieFermer: document.getElementById("btnGalerieFermer"),
      zoneImpression: document.getElementById("zoneImpression"),
      dashboardExtra: document.getElementById("dashboardExtra"),
      tableBody: document.getElementById("tableBody"),
      emptyState: document.getElementById("emptyState"),
      resultCount: document.getElementById("resultCount"),
      search: document.getElementById("searchInput"),
      filterCategorie: document.getElementById("filterCategorie"),
      filterConforme: document.getElementById("filterConforme"),
      filterStatut: document.getElementById("filterStatut"),
      filterControleur: document.getElementById("filterControleur"),
      filterDateFrom: document.getElementById("filterDateFrom"),
      filterDateTo: document.getElementById("filterDateTo"),
      btnReset: document.getElementById("btnResetFilters"),
      btnExport: document.getElementById("btnExport"),
      btnTheme: document.getElementById("btnTheme"),
      btnGoogleConnect: document.getElementById("btnGoogleConnect"),
      btnActualiser: document.getElementById("btnActualiser"),
      table: document.getElementById("dataTable"),
      modalOverlay: document.getElementById("modalOverlay"),
      modalTitle: document.getElementById("modalTitle"),
      modalBody: document.getElementById("modalBody"),
      modalClose: document.getElementById("modalClose"),
      controleTitreMateriel: document.getElementById("controleTitreMateriel"),
      controleSousTitre: document.getElementById("controleSousTitre"),
      controleBadgeCategorie: document.getElementById("controleBadgeCategorie"),
      controleDate: document.getElementById("controleDate"),
      controleControleurSelect: document.getElementById("controleControleurSelect"),
      controlePointsListe: document.getElementById("controlePointsListe"),
      controleObservations: document.getElementById("controleObservations"),
      controleActions: document.getElementById("controleActions"),
      controleCommentaires: document.getElementById("controleCommentaires"),
      controlePhotos: document.getElementById("controlePhotos"),
      controlePhotosApercu: document.getElementById("controlePhotosApercu"),
      controleResultat: document.getElementById("controleResultat"),
      btnAnnulerControle: document.getElementById("btnAnnulerControle"),
      btnValiderControle: document.getElementById("btnValiderControle"),
      bandeauFlash: document.getElementById("bandeauFlash"),
      bandeauFlashPiste: document.getElementById("bandeauFlashPiste"),
      echeancesBanniere: document.getElementById("echeancesBanniere"),
      echeancesBanniereResume: document.getElementById("echeancesBanniereResume"),
      interventionsBanniere: document.getElementById("interventionsBanniere"),
      interventionsBanniereResume: document.getElementById("interventionsBanniereResume"),
      viewInterventions: document.getElementById("viewInterventions"),
      viewInterventionForm: document.getElementById("viewInterventionForm"),
      intervCardsGrid: document.getElementById("intervCardsGrid"),
      intervEmptyState: document.getElementById("intervEmptyState"),
      intervResultCount: document.getElementById("intervResultCount"),
      intervSearch: document.getElementById("intervSearch"),
      intervFilterCategorie: document.getElementById("intervFilterCategorie"),
      intervFilterType: document.getElementById("intervFilterType"),
      intervFilterStatut: document.getElementById("intervFilterStatut"),
      intervFilterDateFrom: document.getElementById("intervFilterDateFrom"),
      intervFilterDateTo: document.getElementById("intervFilterDateTo"),
      btnResetIntervFilters: document.getElementById("btnResetIntervFilters"),
      btnExportIntervCsv: document.getElementById("btnExportIntervCsv"),
      btnNouvelleIntervention: document.getElementById("btnNouvelleIntervention"),
      intervFormTitre: document.getElementById("intervFormTitre"),
      intervFormSousTitre: document.getElementById("intervFormSousTitre"),
      intervFormBadgeStatut: document.getElementById("intervFormBadgeStatut"),
      intervMaterielSelect: document.getElementById("intervMaterielSelect"),
      intervTypeSelect: document.getElementById("intervTypeSelect"),
      intervDate: document.getElementById("intervDate"),
      intervDuree: document.getElementById("intervDuree"),
      intervLieu: document.getElementById("intervLieu"),
      intervIntervenantSelect: document.getElementById("intervIntervenantSelect"),
      intervCoupureCatenaire: document.getElementById("intervCoupureCatenaire"),
      intervCoupureChamps: document.getElementById("intervCoupureChamps"),
      intervCoupureDebut: document.getElementById("intervCoupureDebut"),
      intervCoupureFin: document.getElementById("intervCoupureFin"),
      intervImpact: document.getElementById("intervImpact"),
      intervConsequences: document.getElementById("intervConsequences"),
      intervCommentaires: document.getElementById("intervCommentaires"),
      intervDemandeInfo: document.getElementById("intervDemandeInfo"),
      intervResultat: document.getElementById("intervResultat"),
      btnAnnulerIntervention: document.getElementById("btnAnnulerIntervention"),
      btnValiderNouvelleIntervention: document.getElementById("btnValiderNouvelleIntervention"),
    });
  }

  // -- Chargement des données (démonstration par défaut, Google Sheets après connexion) --
  function chargerDemo() {
    const demo = construireJeuDeDemonstration();
    Object.assign(state, demo);
    state.modeDemo = true;
    state.role = "Administrateur"; // toutes les fonctionnalités visibles en démonstration
    state.permissions = ROLES_CONFIG["Administrateur"].permissions.slice();
    state.controleurs = state.utilisateurs;
    state.utilisateur = { id: null, nom: "Utilisateur de démonstration", email: "" };
    state.journal = [
      { date: new Date().toISOString().slice(0, 10), heure: "08:12:00", utilisateur: "Amandine Roy", action: "Connexion", ip: "(exemple)" },
      { date: new Date().toISOString().slice(0, 10), heure: "08:15:42", utilisateur: "Julien Marchand", action: "Contrôle validé — LED bleu n°55", ip: "(exemple)" },
    ];
    els.headerSubtitle.textContent = "Mode démonstration — cliquez sur \"Se connecter avec Google\" pour vos données réelles";
    afficherBanniere("ℹ️ Mode démonstration — données d'exemple, aucune écriture réelle. Connectez-vous à Google pour vos vraies données.", "info");
    afficherRoleBadge();
  }

  function afficherRoleBadge() {
    if (!els.roleBadge) return;
    els.roleBadge.textContent = state.role;
    els.roleBadge.hidden = false;
    els.btnExport.hidden = !aPermission("exporterCsv");
  }

  async function connecterGoogle(options = {}) {
    const silencieux = !!options.silencieux;
    if (GOOGLE_CONFIG.spreadsheetId === "COLLEZ_ICI_L_ID_DE_VOTRE_CLASSEUR") {
      if (!silencieux) afficherBanniere("⚠️ Configuration incomplète : ajoutez l'ID de votre classeur dans js/google-config.js.", "warn");
      return;
    }
    if (!silencieux) {
      els.btnGoogleConnect.disabled = true;
      els.btnGoogleConnect.textContent = "Connexion…";
    }
    try {
      if (silencieux) await GoogleSheetsAPI.connecterSilencieux();
      else await GoogleSheetsAPI.connecter();

      const [donnees, utilisateur] = await Promise.all([
        GoogleSheetsAPI.chargerDonnees(),
        GoogleSheetsAPI.utilisateurCourant(),
      ]);
      state.modeDemo = false;
      state.utilisateur = utilisateur;
      appliquerDonnees(donnees);
      localStorage.setItem(CLE_DEJA_CONNECTE, "1");
      // Rafraîchit l'affichage (bandeau inclus) tout de suite après avoir appliqué les
      // données réelles, AVANT toute action annexe ci-dessous : si l'une d'elles échouait,
      // l'affichage ne devait pas rester bloqué sur son dernier rendu (mode démonstration
      // au premier chargement de la page) — voir docs/10 §9 (correctif bandeau figé en
      // mode démonstration après une reconnexion silencieuse).
      afficherVue("accueil");
      els.headerSubtitle.textContent = `Connecté à Google Sheets — ${state.utilisateur.nom}`;
      els.btnGoogleConnect.textContent = "✅ Connecté";
      afficherBanniere("✅ Connecté à Google Sheets — les données affichées sont réelles et le bouton \"Valider le contrôle\" écrit dans votre classeur.", "info");
      try { afficherRoleBadge(); } catch (e) { console.error(e); }
      try { peuplerFiltresTableau(); } catch (e) { console.error(e); }
      try { peuplerFiltresInterventions(); } catch (e) { console.error(e); }
      try { journaliser("Connexion"); } catch (e) { console.error(e); }
      GoogleSheetsAPI.chargerJournal().then((j) => { state.journal = j; if (state.vue === "administration") renderAdministration(); }).catch(() => {});
    } catch (e) {
      console.error(e);
      if (!silencieux) {
        els.btnGoogleConnect.disabled = false;
        els.btnGoogleConnect.textContent = "🔑 Se connecter avec Google";
        afficherBanniere("⚠️ Connexion à Google impossible : " + e.message, "warn");
      }
      throw e;
    }
  }

  /** Applique un jeu de données fraîchement chargé (utilisé par la connexion et par l'actualisation manuelle/automatique). */
  function appliquerDonnees(donnees) {
    Object.assign(state, donnees);
    state.controleurs = donnees.utilisateurs.filter((u) => (u.permissions || []).includes("nouveauControle"));
    if (state.utilisateur && state.utilisateur.email) {
      // Utilise le nom déclaré dans l'onglet Utilisateurs (ex. "PATON ROMUALD") plutôt
      // que le nom du compte Google, s'il est renseigné.
      const ligneUtilisateur = GoogleSheetsAPI.trouverUtilisateur(state.utilisateur.email, donnees.utilisateurs);
      if (ligneUtilisateur && ligneUtilisateur.nom) state.utilisateur.nom = ligneUtilisateur.nom;
      state.role = GoogleSheetsAPI.determinerRole(state.utilisateur.email, donnees.utilisateurs);
      state.permissions = ligneUtilisateur ? ligneUtilisateur.permissions : (ROLES_CONFIG[state.role] || ROLES_CONFIG[ROLE_PAR_DEFAUT]).permissions;
    }
  }

  /**
   * Recharge les données depuis Google Sheets sans repasser par la connexion
   * OAuth (le jeton d'accès obtenu au clic sur "Se connecter" reste valide en
   * mémoire) — bouton "🔄 Actualiser" et actualisation automatique en
   * arrière-plan (voir DUREE_ACTUALISATION_AUTO_MS).
   */
  // Empêche deux actualisations de tourner en même temps (ex. l'auto-actualisation
  // toutes les 60 s qui chevauche un clic manuel sur "Actualiser") : sans ce verrou,
  // la requête qui termine en DERNIER écrase l'affichage avec ses données, même si
  // elle a été lancée AVANT l'autre — source d'incohérences entre le bandeau et une
  // fenêtre modale ouverte au même moment (voir docs/10 §9).
  let actualisationEnCours = false;

  async function actualiserDonnees(options = {}) {
    const silencieux = !!options.silencieux;
    if (state.modeDemo) {
      if (!silencieux) afficherBanniere("ℹ️ Mode démonstration : aucune donnée réelle à actualiser. Connectez-vous avec Google.", "info");
      return;
    }
    if (actualisationEnCours) {
      if (!silencieux) afficherBanniere("ℹ️ Actualisation déjà en cours, patientez un instant.", "info");
      return;
    }
    if (state.vue === "controle" && !silencieux) {
      if (!confirm("Une saisie de contrôle est en cours. Actualiser les données depuis Google Sheets maintenant ? La saisie non enregistrée sera perdue.")) return;
    }
    actualisationEnCours = true;
    if (!silencieux) {
      els.btnActualiser.disabled = true;
      els.btnActualiser.textContent = "🔄 Actualisation…";
    }
    try {
      const donnees = await GoogleSheetsAPI.chargerDonnees();
      appliquerDonnees(donnees);
      // Rafraîchit l'affichage tout de suite après avoir appliqué les données, AVANT les
      // actions annexes ci-dessous : si l'une d'elles échouait, le bandeau/la vue ne
      // devaient pas rester bloqués sur leur dernier rendu — voir docs/10 §9.
      if (!["controle"].includes(state.vue)) {
        afficherVue(state.vue, { categorie: state.categorieCourante });
      } else {
        renderStatsGlobales();
        renderBandeauFlash();
      }
      rafraichirModalOuvert();
      try { peuplerFiltresTableau(); } catch (e) { console.error(e); }
      try { peuplerFiltresInterventions(); } catch (e) { console.error(e); }
      try { afficherRoleBadge(); } catch (e) { console.error(e); }
      if (state.adminDeverrouille) GoogleSheetsAPI.chargerJournal().then((j) => { state.journal = j; }).catch(() => {});
      if (!silencieux) afficherBanniere("✅ Données actualisées depuis Google Sheets.", "info");
    } catch (e) {
      console.error(e);
      if (!silencieux) afficherBanniere("⚠️ Erreur lors de l'actualisation : " + e.message, "warn");
    } finally {
      actualisationEnCours = false;
      if (!silencieux) {
        els.btnActualiser.disabled = false;
        els.btnActualiser.textContent = "🔄 Actualiser";
      }
    }
  }

  // Actualisation automatique en arrière-plan (voir docs/10 §9) : pas d'interruption
  // pendant une saisie de contrôle ou une édition en cours dans Administration.
  const DUREE_ACTUALISATION_AUTO_MS = 60 * 1000;
  setInterval(() => {
    if (!state.modeDemo && !["controle", "administration"].includes(state.vue)) {
      actualiserDonnees({ silencieux: true });
    }
  }, DUREE_ACTUALISATION_AUTO_MS);

  function afficherBanniere(texte, type) {
    els.bannerEtat.textContent = texte;
    els.bannerEtat.className = "banner banner--" + type;
    els.bannerEtat.hidden = false;
  }

  function afficherChargement(actif) {
    document.body.style.cursor = actif ? "wait" : "";
  }

  // -- Navigation entre vues --------------------------------------------------
  const VUES_RESTREINTES = { tableau: "tableauBord", calendrier: "calendrier", ressources: "ressources", galerie: "galerie", interventions: "interventions" };

  function afficherVue(vue, options = {}) {
    if (VUES_RESTREINTES[vue] && !aPermission(VUES_RESTREINTES[vue])) {
      afficherBanniere("⛔ Vous n'avez pas la permission d'accéder à cette section.", "warn");
      vue = "accueil";
    }
    state.vue = vue;
    els.viewAccueil.hidden = vue !== "accueil";
    els.viewCategorie.hidden = vue !== "categorie";
    els.viewTableau.hidden = vue !== "tableau";
    els.viewControle.hidden = vue !== "controle";
    els.viewCalendrier.hidden = vue !== "calendrier";
    els.viewRessources.hidden = vue !== "ressources";
    els.viewGalerie.hidden = vue !== "galerie";
    els.viewAdministration.hidden = vue !== "administration";
    els.viewInterventions.hidden = vue !== "interventions";
    els.viewInterventionForm.hidden = vue !== "interventionForm";

    if (vue === "accueil") {
      els.crumbSep.hidden = true;
      els.crumbCourant.textContent = "";
      renderTuiles();
    } else if (vue === "categorie") {
      state.categorieCourante = options.categorie;
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = options.categorie;
      renderCartesCategorie(options.categorie);
    } else if (vue === "tableau") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Tableau général";
      renderDashboardExtra();
      renderTableau();
    } else if (vue === "controle") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Nouveau contrôle";
    } else if (vue === "calendrier") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Calendrier des contrôles";
      renderCalendrier();
    } else if (vue === "ressources") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Ressources";
      renderRessources();
    } else if (vue === "galerie") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Galerie photos";
      renderGalerieGrille();
    } else if (vue === "administration") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Administration des utilisateurs";
      renderAdministration();
    } else if (vue === "interventions") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Interventions";
      renderInterventions();
    } else if (vue === "interventionForm") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Nouvelle intervention";
    }
    renderStatsGlobales();
    renderBandeauFlash();
  }

  function lierEvenements() {
    els.crumbAccueil.addEventListener("click", () => afficherVue("accueil"));

    [els.search, els.filterCategorie, els.filterConforme, els.filterStatut,
     els.filterControleur, els.filterDateFrom, els.filterDateTo].forEach((el) =>
      el.addEventListener("input", renderTableau)
    );
    els.btnReset.addEventListener("click", () => {
      els.search.value = ""; els.filterCategorie.value = ""; els.filterConforme.value = "";
      els.filterStatut.value = ""; els.filterControleur.value = ""; els.filterDateFrom.value = ""; els.filterDateTo.value = "";
      renderTableau();
    });
    els.btnExport.addEventListener("click", exporterCsv);
    els.btnTheme.addEventListener("click", toggleTheme);
    els.btnGoogleConnect.addEventListener("click", connecterGoogle);
    els.btnActualiser.addEventListener("click", () => actualiserDonnees());
    els.table.querySelectorAll("thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        currentSort.dir = currentSort.key === key && currentSort.dir === "asc" ? "desc" : "asc";
        currentSort.key = key;
        renderTableau();
      });
    });

    els.modalClose.addEventListener("click", fermerModal);
    els.modalOverlay.addEventListener("click", (e) => { if (e.target === els.modalOverlay) fermerModal(); });
    els.echeancesBanniere.addEventListener("click", ouvrirFenetreEcheances);
    els.interventionsBanniere.addEventListener("click", () => {
      afficherVue("interventions");
      els.intervFilterStatut.value = "retard";
      renderInterventions();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      fermerModal();
      if (!els.galerieDiaporama.hidden) fermerDiaporama();
    });

    els.btnGaleriePrecedent.addEventListener("click", diaporamaPrecedent);
    els.btnGalerieSuivant.addEventListener("click", diaporamaSuivant);
    els.btnGalerieLecture.addEventListener("click", toggleLectureDiaporama);
    els.galerieVitesse.addEventListener("change", demarrerMinuteurDiaporama);
    els.btnGalerieZoom.addEventListener("click", toggleZoomDiaporama);
    els.galerieImage.addEventListener("click", toggleZoomDiaporama);
    els.btnGaleriePleinEcran.addEventListener("click", toggleFullscreenDiaporama);
    els.btnGalerieFermer.addEventListener("click", fermerDiaporama);

    els.btnAnnulerControle.addEventListener("click", () => afficherVue("categorie", { categorie: state.categorieCourante || (state.materielControleCourant || {}).categorie }));
    els.btnValiderControle.addEventListener("click", validerControle);
    els.controlePhotos.addEventListener("change", () => {
      state.photosControleCourant.push(...els.controlePhotos.files);
      els.controlePhotos.value = "";
      renderPhotosApercu();
    });

    els.btnMoisPrecedent.addEventListener("click", () => {
      state.moisCalendrier.setMonth(state.moisCalendrier.getMonth() - 1);
      renderCalendrier();
    });
    els.btnMoisSuivant.addEventListener("click", () => {
      state.moisCalendrier.setMonth(state.moisCalendrier.getMonth() + 1);
      renderCalendrier();
    });

    // -- Interventions (programmation GMAO, voir docs/11) --------------------
    [els.intervSearch, els.intervFilterCategorie, els.intervFilterType, els.intervFilterStatut,
     els.intervFilterDateFrom, els.intervFilterDateTo].forEach((el) =>
      el.addEventListener("input", renderInterventions)
    );
    els.btnResetIntervFilters.addEventListener("click", () => {
      els.intervSearch.value = ""; els.intervFilterCategorie.value = ""; els.intervFilterType.value = "";
      els.intervFilterStatut.value = ""; els.intervFilterDateFrom.value = ""; els.intervFilterDateTo.value = "";
      renderInterventions();
    });
    els.btnExportIntervCsv.addEventListener("click", exporterCsvInterventions);
    els.btnNouvelleIntervention.addEventListener("click", () => ouvrirEcranNouvelleIntervention());
    els.btnAnnulerIntervention.addEventListener("click", () => afficherVue("interventions"));
    els.btnValiderNouvelleIntervention.addEventListener("click", validerNouvelleIntervention);
    els.intervCoupureCatenaire.addEventListener("change", () => {
      els.intervCoupureChamps.hidden = !els.intervCoupureCatenaire.checked;
    });

    Object.keys(ROLES_CONFIG).forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r; opt.textContent = r;
      els.nouveauRole.appendChild(opt);
    });
    renderPermissionsFormulaireAjout();
    els.nouveauRole.addEventListener("change", () => renderPermissionsFormulaireAjout());
    els.formUtilisateur.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const permissions = permissionsCocheesDans(els.nouvellesPermissions);
        const identifiant = els.nouvelIdentifiant.value.trim();
        const motDePasse = els.nouveauMotDePasse.value;
        const motDePasseHash = identifiant && motDePasse ? await GoogleSheetsAPI.hacherMotDePasse(identifiant, motDePasse) : "";
        await creerUtilisateurAction(els.nouvelEmail.value.trim().toLowerCase(), els.nouveauNom.value.trim(), els.nouveauRole.value, permissions, identifiant, motDePasseHash);
      } catch (e) {
        // Filet de sécurité : une page mise en cache par le service worker et pas encore
        // rafraîchie peut désynchroniser index.html/js/app.js (élément manquant, etc.).
        console.error(e);
        afficherBanniere("⚠️ Erreur inattendue lors de l'ajout : " + e.message + " — essayez de recharger la page (Ctrl+Maj+R / Cmd+Maj+R) puis réessayez.", "warn");
      }
    });

    els.formAdminLogin.addEventListener("submit", async (e) => {
      e.preventDefault();

      const blocage = secondesBlocageLoginAdmin();
      if (blocage > 0) {
        afficherBanniere(`⛔ Trop de tentatives incorrectes. Réessayez dans ${blocage} seconde${blocage > 1 ? "s" : ""}.`, "warn");
        return;
      }

      const identifiant = els.adminIdentifiant.value.trim();
      const motDePasse = els.adminMotDePasse.value;
      let utilisateurConnecte = null;

      if (!state.modeDemo) {
        utilisateurConnecte = await GoogleSheetsAPI.verifierMotDePasse(identifiant, motDePasse, state.utilisateurs);
      } else {
        // Mode démonstration : aucun hash Sheets disponible, on compare le mot de passe fictif déclaré localement (data.js).
        const trouve = state.utilisateurs.find((u) => u.identifiant && u.identifiant.toLowerCase() === identifiant.toLowerCase());
        if (trouve && trouve.motDePasseDemo === motDePasse) utilisateurConnecte = trouve;
      }

      const secours = identifiant === ADMIN_AUTH.identifiant && motDePasse === ADMIN_AUTH.motDePasse;

      if (utilisateurConnecte || secours) {
        reinitialiserEchecsLoginAdmin();
        state.adminDeverrouille = true;
        state.adminUtilisateurCourant = utilisateurConnecte || { nom: "Administrateur (identifiant de secours)", identifiant: ADMIN_AUTH.identifiant, ligne: null };
        els.formAdminLogin.reset();
        els.motDePasseOublieTexte.hidden = true;
        renderAdministration();
        reinitialiserInactiviteAdmin();
        journaliser(`Connexion à l'écran Administration — ${state.adminUtilisateurCourant.nom}`);
      } else {
        enregistrerEchecLoginAdmin();
        const restant = secondesBlocageLoginAdmin();
        afficherBanniere(restant > 0
          ? `⛔ Trop de tentatives incorrectes. Réessayez dans ${restant} secondes.`
          : "⛔ Identifiant ou mot de passe incorrect.", "warn");
      }
    });

    els.btnMotDePasseOublie.addEventListener("click", () => {
      els.motDePasseOublieTexte.hidden = !els.motDePasseOublieTexte.hidden;
    });

    els.btnVerrouillerAdmin.addEventListener("click", () => {
      journaliser(`Verrouillage de l'écran Administration — ${(state.adminUtilisateurCourant || {}).nom || ""}`);
      clearTimeout(minuteurInactiviteAdmin);
      state.adminDeverrouille = false;
      state.adminUtilisateurCourant = null;
      afficherVue("accueil");
    });

    els.formChangerMotDePasse.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nouveau = els.changerNouveauMdp.value;
      const confirmation = els.changerNouveauMdpConfirm.value;
      if (nouveau !== confirmation) { afficherBanniere("⚠️ Les deux mots de passe ne correspondent pas.", "warn"); return; }
      await changerMotDePasseAction(nouveau);
    });

    els.btnExporterSauvegarde.addEventListener("click", exporterSauvegarde);
    els.fichierSauvegarde.addEventListener("change", () => {
      const fichier = els.fichierSauvegarde.files[0];
      if (fichier) importerApercuSauvegarde(fichier);
    });

    applyTheme(localStorage.getItem("theme") || "light");
  }

  // -- Statistiques globales (bandeau du haut, toujours visible) -------------
  function statutDeControle(controle) {
    if (controle.statut && STATUT_CLE_PAR_LABEL[controle.statut]) return STATUT_CLE_PAR_LABEL[controle.statut];
    return calculerStatut(controle);
  }

  /** Dernier contrôle connu pour un matériel (ou null si jamais contrôlé). */
  function dernierControle(materielId) {
    const historique = state.controles.filter((c) => c.materielId === materielId);
    if (!historique.length) return null;
    return historique.reduce((a, b) => (a.dateControle > b.dateControle ? a : b));
  }

  // -- Programmation GMAO des interventions/réparations (voir docs/11) -------
  /** Jours restants avant la date d'intervention prévue (négatif = en retard), ou null si aucune date. */
  function joursRestantsIntervention(iv) {
    if (!iv.dateIntervention) return null;
    return Math.ceil((new Date(iv.dateIntervention) - new Date()) / 86400000);
  }

  /**
   * Statut calculé d'une intervention (jamais stocké tel quel) : circuit de
   * validation à deux étapes (demande → validation par un Administrateur),
   * puis suivi de l'échéance jusqu'à ce qu'elle soit marquée réalisée.
   */
  function statutIntervention(iv) {
    if (iv.dateRealisation) return "realisee";
    if (!iv.dateValidation) return "attente_validation";
    const j = joursRestantsIntervention(iv);
    if (j === null) return "planifiee";
    if (j < 0) return "retard";
    if (j <= GOOGLE_CONFIG.seuilInterventionImminenteJours) return "imminente";
    return "planifiee";
  }

  function renderStatsGlobales() {
    const derniers = state.materiels.map((m) => dernierControle(m.id)).filter(Boolean);
    const counts = { conforme: 0, bientot: 0, nonconforme: 0, hs: 0 };
    derniers.forEach((c) => counts[statutDeControle(c)]++);
    const total = state.materiels.length;
    const taux = derniers.length ? Math.round((counts.conforme / derniers.length) * 100) : 0;

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statConforme").textContent = counts.conforme;
    document.getElementById("statBientot").textContent = counts.bientot;
    document.getElementById("statNonConforme").textContent = counts.nonconforme;
    document.getElementById("statHorsService").textContent = counts.hs;
    document.getElementById("statTaux").textContent = `${taux}%`;
  }

  // -- Bandeau flash info : échéances proches, défilant façon chaîne d'info ---
  function renderBandeauFlash() {
    if (!els.bandeauFlash) return;
    const maintenant = new Date();
    const clicable = aPermission("historique");
    const clicableInterventions = aPermission("interventions");
    const itemsControles = state.materiels.map((m) => {
      const c = dernierControle(m.id);
      if (!c || !c.dateProchainControle) return null;
      const echeance = new Date(c.dateProchainControle);
      const joursRestants = Math.ceil((echeance - maintenant) / 86400000);
      if (joursRestants > GOOGLE_CONFIG.seuilBandeauJours) return null;
      let classeCouleur = "bandeau-flash__item--vert";
      let clignote = false;
      if (joursRestants <= 2) { classeCouleur = "bandeau-flash__item--rouge"; clignote = true; }
      else if (joursRestants <= 7) classeCouleur = "bandeau-flash__item--rouge";
      else if (joursRestants <= 30) classeCouleur = "bandeau-flash__item--orange";
      const nomAffiche = `${m.title} (N° ${m.numSerie || "?"})`;
      const texte = joursRestants < 0
        ? `⚠ ${nomAffiche} — en retard de ${Math.abs(joursRestants)} jour${Math.abs(joursRestants) > 1 ? "s" : ""}`
        : `⚠ ${nomAffiche} — expire dans ${joursRestants} jour${joursRestants > 1 ? "s" : ""}`;
      return { materielId: m.id, texte, classeCouleur, clignote };
    }).filter(Boolean);

    // Rappel GMAO (voir docs/11) : visible de partout dans l'application, comme
    // les échéances de contrôle — seule la consultation détaillée (clic) est
    // soumise à la permission "interventions", pas l'affichage du rappel lui-même
    // (information de sécurité, ex. coupure caténaire à venir).
    const itemsInterventions = state.interventions.filter((iv) => !iv.dateRealisation).map((iv) => {
      const j = joursRestantsIntervention(iv);
      if (j === null) return null;
      const enRetard = j < 0;
      const imminente = !enRetard && j <= GOOGLE_CONFIG.seuilInterventionImminenteJours;
      if (!enRetard && !imminente) return null;
      const nomAffiche = `${iv.materiel || iv.numSerie} — ${iv.type || "Intervention"}`;
      const texte = enRetard
        ? `🔧 ${nomAffiche} — en retard de ${Math.abs(j)} jour${Math.abs(j) > 1 ? "s" : ""}`
        : `🔧 ${nomAffiche} — prévue dans ${j} jour${j > 1 ? "s" : ""}`;
      return {
        interventionId: iv.id, texte,
        classeCouleur: enRetard ? "bandeau-flash__item--rouge" : "bandeau-flash__item--orange",
        clignote: enRetard,
      };
    }).filter(Boolean);

    const items = [...itemsInterventions, ...itemsControles];

    if (items.length === 0) {
      els.bandeauFlash.hidden = true;
      els.bandeauFlashPiste.innerHTML = "";
      document.body.classList.remove("a-bandeau-flash");
      return;
    }
    els.bandeauFlash.hidden = false;
    document.body.classList.add("a-bandeau-flash");
    els.bandeauFlashPiste.style.animationDuration = Math.max(18, items.length * 6) + "s";
    const html = items.map((it) => {
      const estIntervention = it.interventionId !== undefined;
      const peutCliquer = estIntervention ? clicableInterventions : clicable;
      const attribut = estIntervention ? `data-intervention="${it.interventionId}"` : `data-materiel="${it.materielId}"`;
      return `<button type="button" class="bandeau-flash__item ${it.classeCouleur} ${it.clignote ? "bandeau-flash__item--clignote" : ""} ${peutCliquer ? "" : "bandeau-flash__item--non-cliquable"}" ${attribut}>${escapeHtml(it.texte)}</button>`;
    }).join("");
    // Contenu dupliqué : le défilement (translateX -50%) boucle sans coupure visible.
    els.bandeauFlashPiste.innerHTML = html + html;
    els.bandeauFlashPiste.querySelectorAll(".bandeau-flash__item").forEach((btn) => {
      if (btn.dataset.intervention !== undefined) {
        if (clicableInterventions) btn.addEventListener("click", () => ouvrirDetailIntervention(idDepuisAttribut(btn.dataset.intervention)));
      } else if (clicable) {
        btn.addEventListener("click", () => ouvrirFicheMateriel(Number(btn.dataset.materiel)));
      }
    });
  }

  /** Un ID d'intervention est numérique en mode démonstration, texte ("INT…") en mode connecté — reconvertit depuis un attribut data-* (toujours une chaîne). */
  function idDepuisAttribut(valeur) {
    const nombre = Number(valeur);
    return Number.isNaN(nombre) ? valeur : nombre;
  }

  /** Bannière rouge d'accueil, visible seulement s'il existe des interventions GMAO en retard (voir docs/11). */
  function renderInterventionsBanniere() {
    if (!els.interventionsBanniere) return;
    if (!aPermission("interventions")) { els.interventionsBanniere.hidden = true; return; }
    const enRetard = state.interventions
      .filter((iv) => statutIntervention(iv) === "retard")
      .sort((a, b) => (a.dateIntervention < b.dateIntervention ? -1 : 1));
    if (enRetard.length === 0) { els.interventionsBanniere.hidden = true; return; }

    const apercu = enRetard.slice(0, 3).map((iv) => `${iv.materiel} (${Math.abs(joursRestantsIntervention(iv))} j)`);
    if (enRetard.length > 3) apercu.push(`+${enRetard.length - 3} autre${enRetard.length - 3 > 1 ? "s" : ""}`);
    els.interventionsBanniereResume.textContent = apercu.join(" · ");
    els.interventionsBanniere.hidden = false;
  }

  /** Fenêtre "Échéances" : liste complète des matériels avec jours restants, triée par urgence et mise en forme couleur (voir docs/10 §10). */
  /** Bannière d'accueil (format pleine largeur, distinct des vignettes) ouvrant la fenêtre Échéances. */
  function renderEcheancesBanniere() {
    if (!els.echeancesBanniere) return;
    if (!aPermission("historique") || state.materiels.length === 0) { els.echeancesBanniere.hidden = true; return; }

    const maintenant = new Date();
    let enRetard = 0, urgent = 0, aSurveiller = 0;
    state.materiels.forEach((m) => {
      const c = dernierControle(m.id);
      if (!c || !c.dateProchainControle) return;
      const j = Math.ceil((new Date(c.dateProchainControle) - maintenant) / 86400000);
      if (j < 0) enRetard++;
      else if (j <= 7) urgent++;
      else if (j <= 30) aSurveiller++;
    });

    const parties = [];
    if (enRetard) parties.push(`${enRetard} en retard`);
    if (urgent) parties.push(`${urgent} urgent${urgent > 1 ? "s" : ""} (≤ 7 j)`);
    if (aSurveiller) parties.push(`${aSurveiller} à surveiller (≤ 30 j)`);
    els.echeancesBanniereResume.textContent = parties.length ? parties.join(" · ") : "Aucune échéance proche — tout est à jour.";
    els.echeancesBanniere.hidden = false;
  }

  function ouvrirFenetreEcheances() {
    modalActuel = { type: "echeances" };
    const maintenant = new Date();
    const clicable = aPermission("historique");

    const lignes = state.materiels.map((m) => {
      const c = dernierControle(m.id);
      if (!c || !c.dateProchainControle) return { materiel: m, joursRestants: null };
      const echeance = new Date(c.dateProchainControle);
      const joursRestants = Math.ceil((echeance - maintenant) / 86400000);
      return { materiel: m, joursRestants, dateProchainControle: c.dateProchainControle };
    }).sort((a, b) => {
      if (a.joursRestants === null) return 1;
      if (b.joursRestants === null) return -1;
      return a.joursRestants - b.joursRestants;
    });

    const classeEtLabelPourJours = (j) => {
      if (j <= 2) return { classe: "echeances-liste__pastille--rouge", label: j < 0 ? `En retard de ${Math.abs(j)} j` : `${j} j (urgent)` };
      if (j <= 7) return { classe: "echeances-liste__pastille--rouge", label: `${j} j` };
      if (j <= 30) return { classe: "echeances-liste__pastille--orange", label: `${j} j` };
      return { classe: "echeances-liste__pastille--vert", label: `${j} j` };
    };

    // Détecte les intitulés en double (même "Title" pour plusieurs lignes Materiels,
    // donc plusieurs N° de série différents) : cause fréquente d'incohérence entre le
    // bandeau et cette fenêtre, chacune des deux lignes ayant son propre historique de
    // contrôles et donc sa propre échéance — voir docs/10 §9.
    const titresComptes = {};
    const titresOriginaux = {};
    state.materiels.forEach((m) => {
      const cle = String(m.title || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!cle) return;
      titresComptes[cle] = (titresComptes[cle] || 0) + 1;
      if (!titresOriginaux[cle]) titresOriginaux[cle] = m.title;
    });
    const nomsEnDouble = Object.keys(titresComptes).filter((cle) => titresComptes[cle] > 1).map((cle) => titresOriginaux[cle]);

    els.modalTitle.textContent = "📋 Échéances des contrôles";
    els.modalBody.innerHTML = `
      <p class="admin-login-texte">${lignes.length} matériel${lignes.length > 1 ? "s" : ""}, du plus urgent au plus tranquille.</p>
      ${nomsEnDouble.length ? `<p class="admin-login-texte" style="color:var(--color-warn);font-weight:600;">⚠️ Nom(s) présent(s) sur plusieurs lignes de l'onglet Materiels, avec des N° de série différents (visibles sous chaque nom ci-dessous) : ${nomsEnDouble.map(escapeHtml).join(", ")}. Chaque ligne garde son propre historique et son propre délai — vérifiez s'il ne s'agit pas d'une ligne en double à supprimer/fusionner.</p>` : ""}
      <div class="echeances-liste">
        ${lignes.map((l) => {
          const info = l.joursRestants === null ? { classe: "echeances-liste__pastille--neutre", label: "Jamais contrôlé" } : classeEtLabelPourJours(l.joursRestants);
          return `
            <button type="button" class="echeances-liste__ligne ${clicable ? "" : "echeances-liste__ligne--non-cliquable"}" data-materiel="${l.materiel.id}" ${clicable ? "" : "disabled"}>
              <span class="echeances-liste__pastille ${info.classe}"></span>
              <span class="echeances-liste__nom">${escapeHtml(l.materiel.title)}<small class="echeances-liste__numserie">N° ${escapeHtml(l.materiel.numSerie || "?")}</small></span>
              <span class="echeances-liste__categorie">${escapeHtml(l.materiel.categorie)}</span>
              <span class="echeances-liste__jours ${info.classe}">${escapeHtml(info.label)}</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
    if (clicable) {
      els.modalBody.querySelectorAll(".echeances-liste__ligne").forEach((ligne) => {
        ligne.addEventListener("click", () => { fermerModal(); ouvrirFicheMateriel(Number(ligne.dataset.materiel)); });
      });
    }
    els.modalOverlay.hidden = false;
  }

  // -- Tableau de bord : indicateurs complémentaires + graphiques -------------
  function genererGraphiqueBarres(items) {
    const max = Math.max(1, ...items.map((i) => i.valeur));
    return items.map((i) => `
      <div class="graphique-barres__ligne">
        <span class="graphique-barres__label" title="${escapeHtml(i.label)}">${escapeHtml(i.label)}</span>
        <div class="graphique-barres__piste"><div class="graphique-barres__valeur" style="width:${Math.round((i.valeur / max) * 100)}%; background:${i.couleur};"></div></div>
        <span class="graphique-barres__nombre">${i.valeur}</span>
      </div>
    `).join("");
  }

  function renderDashboardExtra() {
    if (!els.dashboardExtra || !aPermission("tableauBord")) { if (els.dashboardExtra) els.dashboardExtra.innerHTML = ""; return; }

    const maintenant = new Date();
    const derniers = state.materiels.map((m) => dernierControle(m.id)).filter(Boolean);
    const enRetard = derniers.filter((c) => c.dateProchainControle && new Date(c.dateProchainControle) < maintenant).length;
    const enAlerte = derniers.filter((c) => ["bientot", "nonconforme"].includes(statutDeControle(c))).length;
    const echeancesDuMois = derniers.filter((c) => {
      if (!c.dateProchainControle) return false;
      const d = new Date(c.dateProchainControle);
      return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();
    }).length;
    const derniereSauvegarde = localStorage.getItem(CLE_DERNIERE_SAUVEGARDE);

    const roleCounts = {};
    state.utilisateurs.forEach((u) => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1; });
    const detailUtilisateurs = Object.entries(roleCounts).map(([r, n]) => `${n} ${r}`).join(" · ") || "aucun";

    els.dashboardExtra.innerHTML = `
      <div class="dashboard__stats">
        <div class="stat-card"><div><p class="stat-card__value">${state.controles.length}</p><p class="stat-card__label">Contrôles réalisés</p></div></div>
        <div class="stat-card"><div><p class="stat-card__value">${enRetard}</p><p class="stat-card__label">Contrôles en retard</p></div></div>
        <div class="stat-card"><div><p class="stat-card__value">${enAlerte}</p><p class="stat-card__label">Matériel en alerte</p></div></div>
        <div class="stat-card"><div><p class="stat-card__value">${echeancesDuMois}</p><p class="stat-card__label">Échéances ce mois-ci</p></div></div>
        <div class="stat-card"><div><p class="stat-card__value">${state.utilisateurs.length}</p><p class="stat-card__label">Utilisateurs déclarés (${detailUtilisateurs})</p></div></div>
        <div class="stat-card"><div><p class="stat-card__value" style="font-size:15px;">${derniereSauvegarde ? formatDate(derniereSauvegarde) : "Jamais"}</p><p class="stat-card__label">Dernière sauvegarde</p></div></div>
      </div>
      <div class="dashboard__graphiques">
        <div class="dashboard__graphique">
          <h3>Matériel par catégorie</h3>
          ${genererGraphiqueBarres(CATEGORIES_CONFIG.filter((c) => state.materiels.some((m) => m.categorie === c.nom)).map((c) => ({
            label: c.nom, valeur: state.materiels.filter((m) => m.categorie === c.nom).length, couleur: c.accent,
          })))}
        </div>
        <div class="dashboard__graphique">
          <h3>Contrôles par statut</h3>
          ${genererGraphiqueBarres([
            { label: "Conforme", valeur: derniers.filter((c) => statutDeControle(c) === "conforme").length, couleur: "var(--color-ok)" },
            { label: "À vérifier prochainement", valeur: derniers.filter((c) => statutDeControle(c) === "bientot").length, couleur: "var(--color-warn)" },
            { label: "Non conforme", valeur: derniers.filter((c) => statutDeControle(c) === "nonconforme").length, couleur: "var(--color-danger)" },
            { label: "Hors service", valeur: derniers.filter((c) => statutDeControle(c) === "hs").length, couleur: "var(--color-neutral)" },
          ])}
        </div>
      </div>
    `;
  }

  // -- Vue Accueil : vignettes par catégorie + tableau général ---------------
  function renderTuiles() {
    renderEcheancesBanniere();
    renderInterventionsBanniere();
    const categories = CATEGORIES_CONFIG.filter((c) => state.materiels.some((m) => m.categorie === c.nom));
    els.tilesGrid.innerHTML = "";

    if (aPermission("tableauBord")) {
      // Vignette "Tableau général"
      const tuileTableau = document.createElement("button");
      tuileTableau.type = "button";
      tuileTableau.className = "tile tile--tableau";
      tuileTableau.innerHTML = `
        <span class="tile__icon" style="background:#EFF6FC;color:var(--color-primary)">
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M10 4v16" stroke="currentColor" stroke-width="2"/></svg>
        </span>
        <span class="tile__titre">Tableau général</span>
        <span class="tile__sous-titre">${state.controles.length} contrôle${state.controles.length > 1 ? "s" : ""} enregistré${state.controles.length > 1 ? "s" : ""}</span>
      `;
      tuileTableau.addEventListener("click", () => afficherVue("tableau"));
      els.tilesGrid.appendChild(tuileTableau);
    }

    if (aPermission("calendrier")) {
      // Vignette "Calendrier"
      const echeancesProches = state.materiels
        .map((m) => dernierControle(m.id))
        .filter((c) => c && new Date(c.dateProchainControle) >= new Date() && new Date(c.dateProchainControle) <= new Date(Date.now() + 30 * 86400000));
      const tuileCalendrier = document.createElement("button");
      tuileCalendrier.type = "button";
      tuileCalendrier.className = "tile";
      tuileCalendrier.innerHTML = `
        <span class="tile__icon" style="background:#FDF0D5;color:var(--color-warn)">
          <svg viewBox="0 0 24 24" width="26" height="26"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <span class="tile__titre">Calendrier</span>
        <span class="tile__sous-titre">${echeancesProches.length} contrôle${echeancesProches.length > 1 ? "s" : ""} sous 30 jours</span>
      `;
      tuileCalendrier.addEventListener("click", () => afficherVue("calendrier"));
      els.tilesGrid.appendChild(tuileCalendrier);
    }

    if (aPermission("interventions")) {
      // Vignette "Interventions" (programmation GMAO, voir docs/11)
      const enRetard = state.interventions.filter((iv) => statutIntervention(iv) === "retard").length;
      const tuileInterventions = document.createElement("button");
      tuileInterventions.type = "button";
      tuileInterventions.className = "tile";
      tuileInterventions.innerHTML = `
        <span class="tile__icon" style="background:${enRetard ? "var(--color-danger-bg)" : "#FCE4D6"};color:${enRetard ? "var(--color-danger)" : "#D83B01"}">
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 015.4-5.4l-2.6 2.6-2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>
        </span>
        <span class="tile__titre">Interventions</span>
        <span class="tile__sous-titre">${state.interventions.length} programmée${state.interventions.length > 1 ? "s" : ""}${enRetard ? ` · ⚠ ${enRetard} en retard` : ""}</span>
      `;
      tuileInterventions.addEventListener("click", () => afficherVue("interventions"));
      els.tilesGrid.appendChild(tuileInterventions);
    }

    if (aPermission("ressources")) {
      // Vignette "Ressources"
      const tuileRessources = document.createElement("button");
      tuileRessources.type = "button";
      tuileRessources.className = "tile";
      tuileRessources.innerHTML = `
        <span class="tile__icon" style="background:#EDEBE9;color:var(--color-neutral)">
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 4h9l3 3h4v13H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </span>
        <span class="tile__titre">Ressources</span>
        <span class="tile__sous-titre">${state.ressources.length} document${state.ressources.length > 1 ? "s" : ""}</span>
      `;
      tuileRessources.addEventListener("click", () => afficherVue("ressources"));
      els.tilesGrid.appendChild(tuileRessources);
    }

    if (aPermission("galerie")) {
      // Vignette "Galerie photos"
      const tuileGalerie = document.createElement("button");
      tuileGalerie.type = "button";
      tuileGalerie.className = "tile";
      tuileGalerie.innerHTML = `
        <span class="tile__icon" style="background:#E8F5E9;color:#2E7D32">
          <svg viewBox="0 0 24 24" width="26" height="26"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="11" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 17l5-4 4 3 3-2 4 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="tile__titre">Galerie photos</span>
        <span class="tile__sous-titre">${state.photos.length} photo${state.photos.length > 1 ? "s" : ""}</span>
      `;
      tuileGalerie.addEventListener("click", () => afficherVue("galerie"));
      els.tilesGrid.appendChild(tuileGalerie);
    }

    // Vignette "Administration" — toujours visible ; l'accès est protégé par
    // un second verrou identifiant/mot de passe indépendant du rôle (voir
    // ADMIN_AUTH, js/google-config.js), pas par le rôle détecté.
    const tuileAdmin = document.createElement("button");
    tuileAdmin.type = "button";
    tuileAdmin.className = "tile";
    tuileAdmin.innerHTML = `
      <span class="tile__icon" style="background:#F3E8FD;color:#8764B8">
        <svg viewBox="0 0 24 24" width="26" height="26"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="8" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 14.5c2.4.3 4.2 2.4 4.2 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </span>
      <span class="tile__titre">Administration</span>
      <span class="tile__sous-titre">${state.adminDeverrouille ? `${state.utilisateurs.length} utilisateur${state.utilisateurs.length > 1 ? "s" : ""}` : "🔒 Accès protégé"}</span>
    `;
    tuileAdmin.addEventListener("click", () => afficherVue("administration"));
    els.tilesGrid.appendChild(tuileAdmin);

    // Une vignette par catégorie présente dans le référentiel
    categories.forEach((cat) => {
      const materielsCat = state.materiels.filter((m) => m.categorie === cat.nom);
      const counts = { conforme: 0, bientot: 0, nonconforme: 0, hs: 0, aucun: 0 };
      materielsCat.forEach((m) => {
        const c = dernierControle(m.id);
        if (!c) counts.aucun++; else counts[statutDeControle(c)]++;
      });

      const tuile = document.createElement("button");
      tuile.type = "button";
      tuile.className = "tile";
      tuile.innerHTML = `
        <span class="tile__icon" style="background:${cat.accent}22;color:${cat.accent}">
          <svg viewBox="0 0 24 24" width="26" height="26">${cat.icone || '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>'}</svg>
        </span>
        <span class="tile__titre">${escapeHtml(cat.nom)}</span>
        <span class="tile__sous-titre">${materielsCat.length} matériel${materielsCat.length > 1 ? "s" : ""}</span>
        <span class="tile__repartition">
          ${counts.conforme ? `<span class="dot dot--ok"></span>${counts.conforme}` : ""}
          ${counts.bientot ? `<span class="dot dot--warn"></span>${counts.bientot}` : ""}
          ${counts.nonconforme ? `<span class="dot dot--danger"></span>${counts.nonconforme}` : ""}
          ${counts.hs ? `<span class="dot dot--neutral"></span>${counts.hs}` : ""}
          ${counts.aucun ? `<span class="tile__aucun">${counts.aucun} sans contrôle</span>` : ""}
        </span>
      `;
      tuile.addEventListener("click", () => afficherVue("categorie", { categorie: cat.nom }));
      els.tilesGrid.appendChild(tuile);
    });
  }

  // -- Vue Catégorie : galerie de matériels ----------------------------------
  function renderCartesCategorie(categorie) {
    const materiels = state.materiels.filter((m) => m.categorie === categorie);
    const voirTout = aPermission("historique");
    els.cardsGrid.innerHTML = "";

    materiels.forEach((m) => {
      const c = dernierControle(m.id);
      const statutKey = c ? statutDeControle(c) : null;
      const statutInfo = statutKey ? STATUT_LABELS[statutKey] : null;

      const carte = document.createElement("div");
      carte.className = "materiel-card";
      carte.innerHTML = `
        <div class="materiel-card__entete">
          <div>
            <p class="materiel-card__nom">${escapeHtml(m.title)}</p>
            <p class="materiel-card__meta">${escapeHtml(m.numSerie)} · ${escapeHtml(m.reference)}</p>
          </div>
          ${voirTout ? (statutInfo ? `<span class="badge ${statutInfo.badge}">${statutInfo.label}</span>` : `<span class="badge badge--neutral">Jamais contrôlé</span>`) : ""}
        </div>
        ${voirTout ? `<p class="materiel-card__info">État : ${escapeHtml(m.etat)}${c ? ` · Dernier contrôle le ${formatDate(c.dateControle)}` : ""}</p>` : ""}
        <div class="materiel-card__actions">
          ${voirTout ? `<button class="btn btn--secondary btn--small btn--historique" type="button" ${c ? "" : "disabled"}>Historique</button>` : ""}
          ${peutControler() ? '<button class="btn btn--primary btn--small btn--nouveau-controle" type="button">🆕 Nouveau contrôle</button>' : ""}
          ${aPermission("nouvelleIntervention") ? '<button class="btn btn--secondary btn--small btn--nouvelle-intervention" type="button">🔧 Intervention</button>' : ""}
        </div>
      `;
      const btnHistorique = carte.querySelector(".btn--historique");
      if (btnHistorique) btnHistorique.addEventListener("click", () => ouvrirFicheMateriel(m.id));
      const btnNouveau = carte.querySelector(".btn--nouveau-controle");
      if (btnNouveau) btnNouveau.addEventListener("click", () => ouvrirEcranControle(m.id));
      const btnIntervention = carte.querySelector(".btn--nouvelle-intervention");
      if (btnIntervention) btnIntervention.addEventListener("click", () => ouvrirEcranNouvelleIntervention(m.id));
      els.cardsGrid.appendChild(carte);
    });
  }

  // -- Fiche matériel (historique des contrôles) -----------------------------
  function ouvrirFicheMateriel(materielId) {
    if (!aPermission("historique")) {
      afficherBanniere("⛔ Vous n'avez pas la permission de consulter l'historique.", "warn");
      return;
    }
    modalActuel = { type: "fiche", materielId };
    const materiel = state.materiels.find((m) => m.id === materielId);
    const historique = state.controles
      .filter((c) => c.materielId === materielId)
      .sort((a, b) => (a.dateControle < b.dateControle ? 1 : -1));

    els.modalTitle.textContent = materiel.title;
    const dernier = historique[0];
    const statutInfo = dernier ? STATUT_LABELS[statutDeControle(dernier)] : null;

    els.modalBody.innerHTML = `
      ${statutInfo ? `<span class="badge ${statutInfo.badge}">${statutInfo.label}</span>` : ""}
      <dl class="modal__grid" style="margin-top:16px;">
        <div class="modal__field"><dt>N° série</dt><dd>${escapeHtml(materiel.numSerie)}</dd></div>
        <div class="modal__field"><dt>Référence</dt><dd>${escapeHtml(materiel.reference)}</dd></div>
        <div class="modal__field"><dt>Catégorie</dt><dd>${escapeHtml(materiel.categorie)}</dd></div>
        <div class="modal__field"><dt>État</dt><dd>${escapeHtml(materiel.etat)}</dd></div>
      </dl>
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        ${peutControler() ? '<button class="btn btn--primary btn--small" id="btnNouveauControleModal" type="button">🆕 Nouveau contrôle</button>' : ""}
        ${aPermission("nouvelleIntervention") ? '<button class="btn btn--secondary btn--small" id="btnNouvelleInterventionModal" type="button">🔧 Programmer une intervention</button>' : ""}
        ${aPermission("exporterPdf") ? '<button class="btn btn--secondary btn--small" id="btnExporterPdf" type="button">🖨️ Exporter en PDF</button>' : ""}
        <button class="btn btn--secondary btn--small" id="btnQrCode" type="button">🔗 QR code</button>
      </div>
      <div id="qrPanel" class="qr-panel" hidden></div>
      <div class="modal__section">
        <h3>Historique des contrôles (${historique.length})</h3>
        ${historique.length ? historique.map((c, i) => renderLigneHistorique(c, i)).join("") : "<p>Aucun contrôle enregistré pour ce matériel.</p>"}
      </div>
    `;
    const btnNouveauModal = els.modalBody.querySelector("#btnNouveauControleModal");
    if (btnNouveauModal) {
      btnNouveauModal.addEventListener("click", () => {
        fermerModal();
        ouvrirEcranControle(materielId);
      });
    }
    const btnInterventionModal = els.modalBody.querySelector("#btnNouvelleInterventionModal");
    if (btnInterventionModal) btnInterventionModal.addEventListener("click", () => { fermerModal(); ouvrirEcranNouvelleIntervention(materielId); });
    const btnExporterPdf = els.modalBody.querySelector("#btnExporterPdf");
    if (btnExporterPdf) btnExporterPdf.addEventListener("click", () => exporterPdfMateriel(materiel, historique));

    const btnQrCode = els.modalBody.querySelector("#btnQrCode");
    const qrPanel = els.modalBody.querySelector("#qrPanel");
    btnQrCode.addEventListener("click", () => {
      if (!qrPanel.hidden) { qrPanel.hidden = true; return; }
      const urlFiche = new URL("fiche.html?numserie=" + encodeURIComponent(materiel.numSerie), window.location.href).href;
      const urlQr = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(urlFiche);
      qrPanel.innerHTML = `
        <img src="${escapeHtml(urlQr)}" alt="QR code vers la fiche de ${escapeHtml(materiel.title)}" width="220" height="220">
        <p class="qr-panel__texte">⚠️ Ce lien est accessible <strong>sans connexion</strong> à quiconque le possède, pas seulement en scannant le QR code physique.</p>
        <div class="qr-panel__lien">
          <input type="text" readonly value="${escapeHtml(urlFiche)}" id="qrLienTexte">
          <button type="button" class="btn btn--secondary btn--small" id="btnCopierLien">📋 Copier</button>
        </div>
      `;
      qrPanel.hidden = false;
      qrPanel.querySelector("#btnCopierLien").addEventListener("click", () => {
        navigator.clipboard.writeText(urlFiche)
          .then(() => afficherBanniere("✅ Lien copié dans le presse-papiers.", "info"))
          .catch(() => afficherBanniere("⚠️ Impossible de copier automatiquement — sélectionnez le lien manuellement.", "warn"));
      });
    });
    els.modalBody.querySelectorAll(".historique-ligne__entete").forEach((el) => {
      el.addEventListener("click", () => {
        const detail = el.nextElementSibling;
        detail.hidden = !detail.hidden;
      });
    });
    els.modalOverlay.hidden = false;
  }

  function renderLigneHistorique(c, index) {
    const info = STATUT_LABELS[statutDeControle(c)];
    return `
      <div class="historique-ligne">
        <div class="historique-ligne__entete">
          <span>${formatDate(c.dateControle)} — ${escapeHtml(c.controleur)}</span>
          <span class="badge ${info.badge}">${info.label}</span>
        </div>
        <div class="historique-ligne__detail" ${index === 0 ? "" : "hidden"}>
          <p><strong>Observations :</strong> ${escapeHtml(c.observations) || "—"}</p>
          <p><strong>Actions correctives :</strong> ${escapeHtml(c.actionsCorrectives) || "—"}</p>
          <p><strong>Commentaires :</strong> ${escapeHtml(c.commentaires) || "—"}</p>
          ${renderPhotosControle(c.photos)}
          ${renderPointsControle(c.pointsControle)}
        </div>
      </div>`;
  }

  /** Liens vers les photos de l'équipement prises le jour du contrôle (Google Drive, voir docs/10 §11). */
  function renderPhotosControle(photos) {
    if (!photos || photos.length === 0) return "";
    return `<p><strong>Photos :</strong> ${photos.map((lien, i) =>
      `<a class="controle-photo-lien" href="${escapeHtml(urlSure(lien))}" target="_blank" rel="noopener">📷 Photo ${i + 1}</a>`
    ).join("")}</p>`;
  }

  function renderPointsControle(points) {
    if (!points || points.length === 0) return "";
    const rows = points.map((p) => {
      const ok = p.statut === "Conforme";
      return `<tr><td>${p.effectue ? "✅" : "⬜"}</td><td>${escapeHtml(p.libelle)}</td><td>${escapeHtml(p.rapport)}</td><td><span class="badge ${ok ? "badge--ok" : "badge--danger"}">${escapeHtml(p.statut)}</span></td></tr>`;
    }).join("");
    return `<table class="points-controle-table"><thead><tr><th></th><th>Point de contrôle</th><th>Rapport</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function fermerModal() { els.modalOverlay.hidden = true; modalActuel = null; }

  /** Rafraîchit le contenu de la fenêtre modale actuellement ouverte (fiche matériel ou échéances) après un rechargement des données, pour ne jamais laisser un instantané périmé affiché — voir docs/10 §9. */
  function rafraichirModalOuvert() {
    if (!modalActuel || els.modalOverlay.hidden) return;
    if (modalActuel.type === "echeances") {
      ouvrirFenetreEcheances();
    } else if (modalActuel.type === "fiche") {
      const materielId = modalActuel.materielId;
      if (state.materiels.some((m) => m.id === materielId)) ouvrirFicheMateriel(materielId);
      else fermerModal();
    } else if (modalActuel.type === "intervention") {
      const id = modalActuel.id;
      if (state.interventions.some((iv) => iv.id === id)) ouvrirDetailIntervention(id);
      else fermerModal();
    }
  }

  // -- Vue Contrôle : checklist + validation ----------------------------------
  function ouvrirEcranControle(materielId) {
    if (!peutControler()) {
      afficherBanniere("⛔ Votre rôle (" + state.role + ") ne permet pas de créer de contrôle.", "warn");
      return;
    }
    const materiel = state.materiels.find((m) => m.id === materielId);
    state.materielControleCourant = materiel;

    const libellesPoints = (state.typesPointControle[materiel.categorie] || []);
    state.pointsControleCourants = libellesPoints.map((p) => ({ id: p.id, libelle: p.libelle, statut: "Conforme" }));

    els.controleTitreMateriel.textContent = `Nouveau contrôle — ${materiel.title}`;
    els.controleSousTitre.textContent = `${materiel.numSerie} · ${materiel.reference}`;
    els.controleBadgeCategorie.textContent = materiel.categorie;
    els.controleBadgeCategorie.className = "badge badge--neutral";
    els.controleDate.value = new Date().toISOString().slice(0, 10);
    renderSelecteurControleur();
    els.controleObservations.value = "";
    els.controleActions.value = "";
    els.controleCommentaires.value = "";
    els.controlePhotos.value = "";
    state.photosControleCourant = [];
    renderPhotosApercu();
    els.controleResultat.hidden = true;
    els.btnValiderControle.disabled = false;
    els.btnValiderControle.textContent = "✅ Valider le contrôle";

    renderPointsControleFormulaire();
    afficherVue("controle");
  }

  /** Aperçu des photos sélectionnées pour le contrôle en cours, avec bouton de retrait par photo. */
  function renderPhotosApercu() {
    els.controlePhotosApercu.innerHTML = state.photosControleCourant.map((fichier, i) => `
      <div class="controle-photos-apercu__vignette">
        <img src="${URL.createObjectURL(fichier)}" alt="${escapeHtml(fichier.name)}">
        <button type="button" class="controle-photos-apercu__retirer" data-index="${i}" title="Retirer cette photo">✕</button>
      </div>
    `).join("");
    els.controlePhotosApercu.querySelectorAll(".controle-photos-apercu__retirer").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.photosControleCourant.splice(Number(btn.dataset.index), 1);
        renderPhotosApercu();
      });
    });
  }

  /** Liste déroulante des contrôleurs (onglet Utilisateurs), présélectionne l'utilisateur connecté s'il y figure. */
  function renderSelecteurControleur() {
    const nomCourant = (state.utilisateur && state.utilisateur.nom) || "";
    if (!state.controleurs || state.controleurs.length === 0) {
      els.controleControleurSelect.innerHTML = `<option value="${escapeHtml(nomCourant)}">${escapeHtml(nomCourant) || "—"}</option>`;
      return;
    }
    els.controleControleurSelect.innerHTML = state.controleurs
      .map((c) => `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.nom)} (${escapeHtml(c.role)})</option>`)
      .join("");
    const correspond = state.controleurs.some((c) => c.nom === nomCourant);
    if (correspond) els.controleControleurSelect.value = nomCourant;
    else if (state.utilisateur && state.utilisateur.email) {
      const opt = document.createElement("option");
      opt.value = nomCourant;
      opt.textContent = `${nomCourant} (vous)`;
      els.controleControleurSelect.prepend(opt);
      els.controleControleurSelect.value = nomCourant;
    }
  }

  function renderPointsControleFormulaire() {
    if (state.pointsControleCourants.length === 0) {
      els.controlePointsListe.innerHTML = "<p>Aucun point de contrôle défini pour cette catégorie (voir liste <code>TypesPointControle</code>).</p>";
      return;
    }
    els.controlePointsListe.innerHTML = state.pointsControleCourants.map((p, i) => `
      <div class="controle-point" data-index="${i}">
        <span class="controle-point__libelle">${escapeHtml(p.libelle)}</span>
        <div class="controle-point__toggle">
          <button type="button" class="toggle-btn toggle-btn--ok is-active" data-valeur="Conforme">Conforme</button>
          <button type="button" class="toggle-btn toggle-btn--danger" data-valeur="Non conforme">Non conforme</button>
        </div>
      </div>
    `).join("");

    els.controlePointsListe.querySelectorAll(".controle-point").forEach((ligne) => {
      const index = Number(ligne.dataset.index);
      ligne.querySelectorAll(".toggle-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.pointsControleCourants[index].statut = btn.dataset.valeur;
          ligne.querySelectorAll(".toggle-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
        });
      });
    });
  }

  function calculerResultatControle(materiel, dateControle, points) {
    const conforme = points.every((p) => p.statut === "Conforme");
    const dateProchain = ajouterMoisISO(dateControle, materiel.periodiciteMois || 6);
    const joursRestants = Math.ceil((new Date(dateProchain) - new Date(dateControle)) / 86400000);
    let statut = "Conforme";
    if (materiel.etat === "Hors service") statut = "Hors service";
    else if (!conforme) statut = "Non conforme";
    else if (joursRestants <= GOOGLE_CONFIG.seuilJours) statut = "À vérifier prochainement";
    return { conforme, statut, dateProchainControle: dateProchain };
  }

  function ajouterMoisISO(dateIso, nbMois) {
    const d = new Date(dateIso + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + nbMois);
    return d.toISOString().slice(0, 10);
  }

  async function validerControle() {
    const materiel = state.materielControleCourant;
    const dateControle = els.controleDate.value;
    if (!dateControle) {
      alert("Veuillez renseigner la date du contrôle.");
      return;
    }
    const observations = els.controleObservations.value;
    const actionsCorrectives = els.controleActions.value;
    const commentaires = els.controleCommentaires.value;
    const points = state.pointsControleCourants;
    const controleurNom = els.controleControleurSelect.value || (state.utilisateur && state.utilisateur.nom) || "";

    els.btnValiderControle.disabled = true;
    els.btnValiderControle.textContent = "Enregistrement…";

    const photos = state.photosControleCourant;

    try {
      let resultat;
      if (!state.modeDemo) {
        resultat = await GoogleSheetsAPI.enregistrerControle({
          materiel, dateControle, controleurNom,
          observations, actionsCorrectives, commentaires, points, photos,
          onProgressionPhotos: ({ index, total }) => {
            els.btnValiderControle.textContent = `Envoi photo ${index + 1}/${total}…`;
          },
        });
        // Reflète immédiatement le contrôle dans l'état local (bandeau, fenêtre
        // Échéances, tableau de bord) sans attendre la prochaine actualisation —
        // sans quoi le contrôle qu'on vient de valider resterait invisible jusqu'à
        // 60 secondes, source de confusion si on enchaîne plusieurs contrôles.
        state.controles.unshift({
          id: resultat.id, materielId: materiel.id, materiel: materiel.title,
          numSerie: materiel.numSerie, reference: materiel.reference, categorie: materiel.categorie,
          etat: materiel.etat, dateControle, dateProchainControle: resultat.dateProchainControle,
          controleur: controleurNom, conforme: resultat.conforme, statut: resultat.statut,
          observations, actionsCorrectives, commentaires, photos: resultat.photos || [],
          pointsControle: points.map((p) => ({ libelle: p.libelle, effectue: true, rapport: p.statut === "Conforme" ? "Validé" : "Non validé", statut: p.statut })),
        });
      } else {
        // Simulation locale : aucune écriture réelle en mode démonstration (les photos ne sont pas envoyées).
        resultat = calculerResultatControle(materiel, dateControle, points);
        resultat.id = Math.max(0, ...state.controles.map((c) => c.id)) + 1;
        resultat.photos = photos.map((f) => URL.createObjectURL(f));
        state.controles.unshift({
          id: resultat.id, materielId: materiel.id, materiel: materiel.title,
          numSerie: materiel.numSerie, reference: materiel.reference, categorie: materiel.categorie,
          etat: materiel.etat, dateControle, dateProchainControle: resultat.dateProchainControle,
          controleur: controleurNom, conforme: resultat.conforme, statut: resultat.statut,
          observations, actionsCorrectives, commentaires, photos: resultat.photos,
          pointsControle: points.map((p) => ({ libelle: p.libelle, effectue: true, rapport: p.statut === "Conforme" ? "Validé" : "Non validé", statut: p.statut })),
        });
      }

      const cle = STATUT_CLE_PAR_LABEL[resultat.statut] || (resultat.conforme ? "conforme" : "nonconforme");
      const info = STATUT_LABELS[cle];
      const noteSauvegarde = state.modeDemo ? " (simulation locale)" : " dans Google Sheets";
      const notePhotos = photos.length ? (state.modeDemo ? ` — ${photos.length} photo${photos.length > 1 ? "s" : ""} non envoyée${photos.length > 1 ? "s" : ""} en mode démonstration` : ` — ${photos.length} photo${photos.length > 1 ? "s" : ""} envoyée${photos.length > 1 ? "s" : ""} sur Drive`) : "";
      els.controleResultat.hidden = false;
      els.controleResultat.className = "controle-resultat controle-resultat--" + cle;
      els.controleResultat.innerHTML = `<span class="badge ${info.badge}">${info.label}</span> Contrôle enregistré${noteSauvegarde}${notePhotos}.`;
      els.btnValiderControle.textContent = "✅ Contrôle enregistré";
      journaliser(`Contrôle validé — ${materiel.title} (${materiel.numSerie}) — ${resultat.statut}${photos.length ? ` — ${photos.length} photo(s)` : ""}`);
      state.photosControleCourant = [];

      setTimeout(() => afficherVue("categorie", { categorie: materiel.categorie }), 1400);
    } catch (e) {
      console.error(e);
      els.controleResultat.hidden = false;
      els.controleResultat.className = "controle-resultat controle-resultat--erreur";
      els.controleResultat.textContent = "Erreur lors de l'enregistrement : " + e.message;
      els.btnValiderControle.disabled = false;
      els.btnValiderControle.textContent = "✅ Valider le contrôle";
    }
  }

  // -- Vue Tableau général (recherche, filtres, tri, export) ------------------
  function peuplerFiltresTableau() {
    populateSelect(els.filterCategorie, uniqueValues("categorie"));
    populateSelect(els.filterControleur, uniqueValues("controleur"));
  }

  function uniqueValues(field) {
    return [...new Set(state.controles.map((d) => d[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  }

  function populateSelect(select, values) {
    select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function getFilteredData() {
    const term = els.search.value.trim().toLowerCase();
    const categorie = els.filterCategorie.value;
    const conforme = els.filterConforme.value;
    const statut = els.filterStatut.value;
    const controleur = els.filterControleur.value;
    const dateFrom = els.filterDateFrom.value;
    const dateTo = els.filterDateTo.value;

    let rows = state.controles.filter((item) => {
      if (term) {
        const haystack = [item.materiel, item.numSerie, item.reference, item.controleur, item.observations].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (categorie && item.categorie !== categorie) return false;
      if (conforme && (conforme === "oui") !== item.conforme) return false;
      if (controleur && item.controleur !== controleur) return false;
      if (statut && statutDeControle(item) !== statut) return false;
      if (dateFrom && item.dateControle < dateFrom) return false;
      if (dateTo && item.dateControle > dateTo) return false;
      return true;
    });

    rows.sort((a, b) => {
      let va = a[currentSort.key]; let vb = b[currentSort.key];
      if (currentSort.key === "conforme") { va = va ? 1 : 0; vb = vb ? 1 : 0; }
      if (va < vb) return currentSort.dir === "asc" ? -1 : 1;
      if (va > vb) return currentSort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }

  function renderTableau() {
    const rows = getFilteredData();
    els.tableBody.innerHTML = "";
    els.emptyState.hidden = rows.length > 0;

    rows.forEach((item) => {
      const statutInfo = STATUT_LABELS[statutDeControle(item)];
      const tr = document.createElement("tr");
      tr.className = statutInfo.row;
      tr.tabIndex = 0;
      tr.addEventListener("click", () => ouvrirFicheMateriel(item.materielId));
      tr.innerHTML = `
        <td class="cell-name" data-label="Matériel">${escapeHtml(item.materiel)}</td>
        <td data-label="N° série">${escapeHtml(item.numSerie)}</td>
        <td class="cell-muted" data-label="Référence">${escapeHtml(item.reference)}</td>
        <td data-label="Catégorie">${escapeHtml(item.categorie)}</td>
        <td data-label="Date contrôle">${formatDate(item.dateControle)}</td>
        <td data-label="Prochain contrôle">${formatDate(item.dateProchainControle)}</td>
        <td data-label="Contrôleur">${escapeHtml(item.controleur)}</td>
        <td data-label="État">${escapeHtml(item.etat)}</td>
        <td data-label="Conforme">${item.conforme ? '<span class="badge badge--ok">Oui</span>' : '<span class="badge badge--danger">Non</span>'}</td>
        <td data-label="Observations"><span class="cell-truncate" title="${escapeHtml(item.observations)}">${escapeHtml(item.observations) || "—"}</span></td>
        <td data-label="Actions correctives"><span class="cell-truncate" title="${escapeHtml(item.actionsCorrectives)}">${escapeHtml(item.actionsCorrectives) || "—"}</span></td>
        <td data-label="Commentaires"><span class="cell-truncate" title="${escapeHtml(item.commentaires)}">${escapeHtml(item.commentaires) || "—"}</span></td>
      `;
      els.tableBody.appendChild(tr);
    });

    els.table.querySelectorAll("thead th[data-sort]").forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.dataset.sort === currentSort.key) th.classList.add(currentSort.dir === "asc" ? "sorted-asc" : "sorted-desc");
    });
    els.resultCount.textContent = `${rows.length} résultat${rows.length > 1 ? "s" : ""}`;
  }

  function exporterCsv() {
    const rows = getFilteredData();
    const headers = ["Matériel", "N° série", "Référence", "Catégorie", "Date contrôle", "Prochain contrôle", "Contrôleur", "État", "Conforme", "Observations", "Actions correctives", "Commentaires"];
    const lines = rows.map((item) => [
      item.materiel, item.numSerie, item.reference, item.categorie, item.dateControle, item.dateProchainControle,
      item.controleur, item.etat, item.conforme ? "Oui" : "Non", item.observations, item.actionsCorrectives, item.commentaires,
    ].map(csvEscape).join(";"));
    const csvContent = "﻿" + [headers.map(csvEscape).join(";"), ...lines].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `verifications-materiel_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const v = String(value ?? "");
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  // -- Vue Interventions : programmation GMAO (voir docs/11) -----------------
  function peuplerFiltresInterventions() {
    if (!els.intervFilterCategorie) return;
    const categories = [...new Set(state.materiels.map((m) => m.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    populateSelect(els.intervFilterCategorie, categories);
  }

  const INTERVENTION_ORDRE_PRIORITE = { retard: 0, imminente: 1, attente_validation: 2, planifiee: 3, realisee: 4 };

  function getFilteredInterventions() {
    const term = els.intervSearch.value.trim().toLowerCase();
    const categorie = els.intervFilterCategorie.value;
    const type = els.intervFilterType.value;
    const statut = els.intervFilterStatut.value;
    const dateFrom = els.intervFilterDateFrom.value;
    const dateTo = els.intervFilterDateTo.value;

    let rows = state.interventions.filter((iv) => {
      if (term) {
        const haystack = [iv.materiel, iv.numSerie, iv.lieu, iv.intervenant, iv.impact].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (categorie && iv.categorie !== categorie) return false;
      if (type && iv.type !== type) return false;
      if (statut && statutIntervention(iv) !== statut) return false;
      if (dateFrom && (!iv.dateIntervention || iv.dateIntervention < dateFrom)) return false;
      if (dateTo && (!iv.dateIntervention || iv.dateIntervention > dateTo)) return false;
      return true;
    });

    rows.sort((a, b) => {
      const pa = INTERVENTION_ORDRE_PRIORITE[statutIntervention(a)];
      const pb = INTERVENTION_ORDRE_PRIORITE[statutIntervention(b)];
      if (pa !== pb) return pa - pb;
      return (a.dateIntervention || "9999-99-99") < (b.dateIntervention || "9999-99-99") ? -1 : 1;
    });
    return rows;
  }

  function renderInterventions() {
    const rows = getFilteredInterventions();
    els.intervCardsGrid.innerHTML = "";
    els.intervEmptyState.hidden = rows.length > 0;
    els.intervResultCount.textContent = `${rows.length} intervention${rows.length > 1 ? "s" : ""}`;
    els.btnNouvelleIntervention.hidden = !aPermission("nouvelleIntervention");
    els.btnExportIntervCsv.hidden = !aPermission("exporterCsv");

    rows.forEach((iv) => {
      const cle = statutIntervention(iv);
      const info = INTERVENTION_STATUT_LABELS[cle];
      const j = joursRestantsIntervention(iv);
      const carte = document.createElement("div");
      carte.className = "materiel-card";
      carte.innerHTML = `
        <div class="materiel-card__entete">
          <div>
            <p class="materiel-card__nom">${escapeHtml(iv.materiel || iv.numSerie)}</p>
            <p class="materiel-card__meta">${escapeHtml(iv.type) || "—"} · ${formatDate(iv.dateIntervention)}${iv.coupureCatenaire ? " · ⚡ Coupure caténaire" : ""}</p>
          </div>
          <span class="badge ${info.badge}">${info.label}</span>
        </div>
        <p class="materiel-card__info">📍 ${escapeHtml(iv.lieu) || "—"} · 👤 ${escapeHtml(iv.intervenant) || "—"}${cle === "retard" && j !== null ? ` · en retard de ${Math.abs(j)} j` : ""}</p>
        <div class="materiel-card__actions">
          <button class="btn btn--secondary btn--small btn--interv-detail" type="button">Détails</button>
        </div>
      `;
      carte.querySelector(".btn--interv-detail").addEventListener("click", () => ouvrirDetailIntervention(iv.id));
      els.intervCardsGrid.appendChild(carte);
    });
  }

  function exporterCsvInterventions() {
    const rows = getFilteredInterventions();
    const headers = ["Matériel", "N° série", "Type", "Statut", "Date intervention", "Durée (h)", "Lieu", "Impact", "Conséquences", "Intervenant", "Coupure caténaire", "Début coupure", "Fin coupure", "Date demande", "Demandé par", "Date validation", "Validé par", "Date réalisation", "Commentaires"];
    const lines = rows.map((iv) => [
      iv.materiel, iv.numSerie, iv.type, INTERVENTION_STATUT_LABELS[statutIntervention(iv)].label,
      iv.dateIntervention, iv.dureeHeures ?? "", iv.lieu, iv.impact, iv.consequences, iv.intervenant,
      iv.coupureCatenaire ? "Oui" : "Non", iv.coupureDebut, iv.coupureFin,
      iv.dateDemande, iv.demandePar, iv.dateValidation, iv.validePar, iv.dateRealisation, iv.commentaires,
    ].map(csvEscape).join(";"));
    const csvContent = "﻿" + [headers.map(csvEscape).join(";"), ...lines].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `interventions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  /** Fenêtre de détail d'une intervention, avec les actions de circuit demande/validation (voir docs/11). */
  function ouvrirDetailIntervention(id) {
    if (!aPermission("interventions")) {
      afficherBanniere("⛔ Vous n'avez pas la permission de consulter les interventions.", "warn");
      return;
    }
    const iv = state.interventions.find((x) => x.id === id);
    if (!iv) return;
    modalActuel = { type: "intervention", id };
    const cle = statutIntervention(iv);
    const info = INTERVENTION_STATUT_LABELS[cle];

    els.modalTitle.textContent = `🔧 ${iv.materiel || iv.numSerie}`;
    els.modalBody.innerHTML = `
      <span class="badge ${info.badge}">${info.label}</span>
      <dl class="modal__grid" style="margin-top:16px;">
        <div class="modal__field"><dt>Type</dt><dd>${escapeHtml(iv.type) || "—"}</dd></div>
        <div class="modal__field"><dt>Jour de l'intervention</dt><dd>${formatDate(iv.dateIntervention)}</dd></div>
        <div class="modal__field"><dt>Durée prévue</dt><dd>${iv.dureeHeures ? escapeHtml(String(iv.dureeHeures)) + " h" : "—"}</dd></div>
        <div class="modal__field"><dt>Lieu</dt><dd>${escapeHtml(iv.lieu) || "—"}</dd></div>
        <div class="modal__field"><dt>Intervenant</dt><dd>${escapeHtml(iv.intervenant) || "—"}</dd></div>
        <div class="modal__field"><dt>Coupure caténaire</dt><dd>${iv.coupureCatenaire ? `⚡ Oui (${escapeHtml(iv.coupureDebut) || "?"} → ${escapeHtml(iv.coupureFin) || "?"})` : "Non"}</dd></div>
        <div class="modal__field"><dt>Demande</dt><dd>${formatDate(iv.dateDemande)}${iv.demandePar ? " · " + escapeHtml(iv.demandePar) : ""}</dd></div>
        <div class="modal__field"><dt>Validation</dt><dd>${iv.dateValidation ? formatDate(iv.dateValidation) + (iv.validePar ? " · " + escapeHtml(iv.validePar) : "") : "En attente"}</dd></div>
      </dl>
      <div class="modal__section"><h3>Impact</h3><p>${escapeHtml(iv.impact) || "—"}</p></div>
      <div class="modal__section"><h3>Conséquences</h3><p>${escapeHtml(iv.consequences) || "—"}</p></div>
      ${iv.commentaires ? `<div class="modal__section"><h3>Commentaires</h3><p>${escapeHtml(iv.commentaires)}</p></div>` : ""}
      ${iv.dateRealisation ? `<div class="modal__section"><h3>Réalisée le</h3><p>${formatDate(iv.dateRealisation)}</p></div>` : ""}
      <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
        ${!iv.dateValidation && aPermission("validerIntervention") ? '<button class="btn btn--primary btn--small" id="btnValiderInterventionModal" type="button">✅ Valider</button>' : ""}
        ${iv.dateValidation && !iv.dateRealisation && (aPermission("validerIntervention") || aPermission("nouvelleIntervention")) ? '<button class="btn btn--primary btn--small" id="btnRealiserInterventionModal" type="button">☑️ Marquer réalisée</button>' : ""}
        ${!iv.dateRealisation && aPermission("validerIntervention") ? '<button class="btn btn--secondary btn--small" id="btnAnnulerInterventionModal" type="button">🗑️ Annuler la demande</button>' : ""}
      </div>
    `;
    const btnValider = els.modalBody.querySelector("#btnValiderInterventionModal");
    if (btnValider) btnValider.addEventListener("click", () => validerInterventionAction(id));
    const btnRealiser = els.modalBody.querySelector("#btnRealiserInterventionModal");
    if (btnRealiser) btnRealiser.addEventListener("click", () => marquerInterventionRealiseeAction(id));
    const btnAnnuler = els.modalBody.querySelector("#btnAnnulerInterventionModal");
    if (btnAnnuler) btnAnnuler.addEventListener("click", () => annulerInterventionAction(id));
    els.modalOverlay.hidden = false;
  }

  async function validerInterventionAction(id) {
    if (!aPermission("validerIntervention")) {
      afficherBanniere("⛔ Vous n'avez pas la permission de valider une intervention.", "warn");
      return;
    }
    const iv = state.interventions.find((x) => x.id === id);
    if (!iv) return;
    const nom = (state.utilisateur && state.utilisateur.nom) || "";
    const dateValidation = new Date().toISOString().slice(0, 10);
    try {
      if (!state.modeDemo) await GoogleSheetsAPI.mettreAJourIntervention(iv.ligne, { ...iv, dateValidation, validePar: nom });
      iv.dateValidation = dateValidation;
      iv.validePar = nom;
      journaliser(`Intervention validée — ${iv.materiel} (${formatDate(iv.dateIntervention)})`);
      afficherBanniere("✅ Intervention validée" + (state.modeDemo ? " (simulation locale)." : "."), "info");
      ouvrirDetailIntervention(id);
      renderTuiles();
      if (state.vue === "interventions") renderInterventions();
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors de la validation : " + e.message, "warn");
    }
  }

  async function marquerInterventionRealiseeAction(id) {
    const iv = state.interventions.find((x) => x.id === id);
    if (!iv) return;
    const dateRealisation = new Date().toISOString().slice(0, 10);
    try {
      if (!state.modeDemo) await GoogleSheetsAPI.mettreAJourIntervention(iv.ligne, { ...iv, dateRealisation });
      iv.dateRealisation = dateRealisation;
      journaliser(`Intervention marquée réalisée — ${iv.materiel} (${formatDate(iv.dateIntervention)})`);
      afficherBanniere("✅ Intervention marquée réalisée" + (state.modeDemo ? " (simulation locale)." : "."), "info");
      ouvrirDetailIntervention(id);
      renderTuiles();
      if (state.vue === "interventions") renderInterventions();
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur : " + e.message, "warn");
    }
  }

  async function annulerInterventionAction(id) {
    if (!aPermission("validerIntervention")) {
      afficherBanniere("⛔ Vous n'avez pas la permission d'annuler une demande d'intervention.", "warn");
      return;
    }
    const iv = state.interventions.find((x) => x.id === id);
    if (!iv) return;
    if (!confirm(`Annuler définitivement la demande d'intervention pour ${iv.materiel} ?`)) return;
    try {
      if (!state.modeDemo) await GoogleSheetsAPI.supprimerIntervention(iv.ligne);
      state.interventions = state.interventions.filter((x) => x.id !== id);
      journaliser(`Demande d'intervention annulée — ${iv.materiel} (${formatDate(iv.dateIntervention)})`);
      fermerModal();
      afficherBanniere("✅ Demande annulée" + (state.modeDemo ? " (simulation locale)." : "."), "info");
      renderTuiles();
      if (state.vue === "interventions") renderInterventions();
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur : " + e.message, "warn");
    }
  }

  /** Écran de demande d'intervention (étape 1 du circuit demande/validation, voir docs/11). Préremplit le matériel si ouvert depuis sa fiche. */
  function ouvrirEcranNouvelleIntervention(materielIdPreselectionne) {
    if (!aPermission("nouvelleIntervention")) {
      afficherBanniere("⛔ Votre rôle (" + state.role + ") ne permet pas de créer une demande d'intervention.", "warn");
      return;
    }
    if (state.materiels.length === 0) {
      afficherBanniere("⚠️ Aucun matériel disponible.", "warn");
      return;
    }
    els.intervFormTitre.textContent = "Nouvelle intervention";
    els.intervFormSousTitre.textContent = "Demande de programmation GMAO";
    els.intervFormBadgeStatut.textContent = "";
    els.intervFormBadgeStatut.className = "badge";
    renderSelecteurMaterielIntervention(materielIdPreselectionne);
    renderSelecteurIntervenant();
    els.intervTypeSelect.value = "Maintenance préventive";
    els.intervDate.value = "";
    els.intervDuree.value = "";
    els.intervLieu.value = "";
    els.intervImpact.value = "";
    els.intervConsequences.value = "";
    els.intervCommentaires.value = "";
    els.intervCoupureCatenaire.checked = false;
    els.intervCoupureChamps.hidden = true;
    els.intervCoupureDebut.value = "";
    els.intervCoupureFin.value = "";
    const nom = (state.utilisateur && state.utilisateur.nom) || "";
    els.intervDemandeInfo.textContent = `Demande créée par ${nom || "—"} le ${formatDate(new Date().toISOString().slice(0, 10))} — nécessitera la validation d'un administrateur.`;
    els.intervResultat.hidden = true;
    els.btnValiderNouvelleIntervention.disabled = false;
    els.btnValiderNouvelleIntervention.textContent = "📩 Enregistrer la demande";
    afficherVue("interventionForm");
  }

  function renderSelecteurMaterielIntervention(materielIdPreselectionne) {
    els.intervMaterielSelect.innerHTML = state.materiels
      .map((m) => `<option value="${m.id}">${escapeHtml(m.title)} (${escapeHtml(m.numSerie)})</option>`)
      .join("");
    if (materielIdPreselectionne) els.intervMaterielSelect.value = materielIdPreselectionne;
  }

  /** Liste déroulante des intervenants possibles (mêmes personnes que le sélecteur de contrôleur), présélectionne l'utilisateur connecté s'il y figure. */
  function renderSelecteurIntervenant() {
    const nomCourant = (state.utilisateur && state.utilisateur.nom) || "";
    const liste = state.controleurs && state.controleurs.length ? state.controleurs : state.utilisateurs;
    if (!liste || liste.length === 0) {
      els.intervIntervenantSelect.innerHTML = `<option value="${escapeHtml(nomCourant)}">${escapeHtml(nomCourant) || "—"}</option>`;
      return;
    }
    els.intervIntervenantSelect.innerHTML = liste.map((c) => `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.nom)}</option>`).join("");
    if (liste.some((c) => c.nom === nomCourant)) els.intervIntervenantSelect.value = nomCourant;
  }

  async function validerNouvelleIntervention() {
    const materielId = Number(els.intervMaterielSelect.value);
    const materiel = state.materiels.find((m) => m.id === materielId);
    if (!materiel) { alert("Veuillez sélectionner un matériel."); return; }
    const dateIntervention = els.intervDate.value;
    if (!dateIntervention) { alert("Veuillez renseigner le jour de l'intervention."); return; }
    const coupureCatenaire = els.intervCoupureCatenaire.checked;
    if (coupureCatenaire && (!els.intervCoupureDebut.value || !els.intervCoupureFin.value)) {
      alert("Veuillez renseigner l'heure de début et de fin de la coupure caténaire.");
      return;
    }

    const nom = (state.utilisateur && state.utilisateur.nom) || "";
    const dateDemande = new Date().toISOString().slice(0, 10);
    const nouvelleIntervention = {
      materielId: materiel.id, materiel: materiel.title, numSerie: materiel.numSerie, categorie: materiel.categorie,
      type: els.intervTypeSelect.value,
      dateDemande, demandePar: nom,
      dateIntervention,
      dureeHeures: els.intervDuree.value ? Number(els.intervDuree.value) : null,
      lieu: els.intervLieu.value.trim(),
      impact: els.intervImpact.value.trim(),
      consequences: els.intervConsequences.value.trim(),
      intervenant: els.intervIntervenantSelect.value || nom,
      coupureCatenaire,
      coupureDebut: coupureCatenaire ? els.intervCoupureDebut.value : "",
      coupureFin: coupureCatenaire ? els.intervCoupureFin.value : "",
      dateValidation: "", validePar: "", dateRealisation: "",
      commentaires: els.intervCommentaires.value.trim(),
    };

    els.btnValiderNouvelleIntervention.disabled = true;
    els.btnValiderNouvelleIntervention.textContent = "Enregistrement…";

    try {
      if (!state.modeDemo) {
        const resultat = await GoogleSheetsAPI.ajouterIntervention(nouvelleIntervention);
        nouvelleIntervention.id = resultat.id;
        nouvelleIntervention.ligne = resultat.ligne;
      } else {
        nouvelleIntervention.id = Math.max(0, ...state.interventions.map((iv) => Number(iv.id) || 0)) + 1;
      }
      state.interventions.unshift(nouvelleIntervention);

      els.intervResultat.hidden = false;
      els.intervResultat.className = "controle-resultat";
      els.intervResultat.innerHTML = `<span class="badge badge--neutral">En attente de validation</span> Demande enregistrée${state.modeDemo ? " (simulation locale)" : " dans Google Sheets"}.`;
      els.btnValiderNouvelleIntervention.textContent = "✅ Demande enregistrée";
      journaliser(`Demande d'intervention créée — ${materiel.title} (${materiel.numSerie}) — ${dateIntervention}`);
      renderTuiles();
      setTimeout(() => afficherVue("interventions"), 1200);
    } catch (e) {
      console.error(e);
      els.intervResultat.hidden = false;
      els.intervResultat.className = "controle-resultat controle-resultat--erreur";
      els.intervResultat.textContent = "Erreur lors de l'enregistrement : " + e.message;
      els.btnValiderNouvelleIntervention.disabled = false;
      els.btnValiderNouvelleIntervention.textContent = "📩 Enregistrer la demande";
    }
  }

  // -- Vue Calendrier : contrôles à venir par mois ----------------------------
  function renderCalendrier() {
    const mois = state.moisCalendrier;
    const annee = mois.getFullYear();
    const moisIndex = mois.getMonth();
    els.calendrierTitre.textContent = mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    // Prochain contrôle par matériel = dateProchainControle de son dernier contrôle connu
    const echeances = state.materiels
      .map((m) => ({ materiel: m, controle: dernierControle(m.id) }))
      .filter((e) => e.controle && e.controle.dateProchainControle);

    // Interventions GMAO programmées (voir docs/11), affichées sur le même calendrier.
    const echeancesInterventions = aPermission("interventions")
      ? state.interventions.filter((iv) => iv.dateIntervention)
      : [];

    const premierJourMois = new Date(annee, moisIndex, 1);
    const decalage = (premierJourMois.getDay() + 6) % 7; // semaine commençant lundi
    const nbJours = new Date(annee, moisIndex + 1, 0).getDate();

    let html = `
      <div class="calendrier-entete-jours">
        ${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j) => `<div>${j}</div>`).join("")}
      </div>
      <div class="calendrier-grille-jours">
    `;
    for (let i = 0; i < decalage; i++) html += `<div class="calendrier-jour calendrier-jour--vide"></div>`;
    for (let jour = 1; jour <= nbJours; jour++) {
      const dateJour = `${annee}-${String(moisIndex + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
      const echeancesJour = echeances.filter((e) => e.controle.dateProchainControle === dateJour);
      const interventionsJour = echeancesInterventions.filter((iv) => iv.dateIntervention === dateJour);
      const estAujourdhui = dateJour === new Date().toISOString().slice(0, 10);
      html += `
        <div class="calendrier-jour ${estAujourdhui ? "calendrier-jour--aujourdhui" : ""}">
          <span class="calendrier-jour__numero">${jour}</span>
          ${echeancesJour.map((e) => {
            const info = STATUT_LABELS[statutDeControle(e.controle)];
            return `<button type="button" class="calendrier-echeance ${info.badge}" title="${escapeHtml(e.materiel.title)}">${escapeHtml(e.materiel.title)}</button>`;
          }).join("")}
          ${interventionsJour.map((iv) => {
            const info = INTERVENTION_STATUT_LABELS[statutIntervention(iv)];
            const titre = `🔧 ${iv.materiel || iv.numSerie}`;
            return `<button type="button" class="calendrier-intervention ${info.badge}" title="${escapeHtml(titre)}">${escapeHtml(titre)}</button>`;
          }).join("")}
        </div>`;
    }
    html += `</div>`;
    els.calendrierGrille.innerHTML = html;

    // Association clic → fiche matériel
    let index = 0;
    for (let jour = 1; jour <= nbJours; jour++) {
      const dateJour = `${annee}-${String(moisIndex + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
      const echeancesJour = echeances.filter((e) => e.controle.dateProchainControle === dateJour);
      echeancesJour.forEach((e) => {
        const btn = els.calendrierGrille.querySelectorAll(".calendrier-echeance")[index];
        if (btn) btn.addEventListener("click", () => ouvrirFicheMateriel(e.materiel.id));
        index++;
      });
    }

    // Association clic → détail intervention (voir docs/11)
    let indexInterv = 0;
    for (let jour = 1; jour <= nbJours; jour++) {
      const dateJour = `${annee}-${String(moisIndex + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
      const interventionsJour = echeancesInterventions.filter((iv) => iv.dateIntervention === dateJour);
      interventionsJour.forEach((iv) => {
        const btn = els.calendrierGrille.querySelectorAll(".calendrier-intervention")[indexInterv];
        if (btn) btn.addEventListener("click", () => ouvrirDetailIntervention(iv.id));
        indexInterv++;
      });
    }
  }

  // -- Vue Ressources : documents/liens ---------------------------------------
  function renderRessources() {
    if (!state.ressources || state.ressources.length === 0) {
      els.ressourcesListe.innerHTML = `<p>Aucune ressource pour l'instant. Ajoutez des lignes (Titre | Lien | Categorie) dans l'onglet <code>Ressources</code> de votre classeur Google Sheets.</p>`;
      return;
    }
    const parCategorie = {};
    state.ressources.forEach((r) => {
      const cat = r.categorie || "Général";
      if (!parCategorie[cat]) parCategorie[cat] = [];
      parCategorie[cat].push(r);
    });
    els.ressourcesListe.innerHTML = Object.entries(parCategorie).map(([cat, items]) => `
      <div class="ressources-groupe">
        <h3>${escapeHtml(cat)}</h3>
        <ul class="ressources-liste">
          ${items.map((r) => `<li><a href="${escapeHtml(urlSure(r.lien))}" target="_blank" rel="noopener">📄 ${escapeHtml(r.titre)}</a></li>`).join("")}
        </ul>
      </div>
    `).join("");
  }

  // -- Vue Galerie photos : chargement automatique + diaporama ----------------
  const DOSSIER_PHOTOS = "assets/photos/";

  async function chargerPhotos() {
    try {
      const res = await fetch(DOSSIER_PHOTOS + "manifest.json", { cache: "no-store" });
      state.photos = res.ok ? await res.json() : [];
    } catch (e) {
      state.photos = [];
    }
    if (state.vue === "accueil") renderTuiles();
    if (state.vue === "galerie") renderGalerieGrille();
  }

  function renderGalerieGrille() {
    if (!els.galerieGrille) return;
    els.galerieVide.hidden = state.photos.length > 0;
    els.galerieGrille.hidden = state.photos.length === 0;
    els.galerieGrille.innerHTML = state.photos.map((fichier, i) => `
      <button type="button" class="galerie-grille__vignette" data-index="${i}">
        <img src="${DOSSIER_PHOTOS}${encodeURIComponent(fichier)}" alt="${escapeHtml(fichier)}" loading="lazy">
      </button>
    `).join("");
    els.galerieGrille.querySelectorAll(".galerie-grille__vignette").forEach((btn) => {
      btn.addEventListener("click", () => ouvrirDiaporama(Number(btn.dataset.index)));
    });
  }

  function ouvrirDiaporama(index) {
    if (state.photos.length === 0) return;
    diaporama.index = index;
    diaporama.enLecture = true;
    els.galerieDiaporama.hidden = false;
    els.btnGalerieLecture.textContent = "⏸ Pause";
    els.galerieScene.classList.remove("galerie-diaporama__scene--zoom");
    afficherImageDiaporama();
    demarrerMinuteurDiaporama();
  }

  function fermerDiaporama() {
    els.galerieDiaporama.hidden = true;
    clearInterval(diaporama.minuteur);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function afficherImageDiaporama() {
    const fichier = state.photos[diaporama.index];
    if (!fichier) return;
    els.galerieImage.src = DOSSIER_PHOTOS + encodeURIComponent(fichier);
    els.galerieImage.alt = fichier;
    els.galerieCompteur.textContent = `${diaporama.index + 1} / ${state.photos.length}`;
  }

  function diaporamaSuivant() {
    diaporama.index = (diaporama.index + 1) % state.photos.length;
    afficherImageDiaporama();
  }
  function diaporamaPrecedent() {
    diaporama.index = (diaporama.index - 1 + state.photos.length) % state.photos.length;
    afficherImageDiaporama();
  }

  function demarrerMinuteurDiaporama() {
    clearInterval(diaporama.minuteur);
    if (!diaporama.enLecture) return;
    const vitesse = Number(els.galerieVitesse.value) || 4000;
    diaporama.minuteur = setInterval(diaporamaSuivant, vitesse);
  }

  function toggleLectureDiaporama() {
    diaporama.enLecture = !diaporama.enLecture;
    els.btnGalerieLecture.textContent = diaporama.enLecture ? "⏸ Pause" : "▶️ Lecture";
    demarrerMinuteurDiaporama();
  }

  function toggleZoomDiaporama() {
    els.galerieScene.classList.toggle("galerie-diaporama__scene--zoom");
  }

  function toggleFullscreenDiaporama() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      els.galerieDiaporama.requestFullscreen().catch(() => {
        afficherBanniere("⚠️ Le mode plein écran n'est pas disponible sur ce navigateur.", "warn");
      });
    }
  }

  // -- Vue Administration : gestion des utilisateurs (Email | Nom | Rôle | Permissions) -----
  function permissionsCheckboxesHtml(nomChamp, permissionsActuelles) {
    return PERMISSIONS_CONFIG.map((p) => `
      <label class="admin-permission">
        <input type="checkbox" name="${nomChamp}" value="${p.cle}" ${permissionsActuelles.includes(p.cle) ? "checked" : ""}>
        ${escapeHtml(p.label)}
      </label>
    `).join("");
  }

  function permissionsCocheesDans(conteneur) {
    return [...conteneur.querySelectorAll("input[type=checkbox]:checked")].map((c) => c.value);
  }

  /** Recoche les permissions par défaut du rôle sélectionné dans le formulaire "Ajouter un utilisateur". */
  function renderPermissionsFormulaireAjout() {
    if (!els.nouvellesPermissions) return;
    const defauts = (ROLES_CONFIG[els.nouveauRole.value] || {}).permissions || [];
    els.nouvellesPermissions.innerHTML = permissionsCheckboxesHtml("nouvelles-permissions", defauts);
  }

  function renderAdministration() {
    els.adminLoginCarte.hidden = state.adminDeverrouille;
    els.adminContenu.hidden = !state.adminDeverrouille;
    if (!state.adminDeverrouille) return;

    const admin = state.adminUtilisateurCourant;
    els.adminConnecteEnTantQue.textContent = `Connecté en tant que ${(admin && admin.nom) || "?"}`;
    // L'identifiant de secours (ADMIN_AUTH) n'a pas de ligne Utilisateurs associée : rien à mettre à jour.
    els.formChangerMotDePasse.hidden = !(admin && admin.ligne);

    if (!state.utilisateurs || state.utilisateurs.length === 0) {
      els.administrationTableau.innerHTML = `<p>Aucun utilisateur déclaré pour l'instant — tout le monde est traité comme "${ROLE_PAR_DEFAUT}" par défaut. Ajoutez des personnes ci-dessous.</p>`;
    } else {
      els.administrationTableau.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>E-mail</th><th>Nom</th><th>Rôle</th><th>Identifiant</th><th>Nouveau mot de passe</th><th></th></tr></thead>
          <tbody>
            ${state.utilisateurs.map((u, i) => `
              <tr data-index="${i}">
                <td>${escapeHtml(u.email)}</td>
                <td><input type="text" class="admin-input admin-input--nom" value="${escapeHtml(u.nom)}"></td>
                <td>
                  <select class="admin-input admin-input--role">
                    ${Object.keys(ROLES_CONFIG).map((r) => `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`).join("")}
                  </select>
                </td>
                <td><input type="text" class="admin-input admin-input--identifiant" value="${escapeHtml(u.identifiant || "")}" autocomplete="off"></td>
                <td><input type="password" class="admin-input admin-input--nouveau-mdp" placeholder="Laisser vide pour ne pas changer" autocomplete="new-password"></td>
                <td class="admin-table__actions">
                  <button type="button" class="btn btn--secondary btn--small btn--modifier-utilisateur">Enregistrer</button>
                  <button type="button" class="btn btn--secondary btn--small btn--supprimer-utilisateur">Supprimer</button>
                </td>
              </tr>
              <tr data-index-permissions="${i}">
                <td colspan="6">
                  <fieldset class="admin-permissions">
                    <legend>Permissions</legend>
                    ${permissionsCheckboxesHtml(`permissions-${i}`, u.permissions || [])}
                  </fieldset>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      els.administrationTableau.querySelectorAll("tr[data-index]").forEach((ligne) => {
        const index = Number(ligne.dataset.index);
        const lignePermissions = els.administrationTableau.querySelector(`tr[data-index-permissions="${index}"]`);
        ligne.querySelector(".admin-input--role").addEventListener("change", (e) => {
          // Confort : recoche les permissions par défaut du rôle choisi (modifiable avant "Enregistrer").
          const defauts = (ROLES_CONFIG[e.target.value] || {}).permissions || [];
          lignePermissions.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = defauts.includes(c.value); });
        });
        ligne.querySelector(".btn--modifier-utilisateur").addEventListener("click", async () => {
          const nom = ligne.querySelector(".admin-input--nom").value.trim();
          const role = ligne.querySelector(".admin-input--role").value;
          const identifiant = ligne.querySelector(".admin-input--identifiant").value.trim();
          const nouveauMdp = ligne.querySelector(".admin-input--nouveau-mdp").value;
          const permissions = permissionsCocheesDans(lignePermissions);
          const u = state.utilisateurs[index];
          let motDePasseHash = u.motDePasseHash || "";
          if (nouveauMdp) {
            if (!identifiant) { afficherBanniere("⚠️ Renseignez un identifiant avant de définir un mot de passe.", "warn"); return; }
            motDePasseHash = await GoogleSheetsAPI.hacherMotDePasse(identifiant, nouveauMdp);
          }
          modifierUtilisateurAction(index, nom, role, permissions, identifiant, motDePasseHash);
        });
        ligne.querySelector(".btn--supprimer-utilisateur").addEventListener("click", () => {
          if (confirm("Supprimer cet utilisateur ?")) supprimerUtilisateurAction(index);
        });
      });
    }

    renderJournal();
    renderSauvegardeHistorique();
  }

  async function changerMotDePasseAction(nouveauMotDePasse) {
    const admin = state.adminUtilisateurCourant;
    if (!admin || !admin.ligne) {
      afficherBanniere("⚠️ L'identifiant de secours ne peut pas être changé ici — modifiez ADMIN_AUTH dans js/google-config.js.", "warn");
      return;
    }
    try {
      const motDePasseHash = await GoogleSheetsAPI.hacherMotDePasse(admin.identifiant, nouveauMotDePasse);
      if (!state.modeDemo) {
        await GoogleSheetsAPI.modifierUtilisateur(admin.ligne, {
          email: admin.email, nom: admin.nom, role: admin.role, permissions: admin.permissions,
          identifiant: admin.identifiant, motDePasseHash,
        });
      }
      admin.motDePasseHash = motDePasseHash;
      els.formChangerMotDePasse.reset();
      journaliser(`Changement de mot de passe — ${admin.nom}`);
      afficherBanniere("✅ Mot de passe changé" + (state.modeDemo ? " (simulation locale)." : "."), "info");
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors du changement de mot de passe : " + e.message, "warn");
    }
  }

  // -- Sauvegarde (export/import JSON manuel, voir docs/10 §8) -----------------
  function exporterSauvegarde() {
    const sauvegarde = {
      genereLe: new Date().toISOString(),
      materiels: state.materiels,
      typesPointControle: state.typesPointControle,
      controles: state.controles,
      utilisateurs: state.utilisateurs,
      ressources: state.ressources,
      photos: state.photos,
      journal: state.journal,
    };
    const blob = new Blob([JSON.stringify(sauvegarde, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const horodatage = sauvegarde.genereLe.replace(/[:.]/g, "-");
    a.href = url; a.download = `sauvegarde-verif-materiel_${horodatage}.json`;
    a.click();
    URL.revokeObjectURL(url);

    localStorage.setItem(CLE_DERNIERE_SAUVEGARDE, sauvegarde.genereLe);
    const historique = JSON.parse(localStorage.getItem(CLE_HISTORIQUE_SAUVEGARDES) || "[]");
    historique.unshift(sauvegarde.genereLe);
    localStorage.setItem(CLE_HISTORIQUE_SAUVEGARDES, JSON.stringify(historique.slice(0, 10)));

    journaliser("Export d'une sauvegarde complète (JSON)");
    afficherBanniere("✅ Sauvegarde téléchargée.", "info");
    if (state.vue === "administration") renderAdministration();
  }

  async function importerApercuSauvegarde(fichier) {
    try {
      const texte = await fichier.text();
      const donnees = JSON.parse(texte);
      const resume = [
        `${(donnees.materiels || []).length} matériels`,
        `${(donnees.controles || []).length} contrôles`,
        `${(donnees.utilisateurs || []).length} utilisateurs`,
        `${(donnees.ressources || []).length} ressources`,
      ].join(" · ");
      els.sauvegardeApercu.textContent = `Fichier du ${donnees.genereLe ? formatDate(donnees.genereLe) : "date inconnue"} — ${resume}. Ce fichier n'est pas réinjecté automatiquement dans Google Sheets : utilisez-le comme archive ou référence, ou restaurez le classeur entier via son historique de versions natif (voir ci-dessus).`;
      els.sauvegardeApercu.hidden = false;
    } catch (e) {
      afficherBanniere("⚠️ Fichier de sauvegarde invalide ou illisible.", "warn");
    } finally {
      els.fichierSauvegarde.value = "";
    }
  }

  function renderSauvegardeHistorique() {
    if (!els.sauvegardeHistorique) return;
    const historique = JSON.parse(localStorage.getItem(CLE_HISTORIQUE_SAUVEGARDES) || "[]");
    if (historique.length === 0) {
      els.sauvegardeHistorique.innerHTML = `<p class="admin-login-texte">Aucune sauvegarde exportée pour l'instant depuis ce navigateur.</p>`;
      return;
    }
    els.sauvegardeHistorique.innerHTML = `
      <p class="admin-login-texte" style="margin-bottom:6px;">Sauvegardes exportées depuis ce navigateur :</p>
      <ul class="ressources-liste">
        ${historique.map((iso) => `<li>${escapeHtml(formatDate(iso))} à ${escapeHtml(new Date(iso).toLocaleTimeString("fr-FR"))}</li>`).join("")}
      </ul>
    `;
  }

  // -- Journal des actions (audit) ---------------------------------------------
  function renderJournal() {
    if (!els.journalTableau) return;
    if (!state.journal || state.journal.length === 0) {
      els.journalTableau.innerHTML = `<p>Aucune action journalisée pour l'instant.</p>`;
      return;
    }
    const entrees = state.journal.slice(0, 100);
    els.journalTableau.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Date</th><th>Heure</th><th>Utilisateur</th><th>Action</th><th>Adresse IP</th></tr></thead>
        <tbody>
          ${entrees.map((j) => `
            <tr>
              <td>${formatDate(j.date)}</td>
              <td>${escapeHtml(j.heure)}</td>
              <td>${escapeHtml(j.utilisateur)}</td>
              <td>${escapeHtml(j.action)}</td>
              <td>${escapeHtml(j.ip) || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  async function creerUtilisateurAction(email, nom, role, permissions, identifiant, motDePasseHash) {
    if (!email) { afficherBanniere("⚠️ L'adresse e-mail est obligatoire.", "warn"); return; }
    try {
      if (!state.modeDemo) {
        await GoogleSheetsAPI.creerUtilisateur({ email, nom, role, permissions, identifiant, motDePasseHash });
      }
      state.utilisateurs.push({ email: email.toLowerCase(), nom, role, permissions, identifiant: identifiant || "", motDePasseHash: motDePasseHash || "", ligne: state.utilisateurs.length + 2 });
      state.controleurs = state.utilisateurs.filter((u) => (u.permissions || []).includes("nouveauControle"));
      els.formUtilisateur.reset();
      renderPermissionsFormulaireAjout();
      renderAdministration();
      journaliser(`Ajout de l'utilisateur ${nom || email} (${role})`);
      afficherBanniere("✅ Utilisateur ajouté" + (state.modeDemo ? " (simulation locale)." : "."), "info");
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors de l'ajout : " + e.message, "warn");
    }
  }

  async function modifierUtilisateurAction(index, nom, role, permissions, identifiant, motDePasseHash) {
    const u = state.utilisateurs[index];
    try {
      if (!state.modeDemo) {
        await GoogleSheetsAPI.modifierUtilisateur(u.ligne, { email: u.email, nom, role, permissions, identifiant, motDePasseHash });
      }
      u.nom = nom; u.role = role; u.permissions = permissions; u.identifiant = identifiant; u.motDePasseHash = motDePasseHash;
      state.controleurs = state.utilisateurs.filter((x) => (x.permissions || []).includes("nouveauControle"));
      journaliser(`Modification de l'utilisateur ${nom || u.email}`);
      afficherBanniere("✅ Utilisateur modifié" + (state.modeDemo ? " (simulation locale)." : "."), "info");
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors de la modification : " + e.message, "warn");
    }
  }

  async function supprimerUtilisateurAction(index) {
    const u = state.utilisateurs[index];
    try {
      if (!state.modeDemo) {
        await GoogleSheetsAPI.supprimerUtilisateur(u.ligne);
      }
      state.utilisateurs.splice(index, 1);
      state.controleurs = state.utilisateurs.filter((x) => (x.permissions || []).includes("nouveauControle"));
      renderAdministration();
      journaliser(`Suppression de l'utilisateur ${u.nom || u.email}`);
      afficherBanniere("✅ Utilisateur supprimé" + (state.modeDemo ? " (simulation locale)." : "."), "info");
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors de la suppression : " + e.message, "warn");
    }
  }

  // -- Export PDF (impression navigateur) --------------------------------------
  function exporterPdfMateriel(materiel, historique) {
    const genererLigne = (label, valeur) => `<div class="impression-champ"><dt>${label}</dt><dd>${escapeHtml(valeur) || "—"}</dd></div>`;
    els.zoneImpression.innerHTML = `
      <h1>${escapeHtml(materiel.title)}</h1>
      <dl class="impression-grille">
        ${genererLigne("N° série", materiel.numSerie)}
        ${genererLigne("Référence", materiel.reference)}
        ${genererLigne("Catégorie", materiel.categorie)}
        ${genererLigne("État", materiel.etat)}
      </dl>
      <h2>Historique des contrôles (${historique.length})</h2>
      ${historique.map((c) => `
        <div class="impression-controle">
          <h3>${formatDate(c.dateControle)} — ${escapeHtml(c.controleur)} — ${escapeHtml(c.statut)}</h3>
          <p><strong>Observations :</strong> ${escapeHtml(c.observations) || "—"}</p>
          <p><strong>Actions correctives :</strong> ${escapeHtml(c.actionsCorrectives) || "—"}</p>
          <p><strong>Commentaires :</strong> ${escapeHtml(c.commentaires) || "—"}</p>
          ${renderPhotosControle(c.photos)}
          ${renderPointsControle(c.pointsControle)}
        </div>
      `).join("")}
    `;
    window.print();
  }

  // -- Thème clair / sombre ---------------------------------------------------
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "light" ? "dark" : "light");
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }

  // -- Utilitaires --------------------------------------------------------------
  function formatDate(isoDate) {
    if (!isoDate) return "—";
    const d = new Date(isoDate);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /**
   * Neutralise un lien saisi dans l'onglet Ressources/Controles (Google Sheets)
   * avant de l'utiliser comme `href` : seuls http/https (et blob:, généré
   * uniquement par notre propre code pour l'aperçu local des photos en mode
   * démonstration) sont acceptés, ce qui bloque un lien `javascript:`
   * malveillant qui échapperait à escapeHtml (les caractères spéciaux HTML
   * n'y suffisent pas, un tel lien reste une URL valide). Voir docs/10 §7.
   */
  function urlSure(url) {
    try {
      const u = new URL(String(url || ""), window.location.href);
      return ["http:", "https:", "blob:"].includes(u.protocol) ? u.href : "#";
    } catch (e) {
      return "#";
    }
  }
})();
