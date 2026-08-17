/**
 * data.js — Jeu de données de DÉMONSTRATION, utilisé par défaut avant que
 * l'utilisateur ne clique sur "Se connecter avec Google" (voir
 * js/google-sheets.js). Reproduit la même forme que les données réelles
 * ({ materiels, typesPointControle, controles }) pour que js/app.js n'ait
 * aucune différence de traitement entre démo et données réelles.
 */

function construireJeuDeDemonstration() {
  const typesPointControle = {
    "Perche isolante": ["État de l'isolant", "Absence de fissure", "Essai diélectrique", "Propreté", "Système de verrouillage", "Étiquette de validité"],
    "LED signalisation": ["Etat général de la lampe", "Absence de fissure ou d'impact important", "Plots de charge", "Attache sur clips", "Autonomie de la lampe", "Contrôle de la batterie"],
    "VAT": ["Test de fonctionnement sur source connue", "État des cordons", "État des pointes de touche", "Autonomie de la pile", "Étalonnage", "Boîtier et voyants"],
    "Drapeau": ["État du tissu", "Fixation sur hampe", "Visibilité / couleur", "Absence de déchirure"],
    "Signal d'arrêt à main": ["État du support", "Visibilité nocturne", "Fixation", "Lisibilité du panneau"],
  };
  const typesPointControleAvecId = {};
  let idPoint = 1;
  Object.entries(typesPointControle).forEach(([categorie, libelles]) => {
    typesPointControleAvecId[categorie] = libelles.map((libelle, i) => ({ id: idPoint++, libelle, ordre: i + 1 }));
  });

  const materiels = [
    { id: 1,  title: "PERCHE 004",               numSerie: "PI56-C2505-004",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service",   periodiciteMois: 6, responsable: "Julien Marchand" },
    { id: 2,  title: "PERCHE 005",                numSerie: "PI56-C2505-005",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service",   periodiciteMois: 6, responsable: "Julien Marchand" },
    { id: 3,  title: "PERCHE 006",                numSerie: "PI56-C2505-006",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service",   periodiciteMois: 6, responsable: "Sophie Nguyen" },
    { id: 4,  title: "PERCHE 007",                numSerie: "PI56-C2505-007",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service",   periodiciteMois: 12, responsable: "Sophie Nguyen" },
    { id: 5,  title: "LED ROUGE N°66",            numSerie: "SAMNG-2305A-07866",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service",   periodiciteMois: 6, responsable: "Amandine Roy" },
    { id: 6,  title: "LED ROUGE N°67",            numSerie: "SAMNG-2305A-07867",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service",   periodiciteMois: 6, responsable: "Sophie Nguyen" },
    { id: 7,  title: "LED ROUGE N°68",            numSerie: "SAMNG-2305A-07868",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service",   periodiciteMois: 6, responsable: "Karim Belaid" },
    { id: 8,  title: "LED ROUGE N°69",            numSerie: "SAMNG-2305A-07869",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service",   periodiciteMois: 6, responsable: "Sophie Nguyen" },
    { id: 9,  title: "LED ROUGE N°70",            numSerie: "SAMNG-2305A-07870",  reference: "SAMNG", categorie: "LED signalisation",    etat: "Hors service", periodiciteMois: 6, responsable: "Karim Belaid" },
    { id: 10, title: "LED ROUGE N°71",            numSerie: "SAMNG-2305A-07871",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service",   periodiciteMois: 6, responsable: "Julien Marchand" },
    { id: 11, title: "LED BLEU N°54",             numSerie: "LECBV2-2411-01154",  reference: "LECBV2", categorie: "LED signalisation",   etat: "En service",   periodiciteMois: 6, responsable: "Amandine Roy" },
    { id: 12, title: "VAT N°09",                  numSerie: "VAT-2023-0009",      reference: "VAT",   categorie: "VAT",                  etat: "Hors service", periodiciteMois: 12, responsable: "Amandine Roy" },
    { id: 13, title: "VAT N°12",                  numSerie: "VAT-2024-0012",      reference: "VAT",   categorie: "VAT",                  etat: "En service",   periodiciteMois: 12, responsable: "Julien Marchand" },
    { id: 14, title: "VAT N°13",                  numSerie: "VAT-2024-0013",      reference: "VAT",   categorie: "VAT",                  etat: "En service",   periodiciteMois: 12, responsable: "Sophie Nguyen" },
    { id: 15, title: "VAT N°14",                  numSerie: "VAT-2024-0014",      reference: "VAT",   categorie: "VAT",                  etat: "En service",   periodiciteMois: 12, responsable: "Amandine Roy" },
    { id: 16, title: "Drapeaux bleu",              numSerie: "DRAP-BL-2026-008",   reference: "DRAP",  categorie: "Drapeau",              etat: "En service",   periodiciteMois: 12, responsable: "Amandine Roy" },
    { id: 17, title: "Drapeaux rouge",             numSerie: "DRAP-RG-2026-009",   reference: "DRAP",  categorie: "Drapeau",              etat: "En service",   periodiciteMois: 12, responsable: "Karim Belaid" },
    { id: 18, title: "Signal d'Arrêt à Main N°5",  numSerie: "SAMNG-2305A-SIG5",   reference: "SAMNG", categorie: "Signal d'arrêt à main", etat: "En service",  periodiciteMois: 6, responsable: "Karim Belaid" },
  ];

  const donneesControles = [
    { materielId: 1,  dateControle: "2026-01-22", controleur: "Julien Marchand", conforme: true,  observations: "Isolant en bon état, essai diélectrique conforme.", actionsCorrectives: "", commentaires: "" },
    { materielId: 2,  dateControle: "2026-02-18", controleur: "Julien Marchand", conforme: true,  observations: "RAS, étiquette de validité à jour.", actionsCorrectives: "", commentaires: "" },
    { materielId: 3,  dateControle: "2026-06-25", controleur: "Sophie Nguyen",   conforme: true,  observations: "Essai diélectrique OK.", actionsCorrectives: "", commentaires: "Contrôle rapproché — renouvellement semestriel." },
    { materielId: 4,  dateControle: "2026-06-15", controleur: "Sophie Nguyen",   conforme: true,  observations: "Bon état, aucune fissure.", actionsCorrectives: "", commentaires: "" },
    { materielId: 5,  dateControle: "2025-12-05", controleur: "Amandine Roy",    conforme: true,  observations: "Conforme sur tous les points.", actionsCorrectives: "", commentaires: "" },
    { materielId: 6,  dateControle: "2026-01-13", controleur: "Sophie Nguyen",   conforme: true,  observations: "Batterie et autonomie conformes.", actionsCorrectives: "", commentaires: "Contrôle rapproché — proche échéance." },
    { materielId: 7,  dateControle: "2025-12-19", controleur: "Karim Belaid",    conforme: false, observations: "Autonomie de la lampe insuffisante.", actionsCorrectives: "Remplacement de la batterie effectué.", commentaires: "", pointNonConforme: "Autonomie de la lampe" },
    { materielId: 8,  dateControle: "2025-12-25", controleur: "Sophie Nguyen",   conforme: false, observations: "Fissure constatée sur le boîtier.", actionsCorrectives: "Remplacement du boîtier programmé.", commentaires: "Non conforme — consigné.", pointNonConforme: "Absence de fissure ou d'impact important" },
    { materielId: 9,  dateControle: "2025-11-27", controleur: "Karim Belaid",    conforme: false, observations: "Lampe hors service, panne électronique.", actionsCorrectives: "Retour atelier pour diagnostic.", commentaires: "", pointNonConforme: "Etat général de la lampe" },
    { materielId: 10, dateControle: "2025-05-16", controleur: "Julien Marchand", conforme: false, observations: "Plots de charge à recontrôler.", actionsCorrectives: "Intervention technicien planifiée.", commentaires: "", pointNonConforme: "Plots de charge" },
    { materielId: 11, dateControle: "2026-06-29", controleur: "Amandine Roy",    conforme: true,  observations: "Etat général, plots de charge et batterie conformes.", actionsCorrectives: "", commentaires: "" },
    { materielId: 12, dateControle: "2024-06-01", controleur: "Amandine Roy",    conforme: false, observations: "Réformé suite chute, boîtier hors service.", actionsCorrectives: "Mise au rebut effectuée.", commentaires: "Sorti du parc matériel.", pointNonConforme: "Boîtier et voyants" },
    { materielId: 13, dateControle: "2026-03-05", controleur: "Julien Marchand", conforme: true,  observations: "Test sur source connue OK, étalonnage à jour.", actionsCorrectives: "", commentaires: "" },
    { materielId: 14, dateControle: "2025-07-14", controleur: "Sophie Nguyen",   conforme: true,  observations: "Cordons et pointes de touche en bon état.", actionsCorrectives: "", commentaires: "Prochain contrôle proche." },
    { materielId: 15, dateControle: "2025-09-18", controleur: "Amandine Roy",    conforme: true,  observations: "Boîtier et voyants vérifiés.", actionsCorrectives: "", commentaires: "" },
    { materielId: 16, dateControle: "2026-01-30", controleur: "Amandine Roy",    conforme: true,  observations: "Tissu et fixation conformes.", actionsCorrectives: "", commentaires: "" },
    { materielId: 17, dateControle: "2026-06-01", controleur: "Karim Belaid",    conforme: true,  observations: "Visibilité et couleur conformes.", actionsCorrectives: "", commentaires: "" },
    { materielId: 18, dateControle: "2026-05-28", controleur: "Karim Belaid",    conforme: true,  observations: "Support et lisibilité du panneau conformes.", actionsCorrectives: "", commentaires: "" },
  ];

  function ajouterMois(dateIso, nbMois) {
    const d = new Date(dateIso + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + nbMois);
    return d.toISOString().slice(0, 10);
  }

  let idControle = 1;
  const controles = donneesControles.map((c) => {
    const materiel = materiels.find((m) => m.id === c.materielId);
    return {
      id: idControle++,
      materielId: materiel.id,
      materiel: materiel.title,
      numSerie: materiel.numSerie,
      reference: materiel.reference,
      categorie: materiel.categorie,
      etat: materiel.etat,
      dateControle: c.dateControle,
      dateProchainControle: ajouterMois(c.dateControle, materiel.periodiciteMois),
      controleur: c.controleur,
      conforme: c.conforme,
      statut: null, // calculé par calculerStatut()
      observations: c.observations,
      actionsCorrectives: c.actionsCorrectives,
      commentaires: c.commentaires,
      pointsControle: genererPointsDemo(materiel.categorie, c.conforme, c.pointNonConforme, typesPointControleAvecId),
    };
  });

  const utilisateurs = [
    { ligne: 2, email: "julien.marchand@example.com", nom: "Julien Marchand", role: "Contrôleur", permissions: ROLES_CONFIG["Contrôleur"].permissions.slice() },
    { ligne: 3, email: "sophie.nguyen@example.com", nom: "Sophie Nguyen", role: "Contrôleur", permissions: ROLES_CONFIG["Contrôleur"].permissions.slice() },
    { ligne: 4, email: "karim.belaid@example.com", nom: "Karim Belaid", role: "Contrôleur", permissions: ROLES_CONFIG["Contrôleur"].permissions.slice() },
    { ligne: 5, email: "amandine.roy@example.com", nom: "Amandine Roy", role: "Administrateur", permissions: ROLES_CONFIG["Administrateur"].permissions.slice(), identifiant: "amandine", motDePasseDemo: "demo1234" },
  ];

  const ressources = [
    { titre: "Procédure de contrôle des perches isolantes", lien: "#", categorie: "Procédures" },
    { titre: "Fiche de sécurité VAT", lien: "#", categorie: "Sécurité" },
  ];

  // -- Programmation GMAO : interventions/réparations (voir docs/11) --------
  // Jeu d'exemple couvrant chaque statut (en attente de validation, planifiée,
  // imminente, en retard, réalisée) pour que la démonstration montre tout de
  // suite le rappel rouge et les couleurs sans configuration.
  const donneesInterventions = [
    {
      materielId: 9, type: "Réparation", dateDemande: "2026-07-10", demandePar: "Karim Belaid",
      dateIntervention: "2026-07-25", dureeHeures: 3, lieu: "Voie 3 — quai Nord",
      impact: "Signalisation LED indisponible sur ce point", consequences: "Report du contrôle visuel manuel en attendant la remise en service",
      intervenant: "Julien Marchand", coupureCatenaire: true, coupureDebut: "09:00", coupureFin: "12:00",
      dateValidation: "2026-07-11", validePar: "Amandine Roy", dateRealisation: "",
      commentaires: "Diagnostic panne électronique en atelier, remplacement de la carte.",
    }, // en retard (date dépassée, non réalisée)
    {
      materielId: 12, type: "Réparation", dateDemande: "2026-07-28", demandePar: "Amandine Roy",
      dateIntervention: "2026-08-04", dureeHeures: 4, lieu: "Atelier caténaire",
      impact: "VAT hors service, aucun contrôle possible sur cet appareil", consequences: "Utilisation d'un VAT de secours en doublon pendant l'immobilisation",
      intervenant: "Sophie Nguyen", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-07-29", validePar: "Amandine Roy", dateRealisation: "",
      commentaires: "",
    }, // imminente (< seuilInterventionImminenteJours)
    {
      materielId: 6, type: "Maintenance préventive", dateDemande: "2026-07-30", demandePar: "Sophie Nguyen",
      dateIntervention: "2026-08-15", dureeHeures: 1.5, lieu: "Poste caténaire secteur B",
      impact: "Aucun — contrôle courant", consequences: "",
      intervenant: "Karim Belaid", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "", validePar: "", dateRealisation: "",
      commentaires: "En attente d'un créneau de coupure caténaire.",
    }, // en attente de validation
    {
      materielId: 3, type: "Maintenance préventive", dateDemande: "2026-06-01", demandePar: "Julien Marchand",
      dateIntervention: "2026-08-20", dureeHeures: 2, lieu: "Zone de stockage perches",
      impact: "", consequences: "",
      intervenant: "Julien Marchand", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-06-02", validePar: "Amandine Roy", dateRealisation: "",
      commentaires: "",
    }, // planifiée
    {
      materielId: 17, type: "Réparation", dateDemande: "2026-05-10", demandePar: "Karim Belaid",
      dateIntervention: "2026-05-20", dureeHeures: 1, lieu: "Local matériel signalisation",
      impact: "Drapeau rouge indisponible temporairement", consequences: "Remplacement provisoire par le drapeau de réserve",
      intervenant: "Karim Belaid", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-05-11", validePar: "Amandine Roy", dateRealisation: "2026-05-20",
      commentaires: "Couture reprise, RAS.",
    }, // réalisée
    {
      // Exemple d'ordre importé d'un plan de maintenance externe type SAP (voir
      // docs/11) : pas de matériel lié (numéros/valeurs fictifs), fenêtre
      // planifiée sur plusieurs semaines plutôt qu'un jour unique, priorité brute.
      materielId: null, materiel: "Signal Cv 5046 (Cv, M)", posteTechnique: "3HMCM-EFE-VDF-VF5",
      type: "Maintenance signal", priorite: "N",
      dateDemande: "2026-01-05", demandePar: "Import PDM 2026",
      dateIntervention: "2026-09-02", dateFinPlanifiee: "2026-11-02", dureeHeures: null, lieu: "",
      impact: "", consequences: "",
      intervenant: "", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-01-05", validePar: "Import PDM 2026", dateRealisation: "",
      commentaires: "",
    }, // planifiée, importée (fenêtre) — illustre le mapping décrit en docs/11
  ];
  let idIntervention = 1;
  const interventions = donneesInterventions.map((iv) => {
    const materiel = iv.materielId ? materiels.find((m) => m.id === iv.materielId) : null;
    return {
      id: idIntervention++,
      materielId: materiel ? materiel.id : null,
      materiel: materiel ? materiel.title : (iv.materiel || ""),
      numSerie: materiel ? materiel.numSerie : "",
      categorie: materiel ? materiel.categorie : "",
      posteTechnique: iv.posteTechnique || "",
      type: iv.type,
      priorite: iv.priorite || "",
      dateDemande: iv.dateDemande,
      demandePar: iv.demandePar,
      dateIntervention: iv.dateIntervention,
      dateFinPlanifiee: iv.dateFinPlanifiee || "",
      dureeHeures: iv.dureeHeures,
      lieu: iv.lieu,
      impact: iv.impact,
      consequences: iv.consequences,
      intervenant: iv.intervenant,
      coupureCatenaire: iv.coupureCatenaire,
      coupureDebut: iv.coupureDebut,
      coupureFin: iv.coupureFin,
      dateValidation: iv.dateValidation,
      validePar: iv.validePar,
      dateRealisation: iv.dateRealisation,
      commentaires: iv.commentaires,
    };
  });

  return { materiels, typesPointControle: typesPointControleAvecId, controles, utilisateurs, ressources, interventions };
}

function genererPointsDemo(categorie, conforme, libelleNonConforme, typesPointControleAvecId) {
  const points = typesPointControleAvecId[categorie] || [];
  return points.map((p) => {
    const nonConforme = !conforme && p.libelle === libelleNonConforme;
    return {
      id: p.id,
      libelle: p.libelle,
      effectue: true,
      rapport: nonConforme ? "Non validé" : "Validé",
      statut: nonConforme ? "Non conforme" : "Conforme",
    };
  });
}

/**
 * Calcule le statut visuel (🟢🟠🔴⚪) d'un contrôle à partir de l'état du
 * matériel et de sa conformité. Même règle portée côté SharePoint par un flux
 * Power Automate quotidien (docs/04, flux 4.2) et côté Power Apps par une
 * formule Switch() (docs/03), pour un rendu identique partout.
 */
function calculerStatut(item, seuilJours = GOOGLE_CONFIG.seuilJours) {
  if (item.etat === "Hors service") return "hs";
  if (!item.conforme) return "nonconforme";

  const aujourdHui = new Date();
  const prochain = new Date(item.dateProchainControle);
  const joursRestants = Math.ceil((prochain - aujourdHui) / (1000 * 60 * 60 * 24));

  if (joursRestants <= seuilJours) return "bientot";
  return "conforme";
}
