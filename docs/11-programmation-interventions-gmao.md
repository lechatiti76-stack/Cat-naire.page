# 11. Programmation GMAO des interventions/réparations

Ce document décrit le module **Interventions**, qui répond au besoin d'une petite GMAO
(Gestion de Maintenance Assistée par Ordinateur) : demande, validation, planification,
rappel automatique en cas de retard, mise à jour de la base une fois l'intervention
saisie — distinct des contrôles périodiques de conformité déjà couverts par docs/01 à 10.

**Appli dédiée** : `gmao/index.html` — une PWA autonome et installable séparément
(icône, nom "GMAO", accent de couleur propres — voir `gmao/css/theme.css`), détachée du
Registre des Vérifications de Matériel mais connectée au **même classeur Google Sheets**
(mêmes onglets `Materiels`/`Utilisateurs`/`Interventions`, mêmes rôles). Son code
(`gmao/js/app.js`, `gmao/js/data.js`) est un sous-ensemble volontairement allégé de
`js/app.js` : uniquement ce qui concerne les interventions (pas de contrôles, pas
d'écran Administration — la gestion des utilisateurs/rôles reste dans le Registre).
Chaque appli renvoie vers l'autre depuis son pied de page.

## 11.1 Onglet Google Sheets `Interventions`

Onglet optionnel (créé automatiquement à la première demande si absent, comme
`Utilisateurs` ou `Journal` — voir docs/10). Colonnes, dans cet ordre :

```
InterventionId | NumSerie | Materiel | PosteTechnique | TypeIntervention | Priorite |
DateDemande | DemandePar | DateIntervention | DateFinPlanifiee | DureeHeures | Lieu |
Impact | Consequences | Intervenant | CoupureCatenaire | CoupureDebut | CoupureFin |
DateValidation | ValidePar | DateRealisation | Commentaires
```

- `NumSerie` relie l'intervention au matériel concerné (onglet `Materiels`, même
  logique de correspondance que `Controles`) — **optionnel** : laissez vide pour un
  équipement hors du référentiel Materiels (voir §11.6, import d'un plan de
  maintenance externe).
