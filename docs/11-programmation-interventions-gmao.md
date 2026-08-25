# 11. Programmation GMAO des interventions/réparations

Ce document décrit le module **Interventions**, qui répond au besoin d'une petite GMAO
(Gestion de Maintenance Assistée par Ordinateur) : demande, validation, planification,
rappel automatique en cas de retard, mise à jour de la base une fois l'intervention
saisie — distinct des contrôles périodiques de conformité déjà couverts par docs/01 à 10.

**Appli dédiée, exclusivement** : `gmao/index.html` — une PWA autonome et installable
séparément (icône, nom "GMAO", accent de couleur propres — voir `gmao/css/theme.css`),
détachée du Registre des Vérifications de Matériel mais connectée au **même classeur
Google Sheets** (mêmes onglets `Materiels`/`Utilisateurs`/`Interventions`, mêmes rôles).
Son code (`gmao/js/app.js`, `gmao/js/data.js`) est un sous-ensemble volontairement allégé
de `js/app.js` : uniquement ce qui concerne les interventions (pas de contrôles, pas
d'écran Administration — la gestion des utilisateurs/rôles reste dans le Registre).
Chaque appli renvoie vers l'autre depuis son pied de page.

**Séparation stricte des deux fonctionnalités** : le Registre des Vérifications de
Matériel (racine du site, `index.html`/`js/app.js`) ne contient **aucune** UI ni logique
Interventions — pas de vignette, pas de bandeau de rappel d'intervention, pas de
formulaire, pas de calendrier d'intervention. Tout ce qui touche aux interventions vit
uniquement dans `gmao/`. Le Registre garde seulement `js/google-config.js` et
`js/google-sheets.js` (fichiers **partagés**, lus par les deux applis pour la
configuration, les permissions et la lecture/écriture Google Sheets) — mais son propre
code (`js/app.js`, `js/data.js`) n'affiche jamais les données de l'onglet `Interventions`,
même quand elles existent dans le classeur. Le seul lien entre les deux applis dans
l'interface est le renvoi réciproque en pied de page.

## 11.1 Onglet Google Sheets `Interventions`

Onglet optionnel (créé automatiquement à la première demande si absent, comme
`Utilisateurs` ou `Journal` — voir docs/10). Colonnes, dans cet ordre :

```
InterventionId | NumSerie | Materiel | PosteTechnique | TypeIntervention | Priorite |
DateDemande | DemandePar | DateIntervention | DateFinPlanifiee | DureeHeures | Lieu |
Impact | Consequences | Intervenant | CoupureCatenaire | CoupureDebut | CoupureFin |
DateValidation | ValidePar | DateRealisation | Commentaires | DateTheorique | HeureDebut | HeureFin
```

Les 3 dernières colonnes (`DateTheorique`/`HeureDebut`/`HeureFin`) servent à la
planification pratique décrite en §11.8 — `DateIntervention` reste la date de référence
utilisée partout ailleurs (calendrier, statuts, vue semaine).

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
   intervenant, coupure caténaire éventuelle, commentaires. `DateDemande` est renseignée
   automatiquement (date du jour) ; `DemandePar` se choisit dans un menu déroulant,
   préréglé sur le demandeur par défaut des opérations (voir §11.7bis) mais modifiable.
   L'intervention apparaît alors avec le statut **🔵 En attente de validation**.
2. **Validation** — seul un **Administrateur** peut valider (bouton "✅ Valider" dans la
   fiche détaillée de l'intervention), ce qui renseigne `DateValidation`/`ValidePar` (la
   personne connectée) et fait passer l'intervention en 🟢 **Planifiée** (ou 🟠
   **Imminente** / 🔴 **En retard** selon la proximité de la date prévue).
