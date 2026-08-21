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
   locale en mode démonstration) — aucune ressaisie séparée n'est nécessaire.

Un Administrateur peut aussi annuler une demande non réalisée ("🗑️ Annuler la demande"),
ou, sur une intervention déjà réalisée, revenir en arrière avec "↩️ Remettre à l'état non
réalisé" (efface uniquement `DateRealisation` — la validation n'est pas remise en cause)
si le bouton "Marquer réalisée" a été cliqué par erreur.

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
  technique, nature des travaux, priorité, statut, fenêtre planifiée, horaires, durée,
  lieu, impact, consignation caténaire, validation, réalisation) et deux
  colonnes calculées — **Retard actuel (j)** : jours de retard par rapport à l'échéance
  pour une intervention pas encore réalisée ; **Écart réalisation (j)** : écart entre la
  date de réalisation et l'échéance pour une intervention réalisée (positif = réalisée en
  retard, négatif/nul = à temps ou en avance). N° série, conséquences, intervenant, date
  de demande et commentaires ne sont plus exportés (redondants avec les autres colonnes
  ou peu utilisés en pratique).
- **Calendrier** (propre à GMAO) : les interventions programmées apparaissent sur un
  calendrier mensuel dédié (icône 🔧), sur leur jour prévu — `DateIntervention` tant
  qu'elles ne sont pas réalisées, puis leur date réelle (`DateRealisation`) une fois
  qu'elles le sont (voir §11.8).
- **Vue semaine** (§11.9) : point hebdomadaire imprimable/envoyable par e-mail, avec la
  même bascule sur la date réelle une fois l'intervention réalisée.
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

`DateIntervention`/`DateFinPlanifiee` forment la **fenêtre planifiée** d'une
intervention — posée une fois (import du plan, §11.6, ou saisie manuelle) et **fixe
ensuite** : aucun écran de l'appli, y compris "📌 Planifier", ne la modifie. C'est la
**date de réalisation** (`DateRealisation`, renseignée par "☑️ Marquer réalisée",
§11.2) qui porte la date réelle à laquelle le travail a effectivement eu lieu — la
fenêtre planifiée et la réalisation sont deux informations distinctes, chacune dans sa
colonne.

L'écran **"📌 Planifier"** sert à renseigner les **détails pratiques d'exécution** d'une
intervention déjà programmée dans sa fenêtre, sans jamais déplacer cette fenêtre :

**Trois colonnes supplémentaires** dans l'onglet `Interventions` (ajoutées en fin de
tableau pour ne jamais décaler les colonnes existantes ni les lignes déjà importées) :

```
… DateRealisation | Commentaires | DateTheorique | HeureDebut | HeureFin
```

- `HeureDebut`/`HeureFin` : horaires de la fenêtre de travail ; `HeureFin` est toujours
  calculée (`HeureDebut` + durée allouée), jamais saisie à la main.
- `DateTheorique` : colonne historique d'une précédente version de cet écran (qui
  déplaçait alors `DateIntervention`) — n'est plus écrite par l'appli, conservée dans le
  schéma uniquement pour ne pas perdre les valeurs déjà présentes sur d'anciennes lignes.

Si l'onglet `Interventions` existe déjà dans votre classeur (créé par une version
antérieure de l'appli, avant ces 3 colonnes), son en-tête est complété automatiquement à
la prochaine écriture — `assurerFeuille` (`js/google-sheets.js`) compare l'en-tête réel de
la ligne 1 au schéma attendu et ajoute les colonnes manquantes, sans jamais toucher aux
lignes de données déjà présentes.

**Écran "📌 Planifier"** (bouton dans la barre d'outils de la vue Interventions, sur
chaque carte non réalisée, et dans la fiche détaillée — permission `validerIntervention`,
la même que "Valider" puisque cet écran renseigne aussi la validation) :

1. **Intervention à planifier** : liste déroulante de toutes les interventions non
   réalisées, avec leur date planifiée — la sélectionner précharge automatiquement les
   champs déjà connus de sa fiche (zone/lieu, impact, demandeur, date de demande,
   consignation caténaire) et affiche sa fenêtre planifiée en lecture seule. La
   **zone/lieu** est résolue en priorité depuis le référentiel `Interventions 2` (le code
   ZEP du matériel concerné, voir §11.7bis) plutôt que la valeur `Lieu` brute stockée sur
   l'intervention — utile pour les interventions importées dont le `Lieu` contenait autre
   chose qu'un code ZEP (ex. un fragment de texte d'impact hérité de l'import). Si aucune
   correspondance n'est trouvée dans le référentiel, la valeur `Lieu` d'origine reste
   utilisée telle quelle.
