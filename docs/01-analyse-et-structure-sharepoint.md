# 1. Analyse de la liste SharePoint & structure finale

> Ce document est basé sur l'analyse réelle de vos listes SharePoint (site *Communication site*), consultées via captures d'écran : `VALIDITE`, `Source Application Dashboard Caténaire`, et les listes créées par équipement (ex. `LECBV2-2411-01154`, `PerchePI56C2505005`, `PerchePI56C2505004`). Le domaine est la sécurité des équipements caténaire ferroviaire (perches isolantes, LED de signalisation, VAT — Vérificateur d'Absence de Tension —, drapeaux, signaux d'arrêt à main).

## 1.1 Ce qui existe aujourd'hui

### Liste `Source Application Dashboard Caténaire` (référentiel équipements / tableau de bord source)
Colonnes observées : `Titre` (ex. "PERCHE 004", "LED BLEU N°54", "Signal d'Arrêt à Main N°5", "VAT", "Drapeaux bleu"), `Description` (ex. "PI56", "SAMNG (Rouge)", "Signal d'Absence Caténaire (bleu) N°1"), `N° Series` (ex. "PI56-C2505-004", "SAMNG-2305A-07870", "LECBV2-2411-01154"), `Statut` (A FAIRE…), `Priorité` (HAUTE/MOYENNE/BASSE), `Date de création`, `Deadline`, `Assignée à`, `Date de fin`, `Créer Par`.

