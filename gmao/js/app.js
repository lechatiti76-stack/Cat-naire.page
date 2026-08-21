/**
 * app.js — Logique de l'appli GMAO autonome (Interventions & Réparations),
 * détachée du Registre des Vérifications de Matériel (voir ../../js/app.js)
 * mais connectée au même classeur Google Sheets (mêmes onglets Materiels/
 * Utilisateurs/Interventions — voir ../../docs/11-programmation-interventions-gmao.md).
 * Mode démonstration actif par défaut avant connexion, comme l'appli sœur.
 */

(function () {
  "use strict";

  const INTERVENTION_STATUT_LABELS = {
    attente_validation: { label: "En attente de validation", badge: "badge--neutral" },
    planifiee:          { label: "Planifiée",                 badge: "badge--ok" },
    imminente:          { label: "Imminente",                 badge: "badge--warn" },
    retard:             { label: "En retard",                 badge: "badge--danger" },
    realisee:           { label: "Réalisée",                  badge: "badge--neutral" },
  };

  /** Demandeur par défaut des opérations (validation restant à la personne connectée). */
  const DEMANDEUR_PAR_DEFAUT = "DESERT JULIEN";

  const state = {
    materiels: [],
    utilisateurs: [],
    interventions: [],
    referentielInterventions: [],
    controleurs: [],
    role: ROLE_PAR_DEFAUT,
    permissions: [],
    modeDemo: true,
    utilisateur: null,
    vue: "interventions",
    moisCalendrier: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    semaineCourante: lundiDeLaSemaine(new Date()),
  };

  let modalActuel = null;
  const els = {};

  function aPermission(cle) {
    return state.permissions.includes(cle);
  }

  function journaliser(action) {
    const nomUtilisateur = (state.utilisateur && (state.utilisateur.nom || state.utilisateur.email)) || "Anonyme";
    if (state.modeDemo) return;
    GoogleSheetsAPI.enregistrerJournal({ utilisateur: nomUtilisateur, action });
  }

  const CLE_DEJA_CONNECTE = "gsheets_deja_connecte";

  document.addEventListener("DOMContentLoaded", demarrer);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  async function demarrer() {
    cacherElements();
    lierEvenements();
    chargerDemo();
    peuplerFiltresInterventions();
    peuplerDatalistsTravaux();
    afficherVue("interventions");
    applyTheme(localStorage.getItem("theme") || "light");

    if (localStorage.getItem(CLE_DEJA_CONNECTE) === "1" && GOOGLE_CONFIG.spreadsheetId !== "COLLEZ_ICI_L_ID_DE_VOTRE_CLASSEUR") {
      try {
        await connecterGoogle({ silencieux: true });
      } catch (e) {
        // Échec silencieux : reste en mode démonstration.
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
      viewInterventions: document.getElementById("viewInterventions"),
      viewCalendrier: document.getElementById("viewCalendrier"),
      viewSemaine: document.getElementById("viewSemaine"),
      viewInterventionForm: document.getElementById("viewInterventionForm"),
      viewPlanificationForm: document.getElementById("viewPlanificationForm"),
      roleBadge: document.getElementById("roleBadge"),
      btnGoogleConnect: document.getElementById("btnGoogleConnect"),
      btnActualiser: document.getElementById("btnActualiser"),
      btnTheme: document.getElementById("btnTheme"),
      modalOverlay: document.getElementById("modalOverlay"),
      modalTitle: document.getElementById("modalTitle"),
      modalBody: document.getElementById("modalBody"),
      modalClose: document.getElementById("modalClose"),
      bandeauFlash: document.getElementById("bandeauFlash"),
      bandeauFlashPiste: document.getElementById("bandeauFlashPiste"),
      interventionsBanniere: document.getElementById("interventionsBanniere"),
      interventionsBanniereResume: document.getElementById("interventionsBanniereResume"),
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
      btnVoirCalendrier: document.getElementById("btnVoirCalendrier"),
      btnVoirSemaine: document.getElementById("btnVoirSemaine"),
      btnPlanifierIntervention: document.getElementById("btnPlanifierIntervention"),
      btnNouvelleIntervention: document.getElementById("btnNouvelleIntervention"),
      calendrierGrille: document.getElementById("calendrierGrille"),
      calendrierTitre: document.getElementById("calendrierTitre"),
      btnMoisPrecedent: document.getElementById("btnMoisPrecedent"),
      btnMoisSuivant: document.getElementById("btnMoisSuivant"),
      semaineTitre: document.getElementById("semaineTitre"),
      semaineContenu: document.getElementById("semaineContenu"),
      btnSemainePrecedente: document.getElementById("btnSemainePrecedente"),
      btnSemaineSuivante: document.getElementById("btnSemaineSuivante"),
      btnImprimerSemaine: document.getElementById("btnImprimerSemaine"),
      btnEmailSemaine: document.getElementById("btnEmailSemaine"),
      zoneImpression: document.getElementById("zoneImpression"),
      intervFormTitre: document.getElementById("intervFormTitre"),
      intervFormSousTitre: document.getElementById("intervFormSousTitre"),
      intervFormBadgeStatut: document.getElementById("intervFormBadgeStatut"),
      intervMaterielSelect: document.getElementById("intervMaterielSelect"),
      intervReferentielCategorie: document.getElementById("intervReferentielCategorie"),
      intervReferentielType: document.getElementById("intervReferentielType"),
      intervReferentielMateriel: document.getElementById("intervReferentielMateriel"),
      intervMaterielHorsListe: document.getElementById("intervMaterielHorsListe"),
      intervPosteTechnique: document.getElementById("intervPosteTechnique"),
      intervTypeSelect: document.getElementById("intervTypeSelect"),
      intervPriorite: document.getElementById("intervPriorite"),
      intervDate: document.getElementById("intervDate"),
      intervDateFin: document.getElementById("intervDateFin"),
      intervDuree: document.getElementById("intervDuree"),
      intervLieu: document.getElementById("intervLieu"),
      intervIntervenantSelect: document.getElementById("intervIntervenantSelect"),
      intervDemandeurSelect: document.getElementById("intervDemandeurSelect"),
      intervCoupureCatenaire: document.getElementById("intervCoupureCatenaire"),
      intervCoupureChamps: document.getElementById("intervCoupureChamps"),
      intervCoupureDebut: document.getElementById("intervCoupureDebut"),
      intervCoupureFin: document.getElementById("intervCoupureFin"),
      intervImpact: document.getElementById("intervImpact"),
      intervCommentaires: document.getElementById("intervCommentaires"),
      intervDemandeInfo: document.getElementById("intervDemandeInfo"),
      intervResultat: document.getElementById("intervResultat"),
      btnAnnulerIntervention: document.getElementById("btnAnnulerIntervention"),
      btnValiderNouvelleIntervention: document.getElementById("btnValiderNouvelleIntervention"),
      planifInterventionSelect: document.getElementById("planifInterventionSelect"),
      planifDateTheoriqueInfo: document.getElementById("planifDateTheoriqueInfo"),
      planifLieu: document.getElementById("planifLieu"),
      planifDemandeurSelect: document.getElementById("planifDemandeurSelect"),
      planifDateDemande: document.getElementById("planifDateDemande"),
      planifDate: document.getElementById("planifDate"),
      planifHeureDebut: document.getElementById("planifHeureDebut"),
      planifDuree: document.getElementById("planifDuree"),
      planifHeureFin: document.getElementById("planifHeureFin"),
      planifDateValidation: document.getElementById("planifDateValidation"),
      planifValideParInfo: document.getElementById("planifValideParInfo"),
      planifCoupureCatenaire: document.getElementById("planifCoupureCatenaire"),
      planifCoupureChamps: document.getElementById("planifCoupureChamps"),
      planifCoupureDebut: document.getElementById("planifCoupureDebut"),
      planifCoupureFin: document.getElementById("planifCoupureFin"),
      planifRetardInfo: document.getElementById("planifRetardInfo"),
      planifImpact: document.getElementById("planifImpact"),
      planifConsequences: document.getElementById("planifConsequences"),
      planifResultat: document.getElementById("planifResultat"),
      btnAnnulerPlanification: document.getElementById("btnAnnulerPlanification"),
      btnConfirmerPlanification: document.getElementById("btnConfirmerPlanification"),
    });
  }

  function chargerDemo() {
    const demo = construireJeuDeDemonstrationGmao();
    Object.assign(state, demo);
    appliquerNomsLisibles();
    state.modeDemo = true;
    state.role = "Administrateur";
    state.permissions = ROLES_CONFIG["Administrateur"].permissions.slice();
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
      state.modeDemo = false;
      state.utilisateur = utilisateur;
      appliquerDonnees(donnees);
      try { await assurerReferentielInterventionsCharge(); appliquerNomsLisibles(); } catch (e) { console.error(e); }
      localStorage.setItem(CLE_DEJA_CONNECTE, "1");
      afficherVue(state.vue);
      els.headerSubtitle.textContent = `Connecté à Google Sheets — ${state.utilisateur.nom}`;
      els.btnGoogleConnect.textContent = "✅ Connecté";
      afficherBanniere("✅ Connecté à Google Sheets — les données affichées sont réelles.", "info");
      try { afficherRoleBadge(); } catch (e) { console.error(e); }
      try { peuplerFiltresInterventions(); } catch (e) { console.error(e); }
      try { journaliser("Connexion (GMAO)"); } catch (e) { console.error(e); }
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

  function appliquerDonnees(donnees) {
    Object.assign(state, donnees);
    state.controleurs = donnees.utilisateurs.filter((u) => (u.permissions || []).includes("nouveauControle") || (u.permissions || []).includes("nouvelleIntervention"));
    if (state.utilisateur && state.utilisateur.email) {
      const ligneUtilisateur = GoogleSheetsAPI.trouverUtilisateur(state.utilisateur.email, donnees.utilisateurs);
      if (ligneUtilisateur && ligneUtilisateur.nom) state.utilisateur.nom = ligneUtilisateur.nom;
      state.role = GoogleSheetsAPI.determinerRole(state.utilisateur.email, donnees.utilisateurs);
      state.permissions = ligneUtilisateur ? ligneUtilisateur.permissions : (ROLES_CONFIG[state.role] || ROLES_CONFIG[ROLE_PAR_DEFAUT]).permissions;
    }
  }

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
    actualisationEnCours = true;
    if (!silencieux) {
      els.btnActualiser.disabled = true;
      els.btnActualiser.textContent = "🔄 Actualisation…";
    }
    try {
      const donnees = await GoogleSheetsAPI.chargerDonnees();
      appliquerDonnees(donnees);
      try { await assurerReferentielInterventionsCharge(); appliquerNomsLisibles(); } catch (e) { console.error(e); }
      afficherVue(state.vue);
      rafraichirModalOuvert();
      try { peuplerFiltresInterventions(); } catch (e) { console.error(e); }
      try { afficherRoleBadge(); } catch (e) { console.error(e); }
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

  const DUREE_ACTUALISATION_AUTO_MS = 60 * 1000;
  setInterval(() => {
    if (!state.modeDemo && state.vue !== "interventionForm") actualiserDonnees({ silencieux: true });
  }, DUREE_ACTUALISATION_AUTO_MS);

  function afficherBanniere(texte, type) {
    els.bannerEtat.textContent = texte;
    els.bannerEtat.className = "banner banner--" + type;
    els.bannerEtat.hidden = false;
  }

  // -- Navigation --------------------------------------------------------------
  function afficherVue(vue) {
    state.vue = vue;
    els.viewInterventions.hidden = vue !== "interventions";
    els.viewCalendrier.hidden = vue !== "calendrier";
    els.viewSemaine.hidden = vue !== "semaine";
    els.viewInterventionForm.hidden = vue !== "interventionForm";
    els.viewPlanificationForm.hidden = vue !== "planificationForm";

    if (vue === "interventions") {
      els.crumbSep.hidden = true;
      els.crumbCourant.textContent = "";
      renderInterventions();
    } else if (vue === "calendrier") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Calendrier";
      renderCalendrier();
    } else if (vue === "semaine") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Vue semaine";
      renderSemaine();
    } else if (vue === "interventionForm") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Nouvelle intervention";
    } else if (vue === "planificationForm") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Planifier une intervention";
    }
    renderStatsGlobales();
    renderBandeauFlash();
    renderInterventionsBanniere();
  }

  function lierEvenements() {
    els.crumbAccueil.addEventListener("click", () => afficherVue("interventions"));
    els.btnTheme.addEventListener("click", toggleTheme);
    els.btnGoogleConnect.addEventListener("click", connecterGoogle);
    els.btnActualiser.addEventListener("click", () => actualiserDonnees());
    els.btnVoirCalendrier.addEventListener("click", () => afficherVue("calendrier"));
    els.btnVoirSemaine.addEventListener("click", () => afficherVue("semaine"));

    els.modalClose.addEventListener("click", fermerModal);
    els.modalOverlay.addEventListener("click", (e) => { if (e.target === els.modalOverlay) fermerModal(); });
    els.interventionsBanniere.addEventListener("click", () => {
      afficherVue("interventions");
      els.intervFilterStatut.value = "retard";
      renderInterventions();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerModal(); });

    els.btnMoisPrecedent.addEventListener("click", () => {
      state.moisCalendrier.setMonth(state.moisCalendrier.getMonth() - 1);
      renderCalendrier();
    });
    els.btnMoisSuivant.addEventListener("click", () => {
      state.moisCalendrier.setMonth(state.moisCalendrier.getMonth() + 1);
      renderCalendrier();
    });

    els.btnSemainePrecedente.addEventListener("click", () => {
      state.semaineCourante.setDate(state.semaineCourante.getDate() - 7);
      renderSemaine();
    });
    els.btnSemaineSuivante.addEventListener("click", () => {
      state.semaineCourante.setDate(state.semaineCourante.getDate() + 7);
      renderSemaine();
    });
    els.btnImprimerSemaine.addEventListener("click", imprimerSemaine);
    els.btnEmailSemaine.addEventListener("click", envoyerEmailSemaine);

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
    els.intervReferentielCategorie.addEventListener("change", () => {
      renderSelecteurReferentielType(els.intervReferentielCategorie.value);
      renderSelecteurReferentielMateriel("", "");
    });
    els.intervReferentielType.addEventListener("change", () => {
      renderSelecteurReferentielMateriel(els.intervReferentielCategorie.value, els.intervReferentielType.value);
    });
    els.intervReferentielMateriel.addEventListener("change", appliquerSelectionReferentiel);

    els.btnPlanifierIntervention.addEventListener("click", () => ouvrirEcranPlanification());
    els.btnAnnulerPlanification.addEventListener("click", () => afficherVue("interventions"));
    els.btnConfirmerPlanification.addEventListener("click", validerPlanification);
    els.planifInterventionSelect.addEventListener("change", () => chargerInterventionDansPlanification(els.planifInterventionSelect.value));
    [els.planifHeureDebut, els.planifDuree].forEach((el) => el.addEventListener("input", calculerHeureFinPlanification));
    els.planifDate.addEventListener("input", () => mettreAJourRetardInfoDepuisSelection());
    els.planifCoupureCatenaire.addEventListener("change", () => {
      els.planifCoupureChamps.hidden = !els.planifCoupureCatenaire.checked;
      if (els.planifCoupureCatenaire.checked) calculerHeureFinPlanification();
    });
  }

  // -- Statuts calculés (voir docs/11) -----------------------------------------
  function dateEcheanceIntervention(iv) {
    return iv.dateFinPlanifiee || iv.dateIntervention;
  }
  function joursRestantsIntervention(iv) {
    const echeance = dateEcheanceIntervention(iv);
    if (!echeance) return null;
    return Math.ceil((new Date(echeance) - new Date()) / 86400000);
  }
  function statutIntervention(iv) {
    if (iv.dateRealisation) return "realisee";
    if (!iv.dateValidation) return "attente_validation";
    const j = joursRestantsIntervention(iv);
    if (j === null) return "planifiee";
    if (j < 0) return "retard";
    if (j <= GOOGLE_CONFIG.seuilInterventionImminenteJours) return "imminente";
    return "planifiee";
  }

  /** Jours de retard actuel (vs échéance), uniquement pour une intervention pas encore réalisée. Null sinon. */
  function joursDepassementActuel(iv) {
    if (iv.dateRealisation) return null;
    const j = joursRestantsIntervention(iv);
    if (j === null || j >= 0) return null;
    return Math.abs(j);
  }

  /** Écart entre la date de réalisation et l'échéance (positif = réalisée en retard, négatif/nul = à temps), uniquement pour une intervention réalisée. Null sinon. */
  function joursDepassementRealisation(iv) {
    if (!iv.dateRealisation) return null;
    const echeance = dateEcheanceIntervention(iv);
    if (!echeance) return null;
    return Math.round((new Date(iv.dateRealisation) - new Date(echeance)) / 86400000);
  }

  function renderStatsGlobales() {
    const counts = { attente_validation: 0, planifiee: 0, imminente: 0, retard: 0, realisee: 0 };
    state.interventions.forEach((iv) => counts[statutIntervention(iv)]++);
    document.getElementById("statTotal").textContent = state.interventions.length;
    document.getElementById("statPlanifiees").textContent = counts.planifiee;
    document.getElementById("statImminentes").textContent = counts.imminente;
    document.getElementById("statEnRetard").textContent = counts.retard;
    document.getElementById("statAttente").textContent = counts.attente_validation;
  }

  // -- Bandeau flash : rappels des interventions en retard/imminentes ---------
  function renderBandeauFlash() {
    if (!els.bandeauFlash) return;
    const clicable = aPermission("interventions");
    const items = state.interventions.map((iv) => {
      const cle = statutIntervention(iv);
      if (cle !== "retard" && cle !== "imminente") return null;
      const j = joursRestantsIntervention(iv);
      const enRetard = cle === "retard";
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

    if (items.length === 0) {
      els.bandeauFlash.hidden = true;
      els.bandeauFlashPiste.innerHTML = "";
      document.body.classList.remove("a-bandeau-flash");
      return;
    }
    els.bandeauFlash.hidden = false;
    document.body.classList.add("a-bandeau-flash");
    els.bandeauFlashPiste.style.animationDuration = Math.max(18, items.length * 6) + "s";
    const html = items.map((it) =>
      `<button type="button" class="bandeau-flash__item ${it.classeCouleur} ${it.clignote ? "bandeau-flash__item--clignote" : ""} ${clicable ? "" : "bandeau-flash__item--non-cliquable"}" data-intervention="${it.interventionId}">${escapeHtml(it.texte)}</button>`
    ).join("");
    els.bandeauFlashPiste.innerHTML = html + html;
    if (clicable) {
      els.bandeauFlashPiste.querySelectorAll(".bandeau-flash__item").forEach((btn) => {
        btn.addEventListener("click", () => ouvrirDetailIntervention(idDepuisAttribut(btn.dataset.intervention)));
      });
    }
  }

  function idDepuisAttribut(valeur) {
    const nombre = Number(valeur);
    return Number.isNaN(nombre) ? valeur : nombre;
  }

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

  // -- Vue Interventions --------------------------------------------------------
  function populateSelect(select, values) {
    select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function peuplerFiltresInterventions() {
    const categories = [...new Set(state.materiels.map((m) => m.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    populateSelect(els.intervFilterCategorie, categories);
    const types = [...new Set(state.interventions.map((iv) => iv.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    populateSelect(els.intervFilterType, types);
  }

  /** Suggestions (datalists) du formulaire "Nouvelle intervention" à partir du référentiel réel (voir docs/11 §11.6bis). Champs texte libres : ce ne sont que des suggestions, pas des valeurs imposées. */
  function peuplerDatalistsTravaux() {
    const remplir = (id, valeurs) => {
      const liste = document.getElementById(id);
      if (!liste) return;
      liste.innerHTML = valeurs.map((v) => `<option value="${escapeHtml(v)}"></option>`).join("");
    };
    remplir("listeNatureTravaux", REFERENTIEL_TRAVAUX.natureTravaux);
    remplir("listePostesTechniques", REFERENTIEL_TRAVAUX.postesTechniques);
    remplir("listeZones", REFERENTIEL_TRAVAUX.zones);
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
        const haystack = [iv.materiel, iv.numSerie, iv.posteTechnique, iv.lieu, iv.intervenant, iv.impact].join(" ").toLowerCase();
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
    els.btnPlanifierIntervention.hidden = !aPermission("validerIntervention");
    els.btnExportIntervCsv.hidden = !aPermission("exporterCsv");
    els.btnVoirCalendrier.hidden = !aPermission("interventions");

    rows.forEach((iv) => {
      const cle = statutIntervention(iv);
      const info = INTERVENTION_STATUT_LABELS[cle];
      const j = joursRestantsIntervention(iv);
      const ecart = joursEcartTheorique(iv);
      const periode = iv.dateFinPlanifiee && iv.dateFinPlanifiee !== iv.dateIntervention
        ? `${formatDate(iv.dateIntervention)} → ${formatDate(iv.dateFinPlanifiee)}`
        : formatDate(iv.dateIntervention);
      const lieuAffiche = zepAffichable(iv) || iv.posteTechnique;
      const carte = document.createElement("div");
      carte.className = "materiel-card";
      carte.innerHTML = `
        <div class="materiel-card__entete">
          <div>
            <p class="materiel-card__nom">${escapeHtml(iv.materiel || iv.numSerie)}</p>
            <p class="materiel-card__meta">${escapeHtml(iv.type) || "—"} · ${periode}${iv.priorite ? ` · Priorité ${escapeHtml(iv.priorite)}` : ""}${iv.coupureCatenaire ? " · ⚡ Consignation caténaire" : ""}${ecart ? ` · ⏱ ${ecart > 0 ? "+" : ""}${ecart} j vs théorique` : ""}</p>
          </div>
          <span class="badge ${info.badge}">${info.label}</span>
        </div>
        <p class="materiel-card__info">📍 ${escapeHtml(lieuAffiche) || "—"} · 👤 ${escapeHtml(iv.intervenant) || "—"}${cle === "retard" && j !== null ? ` · en retard de ${Math.abs(j)} j` : ""}</p>
        <div class="materiel-card__actions">
          <button class="btn btn--secondary btn--small btn--interv-detail" type="button">Détails</button>
          ${!iv.dateRealisation && aPermission("validerIntervention") ? '<button class="btn btn--primary btn--small btn--interv-planifier" type="button">📌 Planifier</button>' : ""}
          ${iv.dateRealisation && aPermission("validerIntervention") ? '<button class="btn btn--secondary btn--small btn--interv-annuler-realisation" type="button">↩️ Annuler la réalisation</button>' : ""}
        </div>
      `;
      carte.querySelector(".btn--interv-detail").addEventListener("click", () => ouvrirDetailIntervention(iv.id));
      const btnPlanifier = carte.querySelector(".btn--interv-planifier");
      if (btnPlanifier) btnPlanifier.addEventListener("click", () => ouvrirEcranPlanification(iv.id));
      const btnAnnulerRealisation = carte.querySelector(".btn--interv-annuler-realisation");
      if (btnAnnulerRealisation) btnAnnulerRealisation.addEventListener("click", () => annulerRealisationAction(iv.id));
      els.intervCardsGrid.appendChild(carte);
    });
  }

  function csvEscape(value) {
    const v = String(value ?? "");
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  function exporterCsvInterventions() {
    const rows = getFilteredInterventions();
    const headers = ["Matériel", "Poste technique", "Nature des travaux", "Priorité", "Statut", "Date théorique", "Date intervention", "Fin planifiée", "Heure début", "Heure fin", "Durée (h)", "Lieu", "Impact", "Consignation caténaire", "Début consignation", "Fin consignation", "Demandé par", "Date validation", "Validé par", "Date réalisation", "Retard actuel (j)", "Écart réalisation (j)"];
    const lines = rows.map((iv) => [
      iv.materiel, iv.posteTechnique, iv.type, iv.priorite, INTERVENTION_STATUT_LABELS[statutIntervention(iv)].label,
      iv.dateTheorique, iv.dateIntervention, iv.dateFinPlanifiee, iv.heureDebut, iv.heureFin, iv.dureeHeures ?? "", zepAffichable(iv), impactAffichable(iv),
      iv.coupureCatenaire ? "Oui" : "Non", iv.coupureDebut, iv.coupureFin,
      iv.demandePar, iv.dateValidation, iv.validePar, iv.dateRealisation,
      joursDepassementActuel(iv) ?? "", joursDepassementRealisation(iv) ?? "",
    ].map(csvEscape).join(";"));
    const csvContent = "﻿" + [headers.map(csvEscape).join(";"), ...lines].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `interventions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // -- Détail d'une intervention -----------------------------------------------
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
    const ecart = joursEcartTheorique(iv);
    const ecartTexte = ecart === null ? "" : (ecart > 0 ? `retard de ${ecart} jour${ecart > 1 ? "s" : ""}` : `avance de ${Math.abs(ecart)} jour${Math.abs(ecart) > 1 ? "s" : ""}`);

    els.modalTitle.textContent = `🔧 ${iv.materiel || iv.numSerie}`;
    els.modalBody.innerHTML = `
      <span class="badge ${info.badge}">${info.label}</span>
      <dl class="modal__grid" style="margin-top:16px;">
        <div class="modal__field"><dt>Type</dt><dd>${escapeHtml(iv.type) || "—"}</dd></div>
        ${iv.priorite ? `<div class="modal__field"><dt>Priorité</dt><dd>${escapeHtml(iv.priorite)}</dd></div>` : ""}
        <div class="modal__field"><dt>${iv.dateFinPlanifiee ? "Fenêtre planifiée" : "Jour de l'intervention"}</dt><dd>${iv.dateFinPlanifiee ? `${formatDate(iv.dateIntervention)} → ${formatDate(iv.dateFinPlanifiee)}` : formatDate(iv.dateIntervention)}${iv.heureDebut ? ` · ${escapeHtml(iv.heureDebut)}${iv.heureFin ? " → " + escapeHtml(iv.heureFin) : ""}` : ""}</dd></div>
        ${iv.dateTheorique && iv.dateTheorique !== iv.dateIntervention ? `<div class="modal__field"><dt>Date théorique du plan</dt><dd>${formatDate(iv.dateTheorique)}${ecartTexte ? " — " + ecartTexte : ""}</dd></div>` : ""}
        <div class="modal__field"><dt>Durée prévue</dt><dd>${iv.dureeHeures ? escapeHtml(String(iv.dureeHeures)) + " h" : "—"}</dd></div>
        <div class="modal__field"><dt>Lieu / ZEP</dt><dd>${escapeHtml(zepAffichable(iv)) || "—"}</dd></div>
        ${iv.posteTechnique ? `<div class="modal__field"><dt>Poste technique</dt><dd>${escapeHtml(iv.posteTechnique)}</dd></div>` : ""}
        <div class="modal__field"><dt>Consignation caténaire</dt><dd>${iv.coupureCatenaire ? `⚡ Oui (${escapeHtml(iv.coupureDebut) || "?"} → ${escapeHtml(iv.coupureFin) || "?"})` : "Non"}</dd></div>
        <div class="modal__field"><dt>Demande</dt><dd>${formatDate(iv.dateDemande)}${iv.demandePar ? " · " + escapeHtml(iv.demandePar) : ""}</dd></div>
        <div class="modal__field"><dt>Validation</dt><dd>${iv.dateValidation ? formatDate(iv.dateValidation) + (iv.validePar ? " · " + escapeHtml(iv.validePar) : "") : "En attente"}</dd></div>
      </dl>
      <div class="modal__section"><h3>Impact</h3><p style="color:var(--color-danger); font-weight:700;">${escapeHtml(impactAffichable(iv)) || "—"}</p></div>
      ${iv.commentaires ? `<div class="modal__section"><h3>Commentaires</h3><p>${escapeHtml(iv.commentaires)}</p></div>` : ""}
      ${iv.dateRealisation ? `<div class="modal__section"><h3>Réalisée le</h3><p style="font-weight:700;">${formatDate(iv.dateRealisation)}</p></div>` : ""}
      <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
        ${!iv.dateValidation && aPermission("validerIntervention") ? '<button class="btn btn--primary btn--small" id="btnValiderInterventionModal" type="button">✅ Valider</button>' : ""}
        ${!iv.dateRealisation && aPermission("validerIntervention") ? '<button class="btn btn--primary btn--small" id="btnPlanifierInterventionModal" type="button">📌 Planifier</button>' : ""}
        ${iv.dateValidation && !iv.dateRealisation && (aPermission("validerIntervention") || aPermission("nouvelleIntervention")) ? '<button class="btn btn--primary btn--small" id="btnRealiserInterventionModal" type="button">☑️ Marquer réalisée</button>' : ""}
        ${iv.dateRealisation && aPermission("validerIntervention") ? '<button class="btn btn--secondary btn--small" id="btnAnnulerRealisationModal" type="button">↩️ Remettre à l\'état non réalisé</button>' : ""}
        ${!iv.dateRealisation && aPermission("validerIntervention") ? '<button class="btn btn--secondary btn--small" id="btnAnnulerInterventionModal" type="button">🗑️ Annuler la demande</button>' : ""}
      </div>
    `;
    const btnValider = els.modalBody.querySelector("#btnValiderInterventionModal");
    if (btnValider) btnValider.addEventListener("click", () => validerInterventionAction(id));
    const btnPlanifier = els.modalBody.querySelector("#btnPlanifierInterventionModal");
    if (btnPlanifier) btnPlanifier.addEventListener("click", () => { fermerModal(); ouvrirEcranPlanification(id); });
    const btnRealiser = els.modalBody.querySelector("#btnRealiserInterventionModal");
    if (btnRealiser) btnRealiser.addEventListener("click", () => marquerInterventionRealiseeAction(id));
    const btnAnnulerRealisation = els.modalBody.querySelector("#btnAnnulerRealisationModal");
    if (btnAnnulerRealisation) btnAnnulerRealisation.addEventListener("click", () => annulerRealisationAction(id));
    const btnAnnuler = els.modalBody.querySelector("#btnAnnulerInterventionModal");
    if (btnAnnuler) btnAnnuler.addEventListener("click", () => annulerInterventionAction(id));
    els.modalOverlay.hidden = false;
  }

  function fermerModal() { els.modalOverlay.hidden = true; modalActuel = null; }

  function rafraichirModalOuvert() {
    if (!modalActuel || els.modalOverlay.hidden) return;
    if (modalActuel.type === "intervention") {
      const id = modalActuel.id;
      if (state.interventions.some((iv) => iv.id === id)) ouvrirDetailIntervention(id);
      else fermerModal();
    }
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
      renderStatsGlobales(); renderInterventionsBanniere(); renderBandeauFlash();
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
      renderStatsGlobales(); renderInterventionsBanniere(); renderBandeauFlash();
      if (state.vue === "interventions") renderInterventions();
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur : " + e.message, "warn");
    }
  }

  /** Annule un "Marquer réalisée" fait par erreur — remet l'intervention à son état précédent (efface la date de réalisation, sans toucher à la validation). */
  async function annulerRealisationAction(id) {
    const iv = state.interventions.find((x) => x.id === id);
    if (!iv) return;
    if (!confirm(`Remettre "${iv.materiel}" à l'état non réalisé ?`)) return;
    try {
      if (!state.modeDemo) await GoogleSheetsAPI.mettreAJourIntervention(iv.ligne, { ...iv, dateRealisation: "" });
      iv.dateRealisation = "";
      journaliser(`Réalisation annulée — ${iv.materiel} (${formatDate(iv.dateIntervention)})`);
      afficherBanniere("✅ Intervention remise à l'état non réalisé" + (state.modeDemo ? " (simulation locale)." : "."), "info");
      ouvrirDetailIntervention(id);
      renderStatsGlobales(); renderInterventionsBanniere(); renderBandeauFlash();
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
      renderStatsGlobales(); renderInterventionsBanniere(); renderBandeauFlash();
      if (state.vue === "interventions") renderInterventions();
    } catch (e) {
      console.error(e);
      afficherBanniere("⚠️ Erreur : " + e.message, "warn");
    }
  }

  // -- Nouvelle intervention -----------------------------------------------------
  const VALEUR_MATERIEL_HORS_LISTE = "";

  async function ouvrirEcranNouvelleIntervention(materielIdPreselectionne) {
    if (!aPermission("nouvelleIntervention")) {
      afficherBanniere("⛔ Votre rôle (" + state.role + ") ne permet pas de créer une demande d'intervention.", "warn");
      return;
    }
    els.intervFormTitre.textContent = "Nouvelle intervention";
    els.intervFormSousTitre.textContent = "Demande de programmation GMAO";
    els.intervFormBadgeStatut.textContent = "";
    els.intervFormBadgeStatut.className = "badge";
    renderSelecteurMaterielIntervention(materielIdPreselectionne);
    renderSelecteurIntervenant();
    renderSelecteurDemandeur();
    await assurerReferentielInterventionsCharge();
    renderSelecteurReferentielCategorie();
    renderSelecteurReferentielType("");
    renderSelecteurReferentielMateriel("");
    els.intervMaterielHorsListe.value = "";
    els.intervPosteTechnique.value = "";
    els.intervTypeSelect.value = "";
    els.intervPriorite.value = "";
    els.intervDate.value = "";
    els.intervDateFin.value = "";
    els.intervDuree.value = "";
    els.intervLieu.value = "";
    els.intervImpact.value = "";
    els.intervCommentaires.value = "";
    els.intervCoupureCatenaire.checked = false;
    els.intervCoupureChamps.hidden = true;
    els.intervCoupureDebut.value = "";
    els.intervCoupureFin.value = "";
    els.intervDemandeInfo.textContent = `Date de demande : ${formatDate(new Date().toISOString().slice(0, 10))} — nécessitera la validation d'un administrateur.`;
    els.intervResultat.hidden = true;
    els.btnValiderNouvelleIntervention.disabled = false;
    els.btnValiderNouvelleIntervention.textContent = "📩 Enregistrer la demande";
    afficherVue("interventionForm");
  }

  function renderSelecteurMaterielIntervention(materielIdPreselectionne) {
    const optionHorsListe = `<option value="${VALEUR_MATERIEL_HORS_LISTE}">— Hors liste (poste technique ci-dessous) —</option>`;
    els.intervMaterielSelect.innerHTML = optionHorsListe + state.materiels
      .map((m) => `<option value="${m.id}">${escapeHtml(m.title)} (${escapeHtml(m.numSerie)})</option>`)
      .join("");
    if (materielIdPreselectionne) els.intervMaterielSelect.value = materielIdPreselectionne;
  }

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

  /** Noms proposés pour le champ Demandeur — inclut toujours DEMANDEUR_PAR_DEFAUT même s'il n'est pas dans Utilisateurs/Contrôleurs. */
  function nomsDemandeurs() {
    const liste = state.controleurs && state.controleurs.length ? state.controleurs : state.utilisateurs;
    const noms = (liste || []).map((c) => c.nom).filter(Boolean);
    if (!noms.includes(DEMANDEUR_PAR_DEFAUT)) noms.unshift(DEMANDEUR_PAR_DEFAUT);
    return noms;
  }

  /** Peuple le sélecteur Demandeur de "Nouvelle intervention", présélectionné sur DEMANDEUR_PAR_DEFAUT — la validation reste liée à la personne connectée. */
  function renderSelecteurDemandeur() {
    const noms = nomsDemandeurs();
    els.intervDemandeurSelect.innerHTML = noms.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    els.intervDemandeurSelect.value = DEMANDEUR_PAR_DEFAUT;
  }

  // -- Référentiel équipements d'infrastructure : Catégorie → Type → Matériel (voir docs/11 §11.7bis) --
  let referentielInterventionsCharge = false;
  /** Charge une seule fois (mode connecté) le référentiel de l'onglet "Interventions 2" — non chargé par chargerDonnees() car réservé à cet écran. */
  async function assurerReferentielInterventionsCharge() {
    if (state.modeDemo || referentielInterventionsCharge) return;
    try {
      state.referentielInterventions = await GoogleSheetsAPI.chargerReferentielInterventions();
    } catch (e) {
      console.error(e);
    }
    referentielInterventionsCharge = true;
  }

  /**
   * Résout un nom lisible depuis le référentiel (ex. "ADV 5001") pour une
   * valeur brute qui est en fait un code de référence/poste technique (ex.
   * "3HMCM-EFE-ADV-5001") — cas des interventions créées avant la correction
   * du mapping de colonnes (voir docs/11 §11.7bis). Purement pour
   * l'affichage : ne modifie jamais les données stockées dans Google Sheets.
   * Best-effort : si le code n'a pas de suffixe numérique identifiable, ou
   * qu'aucun matériel du référentiel ne s'y termine, la valeur d'origine est
   * renvoyée inchangée.
   */
  /**
   * Retrouve la ligne du référentiel correspondant à une valeur brute (ex.
   * "3HMCM-EFE-ADV-5001" ou déjà "ADV 5001") — par correspondance exacte sur
   * le matériel, sinon par suffixe numérique (voir docs/11 §11.7bis). Sert de
   * base à nomLisibleDepuisReferentiel/zepAffichable/categorieAffichable.
   * Best-effort, jamais garanti : renvoie null si rien ne correspond.
   */
  function trouverLigneReferentiel(brut) {
    if (!brut) return null;
    const parMateriel = state.referentielInterventions.find((r) => r.materiel === brut);
    if (parMateriel) return parMateriel;
    const correspondance = brut.match(/-(\d{3,})$/);
    if (!correspondance) return null;
    const numero = correspondance[1];
    return state.referentielInterventions.find((r) => r.materiel.endsWith(numero)) || null;
  }

  /** Ligne du référentiel pour une intervention (tente son nom, puis son poste technique). */
  function ligneReferentielIntervention(iv) {
    return trouverLigneReferentiel(iv.materiel) || trouverLigneReferentiel(iv.posteTechnique);
  }

  function nomLisibleDepuisReferentiel(brut) {
    const ligne = trouverLigneReferentiel(brut);
    return ligne ? ligne.materiel : brut;
  }

  /** ZEP du référentiel pour une intervention, sinon son Lieu stocké tel quel. */
  function zepAffichable(iv) {
    const ligne = ligneReferentielIntervention(iv);
    return (ligne && ligne.zep) || iv.lieu || "";
  }

  /** Catégorie du référentiel pour une intervention (déduite du matériel/poste technique), sinon sa catégorie stockée (liaison Materiels). */
  function categorieAffichable(iv) {
    if (iv.categorie) return iv.categorie;
    const ligne = ligneReferentielIntervention(iv);
    return ligne ? ligne.categorie : "";
  }

  /**
   * Impact d'une intervention : celui saisi/stocké s'il existe, sinon celui du
   * référentiel (colonne Conséquences du référentiel — voir docs/11 §11.7bis).
   * Les interventions créées avant le câblage du référentiel (ou importées du
   * plan externe) n'ont jamais eu ce champ rempli ; ce repli permet de quand
   * même afficher l'impact connu du matériel concerné.
   */
  function impactAffichable(iv) {
    if (iv.impact) return iv.impact;
    const ligne = ligneReferentielIntervention(iv);
    return ligne ? ligne.consequences : "";
  }

  /**
   * Corrige l'affichage des interventions déjà existantes dont le nom est un
   * code brut du référentiel plutôt qu'un nom lisible (voir
   * nomLisibleDepuisReferentiel) — appelé après chaque chargement des
   * données. Ne réécrit jamais Google Sheets, seulement l'objet en mémoire
   * côté appli.
   */
  function appliquerNomsLisibles() {
    if (!state.referentielInterventions.length) return;
    state.interventions.forEach((iv) => {
      iv.materiel = nomLisibleDepuisReferentiel(iv.materiel);
    });
  }

  function renderSelecteurReferentielCategorie() {
    const categories = [...new Set(state.referentielInterventions.map((r) => r.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    els.intervReferentielCategorie.innerHTML = '<option value="">— Choisir une catégorie —</option>' +
      categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }

  function renderSelecteurReferentielType(categorieSelectionnee) {
    if (!categorieSelectionnee) {
      els.intervReferentielType.innerHTML = '<option value="">— Choisir une catégorie d\'abord —</option>';
      return;
    }
    const types = [...new Set(
      state.referentielInterventions.filter((r) => r.categorie === categorieSelectionnee).map((r) => r.typeMaintenance).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "fr"));
    els.intervReferentielType.innerHTML = '<option value="">— Choisir un type —</option>' +
      types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  }

  function renderSelecteurReferentielMateriel(categorieSelectionnee, typeSelectionne) {
    if (!categorieSelectionnee || !typeSelectionne) {
      els.intervReferentielMateriel.innerHTML = '<option value="">— Choisir un type d\'abord —</option>';
      return;
    }
    const rows = state.referentielInterventions.filter((r) => r.categorie === categorieSelectionnee && r.typeMaintenance === typeSelectionne);
    els.intervReferentielMateriel.innerHTML = '<option value="">— Choisir un matériel —</option>' +
      rows.map((r) => `<option value="${escapeHtml(r.materiel)}">${escapeHtml(r.materiel)}</option>`).join("");
  }

  /**
   * Préremplit Nature des travaux / Nom du matériel / Poste technique / Lieu
   * (ZEP) / Impact depuis la ligne du référentiel choisie (voir docs/11
   * §11.7bis) : Matériel (ex. "ADV 5001") → nom du matériel, Référence (ex.
   * "3HMCM-EFE-ADV") → poste technique, ZEP → lieu/zone, Conséquences (colonne
   * H du référentiel) → Impact. Les champs restent modifiables ensuite.
   */
  function appliquerSelectionReferentiel() {
    const categorieSelectionnee = els.intervReferentielCategorie.value;
    const typeSelectionne = els.intervReferentielType.value;
    const materielSelectionne = els.intervReferentielMateriel.value;
    if (!categorieSelectionnee || !typeSelectionne || !materielSelectionne) return;
    const ligne = state.referentielInterventions.find((r) =>
      r.categorie === categorieSelectionnee && r.typeMaintenance === typeSelectionne && r.materiel === materielSelectionne
    );
    if (!ligne) return;
    els.intervTypeSelect.value = ligne.typeMaintenance;
    els.intervMaterielHorsListe.value = ligne.materiel;
    els.intervPosteTechnique.value = ligne.reference;
    els.intervLieu.value = ligne.zep;
    els.intervImpact.value = ligne.consequences;
  }

  async function validerNouvelleIntervention() {
    const materielId = els.intervMaterielSelect.value ? Number(els.intervMaterielSelect.value) : null;
    const materiel = materielId ? state.materiels.find((m) => m.id === materielId) : null;
    const posteTechnique = els.intervPosteTechnique.value.trim();
    const materielHorsListe = els.intervMaterielHorsListe.value.trim();
    if (!materiel && !posteTechnique && !materielHorsListe) {
      alert("Veuillez sélectionner un matériel dans la liste, ou renseigner un nom de matériel / poste technique.");
      return;
    }
    const dateIntervention = els.intervDate.value;
    if (!dateIntervention) { alert("Veuillez renseigner le jour de l'intervention."); return; }
    const dateFinPlanifiee = els.intervDateFin.value;
    if (dateFinPlanifiee && dateFinPlanifiee < dateIntervention) {
      alert("La fin planifiée ne peut pas être avant le jour de l'intervention.");
      return;
    }
    const coupureCatenaire = els.intervCoupureCatenaire.checked;
    if (coupureCatenaire && (!els.intervCoupureDebut.value || !els.intervCoupureFin.value)) {
      alert("Veuillez renseigner l'heure de début et de fin de la coupure caténaire.");
      return;
    }

    const nom = (state.utilisateur && state.utilisateur.nom) || "";
    const dateDemande = new Date().toISOString().slice(0, 10);
    const nouvelleIntervention = {
      materielId: materiel ? materiel.id : null,
      materiel: materiel ? materiel.title : (materielHorsListe || posteTechnique),
      numSerie: materiel ? materiel.numSerie : "",
      categorie: materiel ? materiel.categorie : "",
      posteTechnique,
      type: els.intervTypeSelect.value,
      priorite: els.intervPriorite.value.trim(),
      dateDemande, demandePar: els.intervDemandeurSelect.value || nom,
      dateIntervention,
      dateFinPlanifiee,
      dureeHeures: els.intervDuree.value ? Number(els.intervDuree.value) : null,
      lieu: els.intervLieu.value.trim(),
      impact: els.intervImpact.value.trim(),
      consequences: "",
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
      journaliser(`Demande d'intervention créée — ${nouvelleIntervention.materiel} — ${dateIntervention}`);
      renderStatsGlobales(); renderInterventionsBanniere(); renderBandeauFlash();
      peuplerFiltresInterventions();
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

  // -- Planification pratique : théorique → date réelle (voir docs/11 §11.8) ---
  /** Écart en jours entre la date théorique du plan et la date réelle programmée (null si sans objet). */
  function joursEcartTheorique(iv) {
    if (!iv.dateTheorique || !iv.dateIntervention || iv.dateTheorique === iv.dateIntervention) return null;
    return Math.round((new Date(iv.dateIntervention) - new Date(iv.dateTheorique)) / 86400000);
  }

  /** Ajoute une durée (en heures, éventuellement décimale) à une heure "HH:MM" — reste dans la même journée. */
  function ajouterHeures(heureDebut, dureeHeures) {
    if (!heureDebut || dureeHeures === null || dureeHeures === undefined || dureeHeures === "" || Number.isNaN(Number(dureeHeures))) return "";
    const [h, m] = heureDebut.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";
    const totalMinutes = h * 60 + m + Math.round(Number(dureeHeures) * 60);
    const finMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(finMinutes / 60)).padStart(2, "0")}:${String(finMinutes % 60).padStart(2, "0")}`;
  }

  /** Recalcule uniquement l'heure de fin affichée (début + durée allouée), sans toucher à la consignation caténaire. */
  function calculerHeureFin() {
    els.planifHeureFin.value = ajouterHeures(els.planifHeureDebut.value, els.planifDuree.value);
  }

  /**
   * Recalcule l'heure de fin et resynchronise la consignation caténaire sur la
   * fenêtre de travail, si elle est cochée — appelé uniquement lors d'une saisie
   * (début/durée modifiés, ou case cochée), jamais au chargement d'une fiche
   * existante (voir chargerInterventionDansPlanification, qui doit respecter des
   * horaires de consignation déjà enregistrés et potentiellement différents).
   */
  function calculerHeureFinPlanification() {
    calculerHeureFin();
    if (els.planifCoupureCatenaire.checked) {
      els.planifCoupureDebut.value = els.planifHeureDebut.value;
      els.planifCoupureFin.value = els.planifHeureFin.value;
    }
  }

  function interventionEnCoursDePlanification() {
    const id = els.planifInterventionSelect.value;
    return id ? state.interventions.find((x) => String(x.id) === String(id)) : null;
  }

  function mettreAJourRetardInfoDepuisSelection() {
    const iv = interventionEnCoursDePlanification();
    const dateTheorique = iv ? (iv.dateTheorique || iv.dateIntervention) : "";
    const nouvelleDate = els.planifDate.value;
    if (!dateTheorique || !nouvelleDate) { els.planifRetardInfo.innerHTML = ""; return; }
    const jours = Math.round((new Date(nouvelleDate) - new Date(dateTheorique)) / 86400000);
    if (jours > 0) {
      els.planifRetardInfo.innerHTML = `<span class="badge badge--warn">⚠ Retard de ${jours} jour${jours > 1 ? "s" : ""} sur le plan théorique (${formatDate(dateTheorique)})</span>`;
    } else if (jours < 0) {
      els.planifRetardInfo.innerHTML = `<span class="badge badge--ok">✅ ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? "s" : ""} d'avance sur le plan théorique (${formatDate(dateTheorique)})</span>`;
    } else {
      els.planifRetardInfo.innerHTML = `<span class="badge badge--ok">✅ Conforme au plan théorique (${formatDate(dateTheorique)})</span>`;
    }
  }

  /** Interventions qu'on peut encore programmer/reprogrammer (tout sauf déjà réalisées). */
  function interventionsPlanifiables() {
    return state.interventions.filter((iv) => !iv.dateRealisation);
  }

  function renderSelecteurPlanification(interventionIdPreselectionnee) {
    const rows = interventionsPlanifiables().sort((a, b) =>
      (a.dateIntervention || "9999-99-99") < (b.dateIntervention || "9999-99-99") ? -1 : 1
    );
    els.planifInterventionSelect.innerHTML = '<option value="">— Sélectionner une intervention —</option>' +
      rows.map((iv) => `<option value="${iv.id}">${escapeHtml(iv.materiel || iv.numSerie)} — théorique ${formatDate(iv.dateTheorique || iv.dateIntervention)}</option>`).join("");
    if (interventionIdPreselectionnee) els.planifInterventionSelect.value = interventionIdPreselectionnee;
  }

  /** Peuple le sélecteur Demandeur de "Planifier" — la présélection (DEMANDEUR_PAR_DEFAUT pour une planification vierge, ou le demandeur déjà enregistré) est faite par l'appelant. */
  function renderSelecteurDemandeurPlanification() {
    const noms = nomsDemandeurs();
    els.planifDemandeurSelect.innerHTML = noms.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  }

  function viderFormulairePlanification() {
    els.planifDateTheoriqueInfo.textContent = "Sélectionnez une intervention ci-dessus pour préremplir sa fiche.";
    els.planifLieu.value = ""; els.planifConsequences.value = ""; els.planifImpact.value = "";
    els.planifDemandeurSelect.value = DEMANDEUR_PAR_DEFAUT;
    els.planifDateDemande.value = "";
    els.planifDate.value = ""; els.planifHeureDebut.value = ""; els.planifDuree.value = "";
    els.planifHeureFin.value = "";
    els.planifCoupureCatenaire.checked = false; els.planifCoupureChamps.hidden = true;
    els.planifCoupureDebut.value = ""; els.planifCoupureFin.value = "";
    els.planifDateValidation.value = new Date().toISOString().slice(0, 10);
    els.planifValideParInfo.textContent = (state.utilisateur && state.utilisateur.nom) || "—";
    els.planifRetardInfo.innerHTML = "";
  }

  /** Précharge la fiche d'une intervention existante dans le formulaire de planification (voir docs/11 §11.8). */
  function chargerInterventionDansPlanification(id) {
    const iv = id ? state.interventions.find((x) => String(x.id) === String(id)) : null;
    if (!iv) { viderFormulairePlanification(); return; }
    const dateTheorique = iv.dateTheorique || iv.dateIntervention || "";
    els.planifDateTheoriqueInfo.textContent = `${iv.type || "Intervention"} — date théorique du plan : ${formatDate(dateTheorique)}`;
    els.planifLieu.value = zepAffichable(iv);
    els.planifConsequences.value = iv.consequences || "";
    els.planifImpact.value = impactAffichable(iv);
    els.planifDemandeurSelect.value = [...els.planifDemandeurSelect.options].some((o) => o.value === iv.demandePar) ? iv.demandePar : DEMANDEUR_PAR_DEFAUT;
    els.planifDateDemande.value = iv.dateDemande || "";
    els.planifDate.value = iv.dateIntervention || "";
    els.planifHeureDebut.value = iv.heureDebut || "";
    els.planifDuree.value = iv.dureeHeures ?? "";
    els.planifCoupureCatenaire.checked = !!iv.coupureCatenaire;
    els.planifCoupureChamps.hidden = !iv.coupureCatenaire;
    els.planifCoupureDebut.value = iv.coupureDebut || "";
    els.planifCoupureFin.value = iv.coupureFin || "";
    calculerHeureFin();
    els.planifDateValidation.value = iv.dateValidation || new Date().toISOString().slice(0, 10);
    els.planifValideParInfo.textContent = (state.utilisateur && state.utilisateur.nom) || iv.validePar || "—";
    mettreAJourRetardInfoDepuisSelection();
  }

  function ouvrirEcranPlanification(interventionIdPreselectionnee) {
    if (!aPermission("validerIntervention")) {
      afficherBanniere("⛔ Votre rôle (" + state.role + ") ne permet pas de planifier une intervention.", "warn");
      return;
    }
    renderSelecteurPlanification(interventionIdPreselectionnee);
    renderSelecteurDemandeurPlanification();
    els.planifResultat.hidden = true;
    els.btnConfirmerPlanification.disabled = false;
    els.btnConfirmerPlanification.textContent = "✅ Confirmer la planification";
    if (interventionIdPreselectionnee) chargerInterventionDansPlanification(interventionIdPreselectionnee);
    else viderFormulairePlanification();
    afficherVue("planificationForm");
  }

  async function validerPlanification() {
    const id = els.planifInterventionSelect.value;
    if (!id) { alert("Veuillez sélectionner l'intervention à planifier."); return; }
    const iv = state.interventions.find((x) => String(x.id) === String(id));
    if (!iv) return;
    const dateIntervention = els.planifDate.value;
    if (!dateIntervention) { alert("Veuillez renseigner la date réelle de l'intervention."); return; }
    const coupureCatenaire = els.planifCoupureCatenaire.checked;
    if (coupureCatenaire && (!els.planifCoupureDebut.value || !els.planifCoupureFin.value)) {
      alert("Veuillez renseigner l'heure de début et de fin de la consignation caténaire.");
      return;
    }
    // La date théorique n'est capturée qu'une seule fois (à la première reprogrammation) :
    // les planifications suivantes ne doivent jamais l'écraser (voir docs/11 §11.8).
    const dateTheorique = iv.dateTheorique || iv.dateIntervention || dateIntervention;

    const maj = {
      ...iv,
      dateTheorique,
      lieu: els.planifLieu.value.trim(),
      consequences: els.planifConsequences.value.trim(),
      impact: els.planifImpact.value.trim(),
      demandePar: els.planifDemandeurSelect.value || iv.demandePar,
      dateDemande: els.planifDateDemande.value || iv.dateDemande,
      dateIntervention,
      heureDebut: els.planifHeureDebut.value,
      heureFin: els.planifHeureFin.value,
      dureeHeures: els.planifDuree.value ? Number(els.planifDuree.value) : null,
      coupureCatenaire,
      coupureDebut: coupureCatenaire ? els.planifCoupureDebut.value : "",
      coupureFin: coupureCatenaire ? els.planifCoupureFin.value : "",
      dateValidation: els.planifDateValidation.value || new Date().toISOString().slice(0, 10),
      validePar: (state.utilisateur && state.utilisateur.nom) || iv.validePar || "",
    };

    els.btnConfirmerPlanification.disabled = true;
    els.btnConfirmerPlanification.textContent = "Enregistrement…";
    try {
      if (!state.modeDemo) await GoogleSheetsAPI.mettreAJourIntervention(iv.ligne, maj);
      Object.assign(iv, maj);
      const ecart = joursEcartTheorique(iv);
      journaliser(`Intervention planifiée — ${iv.materiel} — ${dateIntervention}${ecart ? ` (${ecart > 0 ? "retard" : "avance"} de ${Math.abs(ecart)} j vs théorique)` : ""}`);
      els.planifResultat.hidden = false;
      els.planifResultat.className = "controle-resultat";
      els.planifResultat.innerHTML = `Intervention planifiée pour le ${formatDate(dateIntervention)}${state.modeDemo ? " (simulation locale)" : ""}.`;
      els.btnConfirmerPlanification.textContent = "✅ Planification enregistrée";
      renderStatsGlobales(); renderInterventionsBanniere(); renderBandeauFlash();
      if (state.vue === "interventions") renderInterventions();
      setTimeout(() => afficherVue("interventions"), 1200);
    } catch (e) {
      console.error(e);
      els.planifResultat.hidden = false;
      els.planifResultat.className = "controle-resultat controle-resultat--erreur";
      els.planifResultat.textContent = "Erreur lors de l'enregistrement : " + e.message;
      els.btnConfirmerPlanification.disabled = false;
      els.btnConfirmerPlanification.textContent = "✅ Confirmer la planification";
    }
  }

  // -- Calendrier ----------------------------------------------------------------
  function renderCalendrier() {
    const mois = state.moisCalendrier;
    const annee = mois.getFullYear();
    const moisIndex = mois.getMonth();
    els.calendrierTitre.textContent = mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

    const echeancesInterventions = state.interventions.filter((iv) => iv.dateIntervention);

    const premierJourMois = new Date(annee, moisIndex, 1);
    const decalage = (premierJourMois.getDay() + 6) % 7;
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
      const interventionsJour = echeancesInterventions.filter((iv) => iv.dateIntervention === dateJour);
      const estAujourdhui = dateJour === new Date().toISOString().slice(0, 10);
      html += `
        <div class="calendrier-jour ${estAujourdhui ? "calendrier-jour--aujourdhui" : ""}">
          <span class="calendrier-jour__numero">${jour}</span>
          ${interventionsJour.map((iv) => {
            const info = INTERVENTION_STATUT_LABELS[statutIntervention(iv)];
            const ecart = joursEcartTheorique(iv);
            const titre = `🔧 ${iv.materiel || iv.numSerie}${ecart ? ` (${ecart > 0 ? "+" : ""}${ecart} j)` : ""}`;
            return `<button type="button" class="calendrier-intervention ${info.badge}" title="${escapeHtml(titre)}">${escapeHtml(titre)}</button>`;
          }).join("")}
        </div>`;
    }
    html += `</div>`;
    els.calendrierGrille.innerHTML = html;

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

  // -- Vue semaine : imprimer / envoyer par e-mail les travaux d'une semaine (docs/11 §11.9) --
  /** Lundi 00:00 de la semaine contenant `date` (semaine de travail Lundi→Samedi, comme le classeur "Notes TX"). */
  function lundiDeLaSemaine(date) {
    const d = new Date(date);
    const jour = d.getDay() || 7; // dimanche (0) -> 7
    d.setDate(d.getDate() - jour + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Numéro de semaine ISO-8601 (S1, S2… — même numérotation que les feuilles S1-S52 du classeur "Notes TX"). */
  function numeroSemaineISO(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const jour = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - jour);
    const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - debutAnnee) / 86400000 + 1) / 7);
  }

  function dateISO(date) { return date.toISOString().slice(0, 10); }

  /** Rassemble les données de la semaine affichée (partagé entre l'écran, l'impression et l'e-mail). */
  function construireResumeSemaine() {
    const lundi = state.semaineCourante;
    const samedi = new Date(lundi);
    samedi.setDate(samedi.getDate() + 5);
    const lundiIso = dateISO(lundi);
    const samediIso = dateISO(samedi);

    // Une intervention appartient à la semaine si son jour prévu y tombe, ou si sa
    // fenêtre planifiée (import d'un plan externe, voir docs/11 §11.6) chevauche la
    // semaine — pour ne rien oublier d'actif pendant la période imprimée/envoyée.
    const interventions = state.interventions
      .filter((iv) => {
        if (!iv.dateIntervention) return false;
        const debut = iv.dateIntervention;
        const fin = iv.dateFinPlanifiee || iv.dateIntervention;
        return debut <= samediIso && fin >= lundiIso;
      })
      .sort((a, b) => (a.dateIntervention < b.dateIntervention ? -1 : 1));

    const blocages = interventions.filter((iv) => iv.coupureCatenaire || impactAffichable(iv) || iv.consequences);

    return { lundi, samedi, numeroSemaine: numeroSemaineISO(lundi), interventions, blocages };
  }

  function renderSemaine() {
    const { lundi, samedi, numeroSemaine, interventions, blocages } = construireResumeSemaine();
    els.semaineTitre.textContent = `Semaine S${numeroSemaine} — du ${formatDate(dateISO(lundi))} au ${formatDate(dateISO(samedi))}`;

    if (interventions.length === 0) {
      els.semaineContenu.innerHTML = `<p style="margin-top:16px;">Aucun travaux prévu cette semaine.</p>`;
      return;
    }

    const ligne = (iv) => {
      const cle = statutIntervention(iv);
      const info = INTERVENTION_STATUT_LABELS[cle];
      const jourNom = iv.dateIntervention ? new Date(iv.dateIntervention).toLocaleDateString("fr-FR", { weekday: "long" }) : "";
      const categorie = categorieAffichable(iv);
      const zep = zepAffichable(iv);
      return `
        <div class="historique-ligne">
          <div class="historique-ligne__entete" style="cursor:default;">
            <span>${jourNom ? jourNom.charAt(0).toUpperCase() + jourNom.slice(1) + " " : ""}${formatDate(iv.dateIntervention)} — ${escapeHtml(iv.materiel || iv.numSerie)}</span>
            <span class="badge ${info.badge}">${info.label}</span>
          </div>
          <div class="historique-ligne__detail">
            <p>${categorie ? `<strong>Catégorie :</strong> ${escapeHtml(categorie)} · ` : ""}<strong>Nature des travaux :</strong> ${escapeHtml(iv.type) || "—"}${iv.priorite ? ` (priorité ${escapeHtml(iv.priorite)})` : ""}</p>
            <p><strong>Matériel :</strong> ${escapeHtml(iv.materiel || iv.numSerie) || "—"}</p>
            <p><strong>Début :</strong> ${escapeHtml(iv.heureDebut) || "—"} · <strong>Fin :</strong> ${escapeHtml(iv.heureFin) || "—"}</p>
            <p><strong>Zone (ZEP) :</strong> ${escapeHtml(zep) || "—"}</p>
            ${iv.coupureCatenaire ? `<p><strong>⚡ Consignation caténaire :</strong> ${escapeHtml(iv.coupureDebut) || "?"} → ${escapeHtml(iv.coupureFin) || "?"}</p>` : ""}
            ${impactAffichable(iv) ? `<p style="color:var(--color-danger); font-weight:700;"><strong>Impact :</strong> ${escapeHtml(impactAffichable(iv))}</p>` : ""}
            ${iv.consequences ? `<p><strong>Conséquences / blocages :</strong> ${escapeHtml(iv.consequences)}</p>` : ""}
          </div>
        </div>`;
    };

    els.semaineContenu.innerHTML = `
      <div class="modal__section">
        <h3>Travaux de la semaine (${interventions.length})</h3>
        ${interventions.map(ligne).join("")}
      </div>
      ${blocages.length ? `
        <div class="modal__section">
          <h3>⚠ Blocages / consignations de la semaine (${blocages.length})</h3>
          ${blocages.map(ligne).join("")}
        </div>
      ` : ""}
    `;
  }

  function imprimerSemaine() {
    const { lundi, samedi, numeroSemaine, interventions, blocages } = construireResumeSemaine();
    const genererLigne = (iv) => `
      <tr>
        <td>${formatDate(iv.dateIntervention)}</td>
        <td>${escapeHtml(iv.materiel || iv.numSerie)}</td>
        <td>${escapeHtml(categorieAffichable(iv)) || "—"}</td>
        <td>${escapeHtml(iv.type) || "—"}</td>
        <td>${escapeHtml(iv.heureDebut) || "—"}</td>
        <td>${escapeHtml(iv.heureFin) || "—"}</td>
        <td>${escapeHtml(zepAffichable(iv)) || "—"}</td>
        <td>${iv.coupureCatenaire ? `⚡ ${escapeHtml(iv.coupureDebut) || "?"}-${escapeHtml(iv.coupureFin) || "?"}` : "—"}</td>
        <td>${escapeHtml(INTERVENTION_STATUT_LABELS[statutIntervention(iv)].label)}</td>
      </tr>`;
    els.zoneImpression.innerHTML = `
      <h1>Travaux — Semaine S${numeroSemaine} (${formatDate(dateISO(lundi))} → ${formatDate(dateISO(samedi))})</h1>
      <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead><tr>
          ${["Date", "Matériel", "Catégorie", "Type", "Début", "Fin", "Zone (ZEP)", "Consignation", "Statut"].map((h) => `<th style="border:1px solid #ccc; padding:4px 6px; text-align:left;">${h}</th>`).join("")}
        </tr></thead>
        <tbody>${interventions.map(genererLigne).join("")}</tbody>
      </table>
      ${blocages.length ? `
        <h2>⚠ Blocages / consignations à surveiller</h2>
        ${blocages.map((iv) => `
          <div class="impression-controle">
            <h3>${formatDate(iv.dateIntervention)} — ${escapeHtml(iv.materiel || iv.numSerie)}</h3>
            ${iv.coupureCatenaire ? `<p><strong>Consignation caténaire :</strong> ${escapeHtml(iv.coupureDebut) || "?"} → ${escapeHtml(iv.coupureFin) || "?"}</p>` : ""}
            ${impactAffichable(iv) ? `<p style="color:var(--color-danger); font-weight:700;"><strong>Impact :</strong> ${escapeHtml(impactAffichable(iv))}</p>` : ""}
            ${iv.consequences ? `<p><strong>Conséquences :</strong> ${escapeHtml(iv.consequences)}</p>` : ""}
          </div>
        `).join("")}
      ` : ""}
    `;
    window.print();
  }

  /**
   * Ouvre le client de messagerie par défaut (lien mailto:) avec un résumé de la
   * semaine déjà rédigé. Ce site est statique (sans serveur) : il ne peut pas
   * envoyer un e-mail lui-même, seulement préparer le brouillon — voir docs/11 §11.9.
   */
  function envoyerEmailSemaine() {
    const { lundi, samedi, numeroSemaine, interventions, blocages } = construireResumeSemaine();
    const sujet = `Travaux semaine S${numeroSemaine} — du ${formatDate(dateISO(lundi))} au ${formatDate(dateISO(samedi))}`;
    const ligneTexte = (iv) => `- ${formatDate(iv.dateIntervention)} · ${iv.materiel || iv.numSerie} · ${categorieAffichable(iv) || "—"} / ${iv.type || "—"} · ${iv.heureDebut || "?"}→${iv.heureFin || "?"} · ${zepAffichable(iv) || "—"} (${INTERVENTION_STATUT_LABELS[statutIntervention(iv)].label})`;
    let corps = `Travaux — Semaine S${numeroSemaine} (${formatDate(dateISO(lundi))} au ${formatDate(dateISO(samedi))})\n\n`;
    corps += interventions.length ? interventions.map(ligneTexte).join("\n") : "Aucun travaux prévu cette semaine.";
    if (blocages.length) {
      corps += `\n\n⚠ BLOCAGES / CONSIGNATIONS À SURVEILLER :\n`;
      corps += blocages.map((iv) => {
        const details = [
          iv.coupureCatenaire ? `consignation caténaire ${iv.coupureDebut || "?"}→${iv.coupureFin || "?"}` : "",
          impactAffichable(iv) ? `IMPACT : ${impactAffichable(iv)}` : "",
          iv.consequences ? `conséquences : ${iv.consequences}` : "",
        ].filter(Boolean).join(" — ");
        return `- ${formatDate(iv.dateIntervention)} · ${iv.materiel || iv.numSerie} : ${details}`;
      }).join("\n");
    }
    const lien = `mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
    window.location.href = lien;
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
