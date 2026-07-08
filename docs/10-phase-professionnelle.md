# 10. Phase "application professionnelle" — permissions, journal, alertes

Ce document couvre la demande de transformation en application de niveau entreprise. Vu l'ampleur du cahier des charges (authentification serveur, permissions détaillées, journal avec IP, galerie photos, bandeau d'alertes, tableau de bord, PWA, sauvegardes automatiques...), le travail est livré **par phases**. Cette première phase couvre les permissions détaillées, le journal des actions et le bandeau d'alertes. Les autres points (voir §5 "Ce qui reste") suivront dans une prochaine phase.

## 0. Un principe qui traverse tout le document

L'application reste **100% statique** (GitHub Pages + Google Sheets, sans serveur) — un choix fait plus tôt dans le projet car la politique de sécurité de l'organisation Google bloquait la création d'un compte de service nécessaire à un vrai serveur. Toute fonctionnalité présentée ci-dessous est donc un **best effort compatible avec cette contrainte**, pas une reproduction à l'identique d'une suite logicielle d'entreprise avec base de données serveur.

## 1. Permissions détaillées par personne

L'onglet `Utilisateurs` gagne une 4ᵉ colonne facultative **`Permissions`**. Chaque personne a désormais un jeu de permissions indépendantes (cases à cocher dans l'écran Administration), plutôt qu'un simple rôle figé :

| Permission | Ce qu'elle autorise |
|---|---|
| Tableau général | Recherche, filtres, tri dans la liste complète des contrôles |
| Calendrier | Vue calendrier des contrôles à venir |
| Ressources | Consultation des documents de l'onglet `Ressources` |
| Historique | Ouvrir la fiche d'un matériel et son historique de contrôles |
| Nouveau contrôle | Créer/valider un contrôle |
| Export PDF | Bouton "Exporter en PDF" sur une fiche matériel |
| Export CSV | Bouton "Exporter CSV" du tableau général |

Le **rôle** (Administrateur / Contrôleur / Utilisateur) ne sert plus qu'à **préremplir** ces cases à cocher pour une nouvelle personne, ou en confort quand on change son rôle dans l'écran Administration (les cases se recochent avec les valeurs par défaut du rôle, modifiables avant d'enregistrer). Une fois enregistrées, les permissions d'une personne sont celles cochées, indépendamment de son rôle affiché.

**Simplification volontaire par rapport à une liste-type générique de 18 permissions** : pas de "Modifier/Supprimer un contrôle" (les contrôles sont en ajout seul — un historique de vérification de sécurité ne doit pas pouvoir être réécrit après coup), pas de "Ajouter/Modifier/Supprimer du matériel" ni "Importer/Exporter Excel" (le référentiel de matériel se gère directement dans le classeur Google Sheets, pas dans l'application). Ajouter des cases à cocher pour des actions que l'application ne sait pas faire aurait été trompeur.

## 2. Journal des actions

Nouvel onglet optionnel **`Journal`** (créé automatiquement au premier événement si absent), consultable dans l'écran Administration :

```
Date       | Heure    | Utilisateur      | Action                                    | Adresse IP
2026-07-08 | 09:52:14 | Julien Marchand  | Contrôle validé — LED bleu n°55 (Conforme) | 90.12.34.56
```

Actions journalisées : connexion, ajout/modification/suppression d'un utilisateur, validation d'un contrôle.

⚠️ **L'adresse IP est déclarative, pas une preuve légale.** Le navigateur ne connaît pas sa propre adresse IP publique : elle est obtenue via un service tiers gratuit (`api.ipify.org`), sans clé ni compte. Si ce service est indisponible ou bloqué par un pare-feu, l'action est quand même journalisée, sans IP. Une personne technique pourrait aussi la falsifier (VPN, proxy) — ce journal aide à la traçabilité normale, ce n'est pas un dispositif de preuve inviolable (cela nécessiterait un serveur).

## 3. Bandeau d'alertes défilant

Bandeau fixé en bas de l'écran (façon bandeau d'actualités), qui liste les matériels dont le prochain contrôle approche (fenêtre de 60 jours, réglable via `GOOGLE_CONFIG.seuilBandeauJours`) :

- 🟢 vert : plus de 30 jours restants
- 🟠 orange : entre 7 et 30 jours
- 🔴 rouge : moins de 7 jours
- 🔴 rouge clignotant : moins de 48 heures, ou déjà en retard

Il disparaît automatiquement s'il n'y a aucune échéance dans la fenêtre. Un clic sur une alerte ouvre la fiche du matériel concerné (si la personne a la permission "Historique").

## 4. Ce qui reste (prochaine phase)

- **Connexion par identifiant/mot de passe individuel avec hash** — en plus de la connexion Google. Réalisable côté statique (hash SHA-256 stocké dans la feuille au lieu d'un mot de passe en clair), mais reste une protection de confort, pas une sécurité serveur.
- **Tableau de bord enrichi avec graphiques.**
- **Galerie photos automatique** (dossier `assets/photos/` scanné via une petite GitHub Action générant un manifeste, pour ne jamais toucher au code) + diaporama.
- **Responsive avancé et PWA installable** (manifeste + service worker ; les notifications *push* nécessitent un serveur et ne sont pas réalisables ici).
- **Durcissement sécurité** : expiration de session par inactivité, anti-brute-force léger sur le verrou Administration.
- **Sauvegarde** : export/import JSON manuel depuis l'application, en complément de l'historique de versions natif de Google Sheets (Fichier → Historique des versions), qui sert déjà de sauvegarde automatique de fait.