### Liste `VALIDITE` (suivi de conformité/échéance)
Colonnes observées : `Matériels`, `N° series`, `Référence`, `Aujoud'hui` (colonne calculée `[Today]`), `Date de fin de validité`, `Jours restant` (calculé), `Datecontrole` (date du dernier contrôle), `Statut` (Valide / Expire dans 30 jrs / Expiré, mis en forme conditionnelle), `STATUTCONTROLE` (texte, quasi vide), `ID`, `date calcul` (colonne intermédiaire = `Date de fin` − 31 jours, utilisée comme seuil d'alerte).

### Listes « une par équipement » (ex. `LECBV2-2411-01154`, `PerchePI56C2505005`, `PerchePI56C2505004`)
Colonnes observées : `Titre` ("contrôle 1" à "contrôle 6"), `Equipement` (ex. "LECBV2"), `Point de contrôle` (ex. "Etat général de la lampe", "Absence de fissure ou d'impact important", "Plots de charge", "Attache sur clips", "Autonomie de la lampe", "Contrôle de la batterie"), `Effectuer` (case à cocher), `Rapport` (ex. "Validé"), `Statut` (ex. "Conforme"), `ID`.

## 1.2 Problèmes identifiés (réels, pas hypothétiques)

1. **Une liste SharePoint par équipement physique** (`LECBV2-2411-01154`, `PerchePI56C2505005`…) : chaque nouvel équipement acquis = une nouvelle liste à créer manuellement. Avec un parc de plusieurs centaines d'équipements, cela devient ingérable (maintenance, permissions, découverte, sauvegarde, Power Apps qui devrait connaître dynamiquement le nom de chaque liste).
2. **Duplication du référentiel de points de contrôle** : les 6 points de contrôle d'une LED sont resaisis à l'identique dans la liste de *chaque* LED. Une évolution du protocole de contrôle (ajout/suppression d'un point) oblige à modifier toutes les listes une par une.
3. **Pas d'historique du détail des contrôles** : les lignes "contrôle 1" à "contrôle 6" dans les listes par équipement ne sont pas des événements successifs dans le temps — ce sont les 6 points, **réécrits** à chaque inspection. Le résultat de l'inspection précédente est perdu.
4. **`VALIDITE` ne conserve que l'état courant** : `Datecontrole`/`Date de fin de validité`/`Statut` semblent être mis à jour en place à chaque contrôle, sans garder trace des contrôles précédents pour un même équipement — problème identique à celui du point 3, au niveau global cette fois.
5. **Colonnes calculées basées sur `[Today]`** (`Jours restant`, `Statut` de `VALIDITE`, colonne "Aujoud'hui") : dans SharePoint, une colonne calculée référençant la date du jour **ne se recalcule qu'à la prochaine modification de l'élément**, pas automatiquement chaque jour. C'est très probablement la cause de la colonne `STATUTCONTROLE` (visiblement un correctif manuel ponctuel, renseigné sur une seule ligne) : quelqu'un a dû constater qu'un statut était figé et l'a corrigé à la main. La solution robuste est un flux Power Automate planifié quotidien (voir docs/04) qui recalcule et écrit `Jours restant`/`Statut` dans un champ **normal** (non calculé).
6. **Un même contrôle mélange deux niveaux d'information** : l'état global du contrôle (conforme/non conforme, date, contrôleur) et le détail point par point (6 sous-résultats pour une LED). Les représenter dans une seule liste plate oblige soit à dupliquer les infos globales sur 6 lignes, soit à perdre le détail.

## 1.3 Schéma final retenu — modèle à 4 listes

| Liste | Rôle | Fréquence de création de lignes |
|---|---|---|
| `Materiels` | Référentiel : un enregistrement par équipement physique (remplace la partie "identité" de `Source Application Dashboard Caténaire` + le principe des listes par équipement) | À l'acquisition d'un équipement |
| `TypesPointControle` | Référentiel des points de contrôle **par catégorie** d'équipement, saisi une seule fois par catégorie | À la définition/évolution d'un protocole de contrôle |
| `Controles` | Un enregistrement par **événement de contrôle** (remplace `VALIDITE`, avec historique complet) | À chaque inspection |
| `ResultatsPointsControle` | Détail point par point d'un événement de contrôle (remplace les listes par équipement) | 1 ligne par point de contrôle, à chaque inspection |

### Liste 1 — `Materiels`

| Nom interne | Nom affiché | Type | Détails |
|---|---|---|---|
| `Title` | Nom du matériel | Single line text | ex. "PERCHE 004", "LED BLEU N°54" |
| `NumSerie` | N° série | Single line text | ex. "PI56-C2505-004" — **indexée** |
| `Reference` | Référence | Single line text ou Choice | ex. "PI56", "SAMNG" — code produit/modèle |
| `Categorie` | Catégorie | Choice | Perche isolante, LED signalisation, VAT, Drapeau, Signal d'arrêt à main, Autre *(pilote la sélection du protocole de contrôle dans `TypesPointControle`)* |
| `Description` | Description | Single line text | Complément libre (ex. "Signal d'Absence Caténaire (bleu) N°1") |
| `Responsable` | Responsable / Assignée à | Person or Group | |
| `Etat` | État | Choice | En service, En réparation, Hors service, Réformé |
| `PeriodiciteMois` | Périodicité de contrôle (mois) | Number | Utilisée pour calculer `DateProchainControle` |
| `Photo` | Photo | Image | |
| `Actif` | Actif | Yes/No | |

### Liste 2 — `TypesPointControle` (nouvelle)

| Nom interne | Nom affiché | Type | Détails |
|---|---|---|---|
| `Categorie` | Catégorie | Choice | Doit correspondre aux valeurs de `Materiels.Categorie` |
| `Title` | Libellé du point de contrôle | Single line text | ex. "Etat général de la lampe", "Absence de fissure ou d'impact important" |
| `Ordre` | Ordre d'affichage | Number | Pour un affichage stable dans les formulaires/rapports |

*Exemple pour la catégorie "LED signalisation"* : 6 lignes (Etat général de la lampe, Absence de fissure ou d'impact important, Plots de charge, Attache sur clips, Autonomie de la lampe, Contrôle de la batterie) — exactement les points observés dans `LECBV2-2411-01154`, désormais saisis **une seule fois** pour toute la catégorie.

### Liste 3 — `Controles`

| Nom interne | Nom affiché | Type | Détails |
|---|---|---|---|
| `Title` | Référence du contrôle | Single line text | Généré par flux : `[NumSerie] – [DateControle]` |
| `Materiel` | Matériel | Lookup vers `Materiels.Title` | **Indexée** ; projeter aussi `NumSerie`, `Categorie`, `Reference`, `Photo` |
| `DateControle` | Date du contrôle | Date only | **Indexée** |
| `DateProchainControle` | Date du prochain contrôle | Date only | **Indexée** ; calculée = `DateControle + PeriodiciteMois` (flux, remplace le calcul figé de `VALIDITE`) |
| `Controleur` | Contrôleur | Person or Group | |
| `Conforme` | Conforme | Yes/No | Vrai seulement si tous les points de `ResultatsPointsControle` liés sont conformes |
| `Statut` | Statut | Choice, **recalculé quotidiennement par flux** (pas une colonne calculée `[Today]`) | Conforme / À vérifier prochainement / Non conforme / Hors service |
| `Observations` | Observations | Multiple lines of text | |
| `ActionsCorrectives` | Actions correctives | Multiple lines of text | |
| `Commentaires` | Commentaires | Multiple lines of text | |
| `Signature` | Signature | Multiple lines of text | Image encodée en base64 (contrôle Pen Input Power Apps) |

### Liste 4 — `ResultatsPointsControle` (nouvelle)

| Nom interne | Nom affiché | Type | Détails |
|---|---|---|---|
| `Controle` | Contrôle | Lookup vers `Controles.Title` | **Indexée** |
| `PointControle` | Point de contrôle | Lookup vers `TypesPointControle.Title` | |
| `Effectue` | Effectué | Yes/No | Reprend la case à cocher "Effectuer" existante |
| `Rapport` | Rapport | Choice | Validé, Non validé, Sans objet |
| `Statut` | Statut | Choice | Conforme, Non conforme |
| `Observation` | Observation | Single line text | Remarque spécifique à ce point, optionnelle |

**Génération automatique** : à la création d'un `Controle`, un flux Power Automate (docs/04, flux n°1 bis) lit `TypesPointControle` filtré sur la catégorie du matériel concerné et crée automatiquement une ligne `ResultatsPointsControle` par point trouvé — l'utilisateur n'a plus qu'à cocher/qualifier chaque ligne, sans recréer de liste.

## 1.4 Correspondance avec l'existant

| Existant | Devient |
|---|---|
| `Source Application Dashboard Caténaire` (partie identité) | `Materiels` |
| `Source Application Dashboard Caténaire` (partie suivi/tâche : Statut A FAIRE, Priorité, Deadline, Assignée) | Conservée si utile en tant que liste de **tâches de maintenance** distincte, ou couverte par le flux "création de tâche corrective" (docs/04) déclenché automatiquement sur non-conformité |
| `VALIDITE` | `Controles` (avec historique, calcul par flux au lieu de colonne `[Today]`) |
| Listes par équipement (`LECBV2-2411-01154`, `PerchePI56C2505005`, `PerchePI56C2505004`…) | `TypesPointControle` (référentiel, 1 fois par catégorie) + `ResultatsPointsControle` (détail, historisé, 1 fois par contrôle) |

> La liste `Bris de barrières`, visible dans votre navigation, n'a pas encore été analysée — son rôle exact (catégorie d'équipement supplémentaire, ou liste d'incidents distincte) reste à confirmer avant de l'intégrer au modèle.

## 1.5 Vue « à plat » utilisée par l'interface HTML et les galeries Power Apps

L'interface de consultation affiche une jointure `Controles` ⟶ `Materiels`, avec un accès au détail `ResultatsPointsControle` en un clic (fiche/modale) :

Nom du matériel · N° série · Catégorie · Référence · Date du contrôle · Date du prochain contrôle · Contrôleur · État · Conforme · Statut · Observations · Actions correctives · Commentaires · **Détail des points de contrôle** (nouveau, en fiche détaillée).
