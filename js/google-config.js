/**
 * google-config.js — Point de configuration unique de la connexion Google Sheets.
 *
 * `spreadsheetId` doit être complété après création du classeur (voir
 * docs/08-migration-google-sheets.md) : c'est la partie de l'URL entre
 * /d/ et /edit, ex. https://docs.google.com/spreadsheets/d/CETTE_PARTIE/edit
 */

const GOOGLE_CONFIG = {
  // Identifiant OAuth créé dans Google Cloud Console (type "Application Web")
  clientId: "114999137274-ennjft19eqj2abtb4nlril7kc2bdi16e.apps.googleusercontent.com",

  // Identifiant du classeur Google Sheets (voir docs/08)
  spreadsheetId: "1WkMoTAVbprOkWfU77djyDx2GMIdtHMZPDRQmly41gGU",

  // Noms EXACTS des onglets du classeur
  feuilles: {
    materiels: "Materiels",
    typesPointControle: "TypesPointControle",
    controles: "Controles",
    resultatsPointsControle: "ResultatsPointsControle",
    // Onglet Email | Nom | Role (Administrateur / Contrôleur / Utilisateur).
    // Optionnel : s'il est absent ou vide, tout le monde est traité comme Contrôleur.
    utilisateurs: "Utilisateurs",
    // Onglet Titre | Lien | Categorie (documents/ressources, optionnel)
    ressources: "Ressources",
  },

  // Nombre de jours avant échéance déclenchant le statut "À vérifier prochainement"
  seuilJours: 30,

  // Organisation affichée dans le pied de page
  organisation: {
    nom: "Terminal Multimodal du Havre",
    service: "Service Circulation Ferroviaire",
    mentions: "Agent caténaire · Habilitation Agent E CH1CB1",
  },
};

// Rôles disponibles et permissions associées (gestion d'affichage côté client
// uniquement — la vraie sécurité reste le partage du classeur Google Sheets,
// voir docs/09-roles-et-fonctionnalites.md).
const ROLES_CONFIG = {
  // peutControler : peut créer/valider un contrôle.
  // peutVoirTout  : accès au Tableau général, Calendrier, Ressources, historique/fiche
  //                 matériel et export PDF. Sans ce droit, seuls l'accueil (vignettes de
  //                 catégorie) et l'écran "Nouveau contrôle" restent accessibles.
  // peutGererUtilisateurs : accès à l'écran Administration (gestion de l'onglet Utilisateurs).
  Administrateur: { peutControler: true,  peutVoirTout: true,  peutGererUtilisateurs: true },
  "Contrôleur":   { peutControler: true,  peutVoirTout: false, peutGererUtilisateurs: false },
  Utilisateur:    { peutControler: false, peutVoirTout: true,  peutGererUtilisateurs: false },
};
const ROLE_PAR_DEFAUT = "Contrôleur";

/**
 * Second verrou (identifiant + mot de passe) pour l'écran Administration,
 * indépendant du rôle détecté via l'onglet Utilisateurs — évite de dépendre
 * uniquement de la bonne lecture de cet onglet pour accéder à
 * l'administration. Changez ces valeurs !
 *
 * ⚠️ Ce n'est pas un vrai secret cryptographique : visible dans le code
 * source de la page par quiconque saurait chercher (Affichage → Code
 * source). C'est un verrou pratique, pas une protection contre une personne
 * malveillante avertie. Voir docs/09 pour l'alternative sécurisée (serveur).
 */
const ADMIN_AUTH = {
  identifiant: "PATON",
  motDePasse: "momiji",
};

// Catégories connues, avec un accent visuel (indépendant du code couleur de conformité)
const CATEGORIES_CONFIG = [
  { nom: "Perche isolante",        accent: "#0078D4" },
  { nom: "LED signalisation",      accent: "#8764B8" },
  { nom: "VAT",                    accent: "#00B7C3" },
  { nom: "Drapeau",                accent: "#E3008C" },
  { nom: "Signal d'arrêt à main",  accent: "#CA5010" },
];