3. **Réalisation** — une fois le travail effectué, la personne qui l'a réalisé (ou un
   Administrateur) clique "☑️ Marquer réalisée", ce qui renseigne `DateRealisation` et
   fait passer l'intervention au statut ⚪ **Réalisée**. C'est ce clic qui **met à jour
   la base automatiquement** (écriture Google Sheets réelle une fois connecté ; simulation
   locale en mode démonstration) — aucune ressaisie séparée n'est nécessaire. Un champ
   **Date de réalisation** accompagne le bouton, préréglé sur aujourd'hui mais
   **modifiable** : si le clic dans l'appli intervient plus tard que le travail réel (ex.
   contrôles faits sur le terrain la semaine 26, saisis dans l'appli seulement la semaine
   34), corrigez cette date avant de valider pour que `DateRealisation` — et donc le
   calendrier/la vue semaine (§11.8) — reflète le jour réel, pas le jour de la saisie. Une
   fois réalisée, cette date réelle est mise en évidence (vert, gras : "✅ Réalisée le
   JJ/MM/AAAA") directement sur la carte de l'intervention dans la vue Interventions, pas
   seulement dans sa fiche détaillée.

Un Administrateur peut aussi annuler une demande non réalisée ("🗑️ Annuler la demande"),
ou, sur une intervention déjà réalisée, revenir en arrière avec "↩️ Remettre à l'état non
réalisé" (efface uniquement `DateRealisation` — la validation n'est pas remise en cause)
si le bouton "Marquer réalisée" a été cliqué par erreur.

Si l'intervention est déjà réalisée mais que `DateRealisation` s'avère fausse (le champ
"Date de réalisation" ci-dessus a été laissé sur "aujourd'hui" au lieu du vrai jour du
travail), inutile de repasser par "Remettre à l'état non réalisé" puis "Marquer
réalisée" : la fiche détaillée affiche, sous "Réalisée le", un champ **"Corriger la
date"** + bouton **"✏️ Corriger"** qui réécrit directement `DateRealisation` (même
permission `validerIntervention`) sans toucher au reste de la fiche.

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

Le module reprend, **dans l'appli GMAO uniquement**, la logique "bandeau + bannière +
fenêtre dédiée" déjà utilisée pour les échéances de contrôle dans le Registre (docs/10
§3 et §10), pour une cohérence visuelle entre les deux applis sans mélanger leurs
données :

- **Vignettes** sur l'accueil GMAO : nombre total programmé, planifiées, imminentes, en
  retard, en attente de validation.
- **Bandeau défilant** (bas d'écran, visible depuis n'importe quelle vue de l'appli
  GMAO) : les interventions en retard (🔴, clignotant) et imminentes (🟠). L'affichage du
  rappel n'est pas soumis à permission (information de sécurité visible de tous) ; seul
  le clic pour ouvrir le détail requiert la permission `interventions`.
- **Bannière rouge d'accueil "⚠ Interventions en retard"** : n'apparaît que s'il existe
  au moins une intervention en retard — c'est le rappel explicitement demandé, en
  rouge, qui renvoie vers la liste filtrée sur "En retard" d'un clic.
- **Vue "Interventions"** (liste filtrable : matériel/catégorie, type, statut, plage de
  dates de recherche + texte libre) avec export CSV, triée par urgence (en retard
  d'abord). L'export CSV se concentre sur les champs opérationnels (matériel, poste
  technique, nature des travaux, priorité, statut, fenêtre planifiée, date programmée,
  horaires, durée, lieu, impact, consignation caténaire, validation, réalisation) et deux
  colonnes calculées — **Retard actuel (j)** : jours de retard par rapport à l'échéance
  pour une intervention pas encore réalisée ; **Écart réalisation (j)** : écart entre la
  date de réalisation et l'échéance pour une intervention réalisée (positif = réalisée en
  retard, négatif/nul = à temps ou en avance). N° série, conséquences, intervenant, date
  de demande et commentaires ne sont plus exportés (redondants avec les autres colonnes
  ou peu utilisés en pratique).
- **Calendrier** (propre à GMAO) : les interventions programmées apparaissent sur un
  calendrier mensuel dédié (icône 🔧), sur leur jour prévu — `DateProgrammee` une fois
  programmée via "📌 Planifier", sinon `DateIntervention` (fenêtre théorique), puis leur
  date réelle (`DateRealisation`) une fois réalisées (voir §11.8).
- **Vue semaine** (§11.9) : point hebdomadaire imprimable/envoyable par e-mail, avec la
  même logique de positionnement.
