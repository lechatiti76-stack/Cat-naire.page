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

  const state = {
    materiels: [],
    utilisateurs: [],
    interventions: [],
    controleurs: [],
    role: ROLE_PAR_DEFAUT,
    permissions: [],
    modeDemo: true,
    utilisateur: null,
    vue: "interventions",
    moisCalendrier: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
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
      viewInterventionForm: document.getElementById("viewInterventionForm"),
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
      btnNouvelleIntervention: document.getElementById("btnNouvelleIntervention"),
      calendrierGrille: document.getElementById("calendrierGrille"),
      calendrierTitre: document.getElementById("calendrierTitre"),
      btnMoisPrecedent: document.getElementById("btnMoisPrecedent"),
      btnMoisSuivant: document.getElementById("btnMoisSuivant"),
      intervFormTitre: document.getElementById("intervFormTitre"),
      intervFormSousTitre: document.getElementById("intervFormSousTitre"),
      intervFormBadgeStatut: document.getElementById("intervFormBadgeStatut"),
      intervMaterielSelect: document.getElementById("intervMaterielSelect"),
      intervPosteTechnique: document.getElementById("intervPosteTechnique"),
      intervTypeSelect: document.getElementById("intervTypeSelect"),
      intervPriorite: document.getElementById("intervPriorite"),
      intervDate: document.getElementById("intervDate"),
      intervDateFin: document.getElementById("intervDateFin"),
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

  function chargerDemo() {
    const demo = construireJeuDeDemonstrationGmao();
    Object.assign(state, demo);
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
    els.viewInterventionForm.hidden = vue !== "interventionForm";

    if (vue === "interventions") {
      els.crumbSep.hidden = true;
      els.crumbCourant.textContent = "";
      renderInterventions();
    } else if (vue === "calendrier") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Calendrier";
      renderCalendrier();
    } else if (vue === "interventionForm") {
      els.crumbSep.hidden = false;
      els.crumbCourant.textContent = "Nouvelle intervention";
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
    els.btnExportIntervCsv.hidden = !aPermission("exporterCsv");
    els.btnVoirCalendrier.hidden = !aPermission("interventions");

    rows.forEach((iv) => {
      const cle = statutIntervention(iv);
      const info = INTERVENTION_STATUT_LABELS[cle];
      const j = joursRestantsIntervention(iv);
      const periode = iv.dateFinPlanifiee && iv.dateFinPlanifiee !== iv.dateIntervention
        ? `${formatDate(iv.dateIntervention)} → ${formatDate(iv.dateFinPlanifiee)}`
        : formatDate(iv.dateIntervention);
      const lieuAffiche = [iv.lieu, iv.posteTechnique].filter(Boolean).join(" · ");
      const carte = document.createElement("div");
      carte.className = "materiel-card";
      carte.innerHTML = `
        <div class="materiel-card__entete">
          <div>
            <p class="materiel-card__nom">${escapeHtml(iv.materiel || iv.numSerie)}</p>
            <p class="materiel-card__meta">${escapeHtml(iv.type) || "—"} · ${periode}${iv.priorite ? ` · Priorité ${escapeHtml(iv.priorite)}` : ""}${iv.coupureCatenaire ? " · ⚡ Consignation caténaire" : ""}</p>
          </div>
          <span class="badge ${info.badge}">${info.label}</span>
        </div>
        <p class="materiel-card__info">📍 ${escapeHtml(lieuAffiche) || "—"} · 👤 ${escapeHtml(iv.intervenant) || "—"}${cle === "retard" && j !== null ? ` · en retard de ${Math.abs(j)} j` : ""}</p>
        <div class="materiel-card__actions">
          <button class="btn btn--secondary btn--small btn--interv-detail" type="button">Détails</button>
        </div>
      `;
      carte.querySelector(".btn--interv-detail").addEventListener("click", () => ouvrirDetailIntervention(iv.id));
      els.intervCardsGrid.appendChild(carte);
    });
  }

  function csvEscape(value) {
    const v = String(value ?? "");
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  function exporterCsvInterventions() {
    const rows = getFilteredInterventions();
    const headers = ["Matériel", "N° série", "Poste technique", "Nature des travaux", "Priorité", "Statut", "Date intervention", "Fin planifiée", "Durée (h)", "Lieu", "Impact", "Conséquences", "Intervenant", "Consignation caténaire", "Début consignation", "Fin consignation", "Date demande", "Demandé par", "Date validation", "Validé par", "Date réalisation", "Commentaires"];
    const lines = rows.map((iv) => [
      iv.materiel, iv.numSerie, iv.posteTechnique, iv.type, iv.priorite, INTERVENTION_STATUT_LABELS[statutIntervention(iv)].label,
      iv.dateIntervention, iv.dateFinPlanifiee, iv.dureeHeures ?? "", iv.lieu, iv.impact, iv.consequences, iv.intervenant,
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

    els.modalTitle.textContent = `🔧 ${iv.materiel || iv.numSerie}`;
    els.modalBody.innerHTML = `
      <span class="badge ${info.badge}">${info.label}</span>
      <dl class="modal__grid" style="margin-top:16px;">
        <div class="modal__field"><dt>Type</dt><dd>${escapeHtml(iv.type) || "—"}</dd></div>
        ${iv.priorite ? `<div class="modal__field"><dt>Priorité</dt><dd>${escapeHtml(iv.priorite)}</dd></div>` : ""}
        <div class="modal__field"><dt>${iv.dateFinPlanifiee ? "Fenêtre planifiée" : "Jour de l'intervention"}</dt><dd>${iv.dateFinPlanifiee ? `${formatDate(iv.dateIntervention)} → ${formatDate(iv.dateFinPlanifiee)}` : formatDate(iv.dateIntervention)}</dd></div>
        <div class="modal__field"><dt>Durée prévue</dt><dd>${iv.dureeHeures ? escapeHtml(String(iv.dureeHeures)) + " h" : "—"}</dd></div>
        <div class="modal__field"><dt>Lieu</dt><dd>${escapeHtml(iv.lieu) || "—"}</dd></div>
        ${iv.posteTechnique ? `<div class="modal__field"><dt>Poste technique</dt><dd>${escapeHtml(iv.posteTechnique)}</dd></div>` : ""}
        <div class="modal__field"><dt>Intervenant</dt><dd>${escapeHtml(iv.intervenant) || "—"}</dd></div>
        <div class="modal__field"><dt>Consignation caténaire</dt><dd>${iv.coupureCatenaire ? `⚡ Oui (${escapeHtml(iv.coupureDebut) || "?"} → ${escapeHtml(iv.coupureFin) || "?"})` : "Non"}</dd></div>
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

  function ouvrirEcranNouvelleIntervention(materielIdPreselectionne) {
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
    els.intervPosteTechnique.value = "";
    els.intervTypeSelect.value = "";
    els.intervPriorite.value = "";
    els.intervDate.value = "";
    els.intervDateFin.value = "";
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

  async function validerNouvelleIntervention() {
    const materielId = els.intervMaterielSelect.value ? Number(els.intervMaterielSelect.value) : null;
    const materiel = materielId ? state.materiels.find((m) => m.id === materielId) : null;
    const posteTechnique = els.intervPosteTechnique.value.trim();
    if (!materiel && !posteTechnique) {
      alert("Veuillez sélectionner un matériel dans la liste, ou renseigner un poste technique / nom d'équipement.");
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
      materiel: materiel ? materiel.title : posteTechnique,
      numSerie: materiel ? materiel.numSerie : "",
      categorie: materiel ? materiel.categorie : "",
      posteTechnique,
      type: els.intervTypeSelect.value,
      priorite: els.intervPriorite.value.trim(),
      dateDemande, demandePar: nom,
      dateIntervention,
      dateFinPlanifiee,
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
            const titre = `🔧 ${iv.materiel || iv.numSerie}`;
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
