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

  const state = {
    materiels: [],
    typesPointControle: {},
    controles: [],
    utilisateurs: [],
    ressources: [],
    controleurs: [],
    role: ROLE_PAR_DEFAUT,
    modeDemo: true,
    utilisateur: null,
    vue: "accueil",
    categorieCourante: null,
    materielControleCourant: null,
    pointsControleCourants: [],
    moisCalendrier: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  };

  let currentSort = { key: "dateControle", dir: "desc" };

  function peutControler() {
    return (ROLES_CONFIG[state.role] || ROLES_CONFIG[ROLE_PAR_DEFAUT]).peutControler;
  }
  function peutVoirTout() {
    return (ROLES_CONFIG[state.role] || ROLES_CONFIG[ROLE_PAR_DEFAUT]).peutVoirTout;
  }
  function peutGererUtilisateurs() {
    return (ROLES_CONFIG[state.role] || ROLES_CONFIG[ROLE_PAR_DEFAUT]).peutGererUtilisateurs;
  }

  const CLE_DEJA_CONNECTE = "gsheets_deja_connecte";
  const els = {};

  document.addEventListener("DOMContentLoaded", demarrer);

  async function demarrer() {
    cacherElements();
    lierEvenements();
    chargerDemo();
    peuplerFiltresTableau();
    afficherVue("accueil");

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
      administrationTableau: document.getElementById("administrationTableau"),
      formUtilisateur: document.getElementById("formUtilisateur"),
      nouvelEmail: document.getElementById("nouvelEmail"),
      nouveauNom: document.getElementById("nouveauNom"),
      nouveauRole: document.getElementById("nouveauRole"),
      tilesGrid: document.getElementById("tilesGrid"),
      cardsGrid: document.getElementById("cardsGrid"),
      roleBadge: document.getElementById("roleBadge"),
      calendrierGrille: document.getElementById("calendrierGrille"),
      calendrierTitre: document.getElementById("calendrierTitre"),
      btnMoisPrecedent: document.getElementById("btnMoisPrecedent"),
      btnMoisSuivant: document.getElementById("btnMoisSuivant"),
      ressourcesListe: document.getElementById("ressourcesListe"),
      zoneImpression: document.getElementById("zoneImpression"),
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
      controleResultat: document.getElementById("controleResultat"),
      btnAnnulerControle: document.getElementById("btnAnnulerControle"),
      btnValiderControle: document.getElementById("btnValiderControle"),
    });
  }

  // -- Chargement des données (démonstration par défaut, Google Sheets après connexion) --
  function chargerDemo() {
    const demo = construireJeuDeDemonstration();
    Object.assign(state, demo);
    state.modeDemo = true;
    state.role = "Administrateur"; // toutes les fonctionnalités visibles en démonstration
    state.controleurs = state.utilisateurs;
    state.utilisateur = { id: null, nom: "Utilisateur de démonstration", email: "" };
    els.headerSubtitle.textContent = "Mode démonstration — cliquez sur \"Se connecter avec Google\" pour vos données réelles";
    afficherBanniere("ℹ️ Mode démonstration — données d'exemple, aucune écriture réelle. Connectez-vous à Google pour vos vraies données.", "info");
    afficherRoleBadge();
  }

  function afficherRoleBadge() {
    if (!els.roleBadge) return;
    els.roleBadge.textContent = state.role;
    els.roleBadge.hidden = false;
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
      Object.assign(state, donnees);
      state.modeDemo = false;
      state.utilisateur = utilisateur;
      state.role = GoogleSheetsAPI.determinerRole(utilisateur.email, donnees.utilisateurs);
      state.controleurs = donnees.utilisateurs.filter((u) => (ROLES_CONFIG[u.role] || {}).peutControler);
      // Utilise le nom déclaré dans l'onglet Utilisateurs (ex. "PATON ROMUALD") plutôt
      // que le nom du compte Google, s'il est renseigné.
      const ligneUtilisateur = GoogleSheetsAPI.trouverUtilisateur(utilisateur.email, donnees.utilisateurs);
      if (ligneUtilisateur && ligneUtilisateur.nom) state.utilisateur.nom = ligneUtilisateur.nom;
      localStorage.setItem(CLE_DEJA_CONNECTE, "1");
      els.headerSubtitle.textContent = `Connecté à Google Sheets — ${state.utilisateur.nom}`;
      els.btnGoogleConnect.textContent = "✅ Connecté";
      afficherBanniere("✅ Connecté à Google Sheets — les données affichées sont réelles et le bouton \"Valider le contrôle\" écrit dans votre classeur.", "info");
      afficherRoleBadge();
      peuplerFiltresTableau();
      afficherVue("accueil");
    } catch (e) {
      console.error(e);
      if (!silencieux) {
        els.btnGoogleConnect.disabled = false;
        els.btnGoogleConnect.textContent = "🔑 Se connecter avec Google";
        afficherBanniere("⚠️ Connexion à Google impossible : " + e.message.split("\n")[0], "warn");
      }
      throw e;
    }
  }

  function afficherBanniere(texte, type) {
    els.bannerEtat.textContent = texte;
    els.bannerEtat.className = "banner banner--" + type;
    els.bannerEtat.hidden = false;
  }

  function afficherChargement(actif) {
    document.body.style.cursor = actif ? "wait" : "";
  }

  // -- Navigation entre vues --------------------------------------------------
  const VUES_RESTREINTES = ["tableau", "calendrier", "ressources"];

  function afficherVue(vue, options = {}) {
    if (VUES_RESTREINTES.includes(vue) && !peutVoirTout()) {
      afficherBanniere("⛔ Votre rôle (" + state.role + ") n'a pas accès à cette section.", "warn");
      vue = "accueil";
    }
    if (vue === "administration" && !peutGererUtilisateurs()) {
      afficherBanniere("⛔ Votre rôle (" + state.role + ") n'a pas accès à l'administration des utilisateurs.", "warn");
      vue = "accueil";
    }
    state.vue = vue;
    els.viewAccueil.hidden = vue !== "accueil";
    els.viewCategorie.hidden = vue !== "categorie";
    els.viewTableau.hidden = vue !== "tableau";
    els.viewControle.hidden = vue !== "controle";
    els.viewCalendrier.hidden = vue !== "calendrier";
    els.viewRessources.hidden = vue !== "ressources";
    els.viewAdministration.hidden = vue !== "administration";

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
    } else if (vue === "administration") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Administration des utilisateurs";
      renderAdministration();
    }
    renderStatsGlobales();
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
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerModal(); });

    els.btnAnnulerControle.addEventListener("click", () => afficherVue("categorie", { categorie: state.categorieCourante || (state.materielControleCourant || {}).categorie }));
    els.btnValiderControle.addEventListener("click", validerControle);

    els.btnMoisPrecedent.addEventListener("click", () => {
      state.moisCalendrier.setMonth(state.moisCalendrier.getMonth() - 1);
      renderCalendrier();
    });
    els.btnMoisSuivant.addEventListener("click", () => {
      state.moisCalendrier.setMonth(state.moisCalendrier.getMonth() + 1);
      renderCalendrier();
    });

    Object.keys(ROLES_CONFIG).forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r; opt.textContent = r;
      els.nouveauRole.appendChild(opt);
    });
    els.formUtilisateur.addEventListener("submit", (e) => {
      e.preventDefault();
      creerUtilisateurAction(els.nouvelEmail.value.trim().toLowerCase(), els.nouveauNom.value.trim(), els.nouveauRole.value);
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

  // -- Vue Accueil : vignettes par catégorie + tableau général ---------------
  function renderTuiles() {
    const categories = CATEGORIES_CONFIG.filter((c) => state.materiels.some((m) => m.categorie === c.nom));
    els.tilesGrid.innerHTML = "";

    if (peutVoirTout()) {
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

    if (peutGererUtilisateurs()) {
      const tuileAdmin = document.createElement("button");
      tuileAdmin.type = "button";
      tuileAdmin.className = "tile";
      tuileAdmin.innerHTML = `
        <span class="tile__icon" style="background:#F3E8FD;color:#8764B8">
          <svg viewBox="0 0 24 24" width="26" height="26"><circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="8" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 14.5c2.4.3 4.2 2.4 4.2 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </span>
        <span class="tile__titre">Administration</span>
        <span class="tile__sous-titre">${state.utilisateurs.length} utilisateur${state.utilisateurs.length > 1 ? "s" : ""}</span>
      `;
      tuileAdmin.addEventListener("click", () => afficherVue("administration"));
      els.tilesGrid.appendChild(tuileAdmin);
    }

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
          <svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>
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
    const voirTout = peutVoirTout();
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
        </div>
      `;
      const btnHistorique = carte.querySelector(".btn--historique");
      if (btnHistorique) btnHistorique.addEventListener("click", () => ouvrirFicheMateriel(m.id));
      const btnNouveau = carte.querySelector(".btn--nouveau-controle");
      if (btnNouveau) btnNouveau.addEventListener("click", () => ouvrirEcranControle(m.id));
      els.cardsGrid.appendChild(carte);
    });
  }

  // -- Fiche matériel (historique des contrôles) -----------------------------
  function ouvrirFicheMateriel(materielId) {
    if (!peutVoirTout()) {
      afficherBanniere("⛔ Votre rôle (" + state.role + ") ne permet pas de consulter l'historique.", "warn");
      return;
    }
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
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        ${peutControler() ? '<button class="btn btn--primary btn--small" id="btnNouveauControleModal" type="button">🆕 Nouveau contrôle</button>' : ""}
        <button class="btn btn--secondary btn--small" id="btnExporterPdf" type="button">🖨️ Exporter en PDF</button>
      </div>
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
    els.modalBody.querySelector("#btnExporterPdf").addEventListener("click", () => exporterPdfMateriel(materiel, historique));
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
          ${renderPointsControle(c.pointsControle)}
        </div>
      </div>`;
  }

  function renderPointsControle(points) {
    if (!points || points.length === 0) return "";
    const rows = points.map((p) => {
      const ok = p.statut === "Conforme";
      return `<tr><td>${p.effectue ? "✅" : "⬜"}</td><td>${escapeHtml(p.libelle)}</td><td>${escapeHtml(p.rapport)}</td><td><span class="badge ${ok ? "badge--ok" : "badge--danger"}">${escapeHtml(p.statut)}</span></td></tr>`;
    }).join("");
    return `<table class="points-controle-table"><thead><tr><th></th><th>Point de contrôle</th><th>Rapport</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function fermerModal() { els.modalOverlay.hidden = true; }

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
    els.controleResultat.hidden = true;
    els.btnValiderControle.disabled = false;
    els.btnValiderControle.textContent = "✅ Valider le contrôle";

    renderPointsControleFormulaire();
    afficherVue("controle");
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

    try {
      let resultat;
      if (!state.modeDemo) {
        resultat = await GoogleSheetsAPI.enregistrerControle({
          materiel, dateControle, controleurNom,
          observations, actionsCorrectives, commentaires, points,
        });
      } else {
        // Simulation locale : aucune écriture réelle en mode démonstration.
        resultat = calculerResultatControle(materiel, dateControle, points);
        resultat.id = Math.max(0, ...state.controles.map((c) => c.id)) + 1;
        state.controles.unshift({
          id: resultat.id, materielId: materiel.id, materiel: materiel.title,
          numSerie: materiel.numSerie, reference: materiel.reference, categorie: materiel.categorie,
          etat: materiel.etat, dateControle, dateProchainControle: resultat.dateProchainControle,
          controleur: controleurNom, conforme: resultat.conforme, statut: resultat.statut,
          observations, actionsCorrectives, commentaires,
          pointsControle: points.map((p) => ({ libelle: p.libelle, effectue: true, rapport: p.statut === "Conforme" ? "Validé" : "Non validé", statut: p.statut })),
        });
      }

      const cle = STATUT_CLE_PAR_LABEL[resultat.statut] || (resultat.conforme ? "conforme" : "nonconforme");
      const info = STATUT_LABELS[cle];
      els.controleResultat.hidden = false;
      els.controleResultat.className = "controle-resultat controle-resultat--" + cle;
      els.controleResultat.innerHTML = `<span class="badge ${info.badge}">${info.label}</span> Contrôle enregistré${state.modeDemo ? " (simulation locale)" : " dans Google Sheets"}.`;
      els.btnValiderControle.textContent = "✅ Contrôle enregistré";

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
        <td class="cell-name">${escapeHtml(item.materiel)}</td>
        <td>${escapeHtml(item.numSerie)}</td>
        <td class="cell-muted">${escapeHtml(item.reference)}</td>
        <td>${escapeHtml(item.categorie)}</td>
        <td>${formatDate(item.dateControle)}</td>
        <td>${formatDate(item.dateProchainControle)}</td>
        <td>${escapeHtml(item.controleur)}</td>
        <td>${escapeHtml(item.etat)}</td>
        <td>${item.conforme ? '<span class="badge badge--ok">Oui</span>' : '<span class="badge badge--danger">Non</span>'}</td>
        <td><span class="cell-truncate" title="${escapeHtml(item.observations)}">${escapeHtml(item.observations) || "—"}</span></td>
        <td><span class="cell-truncate" title="${escapeHtml(item.actionsCorrectives)}">${escapeHtml(item.actionsCorrectives) || "—"}</span></td>
        <td><span class="cell-truncate" title="${escapeHtml(item.commentaires)}">${escapeHtml(item.commentaires) || "—"}</span></td>
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
      const estAujourdhui = dateJour === new Date().toISOString().slice(0, 10);
      html += `
        <div class="calendrier-jour ${estAujourdhui ? "calendrier-jour--aujourdhui" : ""}">
          <span class="calendrier-jour__numero">${jour}</span>
          ${echeancesJour.map((e) => {
            const info = STATUT_LABELS[statutDeControle(e.controle)];
            return `<button type="button" class="calendrier-echeance ${info.badge}" title="${escapeHtml(e.materiel.title)}">${escapeHtml(e.materiel.title)}</button>`;
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
          ${items.map((r) => `<li><a href="${escapeHtml(r.lien)}" target="_blank" rel="noopener">📄 ${escapeHtml(r.titre)}</a></li>`).join("")}
        </ul>
      </div>
    `).join("");
  }

  // -- Vue Administration : gestion des utilisateurs (Email | Nom | Rôle) -----
  function renderAdministration() {
    if (!state.utilisateurs || state.utilisateurs.length === 0) {
      els.administrationTableau.innerHTML = `<p>Aucun utilisateur déclaré pour l'instant — tout le monde est traité comme "${ROLE_PAR_DEFAUT}" par défaut. Ajoutez des personnes ci-dessous.</p>`;
    } else {
      els.administrationTableau.innerHTML = `
        <table class="admin-table">
          <thead><tr><th>E-mail</th><th>Nom</th><th>Rôle</th><th></th></tr></thead>
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
                <td class="admin-table__actions">
                  <button type="button" class="btn btn--secondary btn--small btn--modifier-utilisateur">Enregistrer</button>
                  <button type="button" class="btn btn--secondary btn--small btn--supprimer-utilisateur">Supprimer</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      els.administrationTableau.querySelectorAll("tr[data-index]").forEach((ligne) => {
        const index = Number(ligne.dataset.index);
        ligne.querySelector(".btn--modifier-utilisateur").addEventListener("click", () => {
          const nom = ligne.querySelector(".admin-input--nom").value.trim();
          const role = ligne.querySelector(".admin-input--role").value;
          modifierUtilisateurAction(index, nom, role);
        });
        ligne.querySelector(".btn--supprimer-utilisateur").addEventListener("click", () => {
          if (confirm("Supprimer cet utilisateur ?")) supprimerUtilisateurAction(index);
        });
      });
    }
  }

  async function creerUtilisateurAction(email, nom, role) {
    if (!email) { afficherBanniere("⚠️ L'adresse e-mail est obligatoire.", "warn"); return; }
    try {
      if (!state.modeDemo) {
        await GoogleSheetsAPI.creerUtilisateur({ email, nom, role });
      }
      state.utilisateurs.push({ email: email.toLowerCase(), nom, role, ligne: state.utilisateurs.length + 2 });
      state.controleurs = state.utilisateurs.filter((u) => (ROLES_CONFIG[u.role] || {}).peutControler);
      els.formUtilisateur.reset();
      renderAdministration();
      afficherBanniere("✅ Utilisateur ajouté" + (state.modeDemo ? " (simulation locale)." : "."), "info");
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors de l'ajout : " + e.message.split("\n")[0], "warn");
    }
  }

  async function modifierUtilisateurAction(index, nom, role) {
    const u = state.utilisateurs[index];
    try {
      if (!state.modeDemo) {
        await GoogleSheetsAPI.modifierUtilisateur(u.ligne, { email: u.email, nom, role });
      }
      u.nom = nom; u.role = role;
      state.controleurs = state.utilisateurs.filter((x) => (ROLES_CONFIG[x.role] || {}).peutControler);
      afficherBanniere("✅ Utilisateur modifié" + (state.modeDemo ? " (simulation locale)." : "."), "info");
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors de la modification : " + e.message.split("\n")[0], "warn");
    }
  }

  async function supprimerUtilisateurAction(index) {
    const u = state.utilisateurs[index];
    try {
      if (!state.modeDemo) {
        await GoogleSheetsAPI.supprimerUtilisateur(u.ligne);
      }
      state.utilisateurs.splice(index, 1);
      state.controleurs = state.utilisateurs.filter((x) => (ROLES_CONFIG[x.role] || {}).peutControler);
      renderAdministration();
      afficherBanniere("✅ Utilisateur supprimé" + (state.modeDemo ? " (simulation locale)." : "."), "info");
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur lors de la suppression : " + e.message.split("\n")[0], "warn");
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
})();