- **Fiche détaillée** (clic sur une intervention, où qu'elle apparaisse) : tous les
  champs de la demande, plus les actions de circuit (Valider / Marquer réalisée /
  Annuler) selon la permission de la personne connectée.

Le Registre des Vérifications de Matériel (racine) ne reprend **aucun** de ces éléments :
pas de vignette, pas de bandeau ni de bannière liés aux interventions, pas de calendrier
d'intervention — son propre bandeau/calendrier/bannière ne concernent que les échéances
de contrôle du matériel de sécurité.

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

Tous dans l'appli GMAO (`gmao/index.html`) — le Registre des Vérifications de Matériel
n'expose aucun de ces boutons :

- Bouton "🆕 Nouvelle intervention" en haut de la vue "Interventions" — le matériel peut
  être choisi dans la liste `Materiels`, ou laissé sur "— Hors liste —" pour saisir à la
  place un poste technique/nom d'équipement libre (import ponctuel, équipement
  d'infrastructure non suivi comme matériel de sécurité).

## 11.7bis Référentiel équipements d'infrastructure (Catégorie → Type → Matériel)

Pour reproduire le remplissage assisté de l'ancien formulaire Excel/VBA de l'utilisateur
(sélection en cascade → champs auto-remplis), l'écran **"🆕 Nouvelle intervention"**
(GMAO uniquement) propose trois menus déroulants en cascade, alimentés par un second
onglet Google Sheets optionnel, **`Interventions 2`** — un référentiel d'équipements
d'infrastructure (ADV, JGP…), distinct de l'onglet `Materiels` (qui reste réservé au
matériel de sécurité caténaire suivi individuellement : perches, LED, VAT…).

**Structure de l'onglet `Interventions 2`** — volontairement **sans ligne d'en-tête**
(données brutes dès la ligne 1), colonnes A à H (lettres réelles, confirmées sur le
classeur de production) :

| Colonne | Contenu | Exemple |
|---|---|---|
| A | Numéro de tri (inutilisé par l'appli — sert seulement à ordonner manuellement les catégories dans le classeur) | `2` |
| B | Catégorie | `ADV` |
| C | Référence / numéro d'intervention (poste technique) | `3HMCM-EFE-ADV` |
| D | Type de maintenance | `Maintenance ADV (commande mécanique)` |
| E | Matériel concerné | `ADV 5009` |
| F | *(inutilisée)* | — |
| G | ZEP (zone) | `ZEP 5028` |
| H | Conséquences (utilisées comme Impact — voir plus bas) | `Accès ferroviaire et fluvial interdit côté PARIS` |

Les colonnes B/C/D suivent la convention "cellule fusionnée" habituelle d'un tableau
Excel : une cellule vide **hérite de la dernière valeur non vide au-dessus, dans la même
colonne** — une seule ligne porte la catégorie/référence/type, toutes les lignes de
matériel suivantes en héritent jusqu'à la prochaine valeur explicite. C'est
`referentielInterventionsDepuisLignes()` (`js/google-sheets.js`) qui applique ce report
à la lecture ; les colonnes A et F ne sont lues par aucune fonctionnalité.

**Comportement du formulaire, en cascade à 3 niveaux** :
1. **Catégorie (référentiel équipements)** : liste des valeurs distinctes de la
   colonne B (ex. "ADV", "JGP").
2. **Type (référentiel équipements)** : se repeuple avec les valeurs de la colonne D
   dont la colonne B correspond à la catégorie choisie (ex. "ADV" → "Maintenance ADV
   (commande électrique)" / "Maintenance ADV (commande mécanique)" uniquement, pas les
   types d'une autre catégorie).
3. **Matériel concerné (référentiel équipements)** : se repeuple avec les lignes de la
   colonne E dont la catégorie ET le type correspondent aux deux choix précédents (ex.
   "commande mécanique" → ADV 5005, 5009, 5010, 5011, 5028…).
4. Choisir un matériel remplit automatiquement, à partir de la même ligne du
   référentiel : **Nature des travaux** (D), **Nom du matériel** (E), **Poste technique**
   (C), **Lieu / zone** (G, le code ZEP) et **Impact** (H — pas de champ "Conséquences"
   distinct sur cet écran, retiré à la demande de l'utilisateur pour éviter la
   redondance). Tous ces champs restent modifiables ensuite — le référentiel ne fait que
   préremplir, il ne verrouille rien.

Changer la catégorie réinitialise le type et le matériel choisis ; changer le type
réinitialise le matériel choisi — pour ne jamais laisser une combinaison incohérente
(ex. un matériel d'une catégorie affiché après avoir changé de catégorie).

**Demandeur par défaut** : le champ Demandeur ("Nouvelle intervention" et "Planifier")
est préréglé sur `DEMANDEUR_PAR_DEFAUT` (`gmao/js/app.js`, actuellement "DESERT JULIEN")
— la personne qui demande en pratique la plupart de ces opérations d'infrastructure —
tout en restant un menu déroulant modifiable si un autre demandeur doit être enregistré.
Ce préréglage n'affecte jamais `ValidePar`, qui reste toujours la personne connectée au
moment de la validation.

Le référentiel est chargé une seule fois par session (mode connecté), à la connexion et à
chaque actualisation des données — pas seulement à l'ouverture de "Nouvelle
intervention", pour que la correction de noms ci-dessous s'applique dès l'affichage du
tableau de bord.

**Correction d'affichage des interventions déjà créées** : les interventions créées avant
la correction du mapping de colonnes (ou importées avec un nom de poste technique brut,
ex. `3HMCM-EFE-ADV-5001`) affichaient un code plutôt qu'un nom lisible. Une fois le
référentiel chargé, `appliquerNomsLisibles()` (`gmao/js/app.js`) résout automatiquement un
nom lisible pour ces interventions en repérant un matériel du référentiel qui se termine
par le même suffixe numérique (`3HMCM-EFE-ADV-5001` → `ADV 5001`, car le référentiel
contient `ADV 5001`) — partout où l'intervention est affichée (cartes, bandeau,
calendrier, écran "Planifier"…). **Affichage uniquement** : cette correction ne réécrit
jamais l'onglet `Interventions` du classeur, seulement l'objet chargé en mémoire côté
appli ; un code sans suffixe numérique identifiable (ex. `3HMCM-EFE-ADV` seul, trop
ambigu pour savoir quel matériel précis il désigne) reste affiché tel quel plutôt que de
risquer une correspondance incorrecte.

La même logique de repli s'applique, avec les mêmes fonctions de base
(`ligneReferentielIntervention()`), à deux autres champs jamais renseignés sur les
interventions créées avant le référentiel : `zepAffichable()` (zone/lieu → code ZEP du
matériel concerné) et `impactAffichable()` (impact → conséquences du référentiel).
Utilisées partout où ces champs sont affichés (fiche détaillée, cartes, écran
"Planifier", vue semaine, export CSV) — toujours en repli sur la valeur saisie/stockée
si elle existe, jamais en écrasement.

## 11.8 Planification pratique : détails d'exécution d'une intervention déjà programmée

Trois dates, trois rôles bien distincts (chacune dans sa colonne, chacune modifiée par
un seul écran) :

- **`DateIntervention`/`DateFinPlanifiee`** — la **fenêtre théorique** du plan de
  maintenance : posée une fois (import du plan, §11.6, ou saisie manuelle) et **fixe pour
  toujours**, aucun écran de l'appli ne la modifie ensuite. Elle sert de référence pour le
  retard ("échéance dépassée", §11.4) — c'est la date à laquelle le travail *devait*
  arriver selon le plan annuel.
- **`DateProgrammee`** — le jour où le travail est **concrètement prévu**, décidé au fil
  de l'eau et renseigné/modifié librement depuis l'écran "📌 Planifier" (ci-dessous) —
  peut être avant ou après la fenêtre théorique (ex. une maintenance du plan annuel prévue
  en octobre, mais concrètement casée le mois précédent parce qu'une équipe est
  disponible). C'est cette date, une fois renseignée, qui positionne l'intervention dans
  le **calendrier et la vue semaine** tant qu'elle n'est pas réalisée.
- **`DateRealisation`** — le jour où le travail a **effectivement eu lieu**, renseignée
  par "☑️ Marquer réalisée" (§11.2) — prend le pas sur `DateProgrammee` une fois réalisée.

L'écran **"📌 Planifier"** sert à renseigner les **détails pratiques d'exécution** d'une
intervention déjà demandée — date de travail concrète, horaires, consignation,
validation — sans jamais déplacer la fenêtre théorique `DateIntervention`/`DateFinPlanifiee` :

**Quatre colonnes supplémentaires** dans l'onglet `Interventions` (ajoutées en fin de
tableau pour ne jamais décaler les colonnes existantes ni les lignes déjà importées) :

```
… DateRealisation | Commentaires | DateTheorique | HeureDebut | HeureFin | DateProgrammee
```

- `HeureDebut`/`HeureFin` : horaires de la fenêtre de travail ; `HeureFin` est toujours
  calculée (`HeureDebut` + durée allouée), jamais saisie à la main.
- `DateTheorique` : colonne historique d'une précédente version de cet écran (qui
  déplaçait alors `DateIntervention`) — n'est plus écrite par l'appli, conservée dans le
  schéma uniquement pour ne pas perdre les valeurs déjà présentes sur d'anciennes lignes.

Si l'onglet `Interventions` existe déjà dans votre classeur (créé par une version
antérieure de l'appli, avant ces 4 colonnes), son en-tête est complété automatiquement à
la prochaine écriture — `assurerFeuille` (`js/google-sheets.js`) compare l'en-tête réel de
la ligne 1 au schéma attendu et ajoute les colonnes manquantes, sans jamais toucher aux
lignes de données déjà présentes.

**Écran "📌 Planifier"** (bouton dans la barre d'outils de la vue Interventions, sur
chaque carte non réalisée, et dans la fiche détaillée — permission `validerIntervention`,
la même que "Valider" puisque cet écran renseigne aussi la validation) :

1. **Intervention à planifier** : liste déroulante de toutes les interventions non
   réalisées, avec leur date planifiée — la sélectionner précharge automatiquement les
   champs déjà connus de sa fiche (date programmée, zone/lieu, impact, demandeur, date de
   demande, consignation caténaire) et affiche sa fenêtre théorique en lecture seule. La
   **zone/lieu** est résolue en priorité depuis le référentiel `Interventions 2` (le code
   ZEP du matériel concerné, voir §11.7bis) plutôt que la valeur `Lieu` brute stockée sur
   l'intervention — utile pour les interventions importées dont le `Lieu` contenait autre
   chose qu'un code ZEP (ex. un fragment de texte d'impact hérité de l'import). Si aucune
   correspondance n'est trouvée dans le référentiel, la valeur `Lieu` d'origine reste
   utilisée telle quelle.
2. **Date programmée** (`DateProgrammee`) : librement modifiable à chaque passage sur cet
   écran — c'est le champ qui répond à "quand est-ce que je fais concrètement ce
   travail ?", indépendamment de la fenêtre théorique.
3. **Heure de début**, **Durée allouée (heures)** : l'**Heure de fin** se calcule
   automatiquement (début + durée) à chaque modification.
4. **Consignation caténaire nécessaire** (case à cocher) : si cochée, les heures de
   début/fin de consignation se resynchronisent automatiquement sur la fenêtre de travail
   à chaque modification de l'heure de début ou de la durée — reste modifiable
   manuellement juste avant l'enregistrement si la consignation doit différer (ex. coupure
   commencée plus tôt par sécurité).