2. **Heure de début**, **Durée allouée (heures)** : l'**Heure de fin** se calcule
   automatiquement (début + durée) à chaque modification.
3. **Consignation caténaire nécessaire** (case à cocher) : si cochée, les heures de
   début/fin de consignation se resynchronisent automatiquement sur la fenêtre de travail
   à chaque modification de l'heure de début ou de la durée — reste modifiable
   manuellement juste avant l'enregistrement si la consignation doit différer (ex. coupure
   commencée plus tôt par sécurité).
4. **Date de validation** (préremplie à aujourd'hui) et **Validé par** (le nom de la
   personne connectée, en lecture seule) : cet écran vaut validation, cohérent avec le
   circuit à deux étapes (§11.2).
5. Un **indicateur de retard actuel** ("⚠ En retard de X jours (échéance dépassée)")
   s'affiche, en lecture seule, si l'intervention chargée a déjà dépassé son échéance
   (`DateFinPlanifiee`/`DateIntervention`) par rapport à aujourd'hui — c'est le même calcul
   que le badge "🔴 En retard" affiché ailleurs dans l'appli (§11.4), pas une comparaison
   propre à cet écran.

Le retard réel d'une intervention se lit une fois le travail terminé en comparant
`DateFinPlanifiee`/`DateIntervention` (l'échéance) à `DateRealisation` — colonne "Écart
réalisation (j)" de l'export CSV (§11.5).

### Calendrier et vue semaine : bascule sur la date réelle une fois réalisée

`DateIntervention` étant désormais figée (ci-dessus), le **calendrier** (§11.5) et la
**vue semaine** (§11.9) doivent malgré tout continuer à refléter *où* le travail a
réellement eu lieu une fois qu'il l'est. La fonction `dateAffichageIntervention(iv)`
(`gmao/js/app.js`) centralise ce choix d'affichage :

- Intervention **pas encore réalisée** (`DateRealisation` vide) : positionnée sur sa
  fenêtre planifiée (`DateIntervention`/`DateFinPlanifiee`), comme avant.
- Intervention **réalisée** (`DateRealisation` renseignée) : positionnée sur ce jour-là,
  qu'il tombe avant, après ou pendant sa fenêtre planifiée d'origine — elle disparaît du
  jour/semaine où elle était initialement prévue et apparaît sur le jour réel. Si "☑️
  Marquer réalisée" est annulé par erreur (bouton "↩️ Remettre à l'état non réalisé",
  §11.2), elle revient automatiquement s'afficher sur sa fenêtre planifiée d'origine —
  aucune donnée n'est perdue, seul l'affichage suit `DateRealisation`.

Cette bascule ne modifie ni n'écrit rien dans `Interventions` : c'est un choix
d'affichage au même titre que la résolution du référentiel (§11.7bis), jamais une
réécriture de `DateIntervention`.

## 11.9 Vue semaine : imprimer et envoyer par e-mail (GMAO uniquement)

Bouton **"🗓️ Vue semaine"** (à côté de "Calendrier") — pensé pour reproduire, sans la
grille macro à 52 feuilles, l'usage réel du classeur "Notes TX LHTE 2026" : préparer et
diffuser un point hebdomadaire des travaux, semaine calendaire par semaine calendaire
(Lundi → Samedi, même découpage que ce classeur, numérotée selon la même convention
S1-S52 — ISO-8601).

- **Navigation** : "‹ Semaine précédente" / "Semaine suivante ›", comme le calendrier
  mensuel.
- **Contenu** : toutes les interventions dont le jour prévu (ou la fenêtre planifiée,
  voir §11.6) chevauche la semaine affichée — ou, une fois réalisées, dont la date réelle
  tombe dans la semaine (voir "Calendrier et vue semaine" en §11.8) — triées par date.
  Pour chaque intervention :
  catégorie et nature des travaux, nom du matériel, heure de début/fin, zone (ZEP —
  résolue depuis le référentiel comme en §11.8), consignation caténaire si applicable, et
  l'impact mis en évidence (gras, en rouge) lorsqu'il est renseigné — le lieu générique et
  l'intervenant ne sont plus affichés ici (redondants avec la zone ZEP et peu utiles pour
  ce point hebdomadaire). Une seconde section **"⚠ Blocages / consignations de la
  semaine"** isole celles qui ont une consignation caténaire, un impact ou des
  conséquences renseignés — la réponse directe au besoin d'avoir "les travaux et les
  blocages éventuels" en un coup d'œil.
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
