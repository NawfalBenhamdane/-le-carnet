# « Le Carnet » — mon carnet de français courant

PWA mobile-first qui lit `expressions.json` (alimenté chaque jour par une Routine Claude Code) et me laisse étudier, classer et suivre ma progression sur les expressions du français courant. Site 100 % statique sur GitHub Pages, progression stockée en local sur l'appareil, aucune clé ni token.

## Contenu du repo

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `app.js` | L'app (vanilla JS, zéro build) |
| `expressions.json` | Les données — alimenté par la routine |
| `manifest.json`, `sw.js`, `icons/` | PWA : installation iOS + hors-ligne |
| `ROUTINE.md` | Prompt de la Routine Claude Code + mode d'emploi |
| `scripts/ajouter.mjs` | Script de secours pour ajouter des expressions à la main |

## Fonctionnalités

- **Carnet** : cartes expression / sens / exemple / registre, statut en un tap (à apprendre / utilisée / maîtrisée), favoris, recherche, filtres par statut et par registre.
- **Révision** : quiz « devine le sens » avec répétition espacée légère (les « à apprendre » et les ratées reviennent plus souvent).
- **Stats** : compteurs, streak de jours actifs, barre de progression, expression du jour, graphe des ajouts sur 14 jours.
- **Réglages** : URL du JSON configurable, export de la progression, réinitialisation.
- **Hors-ligne** : service worker + cache local ; le bouton ↻ re-télécharge le JSON et fusionne par `id` sans toucher aux statuts.

## Mise en route (une fois)

```bash
# 1. Depuis ce dossier : initialiser le repo et pousser sur GitHub
git init
git add -A
git commit -m "Le Carnet — première version"
gh repo create le-carnet --public --source=. --push
# (sans gh CLI : crée le repo vide sur github.com puis
#  git remote add origin https://github.com/<ton-user>/le-carnet.git
#  git branch -M main && git push -u origin main)

# 2. Activer GitHub Pages
#    GitHub → repo → Settings → Pages → Source: "Deploy from a branch"
#    → Branch: main, dossier "/ (root)" → Save
#    L'app sera sur https://<ton-user>.github.io/le-carnet/
```

## Installer sur iPhone

1. Ouvre `https://<ton-user>.github.io/le-carnet/` dans **Safari**.
2. Bouton **Partager** (carré avec flèche) → **Sur l'écran d'accueil** → **Ajouter**.
3. Lance l'app depuis l'icône : plein écran, hors-ligne OK.

## Alimentation quotidienne

Voir [ROUTINE.md](ROUTINE.md) : le prompt à donner à une Routine Claude Code (planifiée tous les jours), la marche à suivre pour merger ses PR (plan Pro → branche `claude/…`), et le script de secours.

## Et les notifications iOS ?

Honnêtement : pas de solution fiable sans backend. iOS supporte le Web Push pour les PWA installées (iOS 16.4+), mais il faut un serveur qui stocke les abonnements et envoie les pushs — incompatible avec un site 100 % statique. L'alternative simple et robuste : une **automatisation Raccourcis iOS** (app Raccourcis → Automatisation → « À 9h00 tous les jours » → Ouvrir l'app Le Carnet). Zéro infra, ça marche tous les jours.

## Développement local

```bash
python3 -m http.server 8080
# puis http://localhost:8080
```