5. **Date de validation** (préremplie à aujourd'hui) et **Validé par** (le nom de la
   personne connectée, en lecture seule) : cet écran vaut validation, cohérent avec le
   circuit à deux étapes (§11.2).
6. Un **indicateur de retard actuel** ("⚠ En retard de X jours (échéance dépassée)")
   s'affiche, en lecture seule, si l'intervention chargée a déjà dépassé son échéance
   (`DateFinPlanifiee`/`DateIntervention`) par rapport à aujourd'hui — c'est le même calcul
   que le badge "🔴 En retard" affiché ailleurs dans l'appli (§11.4), pas une comparaison
   propre à cet écran ; il compare toujours à la fenêtre théorique, jamais à
   `DateProgrammee`.

Une intervention programmée (mais pas encore réalisée) porte un repère **"📌 Programmée
le JJ/MM/AAAA"** — en bleu, sur sa carte dans la vue Interventions et dans sa fiche
détaillée — pour la distinguer d'une intervention simplement validée sans exécution
concrète encore décidée.

Le retard réel d'une intervention se lit une fois le travail terminé en comparant
`DateFinPlanifiee`/`DateIntervention` (l'échéance théorique) à `DateRealisation` —
colonne "Écart réalisation (j)" de l'export CSV (§11.5).

### Calendrier et vue semaine : quelle date positionne l'intervention ?

`DateIntervention` étant figée (ci-dessus), le **calendrier** (§11.5) et la **vue
semaine** (§11.9) doivent malgré tout refléter *où* le travail va concrètement avoir
lieu, ou a réellement eu lieu. La fonction `dateAffichageIntervention(iv)`
(`gmao/js/app.js`) centralise ce choix d'affichage, par ordre de priorité :

1. **`DateRealisation`** si l'intervention est réalisée — le jour réel, qu'il tombe
   avant, après ou pendant la fenêtre théorique ou la date programmée.
2. Sinon **`DateProgrammee`** si elle a été programmée via "📌 Planifier" — le jour
   concrètement prévu, même très différent de la fenêtre théorique (ex. avancée de
   plusieurs mois par rapport au plan annuel).
3. Sinon **`DateIntervention`** seule — en dernier recours, pour une intervention ni
   programmée ni réalisée. Toujours traitée comme **un jour précis**, jamais comme le
   chevauchement de toute la fenêtre théorique (`DateIntervention`→`DateFinPlanifiee`,
   qui peut s'étendre sur plusieurs mois, §11.6) : sans cela, une intervention au long
   cours apparaîtrait à tort dans chaque semaine/mois qu'elle traverse.

Si "☑️ Marquer réalisée" est annulé par erreur (bouton "↩️ Remettre à l'état non
réalisé", §11.2), l'affichage revient automatiquement à `DateProgrammee` (ou, à défaut, à
`DateIntervention`) — aucune donnée n'est perdue, seul l'affichage suit la priorité
ci-dessus. Cette bascule ne modifie ni n'écrit rien dans
`DateIntervention`/`DateFinPlanifiee` : c'est un choix d'affichage au même titre que la
résolution du référentiel (§11.7bis).

## 11.9 Vue semaine : imprimer et envoyer par e-mail (GMAO uniquement)

Bouton **"🗓️ Vue semaine"** (à côté de "Calendrier") — pensé pour reproduire, sans la
grille macro à 52 feuilles, l'usage réel du classeur "Notes TX LHTE 2026" : préparer et
diffuser un point hebdomadaire des travaux, semaine calendaire par semaine calendaire
(Lundi → Samedi, même découpage que ce classeur, numérotée selon la même convention
S1-S52 — ISO-8601).

- **Navigation** : "‹ Semaine précédente" / "Semaine suivante ›", comme le calendrier
  mensuel.
- **Contenu, groupé par jour** : depuis la version qui reproduit le bulletin papier
  "Information Travaux" que la personne utilisatrice imprimait auparavant depuis Excel,
  la semaine est découpée en **six blocs Lundi → Samedi**, chacun avec son propre bandeau
  de date. Un jour sans aucune intervention affiche simplement "Aucune intervention
  prévue" plutôt que de disparaître ou de se mélanger aux autres jours. Chaque
  intervention n'apparaît que dans **le jour où elle se trouve réellement affectée**
  (`dateAffichageIntervention()`, voir §11.8 : la date réelle une fois réalisée, sinon la
  date programmée via "📌 Planifier", sinon son jour théorique) — jamais répétée sur
  toute une fenêtre planifiée de plusieurs mois qui la traverserait (§11.6) : c'est
  précisément ce qui rendait la vue "très mélangée" avant cette version. Sur chaque ligne
  d'un jour : nom du matériel, puis horaires/consignation/impact séparés par des tirets —
  l'impact est mis en évidence (gras, rouge) exactement comme sur le bulletin papier de
  référence. Cliquer une ligne ouvre la fiche détaillée complète de l'intervention.
- **🖨️ Imprimer la semaine** : génère le même découpage par jour dans une mise en page
  imprimable ("INFORMATION TRAVAUX — SEMAINE {n}") et ouvre la boîte d'impression du
  navigateur, sur le même principe que l'export PDF d'un matériel (docs/09 §9.5) —
  choisir "Enregistrer au format PDF" comme imprimante pour obtenir un fichier. Les
  couleurs de l'impression sont fixes (fond blanc, pas le thème sombre de l'appli), pour
  qu'une page imprimée reste toujours lisible quel que soit le thème actif au moment du
  clic.
- **📧 Envoyer par e-mail** : ouvre le client de messagerie par défaut (lien `mailto:`)
  avec un sujet et un corps déjà rédigés, même découpage par jour en texte. L'appli ne
  peut pas envoyer l'e-mail elle-même — site statique, pas de serveur d'envoi — elle
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
- Toutes les dates affichées ("AAAA-MM-JJ" → "JJ/MM/AAAA", en-têtes de jour de la vue
  semaine, calendrier) passent par des fonctions qui parsent les composantes à la main
  (`formatDate`, `dateISO`) plutôt que par `new Date("AAAA-MM-JJ")` : cette dernière est
  interprétée par JavaScript comme minuit **UTC**, puis réaffichée en heure locale — un
  piège classique qui décale la date d'un jour selon le fuseau horaire du navigateur (en
  avance sur UTC comme la France : le jour affiché peut être bon par coïncidence pour la
  fenêtre théorique mais faux pour une date recalculée localement ; en retard sur UTC
  comme les Amériques : systématiquement faux). Corrigé dans les deux applis (`js/app.js`
  et `gmao/js/app.js`) — toute nouvelle fonction manipulant des dates doit éviter
  `new Date(chaineISO)` et `toISOString()` de la même façon.

