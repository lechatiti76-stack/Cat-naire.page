/**
 * data.js — Source de données du registre de vérifications.
 *
 * Jeu de DÉMONSTRATION reproduisant le schéma final à 4 listes SharePoint
 * (voir docs/01-analyse-et-structure-sharepoint.md) : Materiels, TypesPointControle,
 * Controles, ResultatsPointsControle — après jointure Controles + Materiels
 * (une ligne = un contrôle), avec le détail des points de contrôle rattaché.
 *
 * Domaine : équipements de sécurité caténaire ferroviaire (perches isolantes,
 * LED de signalisation, VAT, drapeaux, signaux d'arrêt à main).
 *
 * Pour connecter les vraies listes SharePoint, remplacer le contenu de
 * `materielsData` par un appel à l'API REST ou Microsoft Graph, par ex. :
 *
 *   fetch(`${siteUrl}/_api/web/lists/getbytitle('Controles')/items` +
 *         `?$select=*,Materiel/Title,Materiel/NumSerie,Materiel/Categorie,Materiel/Reference` +
 *         `&$expand=Materiel`, { headers: { Accept: "application/json;odata=verbose" } })
 *     .then(r => r.json())
 *     .then(json => { materielsData = json.d.results.map(mapSharePointItem); initApp(); });
 *
 * puis charger séparément ResultatsPointsControle filtré par Controle.Id pour
 * peupler `pointsControle` de chaque enregistrement.
 */

// Référentiel des points de contrôle par catégorie (liste TypesPointControle)
const typesPointControle = {
  "Perche isolante": ["État de l'isolant", "Absence de fissure", "Essai diélectrique", "Propreté", "Système de verrouillage", "Étiquette de validité"],
  "LED signalisation": ["Etat général de la lampe", "Absence de fissure ou d'impact important", "Plots de charge", "Attache sur clips", "Autonomie de la lampe", "Contrôle de la batterie"],
  "VAT": ["Test de fonctionnement sur source connue", "État des cordons", "État des pointes de touche", "Autonomie de la pile", "Étalonnage", "Boîtier et voyants"],
  "Drapeau": ["État du tissu", "Fixation sur hampe", "Visibilité / couleur", "Absence de déchirure"],
  "Signal d'arrêt à main": ["État du support", "Visibilité nocturne", "Fixation", "Lisibilité du panneau"],
};

function genererPointsControle(categorie, conforme) {
  const libelles = typesPointControle[categorie] || [];
  return libelles.map((libelle, i) => {
    const nonConforme = !conforme && i === 0; // Le point en défaut est signalé sur la 1re ligne pour la démo
    return {
      libelle,
      effectue: true,
      rapport: nonConforme ? "Non validé" : "Validé",
      statut: nonConforme ? "Non conforme" : "Conforme",
    };
  });
}

