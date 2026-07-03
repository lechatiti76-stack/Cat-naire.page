/**
 * app.js — Logique de l'interface du registre de vérifications.
 * Recherche, filtres multi-critères, tri, statistiques, modale de détail,
 * export CSV et bascule de thème. Aucune dépendance externe.
 */

(function () {
  "use strict";

  const STATUT_LABELS = {
    conforme:    { label: "Conforme",                 badge: "badge--ok",      row: "status-ok" },
    bientot:     { label: "À vérifier prochainement", badge: "badge--warn",    row: "status-warn" },
    nonconforme: { label: "Non conforme",              badge: "badge--danger", row: "status-danger" },
    hs:          { label: "Hors service",              badge: "badge--neutral", row: "status-neutral" },
  };

  let currentSort = { key: "dateControle", dir: "desc" };

  // -- Éléments DOM ---------------------------------------------------------
  const els = {
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
    modalOverlay: document.getElementById("modalOverlay"),
    modalBody: document.getElementById("modalBody"),
    modalClose: document.getElementById("modalClose"),
    table: document.getElementById("dataTable"),
  };

  // -- Initialisation ---------------------------------------------------------
  function init() {
    populateSelect(els.filterCategorie, uniqueValues("categorie"));
    populateSelect(els.filterControleur, uniqueValues("controleur"));
    bindEvents();
    applyTheme(localStorage.getItem("theme") || "light");
    render();
  }

  function uniqueValues(field) {
    return [...new Set(materielsData.map((d) => d[field]))].sort((a, b) => a.localeCompare(b, "fr"));
  }

  function populateSelect(select, values) {
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function bindEvents() {
    [els.search, els.filterCategorie, els.filterConforme, els.filterStatut,
     els.filterControleur, els.filterDateFrom, els.filterDateTo].forEach((el) =>
      el.addEventListener("input", render)
    );

    els.btnReset.addEventListener("click", () => {
      els.search.value = "";
      els.filterCategorie.value = "";
      els.filterConforme.value = "";
      els.filterStatut.value = "";
      els.filterControleur.value = "";
      els.filterDateFrom.value = "";
      els.filterDateTo.value = "";
      render();
    });

    els.btnExport.addEventListener("click", exportCsv);
    els.btnTheme.addEventListener("click", toggleTheme);

    els.table.querySelectorAll("thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        currentSort.dir = currentSort.key === key && currentSort.dir === "asc" ? "desc" : "asc";
        currentSort.key = key;
        render();
      });
    });

    els.modalClose.addEventListener("click", closeModal);
    els.modalOverlay.addEventListener("click", (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // -- Filtrage / recherche / tri ---------------------------------------------
  function getFilteredData() {
    const term = els.search.value.trim().toLowerCase();
    const categorie = els.filterCategorie.value;
    const conforme = els.filterConforme.value;
    const statut = els.filterStatut.value;
    const controleur = els.filterControleur.value;
    const dateFrom = els.filterDateFrom.value;
    const dateTo = els.filterDateTo.value;

    let rows = materielsData.filter((item) => {
      if (term) {
        const haystack = [item.materiel, item.numSerie, item.reference, item.controleur, item.observations]
          .join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (categorie && item.categorie !== categorie) return false;
      if (conforme && (conforme === "oui") !== item.conforme) return false;
      if (controleur && item.controleur !== controleur) return false;
      if (statut && calculerStatut(item) !== statut) return false;
      if (dateFrom && item.dateControle < dateFrom) return false;
      if (dateTo && item.dateControle > dateTo) return false;
      return true;
    });

    rows.sort((a, b) => {
      let va = a[currentSort.key];
      let vb = b[currentSort.key];
      if (currentSort.key === "conforme") { va = va ? 1 : 0; vb = vb ? 1 : 0; }
      if (va < vb) return currentSort.dir === "asc" ? -1 : 1;
      if (va > vb) return currentSort.dir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }

  // -- Rendu --------------------------------------------------------------
  function render() {
    const rows = getFilteredData();
    renderStats(rows);
    renderTable(rows);
    renderSortIndicators();
    els.resultCount.textContent = `${rows.length} résultat${rows.length > 1 ? "s" : ""}`;
  }

  function renderStats(rows) {
    const total = rows.length;
    const counts = { conforme: 0, bientot: 0, nonconforme: 0, hs: 0 };
    rows.forEach((item) => counts[calculerStatut(item)]++);
    const tauxConformite = total ? Math.round((counts.conforme / total) * 100) : 0;

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statConforme").textContent = counts.conforme;
    document.getElementById("statBientot").textContent = counts.bientot;
    document.getElementById("statNonConforme").textContent = counts.nonconforme;
    document.getElementById("statHorsService").textContent = counts.hs;
    document.getElementById("statTaux").textContent = `${tauxConformite}%`;
  }

  function renderTable(rows) {
    els.tableBody.innerHTML = "";
    els.emptyState.hidden = rows.length > 0;

    rows.forEach((item) => {
      const statutKey = calculerStatut(item);
      const statutInfo = STATUT_LABELS[statutKey];

      const tr = document.createElement("tr");
      tr.className = statutInfo.row;
      tr.tabIndex = 0;
      tr.addEventListener("click", () => openModal(item));

      tr.innerHTML = `
        <td class="cell-name">${escapeHtml(item.materiel)}</td>
        <td>${escapeHtml(item.numSerie)}</td>
        <td class="cell-muted">${escapeHtml(item.reference)}</td>
        <td>${escapeHtml(item.categorie)}</td>
        <td>${formatDate(item.dateControle)}</td>
        <td>${formatDate(item.dateProchainControle)}</td>
        <td>${escapeHtml(item.controleur)}</td>
        <td>${escapeHtml(item.etat)}</td>
        <td>${item.conforme
          ? '<span class="badge badge--ok">Oui</span>'
          : '<span class="badge badge--danger">Non</span>'}
        </td>
        <td><span class="cell-truncate" title="${escapeHtml(item.observations)}">${escapeHtml(item.observations) || "—"}</span></td>
        <td><span class="cell-truncate" title="${escapeHtml(item.actionsCorrectives)}">${escapeHtml(item.actionsCorrectives) || "—"}</span></td>
        <td><span class="cell-truncate" title="${escapeHtml(item.commentaires)}">${escapeHtml(item.commentaires) || "—"}</span></td>
      `;
      els.tableBody.appendChild(tr);
    });
  }

  function renderSortIndicators() {
    els.table.querySelectorAll("thead th[data-sort]").forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.dataset.sort === currentSort.key) {
        th.classList.add(currentSort.dir === "asc" ? "sorted-asc" : "sorted-desc");
      }
    });
  }

  // -- Modale de détail ------------------------------------------------------
  function openModal(item) {
    const statutInfo = STATUT_LABELS[calculerStatut(item)];
    document.getElementById("modalTitle").textContent = item.materiel;
    els.modalBody.innerHTML = `
      <span class="badge ${statutInfo.badge}">${statutInfo.label}</span>
      <dl class="modal__grid" style="margin-top:16px;">
        <div class="modal__field"><dt>N° série</dt><dd>${escapeHtml(item.numSerie)}</dd></div>
        <div class="modal__field"><dt>Référence</dt><dd>${escapeHtml(item.reference)}</dd></div>
        <div class="modal__field"><dt>Catégorie</dt><dd>${escapeHtml(item.categorie)}</dd></div>
        <div class="modal__field"><dt>État</dt><dd>${escapeHtml(item.etat)}</dd></div>
        <div class="modal__field"><dt>Conforme</dt><dd>${item.conforme ? "Oui" : "Non"}</dd></div>
        <div class="modal__field"><dt>Date du contrôle</dt><dd>${formatDate(item.dateControle)}</dd></div>
        <div class="modal__field"><dt>Prochain contrôle</dt><dd>${formatDate(item.dateProchainControle)}</dd></div>
        <div class="modal__field"><dt>Contrôleur</dt><dd>${escapeHtml(item.controleur)}</dd></div>
      </dl>
      <div class="modal__section"><h3>Observations</h3><p>${escapeHtml(item.observations) || "—"}</p></div>
      <div class="modal__section"><h3>Actions correctives</h3><p>${escapeHtml(item.actionsCorrectives) || "—"}</p></div>
      <div class="modal__section"><h3>Commentaires</h3><p>${escapeHtml(item.commentaires) || "—"}</p></div>
      <div class="modal__section">
        <h3>Points de contrôle</h3>
        ${renderPointsControle(item.pointsControle)}
      </div>
    `;
    els.modalOverlay.hidden = false;
  }

  function renderPointsControle(points) {
    if (!points || points.length === 0) return "<p>Aucun point de contrôle défini pour cette catégorie.</p>";
    const rows = points.map((p) => {
      const ok = p.statut === "Conforme";
      return `
        <tr>
          <td>${p.effectue ? "✅" : "⬜"}</td>
          <td>${escapeHtml(p.libelle)}</td>
          <td>${escapeHtml(p.rapport)}</td>
          <td><span class="badge ${ok ? "badge--ok" : "badge--danger"}">${escapeHtml(p.statut)}</span></td>
        </tr>`;
    }).join("");
    return `
      <table class="points-controle-table">
        <thead><tr><th></th><th>Point de contrôle</th><th>Rapport</th><th>Statut</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function closeModal() {
    els.modalOverlay.hidden = true;
  }

  // -- Export CSV -------------------------------------------------------------
  function exportCsv() {
    const rows = getFilteredData();
    const headers = ["Matériel", "N° inventaire", "Catégorie", "Date contrôle", "Prochain contrôle",
      "Contrôleur", "État", "Conforme", "Observations", "Actions correctives", "Commentaires"];

    const lines = rows.map((item) => [
      item.materiel, item.numInventaire, item.categorie, item.dateControle, item.dateProchainControle,
      item.controleur, item.etat, item.conforme ? "Oui" : "Non",
      item.observations, item.actionsCorrectives, item.commentaires,
    ].map(csvEscape).join(";"));

    const csvContent = "﻿" + [headers.map(csvEscape).join(";"), ...lines].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verifications-materiel_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const v = String(value ?? "");
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  // -- Thème clair / sombre -----------------------------------------------
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "light" ? "dark" : "light");
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }

  // -- Utilitaires ----------------------------------------------------------
  function formatDate(isoDate) {
    if (!isoDate) return "—";
    const d = new Date(isoDate);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