## 11.11 Archivage annuel des interventions

L'onglet `Interventions` couvre en pratique une seule année d'opérations à la fois
(import du plan annuel, §11.6). Pour repartir sur une base propre chaque année sans
perdre l'historique, l'écran Interventions propose, dans sa barre d'outils — visibles
uniquement en mode connecté (pas en démonstration) et avec la permission
`validerIntervention` :

- Un **sélecteur d'année** (masqué s'il n'existe encore aucune archive) : "Année active"
  par défaut, puis une entrée par année déjà archivée (ex. "2026 (archive)").
- Un bouton **"🗄️ Archiver l'année"**.

**Comment ça marche** : l'onglet actif garde toujours le même nom, `Interventions` — ce
n'est jamais lui qui change de nom d'une année sur l'autre, c'est son **contenu** qui est
mis de côté :

1. Cliquer **"🗄️ Archiver l'année"** demande l'année à archiver (préremplie avec la
   dernière année archivée + 1, ou l'année en cours si aucune archive n'existe encore),
   puis une confirmation explicite — c'est une action rare et structurante (elle modifie
   directement la structure du classeur), volontairement pas accessible en un clic.
2. Une fois confirmée, l'appli **renomme** l'onglet `Interventions` actuel en
   `Interventions {année}` (ex. `Interventions 2026`) via l'API Google Sheets, puis
   **recrée** un onglet `Interventions` vierge avec le même schéma d'en-tête que
   l'ancien (§11.1/§11.8) — prêt à recevoir les nouvelles opérations de l'année
   suivante, que vous alimentez comme d'habitude (saisie manuelle ou import PDM, §11.6).
