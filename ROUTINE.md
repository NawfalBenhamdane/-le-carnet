# Routine Claude Code — alimentation quotidienne du Carnet

Ce fichier contient le prompt à coller dans une **Routine Claude Code** (agent planifié) pour ajouter chaque jour ~4 expressions à `expressions.json`.

## Comment créer la routine

Dans Claude Code, tape `/schedule` et demande une routine quotidienne (par ex. tous les jours à 8h00, fuseau Europe/Paris) sur ce repo, avec le prompt ci-dessous.

> **Limite du plan Pro** : la routine pousse par défaut sur une branche `claude/…`, pas sur `main`. Deux options :
> 1. **Merger à la main** : tu reçois la branche, tu ouvres la PR et tu merges (30 secondes depuis GitHub mobile).
> 2. **Pointer l'app sur la branche de la routine** : dans Réglages de l'app, mets l'URL raw de la branche `claude/...` si la routine réutilise toujours la même. Les nouvelles expressions apparaissent alors sans merge — mais le site Pages, lui, reste sur `main`.
>
> Le plus simple et robuste : option 1 (merge de la PR), l'app lit `main`.

## Le prompt de routine

```
Tu travailles dans le repo « le-carnet » (app d'apprentissage du français courant).

Ta mission, à chaque exécution :

1. Lis le fichier `expressions.json` à la racine. Note toutes les expressions déjà
   présentes (champ `expr`) : ce sont des doublons interdits, y compris leurs
   variantes proches (ex. si « avoir la flemme » existe, n'ajoute pas « la flemme »).

2. Génère exactement 4 nouvelles expressions de français courant et AUTHENTIQUE,
   telles qu'on les entend aujourd'hui en France entre amis, en soirée, en afterwork.
   Critères stricts :
   - registre amical/décontracté, réellement utilisé par des adultes en 2026 ;
   - jamais d'expressions datées ou ringardes (pas de « ça baigne », « c'est chouette ») ;
   - pas de vulgarité gratuite (les expressions familières courantes sont OK,
     l'insulte ou le cru inutile non) ;
   - varie les usages : réactions, plans/sorties, boulot, états d'âme, bouffe, etc. ;
   - varie les registres entre « entre potes », « courant » et « boulot ».

3. Pour chaque expression, produis un objet JSON :
   {
     "expr": "l'expression exacte",
     "sens": "explication claire et concise en français simple",
     "exemple": "un mini-dialogue ou une phrase réaliste, naturelle, avec « » ",
     "registre": "entre potes" | "courant" | "boulot",
     "date": "AAAA-MM-JJ"   ← la date du jour de l'exécution
   }

4. Ajoute ces 4 objets AU DÉBUT du tableau dans `expressions.json` (les plus
   récentes d'abord), sans modifier ni supprimer les entrées existantes.
   Vérifie que le JSON final est valide (pas de virgule en trop, encodage UTF-8).

5. Commit avec le message : `routine: 4 expressions du AAAA-MM-JJ` et pousse.

N'ajoute rien d'autre : pas de refactor, pas d'autres fichiers modifiés.
```

## Script de secours (sans routine, sans API)

Si la routine n'a pas tourné ou que tu veux remplir à la main :

```bash
# Tire 4 expressions au hasard dans la réserve intégrée au script
node scripts/ajouter.mjs --auto 4

# Ou ajoute une expression précise entendue dans la journée
node scripts/ajouter.mjs --expr "ça le fait" --sens "c'est bon, ça convient" \
  --exemple "« On part à 19h ? » — « Ouais, ça le fait. »" --registre "entre potes"

# Puis pousse
git add expressions.json && git commit -m "ajout d'expressions" && git push
```
