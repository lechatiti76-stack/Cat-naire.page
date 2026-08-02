# 11. Programmation GMAO des interventions/réparations

Ce document décrit le module **Interventions**, ajouté au registre pour programmer et
suivre les interventions de maintenance/réparation (distinct des contrôles périodiques
de conformité déjà couverts par docs/01 à 10). Il répond au besoin d'une petite GMAO
(Gestion de Maintenance Assistée par Ordinateur) : demande, validation, planification,
rappel automatique en cas de retard, mise à jour de la base une fois l'intervention
saisie.

## 11.1 Onglet Google Sheets `Interventions`

Onglet optionnel (créé automatiquement à la première demande si absent, comme
`Utilisateurs` ou `Journal` — voir docs/10). Colonnes, dans cet ordre :

```
InterventionId | NumSerie | TypeIntervention | DateDemande | DemandePar | DateIntervention |
DureeHeures | Lieu | Impact | Consequences | Intervenant | CoupureCatenaire | CoupureDebut |
CoupureFin | DateValidation | ValidePar | DateRealisation | Commentaires
```

- `NumSerie` relie l'intervention au matériel concerné (onglet `Materiels`, même
  logique de correspondance que `Controles`).
- `TypeIntervention` : "Maintenance préventive", "Réparation" ou "Autre".
- `CoupureCatenaire` : "Oui"/"Non" ; `CoupureDebut`/`CoupureFin` : heure (HH:MM) du
  créneau de coupure, à ne remplir que si `CoupureCatenaire` = Oui — trace de sécurité
  (consignation) de l'intervention sous caténaire.
- `DateValidation`/`ValidePar` et `DateRealisation` restent vides tant que l'étape
  correspondante n'a pas eu lieu (voir circuit ci-dessous).

## 11.2 Circuit demande → validation → réalisation

Le module suit un circuit à **deux étapes**, cohérent avec la séparation des rôles déjà
en place (docs/09) :

1. **Demande** — un Contrôleur (ou un Administrateur) remplit le formulaire "Nouvelle
   intervention" matériel par matériel : jour de l'intervention, durée, lieu, impact,
   conséquences, intervenant, coupure caténaire éventuelle, commentaires. `DateDemande`
   et `DemandePar` sont renseignés automatiquement (date du jour, personne connectée).
   L'intervention apparaît alors avec le statut **🔵 En attente de validation**.
2. **Validation** — seul un **Administrateur** peut valider (bouton "✅ Valider" dans la
   fiche détaillée de l'intervention), ce qui renseigne `DateValidation`/`ValidePar` et
   fait passer l'intervention en 🟢 **Planifiée** (ou 🟠 **Imminente** / 🔴 **En retard**
   selon la proximité de la date prévue).
3. **Réalisation** — une fois le travail effectué, la personne qui l'a réalisé (ou un
   Administrateur) clique "☑️ Marquer réalisée", ce qui renseigne `DateRealisation` et
   fait passer l'intervention au statut ⚪ **Réalisée**. C'est ce clic qui **met à jour
   la base automatiquement** (écriture Google Sheets réelle une fois connecté ; simulation
   locale en mode démonstration) — aucune ressaisie séparée n'est nécessaire.

Un Administrateur peut aussi annuler une demande non réalisée ("🗑️ Annuler la demande").

## 11.3 Permissions

Trois nouvelles clés dans `PERMISSIONS_CONFIG` (`js/google-config.js`), gérées comme les
autres depuis l'écran Administration (case à cocher par personne, voir docs/09 §9.1bis) :

| Clé | Effet | Rôle par défaut |
|---|---|---|
| `interventions` | Voir la vignette, la liste, le calendrier et le rappel des interventions | Utilisateur, Contrôleur, Administrateur |
| `nouvelleIntervention` | Créer une demande d'intervention, la marquer réalisée | Contrôleur, Administrateur |
| `validerIntervention` | Valider une demande, l'annuler | Administrateur |

## 11.4 Statuts calculés et code couleur

Le statut n'est jamais stocké : il est recalculé à l'affichage à partir des dates,
exactement comme le statut d'un contrôle (docs/03, docs/04) :

| Statut | Condition | Couleur |
|---|---|---|
| En attente de validation | `DateValidation` vide | 🔵 |
| Planifiée | Validée, date d'intervention à plus de `seuilInterventionImminenteJours` jours | 🟢 |
| Imminente | Validée, date d'intervention à ≤ `seuilInterventionImminenteJours` jours (3 par défaut) | 🟠 |
| En retard | Validée, date d'intervention dépassée, pas encore réalisée | 🔴 |
| Réalisée | `DateRealisation` renseignée | ⚪ |

`seuilInterventionImminenteJours` se règle dans `js/google-config.js`.

## 11.5 Visualisation et rappels

Le module reprend la logique "bandeau + bannière + fenêtre dédiée" déjà utilisée pour
les échéances de contrôle (docs/10 §3 et §10), pour une cohérence visuelle complète :

- **Vignette "Interventions"** sur l'accueil : nombre total programmé, et nombre en
  retard mis en évidence.
- **Bandeau défilant** (bas d'écran, visible depuis n'importe quelle vue de
  l'application) : les interventions en retard (🔴, clignotant) et imminentes (🟠) y
  apparaissent aux côtés des échéances de contrôle. L'affichage du rappel n'est pas
  soumis à permission (information de sécurité visible de tous) ; seul le clic pour
  ouvrir le détail requiert la permission `interventions`.
- **Bannière rouge d'accueil "⚠ Interventions en retard"** : n'apparaît que s'il existe
  au moins une intervention en retard — c'est le rappel explicitement demandé, en
  rouge, qui renvoie vers la liste filtrée sur "En retard" d'un clic.
- **Vue "Interventions"** (liste filtrable : matériel/catégorie, type, statut, plage de
  dates de recherche + texte libre) avec export CSV, triée par urgence (en retard
  d'abord).
- **Calendrier** : les interventions programmées apparaissent sur le même calendrier
  mensuel que les échéances de contrôle (icône 🔧), sur leur jour prévu.
- **Fiche détaillée** (clic sur une intervention, où qu'elle apparaisse) : tous les
  champs de la demande, plus les actions de circuit (Valider / Marquer réalisée /
  Annuler) selon la permission de la personne connectée.

## 11.6 Points d'entrée pour créer une demande

- Bouton "🆕 Nouvelle intervention" en haut de la vue "Interventions" (matériel à
  choisir dans le formulaire).
- Bouton "🔧 Intervention" sur chaque carte de la vue Catégorie, et "🔧 Programmer une
  intervention" dans la fiche d'un matériel (docs/10 §10) : le matériel est
  présélectionné, pour une saisie strictement "matériel par matériel".

## 11.7 Limites connues

- Comme le reste de l'application (docs/09 §9.1bis), la sécurité réelle reste le
  partage du classeur Google Sheets : les permissions ci-dessus sont un confort
  d'affichage côté navigateur, pas une barrière serveur.
- Le rappel est **visuel, dans l'application** (bandeau + bannière), pas un e-mail :
  cette page est un site statique sans serveur. Un envoi d'e-mail automatique en cas de
  retard nécessiterait un script Google Apps Script déclenché périodiquement sur le
  classeur (déclencheur temporel) — non mis en place par défaut, mais réalisable en
  complément si besoin.
