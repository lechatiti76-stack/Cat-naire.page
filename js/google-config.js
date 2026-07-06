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

  // À compléter : identifiant du classeur Google Sheets (voir docs/08)
  spreadsheetId: "COLLEZ_ICI_L_ID_DE_VOTRE_CLASSEUR",

  // Noms EXACTS des 4 onglets du classeur
  feuilles: {
    materiels: "Materiels",
    typesPointControle: "TypesPointControle",
    controles: "Controles",
    resultatsPointsControle: "ResultatsPointsControle",
  },

  // Nombre de jours avant échéance déclenchant le statut "À vérifier prochainement"
  seuilJours: 30,
};

// Catégories connues, avec un accent visuel (indépendant du code couleur de conformité)
const CATEGORIES_CONFIG = [
  { nom: "Perche isolante",        accent: "#0078D4" },
  { nom: "LED signalisation",      accent: "#8764B8" },
  { nom: "VAT",                    accent: "#00B7C3" },
  { nom: "Drapeau",                accent: "#E3008C" },
  { nom: "Signal d'arrêt à main",  accent: "#CA5010" },
];
