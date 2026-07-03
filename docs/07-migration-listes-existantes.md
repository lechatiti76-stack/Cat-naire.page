# 7. Migration pas à pas de vos listes existantes vers le modèle final

Ce guide part de vos 3 listes réelles (`Source Application Dashboard Caténaire`, `VALIDITE`, et les listes par équipement comme `LECBV2-2411-01154`) et vous amène au modèle à 4 listes (docs/01), **en réutilisant vos listes actuelles** plutôt qu'en repartant de zéro. À faire dans cet ordre (chaque liste dépend de la précédente).

## 7.0 Avant de commencer

Faites une sauvegarde rapide : sur chaque liste, **Exporter → Exporter vers Excel**, et conservez les fichiers de côté. Ça vous permet de revenir en arrière si besoin pendant la migration.

## 7.1 Transformer `Source Application Dashboard Caténaire` en `Materiels`

1. Ouvrez la liste → **Paramètres de la liste** (roue crantée ou "..." → Paramètres de la liste).
2. Sous "Colonnes", vérifiez les colonnes existantes (`Titre`, `Description`, `N° Series`, `Statut`, `Priorité`, `Date de création`, `Deadline`, `Assignée à`, `Date de fin`, `Créer Par`).
3. Cliquez **+ Ajouter une colonne** (visible dans l'en-tête du tableau) et créez, une par une :
   - `Categorie` — type **Choix**, valeurs : `Perche isolante`, `LED signalisation`, `VAT`, `Drapeau`, `Signal d'arrêt à main`, `Autre`.
   - `Etat` — type **Choix**, valeurs : `En service`, `En réparation`, `Hors service`, `Réformé`.
   - `PeriodiciteMois` — type **Nombre**.
   - `Photo` — type **Image**.
   - `Actif` — type **Oui/Non**, valeur par défaut Oui.
4. Passez en **Modifier en mode grille** (bouton dans le ruban, visible dans vos captures) : ça affiche toutes les lignes en tableau éditable, comme Excel. Remplissez `Categorie` pour chaque ligne (PERCHE → Perche isolante, LED ROUGE/LED BLEU → LED signalisation, VAT → VAT, Drapeaux → Drapeau, Signal d'Arrêt à Main → Signal d'arrêt à main), puis `Etat` = "En service" par défaut, `PeriodiciteMois` selon le type (souvent 6 pour vos équipements, à ajuster).
5. Renommez la colonne `N° Series` en `NumSerie` si vous voulez garder une seule casse (facultatif, cosmétique) : Paramètres de la liste → cliquer sur la colonne → Renommer.
6. Renommez la colonne `Assignée à` en `Responsable` si vous voulez aligner les noms (facultatif).
7. **Indexer** : Paramètres de la liste → **Colonnes d'index** → Créer un index → choisir `NumSerie` (ou `N° Series`), recommencer pour `Categorie` et `Etat`.
8. Optionnel : renommez la liste elle-même en `Materiels` — Paramètres de la liste → **Nom, description et navigation** → changer le nom. *(Vous pouvez aussi garder le nom actuel de la liste et la traiter comme "Materiels" en interne, sans renommer, si d'autres éléments du site dépendent déjà de ce nom.)*

## 7.2 Créer `TypesPointControle` (nouvelle liste)

1. Contenu du site → **Nouveau → Liste → Liste vierge**, nommez-la `TypesPointControle`.
2. Ajoutez les colonnes :
   - `Categorie` — **Choix**, mêmes valeurs qu'à l'étape 7.1.3.
   - `Ordre` — **Nombre**.
   - (La colonne `Titre` existe déjà par défaut : elle sert de libellé du point de contrôle.)
3. Passez en **Modifier en mode grille** et saisissez vos points de contrôle **une seule fois par catégorie**, en les recopiant depuis vos listes existantes par équipement. Pour "LED signalisation" (d'après `LECBV2-2411-01154`) :

   | Titre | Categorie | Ordre |
   |---|---|---|
   | Etat général de la lampe | LED signalisation | 1 |
   | Absence de fissure ou d'impact important | LED signalisation | 2 |
   | Plots de charge | LED signalisation | 3 |
   | Attache sur clips | LED signalisation | 4 |
   | Autonomie de la lampe | LED signalisation | 5 |
   | Contrôle de la batterie | LED signalisation | 6 |

4. Faites de même pour les autres catégories, en consultant vos listes `PerchePI56C2505005`/`PerchePI56C2505004` pour la catégorie "Perche isolante" (récupérez les points de contrôle qu'elles contiennent déjà).

## 7.3 Transformer `VALIDITE` en `Controles`

1. Ouvrez `VALIDITE` → **Paramètres de la liste**.
2. Ajoutez les colonnes manquantes :
   - `Materiel` — type **Recherche (Lookup)**, source = la liste de l'étape 7.1, colonne affichée `Title`. Cochez les colonnes de projection `NumSerie`, `Categorie`, `Reference` si l'assistant les propose.
   - `Controleur` — type **Personne ou groupe**.
   - `Conforme` — type **Oui/Non**.
   - `Observations`, `ActionsCorrectives`, `Commentaires` — type **Plusieurs lignes de texte**.
3. En **mode grille**, pour chaque ligne existante :
   - Renseignez `Materiel` en choisissant l'équipement correspondant (la colonne texte `Matériels` actuelle vous sert de référence pour savoir lequel choisir).
   - Renseignez `Conforme` = Oui, sauf pour les lignes déjà marquées "Expiré" ou pour lesquelles vous savez qu'il y avait une non-conformité.
4. Renommez `Datecontrole` en `DateControle` et `Date de fin de validité` en `DateProchainControle` (Paramètres de la liste → cliquer sur la colonne → Renommer) pour rester cohérent avec la documentation, ou gardez les noms actuels et notez la correspondance quelque part si vous préférez ne pas renommer.
5. **Supprimez** les colonnes devenues inutiles, qui posaient justement problème : `Aujoud'hui`, `Jours restant`, `date calcul`, `STATUTCONTROLE`. Elles seront remplacées par le flux Power Automate quotidien (docs/04, flux 4.2), qui écrira directement dans la colonne `Statut` existante.
6. **Indexez** `Materiel`, `DateControle`, `DateProchainControle` (Paramètres de la liste → Colonnes d'index).
7. Optionnel : renommez la liste `VALIDITE` en `Controles`.

## 7.4 Créer `ResultatsPointsControle` (nouvelle liste)

1. **Nouveau → Liste → Liste vierge**, nommez-la `ResultatsPointsControle`.
2. Ajoutez les colonnes :
   - `Controle` — **Recherche (Lookup)** vers la liste de l'étape 7.3 (`VALIDITE`/`Controles`), colonne affichée `Title`.
   - `PointControle` — **Recherche (Lookup)** vers `TypesPointControle`, colonne affichée `Title`.
   - `Effectue` — **Oui/Non**.
   - `Rapport` — **Choix** : Validé, Non validé, Sans objet.
   - `Statut` — **Choix** : Conforme, Non conforme.
   - `Observation` — **Ligne de texte simple**.
3. **Indexez** la colonne `Controle`.

## 7.5 Migrer le détail de vos listes par équipement

Pour chaque liste existante par équipement (`LECBV2-2411-01154`, `PerchePI56C2505005`, `PerchePI56C2505004`, et toute autre créée depuis) :

1. Repérez, dans `Controles` (ex-`VALIDITE`), la ligne correspondant à cet équipement (celle que vous avez reliée via `Materiel` à l'étape 7.3).
2. Dans `ResultatsPointsControle`, créez une ligne par point de contrôle de la liste d'origine (6 lignes pour une LED), en reliant :
   - `Controle` → la ligne repérée à l'étape 1,
   - `PointControle` → la ligne correspondante dans `TypesPointControle` (même libellé, même catégorie),
   - `Effectue`, `Rapport`, `Statut` → recopiés depuis la liste d'origine.
3. Une fois toutes les lignes migrées et vérifiées, vous pouvez **archiver** (renommer en `_archive_LECBV2-2411-01154` par exemple, ou déplacer dans un sous-site d'archive) ou **supprimer** la liste d'origine. Pour un petit nombre d'équipements comme actuellement, cette étape se fait manuellement en quelques minutes par liste ; au-delà d'une dizaine, envisagez un script (voir option "PnP PowerShell" que je peux fournir sur demande).

## 7.6 Vérification finale

- Ouvrez `scrListe` de votre future application Power Apps (ou testez directement les formules du §3.5/3.6 de docs/03 dans une app vide connectée aux 4 listes) pour vérifier que l'historique et le détail des points remontent bien pour un équipement migré.
- Mettez en place en priorité le flux 4.1 (génération automatique des points de contrôle) et le flux 4.2 (calcul quotidien du statut) — voir docs/04 — **avant** de créer votre prochain contrôle, pour ne plus jamais avoir à créer de liste par équipement ni à corriger un statut figé à la main.
