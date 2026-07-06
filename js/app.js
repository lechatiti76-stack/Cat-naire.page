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
    modeDemo: true,
    utilisateur: null,
    vue: "accueil",
    categorieCourante: null,
    materielControleCourant: null,
    pointsControleCourants: [],
  };

  let currentSort = { key: "dateControle", dir: "desc" };

  const els = {};

  document.addEventListener("DOMContentLoaded", demarrer);

  async function demarrer() {
    cacherElements();
    lierEvenements();
    chargerDemo();
    peuplerFiltresTableau();
    afficherVue("accueil");
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
      tilesGrid: document.getElementById("tilesGrid"),
      cardsGrid: document.getElementById("cardsGrid"),
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
      controleControleur: document.getElementById("controleControleur"),
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
    state.utilisateur = { id: null, nom: "Utilisateur de démonstration", email: "" };
    els.headerSubtitle.textContent = "Mode démonstration — cliquez sur \"Se connecter avec Google\" pour vos données réelles";
    afficherBanniere("ℹ️ Mode démonstration — données d'exemple, aucune écriture réelle. Connectez-vous à Google pour vos vraies données.", "info");
  }

  async function connecterGoogle() {
    if (GOOGLE_CONFIG.spreadsheetId === "COLLEZ_ICI_L_ID_DE_VOTRE_CLASSEUR") {
      afficherBanniere("⚠️ Configuration incomplète : ajoutez l'ID de votre classeur dans js/google-config.js.", "warn");
      return;
    }
    els.btnGoogleConnect.disabled = true;
    els.btnGoogleConnect.textContent = "Connexion…";
    try {
      await GoogleSheetsAPI.connecter();
      const [donnees, utilisateur] = await Promise.all([
        GoogleSheetsAPI.chargerDonnees(),
        GoogleSheetsAPI.utilisateurCourant(),
      ]);
      Object.assign(state, donnees);
      state.modeDemo = false;
      state.utilisateur = utilisateur;
      els.headerSubtitle.textContent = `Connecté à Google Sheets — ${utilisateur.nom}`;
      els.btnGoogleConnect.textContent = "✅ Connecté";
      afficherBanniere("✅ Connecté à Google Sheets — les données affichées sont réelles et le bouton \"Valider le contrôle\" écrit dans votre classeur.", "info");
      peuplerFiltresTableau();
      afficherVue("accueil");
    } catch (e) {
      console.error(e);
      els.btnGoogleConnect.disabled = false;
      els.btnGoogleConnect.textContent = "🔑 Se connecter avec Google";
      afficherBanniere("⚠️ Connexion à Google impossible : " + e.message.split("\n")[0], "warn");
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
  function afficherVue(vue, options = {}) {
    state.vue = vue;
    els.viewAccueil.hidden = vue !== "accueil";
    els.viewCategorie.hidden = vue !== "categorie";
    els.viewTableau.hidden = vue !== "tableau";
    els.viewControle.hidden = vue !== "controle";

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
          ${statutInfo ? `<span class="badge ${statutInfo.badge}">${statutInfo.label}</span>` : `<span class="badge badge--neutral">Jamais contrôlé</span>`}
        </div>
        <p class="materiel-card__info">État : ${escapeHtml(m.etat)}${c ? ` · Dernier contrôle le ${formatDate(c.dateControle)}` : ""}</p>
        <div class="materiel-card__actions">
          <button class="btn btn--secondary btn--small btn--historique" type="button" ${c ? "" : "disabled"}>Historique</button>
          <button class="btn btn--primary btn--small btn--nouveau-controle" type="button">🆕 Nouveau contrôle</button>
        </div>
      `;
      carte.querySelector(".btn--historique").addEventListener("click", () => ouvrirFicheMateriel(m.id));
      carte.querySelector(".btn--nouveau-controle").addEventListener("click", () => ouvrirEcranControle(m.id));
      els.cardsGrid.appendChild(carte);
    });
  }

  // -- Fiche matériel (historique des contrôles) -----------------------------
  function ouvrirFicheMateriel(materielId) {
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
      <button class="btn btn--primary btn--small" id="btnNouveauControleModal" type="button" style="margin-bottom:16px;">🆕 Nouveau contrôle</button>
      <div class="modal__section">
        <h3>Historique des contrôles (${historique.length})</h3>
        ${historique.length ? historique.map((c, i) => renderLigneHistorique(c, i)).join("") : "<p>Aucun contrôle enregistré pour ce matériel.</p>"}
      </div>
    `;
    els.modalBody.querySelector("#btnNouveauControleModal").addEventListener("click", () => {
      fermerModal();
      ouvrirEcranControle(materielId);
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
    const materiel = state.materiels.find((m) => m.id === materielId);
    state.materielControleCourant = materiel;

    const libellesPoints = (state.typesPointControle[materiel.categorie] || []);
    state.pointsControleCourants = libellesPoints.map((p) => ({ id: p.id, libelle: p.libelle, statut: "Conforme" }));

    els.controleTitreMateriel.textContent = `Nouveau contrôle — ${materiel.title}`;
    els.controleSousTitre.textContent = `${materiel.numSerie} · ${materiel.reference}`;
    els.controleBadgeCategorie.textContent = materiel.categorie;
    els.controleBadgeCategorie.className = "badge badge--neutral";
    els.controleDate.value = new Date().toISOString().slice(0, 10);
    els.controleControleur.textContent = (state.utilisateur && state.utilisateur.nom) || "—";
    els.controleObservations.value = "";
    els.controleActions.value = "";
    els.controleCommentaires.value = "";
    els.controleResultat.hidden = true;
    els.btnValiderControle.disabled = false;
    els.btnValiderControle.textContent = "✅ Valider le contrôle";

    renderPointsControleFormulaire();
    afficherVue("controle");
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

    els.btnValiderControle.disabled = true;
    els.btnValiderControle.textContent = "Enregistrement…";

    try {
      let resultat;
      if (!state.modeDemo) {
        resultat = await GoogleSheetsAPI.enregistrerControle({
          materiel, dateControle, controleurNom: state.utilisateur.nom,
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
          controleur: state.utilisateur.nom, conforme: resultat.conforme, statut: resultat.statut,
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
