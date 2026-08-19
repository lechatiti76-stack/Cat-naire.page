/**
 * data.js — Jeu de données de DÉMONSTRATION pour l'appli GMAO autonome,
 * utilisé par défaut avant connexion à Google Sheets (voir ../../js/google-sheets.js).
 * Volontairement allégé par rapport à ../../js/data.js (pas de contrôles/points de
 * contrôle/ressources — hors du périmètre de cette appli détachée, voir docs/11).
 */

function construireJeuDeDemonstrationGmao() {
  // Référentiel Materiels : uniquement pour permettre de lier une intervention à un
  // équipement existant dans le formulaire (optionnel, voir docs/11 §11.7) — reprend
  // les mêmes exemples que le Registre des Vérifications pour rester cohérent si les
  // deux appareils sont connectés au même classeur.
  const materiels = [
    { id: 1,  title: "PERCHE 004",               numSerie: "PI56-C2505-004",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service" },
    { id: 2,  title: "PERCHE 005",                numSerie: "PI56-C2505-005",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service" },
    { id: 3,  title: "PERCHE 006",                numSerie: "PI56-C2505-006",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service" },
    { id: 4,  title: "PERCHE 007",                numSerie: "PI56-C2505-007",     reference: "PI56",  categorie: "Perche isolante",      etat: "En service" },
    { id: 5,  title: "LED ROUGE N°66",            numSerie: "SAMNG-2305A-07866",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service" },
    { id: 6,  title: "LED ROUGE N°67",            numSerie: "SAMNG-2305A-07867",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service" },
    { id: 7,  title: "LED ROUGE N°68",            numSerie: "SAMNG-2305A-07868",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service" },
    { id: 8,  title: "LED ROUGE N°69",            numSerie: "SAMNG-2305A-07869",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service" },
    { id: 9,  title: "LED ROUGE N°70",            numSerie: "SAMNG-2305A-07870",  reference: "SAMNG", categorie: "LED signalisation",    etat: "Hors service" },
    { id: 10, title: "LED ROUGE N°71",            numSerie: "SAMNG-2305A-07871",  reference: "SAMNG", categorie: "LED signalisation",    etat: "En service" },
    { id: 11, title: "LED BLEU N°54",             numSerie: "LECBV2-2411-01154",  reference: "LECBV2", categorie: "LED signalisation",   etat: "En service" },
    { id: 12, title: "VAT N°09",                  numSerie: "VAT-2023-0009",      reference: "VAT",   categorie: "VAT",                  etat: "Hors service" },
    { id: 13, title: "VAT N°12",                  numSerie: "VAT-2024-0012",      reference: "VAT",   categorie: "VAT",                  etat: "En service" },
    { id: 14, title: "VAT N°13",                  numSerie: "VAT-2024-0013",      reference: "VAT",   categorie: "VAT",                  etat: "En service" },
    { id: 15, title: "VAT N°14",                  numSerie: "VAT-2024-0014",      reference: "VAT",   categorie: "VAT",                  etat: "En service" },
    { id: 16, title: "Drapeaux bleu",              numSerie: "DRAP-BL-2026-008",   reference: "DRAP",  categorie: "Drapeau",              etat: "En service" },
    { id: 17, title: "Drapeaux rouge",             numSerie: "DRAP-RG-2026-009",   reference: "DRAP",  categorie: "Drapeau",              etat: "En service" },
    { id: 18, title: "Signal d'Arrêt à Main N°5",  numSerie: "SAMNG-2305A-SIG5",   reference: "SAMNG", categorie: "Signal d'arrêt à main", etat: "En service" },
  ];

  const utilisateurs = [
    { ligne: 2, email: "julien.marchand@example.com", nom: "Julien Marchand", role: "Contrôleur", permissions: ROLES_CONFIG["Contrôleur"].permissions.slice() },
    { ligne: 3, email: "sophie.nguyen@example.com", nom: "Sophie Nguyen", role: "Contrôleur", permissions: ROLES_CONFIG["Contrôleur"].permissions.slice() },
    { ligne: 4, email: "karim.belaid@example.com", nom: "Karim Belaid", role: "Contrôleur", permissions: ROLES_CONFIG["Contrôleur"].permissions.slice() },
    { ligne: 5, email: "amandine.roy@example.com", nom: "Amandine Roy", role: "Administrateur", permissions: ROLES_CONFIG["Administrateur"].permissions.slice(), identifiant: "amandine", motDePasseDemo: "demo1234" },
  ];

  // Jeu d'exemple couvrant chaque statut (voir docs/11) — identique à celui du
  // Registre des Vérifications pour que les deux appareils restent cohérents.
  const donneesInterventions = [
    {
      materielId: 9, type: "Réparation", dateDemande: "2026-07-10", demandePar: "Karim Belaid",
      dateIntervention: "2026-07-25", dureeHeures: 3, lieu: "Voie 3 — quai Nord",
      impact: "Signalisation LED indisponible sur ce point", consequences: "Report du contrôle visuel manuel en attendant la remise en service",
      intervenant: "Julien Marchand", coupureCatenaire: true, coupureDebut: "09:00", coupureFin: "12:00",
      dateValidation: "2026-07-11", validePar: "Amandine Roy", dateRealisation: "",
      commentaires: "Diagnostic panne électronique en atelier, remplacement de la carte.",
    },
    {
      materielId: 12, type: "Réparation", dateDemande: "2026-07-28", demandePar: "Amandine Roy",
      dateIntervention: "2026-08-04", dureeHeures: 4, lieu: "Atelier caténaire",
      impact: "VAT hors service, aucun contrôle possible sur cet appareil", consequences: "Utilisation d'un VAT de secours en doublon pendant l'immobilisation",
      intervenant: "Sophie Nguyen", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-07-29", validePar: "Amandine Roy", dateRealisation: "",
      commentaires: "",
    },
    {
      materielId: 6, type: "Maintenance préventive", dateDemande: "2026-07-30", demandePar: "Sophie Nguyen",
      dateIntervention: "2026-08-15", dureeHeures: 1.5, lieu: "Poste caténaire secteur B",
      impact: "Aucun — contrôle courant", consequences: "",
      intervenant: "Karim Belaid", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "", validePar: "", dateRealisation: "",
      commentaires: "En attente d'un créneau de coupure caténaire.",
    },
    {
      materielId: 3, type: "Maintenance préventive", dateDemande: "2026-06-01", demandePar: "Julien Marchand",
      dateIntervention: "2026-08-20", dureeHeures: 2, lieu: "Zone de stockage perches",
      impact: "", consequences: "",
      intervenant: "Julien Marchand", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-06-02", validePar: "Amandine Roy", dateRealisation: "",
      commentaires: "",
    },
    {
      materielId: 17, type: "Réparation", dateDemande: "2026-05-10", demandePar: "Karim Belaid",
      dateIntervention: "2026-05-20", dureeHeures: 1, lieu: "Local matériel signalisation",
      impact: "Drapeau rouge indisponible temporairement", consequences: "Remplacement provisoire par le drapeau de réserve",
      intervenant: "Karim Belaid", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-05-11", validePar: "Amandine Roy", dateRealisation: "2026-05-20",
      commentaires: "Couture reprise, RAS.",
    },
    {
      materielId: null, materiel: "Signal Cv 5046 (Cv, M)", posteTechnique: "3HMCM-EFE-VDF-VF5",
      type: "Maintenance signal", priorite: "N",
      dateDemande: "2026-01-05", demandePar: "Import PDM 2026",
      dateIntervention: "2026-09-02", dateFinPlanifiee: "2026-11-02", dureeHeures: null, lieu: "",
      impact: "", consequences: "",
      intervenant: "", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-01-05", validePar: "Import PDM 2026", dateRealisation: "",
      commentaires: "",
    },
    {
      // Exemple d'intervention importée avant le câblage du référentiel Interventions 2
      // (voir docs/11 §11.7bis/§11.7ter) : ni Lieu ni Impact n'ont jamais été saisis,
      // seul le poste technique brut de l'import est connu — démontre la résolution
      // best-effort ZEP/Impact depuis le référentiel (zepAffichable/impactAffichable).
      materielId: null, materiel: "3HMCM-EFE-ADV-5009", posteTechnique: "3HMCM-EFE-ADV-5009",
      type: "Maintenance ADV (commande mécanique)", priorite: "C",
      dateDemande: "2026-06-01", demandePar: "Import PDM 2026",
      dateIntervention: "2026-10-05", dureeHeures: null, lieu: "",
      impact: "", consequences: "",
      intervenant: "", coupureCatenaire: false, coupureDebut: "", coupureFin: "",
      dateValidation: "2026-06-02", validePar: "Import PDM 2026", dateRealisation: "",
      commentaires: "",
    },
    {
      // Exemple de planification pratique (voir docs/11 §11.8) : date théorique du
      // plan de maintenance annuel reprogrammée à une date réelle plus tardive,
      // avec horaires et lieu/conséquences déjà connus de la fiche.
      materielId: null, materiel: "ADV 5028", posteTechnique: "3HMCM-EFE-ADV-5028",
      type: "Maintenance signal", priorite: "N",
      dateDemande: "2026-06-01", demandePar: "Import PDM 2026",
      dateTheorique: "2026-09-05",
      dateIntervention: "2026-09-12", dureeHeures: 4, heureDebut: "08:00", heureFin: "12:00",
      lieu: "LE HAVRE — ADV 5028",
      impact: "Signal ADV indisponible pendant l'intervention", consequences: "Marche à vue temporaire sur le secteur concerné",
      intervenant: "Julien Marchand", coupureCatenaire: true, coupureDebut: "08:00", coupureFin: "12:00",
      dateValidation: "2026-08-15", validePar: "Amandine Roy", dateRealisation: "",
      commentaires: "Reprogrammée depuis le 05/09 (plan théorique) via l'écran \"Planifier\".",
    },
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
      dateTheorique: iv.dateTheorique || "",
      heureDebut: iv.heureDebut || "",
      heureFin: iv.heureFin || "",
    };
  });

  // Référentiel équipements d'infrastructure (voir docs/11 §11.7bis) : extrait de
  // l'onglet réel "Interventions 2" de l'utilisateur, pour que le sélecteur en
  // cascade de "Nouvelle intervention" soit démontrable sans connexion Google.
  const referentielInterventions = [
    { categorie: "JGP", reference: "3HMCM", typeMaintenance: "Entretien JGP (dont graissage)", materiel: "JGP", zep: "", consequences: "" },
    { categorie: "ADV", reference: "3HMCM-EFE-ADV", typeMaintenance: "Maintenance ADV (commande électrique)", materiel: "ADV 5001", zep: "ZEP 5041", consequences: "Accès site interdit" },
    { categorie: "ADV", reference: "3HMCM-EFE-ADV", typeMaintenance: "Maintenance ADV (commande mécanique)", materiel: "ADV 5005", zep: "ZEP 5039", consequences: "Accès réception interdit côté PARIS" },
    { categorie: "ADV", reference: "3HMCM-EFE-ADV", typeMaintenance: "Maintenance ADV (commande mécanique)", materiel: "ADV 5009", zep: "ZEP 5028", consequences: "Accès ferroviaire et fluvial interdit côté PARIS" },
    { categorie: "ADV", reference: "3HMCM-EFE-ADV", typeMaintenance: "Maintenance ADV (commande mécanique)", materiel: "ADV 5010", zep: "ZEP 5038", consequences: "Accès VR5 et VR6 interdit côté PARIS" },
    { categorie: "ADV", reference: "3HMCM-EFE-ADV", typeMaintenance: "Maintenance ADV (commande mécanique)", materiel: "ADV 5011", zep: "ZEP 5025", consequences: "Accès ferroviaire interdit côté PARIS" },
    { categorie: "ADV", reference: "3HMCM-EFE-ADV", typeMaintenance: "Maintenance ADV (commande mécanique)", materiel: "ADV 5028", zep: "ZEP 5041", consequences: "Accès site interdit" },
  ];

  return { materiels, utilisateurs, interventions, referentielInterventions };
}
