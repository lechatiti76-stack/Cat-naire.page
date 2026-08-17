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
    // Onglet de programmation GMAO des interventions/réparations (optionnel,
    // créé automatiquement à la première demande si absent — voir docs/11).
    interventions: "Interventions",
  },

  // Nom du dossier Google Drive où sont envoyées les photos prises depuis l'écran
  // "Nouveau contrôle" (créé automatiquement au premier envoi si absent — voir docs/10).
  // Nécessite l'activation de l'API Google Drive dans le projet Google Cloud (en plus
  // de l'API Sheets) et le nouveau scope "drive.file" (reconnexion demandée une fois).
  dossierPhotosControles: "Photos contrôles - Registre matériel",

  // Fiche publique par QR code (fiche.html) : ⚠️ ACCÈS LIBRE, SANS CONNEXION —
  // quiconque a le lien voit ces données, pas seulement en scannant le QR code
  // physique. À remplir après "Fichier → Partager → Publier sur le Web" (format
  // CSV) sur les onglets Materiels et Controles de votre classeur (voir docs/10 §13).
  // Laisser vide désactive la fiche publique (le bouton "QR code" affichera une erreur).
  fichePublique: {
    urlCsvMateriels: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLk7rGL68oSPmo-7eOI1sKwr3HxcaSXoQ_BjL_J-88OuVrOf_pFGFeLiuTxUiCuUieVuSzTo6VgEPP/pub?gid=0&single=true&output=csv",
    urlCsvControles: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLk7rGL68oSPmo-7eOI1sKwr3HxcaSXoQ_BjL_J-88OuVrOf_pFGFeLiuTxUiCuUieVuSzTo6VgEPP/pub?gid=1744123585&single=true&output=csv",
  },

  // Nombre de jours avant échéance déclenchant le statut "À vérifier prochainement"
  seuilJours: 30,

  // Fenêtre (en jours) avant échéance à partir de laquelle un matériel apparaît
  // dans le bandeau d'alertes défilant en bas de l'écran (docs/10 §3).
  seuilBandeauJours: 60,

  // Nombre de jours avant la date d'une intervention programmée (GMAO, voir
  // docs/11) à partir duquel elle passe en orange ("imminente") dans la
  // vignette, la liste et le calendrier. Au-delà de la date prévue sans
  // qu'elle soit marquée réalisée, elle passe en rouge ("en retard").
  seuilInterventionImminenteJours: 3,

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
  // Programmation GMAO des interventions/réparations (voir docs/11).
  { cle: "interventions",        label: "Planification des interventions (consultation)" },
  { cle: "nouvelleIntervention", label: "Créer une demande d'intervention" },
  { cle: "validerIntervention",  label: "Valider une intervention et la marquer réalisée" },
];

// Rôles disponibles : chacun ne fait que fixer les permissions PAR DÉFAUT
// données à une personne nouvellement créée. Une fois créée, ses permissions
// réelles sont celles cochées dans l'écran Administration (colonne
// "Permissions" de l'onglet Utilisateurs) — gestion d'affichage côté client
// uniquement, la vraie sécurité reste le partage du classeur Google Sheets,
// voir docs/09-roles-et-fonctionnalites.md et docs/10.
const ROLES_CONFIG = {
  // Administrateur : seul rôle pouvant valider une intervention (circuit de
  // validation à deux étapes, voir docs/11).
  Administrateur: { permissions: PERMISSIONS_CONFIG.map((p) => p.cle) },
  "Contrôleur":   { permissions: ["nouveauControle", "interventions", "nouvelleIntervention"] },
  Utilisateur:    { permissions: ["tableauBord", "calendrier", "ressources", "galerie", "historique", "exporterPdf", "exporterCsv", "interventions"] },
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

/**
 * Référentiel réel des travaux (GMAO, voir docs/11 §11.6bis), extrait du classeur
 * "Notes TX LHTE 2026" (onglet Données) qui alimente le planning hebdomadaire
 * historique (feuilles S1 à S52). Utilisé comme suggestions (listes <datalist>,
 * pas des <select> fermés) sur les champs Nature des travaux / Poste technique /
 * Lieu du formulaire "Nouvelle intervention" — champs texte libres, ces listes
 * accélèrent la saisie sans empêcher une valeur hors référentiel.
 */
const REFERENTIEL_TRAVAUX = {
  // Colonne C de l'onglet Données : nature exacte des travaux (hors "TOUS", valeur
  // joker du classeur source plutôt qu'un type de travaux réel).
  natureTravaux: [
    "Entretien JGP (dont graissage)",
    "Maintenance ADV (commande électrique)",
    "Maintenance ADV (commande mécanique)",
    "Maintenance ADV (pas de commande)",
    "Maintenance ADV (aiguille à pieds d'œuvre)",
    "Maintenance Centre",
    "Maintenance Circuit de Voie",
    "Maintenance PN",
    "Maintenance signal",
    "Maintenance feu de heurtoir",
    "Maintenance Wagons",
    "Maintenance TR",
    "Relevé des AD",
    "Tournée de conformité du LRS",
    "Tournée enregistrement géométrie",
    "Tournée périodique à pied",
    "Entretient espace vert",
    "déchargement/chargement",
    "Consignation Caténaire",
  ],
  // Colonne B de l'onglet Données : préfixes de poste technique. Colonne O : postes
  // "ZEP" des tournées (table séparée du même onglet, voir docs/11 §11.6bis).
  postesTechniques: [
    "3HMCM", "3HMCM-EFE", "3HMCM-EFE-ADV", "3HMCM-EFE-CEN",
    "3HMCM-EFE-PNV", "3HMCM-EFE-VDF", "3HMCM-EFE-VLI",
    "LHTE-1", "LHTE-2", "LHTE-3", "LHTE-4", "LHTE-5", "LHTE-6",
    "ZEP",
  ],
  // Colonne F de l'onglet Données (postes) + colonne A des feuilles S1-S52 (zones ville).
  zones: [
    "PARIS", "YVETOT", "LE HAVRE",
    "CENTRE POSTE 1O (OUEST)", "CENTRE POSTE 2O (OUEST)", "CENTRE POSTE 3O (OUEST)",
    "CENTRE POSTE 1E (EST)", "CENTRE POSTE 2E (EST)",
  ],
};