- `Materiel` : titre affiché sur la carte/fiche. Rempli automatiquement au nom du
  matériel choisi si `NumSerie` correspond à une ligne `Materiels` ; à défaut, saisi
  ou importé tel quel (ex. désignation précise d'un équipement de signalisation).
- `PosteTechnique` : repère technique libre (ex. code de poste/zone d'un système
  externe) — complète ou remplace `Lieu` pour un équipement identifié par un code
  plutôt qu'un nom de lieu.
- `TypeIntervention` : libre. Le formulaire de demande manuelle propose "Maintenance
  préventive", "Réparation" ou "Autre" ; un import externe peut apporter des libellés
  plus précis (ex. "Maintenance signal") — le filtre de la vue Interventions se
  peuple automatiquement à partir des valeurs réellement présentes.
- `Priorite` : code brut recopié tel quel (ex. "C", "N" d'un export SAP) — affiché
  sans réinterprétation, l'application ne connaît pas la signification propre à
  chaque système source.
- `DateFinPlanifiee` : optionnelle. Pour une intervention ponctuelle, laissez vide
  (`DateIntervention` suffit). Pour une fenêtre de plusieurs jours/semaines (plan de
  maintenance externe), renseignez la fin de fenêtre : c'est **elle qui détermine le
  retard** (§11.4) quand elle est présente, pas `DateIntervention`.
- `CoupureCatenaire` : "Oui"/"Non" ; `CoupureDebut`/`CoupureFin` : heure (HH:MM) du
  créneau de coupure, à ne remplir que si `CoupureCatenaire` = Oui — trace de sécurité
  (consignation) de l'intervention sous caténaire.
- `DateValidation`/`ValidePar` et `DateRealisation` restent vides tant que l'étape
  correspondante n'a pas eu lieu (voir circuit ci-dessous) — sauf import d'un plan déjà
  approuvé (§11.6), pré-rempli en conséquence.

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
| Planifiée | Validée, échéance à plus de `seuilInterventionImminenteJours` jours | 🟢 |
| Imminente | Validée, échéance à ≤ `seuilInterventionImminenteJours` jours (3 par défaut) | 🟠 |
| En retard | Validée, échéance dépassée, pas encore réalisée | 🔴 |
| Réalisée | `DateRealisation` renseignée | ⚪ |

« Échéance » = `DateFinPlanifiee` si elle est renseignée, sinon `DateIntervention` — une
intervention ponctuelle n'a donc qu'une seule date à surveiller, tandis qu'un ordre importé
avec une fenêtre de plusieurs semaines n'est considéré en retard qu'une fois cette fenêtre
close, pas dès son premier jour.

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

## 11.6 Import d'un plan de maintenance externe (type SAP)

Un plan de maintenance annuel exporté d'un autre système (ex. ordres SAP PM) peut être
collé directement dans l'onglet `Interventions`, une fois ses colonnes renommées vers le
schéma ci-dessus. Correspondance type observée sur un export "Ordre / Priorité / Date
début plf / Fin planifiée / Désignation / Poste technique / Description" :

| Colonne source | Colonne `Interventions` |
|---|---|
| Ordre | `InterventionId` (utilisé tel quel plutôt qu'un identifiant généré) |
| Description (équipement précis) — à défaut, Poste technique | `Materiel` |
| Poste technique | `PosteTechnique` |
| Désignation | `TypeIntervention` |
| Priorité | `Priorite` (recopiée sans interprétation) |
| Date début plf | `DateIntervention` |
| Fin planifiée | `DateFinPlanifiee` |
| — | `NumSerie` laissé vide (équipement hors référentiel `Materiels`) |

Un plan déjà approuvé n'a pas besoin de repasser par le circuit demande/validation
(§11.2) : `DateDemande`/`DateValidation` peuvent être pré-remplies à la date de l'import,
`DemandePar`/`ValidePar` à une mention du type "Import PDM 2026", pour que chaque ligne
apparaisse directement 🟢 Planifiée (ou 🟠/🔴 selon sa fenêtre). `DureeHeures`, `Lieu`,
`Impact`, `Consequences`, `Intervenant` et la coupure caténaire restent à compléter au fil
de l'eau si le plan source ne les fournit pas — ce ne sont pas des colonnes obligatoires.

## 11.6bis Référentiel réel (vocabulaire, suggestions du formulaire)

Le vocabulaire de l'écran "Nouvelle intervention" est aligné sur celui du classeur
Excel historique **"Notes TX LHTE 2026"** (planning hebdomadaire à 52 feuilles S1-S52,
alimenté par son onglet `Données`) :

| Terme GMAO | Terme historique (classeur Excel) |
|---|---|
| Nature des travaux (`TypeIntervention`) | Nature des travaux |
| Poste technique (`PosteTechnique`) | Appareils / colonne B de `Données` |
| Lieu / zone (`Lieu`) | ZONE |
| Consignation caténaire (`CoupureCatenaire`) | Consignation Électrique |
| Demandeur (`DemandePar`) | Demandeur |
| Date demande / date validation (`DateDemande`/`DateValidation`) | date demande / date validation AC |
| Commentaire (`Commentaires`) | Commentaire |

`REFERENTIEL_TRAVAUX` (`js/google-config.js`, partagé par les deux applis) reprend les
valeurs réelles observées dans l'onglet `Données` de ce classeur — natures de travaux
(ex. "Maintenance signal", "Consignation Caténaire"), préfixes de poste technique
(ex. "3HMCM-EFE-ADV") et zones (ex. "LE HAVRE", "CENTRE POSTE 1E (EST)"). Elles
alimentent des `<datalist>` sur les champs **Nature des travaux**, **Poste
technique** et **Lieu / zone** du formulaire : des suggestions à la saisie, pas des
listes fermées — une valeur hors référentiel reste acceptée, pour ne jamais bloquer une
demande sur un type de travaux ou un site nouveau. Mettre à jour cette constante
manuellement si le référentiel réel évolue (pas de synchronisation automatique avec le
classeur Excel).

## 11.7 Points d'entrée pour créer une demande

- Bouton "🆕 Nouvelle intervention" en haut de la vue "Interventions" — le matériel peut
  être choisi dans la liste `Materiels`, ou laissé sur "— Hors liste —" pour saisir à la
  place un poste technique/nom d'équipement libre (import ponctuel, équipement
  d'infrastructure non suivi comme matériel de sécurité).
- Bouton "🔧 Intervention" sur chaque carte de la vue Catégorie, et "🔧 Programmer une
  intervention" dans la fiche d'un matériel (docs/10 §10) : le matériel est
  présélectionné, pour une saisie strictement "matériel par matériel".

## 11.9 Vue semaine : imprimer et envoyer par e-mail (GMAO uniquement)

Bouton **"🗓️ Vue semaine"** (à côté de "Calendrier") — pensé pour reproduire, sans la
grille macro à 52 feuilles, l'usage réel du classeur "Notes TX LHTE 2026" : préparer et
diffuser un point hebdomadaire des travaux, semaine calendaire par semaine calendaire
(Lundi → Samedi, même découpage que ce classeur, numérotée selon la même convention
S1-S52 — ISO-8601).

- **Navigation** : "‹ Semaine précédente" / "Semaine suivante ›", comme le calendrier
  mensuel.
- **Contenu** : toutes les interventions dont le jour prévu (ou la fenêtre planifiée,
  voir §11.6) chevauche la semaine affichée, triées par date. Une seconde section
  **"⚠ Blocages / consignations de la semaine"** isole celles qui ont une consignation
  caténaire, un impact ou des conséquences renseignés — la réponse directe au besoin
  d'avoir "les travaux et les blocages éventuels" en un coup d'œil.
- **🖨️ Imprimer la semaine** : génère une vue imprimable (tableau des travaux + détail
  des blocages) et ouvre la boîte d'impression du navigateur, sur le même principe que
  l'export PDF d'un matériel (docs/09 §9.5) — choisir "Enregistrer au format PDF" comme
  imprimante pour obtenir un fichier.
- **📧 Envoyer par e-mail** : ouvre le client de messagerie par défaut (lien `mailto:`)
  avec un sujet et un corps déjà rédigés (mêmes travaux + blocages, en texte). L'appli
  ne peut pas envoyer l'e-mail elle-même — site statique, pas de serveur d'envoi — elle
  prépare le brouillon, à vérifier et envoyer depuis le client de messagerie.

## 11.10 Limites connues

- Comme le reste de l'application (docs/09 §9.1bis), la sécurité réelle reste le
  partage du classeur Google Sheets : les permissions ci-dessus sont un confort
  d'affichage côté navigateur, pas une barrière serveur.
- Le rappel de retard est **visuel, dans l'application** (bandeau + bannière) ; l'envoi
  du point hebdomadaire (§11.9) reste une action manuelle (bouton "Envoyer par e-mail")
  plutôt qu'automatique — un envoi automatique et périodique nécessiterait un script
  Google Apps Script déclenché sur le classeur (déclencheur temporel), non mis en place
  par défaut mais réalisable en complément si besoin.
- Le référentiel réel (§11.6bis) et la correspondance de colonnes du classeur "Notes TX"
  (§11.6bis, §11.9) sont figés dans le code au moment de leur rédaction : une évolution
  du classeur source (nouvelle nature de travaux, nouveau poste ZEP, etc.) ne se
  répercute pas automatiquement dans GMAO.