const materielsData = [
  { id: 1,  materiel: "PERCHE 004",            numSerie: "PI56-C2505-004",     reference: "PI56",  categorie: "Perche isolante",      dateControle: "2026-01-22", dateProchainControle: "2026-07-24", controleur: "Julien Marchand", etat: "En service", conforme: true,  observations: "Isolant en bon état, essai diélectrique conforme.", actionsCorrectives: "", commentaires: "" },
  { id: 2,  materiel: "PERCHE 005",             numSerie: "PI56-C2505-005",     reference: "PI56",  categorie: "Perche isolante",      dateControle: "2026-02-18", dateProchainControle: "2026-08-20", controleur: "Julien Marchand", etat: "En service", conforme: true,  observations: "RAS, étiquette de validité à jour.",                 actionsCorrectives: "", commentaires: "" },
  { id: 3,  materiel: "LED ROUGE N°67",         numSerie: "SAMNG-2305A-07867",  reference: "SAMNG", categorie: "LED signalisation",    dateControle: "2026-01-13", dateProchainControle: "2026-07-15", controleur: "Sophie Nguyen",   etat: "En service", conforme: true,  observations: "Batterie et autonomie conformes.",                    actionsCorrectives: "", commentaires: "Contrôle rapproché — proche échéance." },
  { id: 4,  materiel: "LED ROUGE N°69",         numSerie: "SAMNG-2305A-07869",  reference: "SAMNG", categorie: "LED signalisation",    dateControle: "2025-12-25", dateProchainControle: "2026-06-26", controleur: "Sophie Nguyen",   etat: "En service", conforme: false, observations: "Fissure constatée sur le boîtier.",                   actionsCorrectives: "Remplacement du boîtier programmé.", commentaires: "Non conforme — consigné." },
  { id: 5,  materiel: "LED ROUGE N°68",         numSerie: "SAMNG-2305A-07868",  reference: "SAMNG", categorie: "LED signalisation",    dateControle: "2025-12-19", dateProchainControle: "2026-06-20", controleur: "Karim Belaid",    etat: "En service", conforme: false, observations: "Autonomie de la lampe insuffisante.",                 actionsCorrectives: "Remplacement de la batterie effectué.", commentaires: "" },
  { id: 6,  materiel: "LED ROUGE N°70",         numSerie: "SAMNG-2305A-07870",  reference: "SAMNG", categorie: "LED signalisation",    dateControle: "2025-11-27", dateProchainControle: "2026-05-29", controleur: "Karim Belaid",    etat: "Hors service", conforme: false, observations: "Lampe hors service, panne électronique.",           actionsCorrectives: "Retour atelier pour diagnostic.", commentaires: "" },
  { id: 7,  materiel: "LED ROUGE N°66",         numSerie: "SAMNG-2305A-07866",  reference: "SAMNG", categorie: "LED signalisation",    dateControle: "2025-12-05", dateProchainControle: "2026-06-06", controleur: "Amandine Roy",    etat: "En service", conforme: true,  observations: "Conforme sur tous les points.",                       actionsCorrectives: "", commentaires: "" },
  { id: 8,  materiel: "LED BLEU N°54",          numSerie: "LECBV2-2411-01154",  reference: "LECBV2", categorie: "LED signalisation",   dateControle: "2026-06-29", dateProchainControle: "2026-12-29", controleur: "Amandine Roy",    etat: "En service", conforme: true,  observations: "Etat général, plots de charge et batterie conformes.", actionsCorrectives: "", commentaires: "" },
  { id: 9,  materiel: "VAT N°12",               numSerie: "VAT-2024-0012",      reference: "VAT",   categorie: "VAT",                  dateControle: "2026-03-05", dateProchainControle: "2026-09-05", controleur: "Julien Marchand", etat: "En service", conforme: true,  observations: "Test sur source connue OK, étalonnage à jour.",       actionsCorrectives: "", commentaires: "" },
  { id: 10, materiel: "VAT N°13",               numSerie: "VAT-2024-0013",      reference: "VAT",   categorie: "VAT",                  dateControle: "2025-07-14", dateProchainControle: "2026-07-14", controleur: "Sophie Nguyen",   etat: "En service", conforme: true,  observations: "Cordons et pointes de touche en bon état.",           actionsCorrectives: "", commentaires: "Prochain contrôle proche." },
  { id: 11, materiel: "Drapeaux bleu",          numSerie: "DRAP-BL-2026-008",   reference: "DRAP",  categorie: "Drapeau",              dateControle: "2026-01-30", dateProchainControle: "2027-01-30", controleur: "Amandine Roy",    etat: "En service", conforme: true,  observations: "Tissu et fixation conformes.",                        actionsCorrectives: "", commentaires: "" },
  { id: 12, materiel: "Drapeaux rouge",         numSerie: "DRAP-RG-2026-009",   reference: "DRAP",  categorie: "Drapeau",              dateControle: "2026-06-01", dateProchainControle: "2026-07-15", controleur: "Karim Belaid",    etat: "En service", conforme: true,  observations: "Visibilité et couleur conformes.",                    actionsCorrectives: "", commentaires: "" },
  { id: 13, materiel: "Signal d'Arrêt à Main N°5", numSerie: "SAMNG-2305A-SIG5", reference: "SAMNG", categorie: "Signal d'arrêt à main", dateControle: "2026-05-28", dateProchainControle: "2026-11-28", controleur: "Karim Belaid",    etat: "En service", conforme: true,  observations: "Support et lisibilité du panneau conformes.",         actionsCorrectives: "", commentaires: "" },
  { id: 14, materiel: "PERCHE 006",             numSerie: "PI56-C2505-006",     reference: "PI56",  categorie: "Perche isolante",      dateControle: "2026-06-25", dateProchainControle: "2026-07-25", controleur: "Sophie Nguyen",   etat: "En service", conforme: true,  observations: "Essai diélectrique OK.",                              actionsCorrectives: "", commentaires: "Contrôle rapproché — renouvellement semestriel." },
  { id: 15, materiel: "VAT N°14",               numSerie: "VAT-2024-0014",      reference: "VAT",   categorie: "VAT",                  dateControle: "2025-09-18", dateProchainControle: "2026-09-18", controleur: "Amandine Roy",    etat: "En service", conforme: true,  observations: "Boîtier et voyants vérifiés.",                        actionsCorrectives: "", commentaires: "" },
  { id: 16, materiel: "LED ROUGE N°71",         numSerie: "SAMNG-2305A-07871",  reference: "SAMNG", categorie: "LED signalisation",    dateControle: "2025-05-16", dateProchainControle: "2026-05-16", controleur: "Julien Marchand", etat: "En service", conforme: false, observations: "Plots de charge à recontrôler.",                     actionsCorrectives: "Intervention technicien planifiée.", commentaires: "" },
  { id: 17, materiel: "PERCHE 007",             numSerie: "PI56-C2505-007",     reference: "PI56",  categorie: "Perche isolante",      dateControle: "2026-06-15", dateProchainControle: "2027-06-15", controleur: "Sophie Nguyen",   etat: "En service", conforme: true,  observations: "Bon état, aucune fissure.",                           actionsCorrectives: "", commentaires: "" },
  { id: 18, materiel: "VAT N°09",               numSerie: "VAT-2023-0009",      reference: "VAT",   categorie: "VAT",                  dateControle: "2024-06-01", dateProchainControle: "2025-06-01", controleur: "Amandine Roy",    etat: "Hors service", conforme: false, observations: "Réformé suite chute, boîtier hors service.",         actionsCorrectives: "Mise au rebut effectuée.",           commentaires: "Sorti du parc matériel." },
].map((item) => ({ ...item, pointsControle: genererPointsControle(item.categorie, item.conforme) }));

/**
 * Calcule le statut visuel (🟢🟠🔴⚪) à partir de l'état et de la conformité.
 * Même règle portée côté SharePoint par un flux Power Automate quotidien
 * (voir docs/04, flux 4.2 — préférer à une colonne calculée [Today], qui ne
 * se recalcule pas automatiquement chaque jour) et côté Power Apps par une
 * formule Switch() (voir docs/03), afin de garantir un rendu identique partout.
 *
 * @param {object} item  Un enregistrement de contrôle
 * @param {number} seuilJours  Nombre de jours avant échéance déclenchant "à vérifier prochainement" (30 par défaut)
 */
function calculerStatut(item, seuilJours = 30) {
  if (item.etat === "Hors service") return "hs";
  if (!item.conforme) return "nonconforme";

  const aujourdHui = new Date();
  const prochain = new Date(item.dateProchainControle);
  const joursRestants = Math.ceil((prochain - aujourdHui) / (1000 * 60 * 60 * 24));

  if (joursRestants <= seuilJours) return "bientot";
  return "conforme";
}
