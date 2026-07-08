# Galerie photos

Déposez ici vos photos (`.jpg`, `.jpeg`, `.png`, `.webp`) — par exemple en les glissant directement dans ce dossier sur la page GitHub du dépôt ("Add file" → "Upload files"), ou en les copiant ici avant un `git push`.

Vous n'avez **rien d'autre à faire** : une GitHub Action (`.github/workflows/photos-manifest.yml`) régénère automatiquement `manifest.json` à chaque envoi de fichier dans ce dossier, et l'application affiche les nouvelles photos dans la vue "Galerie photos" sans aucune modification de code.

Ne modifiez pas `manifest.json` à la main : il est régénéré automatiquement et vos changements manuels seraient écrasés.
