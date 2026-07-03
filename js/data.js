/**
 * data.js — Source de données du registre de vérifications.
 *
 * Ce jeu de données est un JEU DE DÉMONSTRATION qui reproduit exactement le
 * schéma des colonnes des listes SharePoint "Matériels" + "Controles"
 * décrites dans docs/01-analyse-et-structure-sharepoint.md, après jointure
 * (une ligne = un contrôle, enrichi des informations du matériel concerné).
 *
 * Pour connecter la vraie liste SharePoint, remplacez le contenu de
 * `materielsData` par un appel à l'API REST ou Microsoft Graph, par ex. :
 *
 *   fetch(`${siteUrl}/_api/web/lists/getbytitle('Controles')/items` +
 *         `?$select=*,Materiel/Title,Materiel/NumInventaire,Materiel/Categorie` +
 *         `&$expand=Materiel`, { headers: { Accept: "application/json;odata=verbose" } })
 *     .then(r => r.json())
 *     .then(json => { materielsData = json.d.results.map(mapSharePointItem); initApp(); });
 *
 * Chaque champ ci-dessous correspond 1:1 à une colonne SharePoint (voir docs).
 */

const materielsData = [
  { id: 1,  materiel: "Extincteur CO2 5kg",         numInventaire: "EXT-001", categorie: "Extincteur",            dateControle: "2026-05-12", dateProchainControle: "2027-05-12", controleur: "Julien Marchand", etat: "En service",   conforme: true,  observations: "Pression correcte, goupille en place.", actionsCorrectives: "",                                  commentaires: "RAS" },
  { id: 2,  materiel: "Extincteur eau pulvérisée 6L", numInventaire: "EXT-002", categorie: "Extincteur",          dateControle: "2025-08-03", dateProchainControle: "2026-08-03", controleur: "Julien Marchand", etat: "En service",   conforme: true,  observations: "Contrôle annuel effectué.",              actionsCorrectives: "",                                  commentaires: "" },
  { id: 3,  materiel: "Échelle télescopique 4m",     numInventaire: "ECH-014", categorie: "Échelle",              dateControle: "2026-06-20", dateProchainControle: "2026-07-20", controleur: "Sophie Nguyen",   etat: "En service",   conforme: true,  observations: "Bon état général, patins antidérapants OK.", actionsCorrectives: "",                             commentaires: "Contrôle rapproché suite usage intensif." },
  { id: 4,  materiel: "Harnais antichute H1",        numInventaire: "EPI-102", categorie: "EPI",                  dateControle: "2026-02-15", dateProchainControle: "2026-08-15", controleur: "Sophie Nguyen",   etat: "En service",   conforme: false, observations: "Sangle effilochée au niveau du point d'attache dorsal.", actionsCorrectives: "Retrait immédiat, commande de remplacement en cours.", commentaires: "Non conforme — consigné." },
  { id: 5,  materiel: "Perceuse à percussion 18V",   numInventaire: "OUT-045", categorie: "Outillage électrique", dateControle: "2026-04-02", dateProchainControle: "2026-10-02", controleur: "Karim Belaid",    etat: "En service",   conforme: true,  observations: "Câble et carter intacts.",               actionsCorrectives: "",                                  commentaires: "" },
  { id: 6,  materiel: "Meuleuse d'angle 125mm",      numInventaire: "OUT-051", categorie: "Outillage électrique", dateControle: "2025-12-10", dateProchainControle: "2026-06-10", controleur: "Karim Belaid",    etat: "En réparation", conforme: false, observations: "Carter de protection fissuré.",           actionsCorrectives: "Envoyée en réparation le 18/06.",   commentaires: "En attente de pièce détachée." },
  { id: 7,  materiel: "Palan électrique 500kg",      numInventaire: "LEV-007", categorie: "Engin de levage",      dateControle: "2026-01-22", dateProchainControle: "2026-07-22", controleur: "Amandine Roy",    etat: "En service",   conforme: true,  observations: "Essai en charge réalisé, freins conformes.", actionsCorrectives: "",                              commentaires: "" },
  { id: 8,  materiel: "Chariot élévateur CE-3",      numInventaire: "VEH-003", categorie: "Véhicule",             dateControle: "2026-03-05", dateProchainControle: "2026-09-05", controleur: "Amandine Roy",    etat: "En service",   conforme: true,  observations: "Freinage et éclairage vérifiés.",         actionsCorrectives: "",                                  commentaires: "" },
  { id: 9,  materiel: "Nacelle élévatrice N2",       numInventaire: "VEH-011", categorie: "Véhicule",             dateControle: "2025-07-14", dateProchainControle: "2026-07-14", controleur: "Julien Marchand", etat: "En service",   conforme: true,  observations: "Stabilisateurs et sécurités testés.",     actionsCorrectives: "",                                  commentaires: "Prochain contrôle proche — planifier créneau atelier." },
  { id: 10, materiel: "Casque de protection C-22",   numInventaire: "EPI-118", categorie: "EPI",                  dateControle: "2026-01-30", dateProchainControle: "2027-01-30", controleur: "Sophie Nguyen",   etat: "En service",   conforme: true,  observations: "Coque et jugulaire en bon état.",         actionsCorrectives: "",                                  commentaires: "" },
  { id: 11, materiel: "Groupe électrogène GE-2",     numInventaire: "OUT-060", categorie: "Outillage électrique", dateControle: "2024-11-01", dateProchainControle: "2025-11-01", controleur: "Karim Belaid",    etat: "Hors service", conforme: false, observations: "Panne moteur, hors service depuis mars.", actionsCorrectives: "Décision de réforme en cours.",      commentaires: "En attente de validation achats." },
  { id: 12, materiel: "Échafaudage roulant R-3",     numInventaire: "ECH-020", categorie: "Échelle",              dateControle: "2026-06-01", dateProchainControle: "2026-07-15", controleur: "Amandine Roy",    etat: "En service",   conforme: true,  observations: "Stabilité et roulettes vérifiées.",       actionsCorrectives: "",                                  commentaires: "" },
  { id: 13, materiel: "Détecteur de gaz portable",   numInventaire: "OUT-072", categorie: "Autre",                dateControle: "2026-05-28", dateProchainControle: "2026-11-28", controleur: "Karim Belaid",    etat: "En service",   conforme: true,  observations: "Calibration effectuée.",                  actionsCorrectives: "",                                  commentaires: "" },
  { id: 14, materiel: "Gants isolants classe 0",     numInventaire: "EPI-133", categorie: "EPI",                  dateControle: "2026-06-25", dateProchainControle: "2026-07-25", controleur: "Sophie Nguyen",   etat: "En service",   conforme: true,  observations: "Test diélectrique OK.",                   actionsCorrectives: "",                                  commentaires: "Contrôle rapproché — renouvellement semestriel." },
  { id: 15, materiel: "Pont élévateur PE-1",         numInventaire: "LEV-015", categorie: "Engin de levage",      dateControle: "2025-09-18", dateProchainControle: "2026-09-18", controleur: "Amandine Roy",    etat: "En service",   conforme: true,  observations: "Vérins et verrouillages testés.",         actionsCorrectives: "",                                  commentaires: "" },
  { id: 16, materiel: "Compresseur d'air CP-4",      numInventaire: "OUT-080", categorie: "Outillage électrique", dateControle: "2026-03-30", dateProchainControle: "2026-09-30", controleur: "Julien Marchand", etat: "En service",   conforme: false, observations: "Soupape de sécurité à recontrôler.",      actionsCorrectives: "Intervention technicien planifiée le 10/07.", commentaires: "" },
  { id: 17, materiel: "Escabeau 3 marches",          numInventaire: "ECH-028", categorie: "Échelle",              dateControle: "2026-06-15", dateProchainControle: "2027-06-15", controleur: "Sophie Nguyen",   etat: "En service",   conforme: true,  observations: "Bon état, aucune fissure.",               actionsCorrectives: "",                                  commentaires: "" },
  { id: 18, materiel: "Chariot élévateur CE-1",      numInventaire: "VEH-001", categorie: "Véhicule",             dateControle: "2024-06-01", dateProchainControle: "2025-06-01", controleur: "Amandine Roy",    etat: "Hors service", conforme: false, observations: "Réformé suite accident.",                 actionsCorrectives: "Mise au rebut effectuée.",           commentaires: "Sorti du parc matériel." },
];

/**
 * Calcule le statut visuel (🟢🟠🔴⚪) à partir de l'état et de la conformité.
 * Cette même règle est portée côté SharePoint par une colonne calculée /
 * Power Automate (voir docs/01) et côté Power Apps par une formule Switch()
 * (voir docs/03-formules-power-fx.md) afin de garantir un rendu identique
 * partout.
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
