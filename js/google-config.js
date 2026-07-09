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
    // Onglet Email | Nom | Role | Permissions (Administrateur / Contrôleur / Utilisateur).
    // Optionnel : s'il est absent ou vide, tout le monde est traité comme Contrôleur.
    utilisateurs: "Utilisateurs",
    // Onglet Titre | Lien | Categorie (documents/ressources, optionnel)
    ressources: "Ressources",
    // Onglet Date | Heure | Utilisateur | Action | Adresse IP (journal des actions, optionnel,
    // créé automatiquement au premier événement si absent — voir docs/10).
    journal: "Journal",
  },

  // Nombre de jours avant échéance déclenchant le statut "À vérifier prochainement"
  seuilJours: 30,

  // Fenêtre (en jours) avant échéance à partir de laquelle un matériel apparaît
  // dans le bandeau d'alertes défilant en bas de l'écran (docs/10 §1).
  seuilBandeauJours: 60,

  // Organisation affichée dans le pied de page
  organisation: {
    nom: "Terminal Multimodal du Havre",
    service: "Service Circulation Ferroviaire",
    mentions: "Agent caténaire · Habilitation Agent E CH1CB1",
  },
};

/**
 * Permissions élémentaires reconnues par l'application (case à cocher dans
 * l'écran Administration). Chacune correspond à une action réellement
 * présente dans l'interface — volontairement plus court que la liste-type
 * d'un cahier des charges générique (pas de "Modifier/Supprimer un contrôle"
 * par exemple : les contrôles sont en ajout seul, par design, pour garder un
 * historique de vérification fiable ; le matériel lui-même se gère dans le
 * classeur Google Sheets, pas dans l'application). Voir docs/10.
 */
const PERMISSIONS_CONFIG = [
  { cle: "tableauBord",     label: "Tableau général (recherche, filtres, tri)" },
  { cle: "calendrier",      label: "Calendrier des contrôles à venir" },
  { cle: "ressources",      label: "Ressources documentaires" },
  { cle: "galerie",         label: "Galerie photos" },
  { cle: "historique",      label: "Consulter la fiche et l'historique d'un matériel" },
  { cle: "nouveauControle", label: "Créer un nouveau contrôle" },
  { cle: "exporterPdf",     label: "Exporter un matériel en PDF" },
  { cle: "exporterCsv",     label: "Exporter le tableau général en CSV" },
];

// Rôles disponibles : chacun ne fait que fixer les permissions PAR DÉFAUT
// données à une personne nouvellement créée. Une fois créée, ses permissions
// réelles sont celles cochées dans l'écran Administration (colonne
// "Permissions" de l'onglet Utilisateurs) — gestion d'affichage côté client
// uniquement, la vraie sécurité reste le partage du classeur Google Sheets,
// voir docs/09-roles-et-fonctionnalites.md et docs/10.
const ROLES_CONFIG = {
  Administrateur: { permissions: PERMISSIONS_CONFIG.map((p) => p.cle) },
  "Contrôleur":   { permissions: ["nouveauControle"] },
  Utilisateur:    { permissions: ["tableauBord", "calendrier", "ressources", "galerie", "historique", "exporterPdf", "exporterCsv"] },
};
const ROLE_PAR_DEFAUT = "Contrôleur";

/**
 * Identifiant de SECOURS pour l'écran Administration — utilisé seulement en
 * bootstrap (avant que quiconque n'ait un identifiant/mot de passe individuel
 * déclaré dans l'onglet Utilisateurs, colonnes Identifiant/MotDePasseHash,
 * gérées depuis l'écran Administration lui-même une fois déverrouillé une
 * première fois). Changez ces valeurs avant mise en production.
 *
 * ⚠️ Ce n'est pas un vrai secret cryptographique : visible dans le code
 * source de la page par quiconque saurait chercher (Affichage → Code
 * source). C'est un verrou pratique, pas une protection contre une personne
 * malveillante avertie. Voir docs/10 §1bis pour le détail des comptes
 * individuels (mot de passe haché SHA-256) qui remplacent ce mode de secours
 * au quotidien.
 */
const ADMIN_AUTH = {
  identifiant: "PATON",
  motDePasse: "momiji",
};

// Catégories connues, avec un accent visuel (indépendant du code couleur de conformité)
// et une icône SVG (contenu interne d'un <svg viewBox="0 0 24 24">, voir js/app.js
// renderTuiles) représentant le type d'équipement plutôt qu'un simple rond générique.
const CATEGORIES_CONFIG = [
  {
    nom: "Perche isolante", accent: "#0078D4",
    icone: '<path d="M5 19L17 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18.5" cy="5.5" r="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 19l-1.8 4 4-1.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    nom: "LED signalisation", accent: "#8764B8",
    icone: '<path d="M12 3a5 5 0 00-3 9c.6.5 1 1.2 1 2v1h4v-1c0-.8.4-1.5 1-2a5 5 0 00-3-9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 19h4M10.5 21h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  },
  {
    nom: "VAT", accent: "#00B7C3",
    icone: '<path d="M6 21l6-8h-3l6-8-2 7h3l-6 9z" fill="currentColor"/>',
  },
  {
    nom: "Drapeau", accent: "#E3008C",
    icone: '<path d="M6 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  },
  {
    nom: "Signal d'arrêt à main", accent: "#CA5010",
    icone: '<path d="M12 12v9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="2"/>',
  },
];