3. Aucune donnée n'est supprimée : l'ancien contenu est intégralement conservé sous son
   nouveau nom d'onglet.

**Consulter une année archivée** : la sélectionner dans le sélecteur d'année charge ses
interventions à la place de l'année active, dans **toutes** les vues (liste, calendrier,
vue semaine, export CSV) — mais en **lecture seule totale** : aucun bouton d'action
(Nouvelle intervention, Valider, Planifier, Marquer réalisée, Corriger la date, Annuler…)
n'est disponible tant qu'une archive est affichée, quel que soit le rôle de la personne
connectée — `aPermission()` (`gmao/js/app.js`) refuse systématiquement
`nouvelleIntervention`/`validerIntervention` dans ce mode. Un bandeau "📁 Consultation de
l'archive {année} — lecture seule" le rappelle, et l'actualisation automatique/manuelle
des données est suspendue tant qu'une archive est affichée (elle ne concerne que l'onglet
actif). Revenir à "Année active" dans le sélecteur recharge normalement l'onglet actif.

Si vous créez vous-même, directement dans le classeur, un futur onglet nommé
`Interventions {année}` (ex. en préparation d'une année à venir), il apparaîtra
automatiquement dans le sélecteur d'année au prochain chargement — aucune configuration
supplémentaire n'est nécessaire côté application, le sélecteur découvre les archives par
leur nom d'onglet (`Interventions ` suivi de 4 chiffres).
