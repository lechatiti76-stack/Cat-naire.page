/**
 * sharepoint-config.js — Point de configuration unique de la connexion SharePoint.
 *
 * Ajustez ces valeurs si votre site ou vos noms de liste changent. Les noms de
 * colonnes utilisés dans sharepoint.js/app.js correspondent aux noms internes
 * définis dans docs/01-analyse-et-structure-sharepoint.md : comme aucun ne
 * contient d'espace ni d'accent, le nom interne SharePoint est identique au
 * nom affiché dans les paramètres de liste.
 *
 * IMPORTANT : pour que la lecture ET l'écriture fonctionnent (authentification
 * de l'utilisateur connecté, jeton anti-CSRF), cette page doit être ouverte
 * depuis le même site SharePoint (ou un domaine *.sharepoint.com du même
 * tenant) — voir docs/05-guide-deploiement.md §5.6. Ouverte ailleurs
 * (aperçu local, GitHub Pages...), l'application bascule automatiquement en
 * mode démonstration avec des données d'exemple.
 */

const SHAREPOINT_CONFIG = {
  // URL du site SharePoint (site racine du tenant, d'après vos listes existantes)
  siteUrl: "https://lhte76.sharepoint.com",

  // Noms EXACTS des 4 listes (docs/07)
  listes: {
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
