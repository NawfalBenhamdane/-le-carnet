#!/usr/bin/env node
/* ============================================================
   Script de secours — ajoute des expressions à expressions.json
   sans API ni dépendance. Deux modes :

   1. Tirage automatique depuis la réserve intégrée :
        node scripts/ajouter.mjs --auto 4

   2. Ajout manuel :
        node scripts/ajouter.mjs --expr "ça le fait" --sens "c'est bon, ça convient" \
          --exemple "« On part à 19h ? » — « Ouais, ça le fait. »" --registre "entre potes"

   Dans les deux cas : dédoublonnage par id, date du jour, tri conservé.
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const FICHIER = join(RACINE, "expressions.json");

// Réserve d'expressions authentiques pour le mode --auto
const RESERVE = [
  { expr: "ça le fait", sens: "c'est bon, ça convient, ça fonctionne", exemple: "« On part vers 19h ? » — « Ouais, ça le fait. »", registre: "entre potes" },
  { expr: "grave", sens: "oui, complètement, tout à fait (approbation forte)", exemple: "« C'était une super soirée non ? » — « Grave ! »", registre: "entre potes" },
  { expr: "se prendre la tête", sens: "se compliquer la vie, se disputer ou trop réfléchir", exemple: "« Te prends pas la tête, on verra sur place. »", registre: "courant" },
  { expr: "avoir le seum", sens: "être dégoûté, frustré, déçu", exemple: "« Ils ont perdu à la dernière minute, j'ai trop le seum. »", registre: "entre potes" },
  { expr: "ça marche", sens: "d'accord, c'est entendu", exemple: "« On se retrouve à 13h devant le métro ? » — « Ça marche ! »", registre: "courant" },
  { expr: "être au taquet", sens: "être à fond, très motivé ou très occupé", exemple: "« T'es dispo cette semaine ? » — « Pas trop, je suis au taquet au boulot. »", registre: "courant" },
  { expr: "faire la grasse mat'", sens: "dormir tard le matin", exemple: "« Demain c'est samedi, grasse mat' obligatoire. »", registre: "courant" },
  { expr: "un truc de ouf", sens: "quelque chose d'incroyable, d'énorme", exemple: "« T'as vu le concert ? C'était un truc de ouf. »", registre: "entre potes" },
  { expr: "se faire un resto", sens: "aller au restaurant ensemble", exemple: "« On se fait un resto jeudi pour fêter ça ? »", registre: "courant" },
  { expr: "c'est mort", sens: "c'est non, impossible, hors de question", exemple: "« Tu viens courir sous la pluie ? » — « C'est mort. »", registre: "entre potes" },
  { expr: "tranquille", sens: "facilement, sans problème (ou réponse à « ça va ? »)", exemple: "« Tu peux finir ça pour demain ? » — « Tranquille. »", registre: "entre potes" },
  { expr: "avoir un coup de barre", sens: "ressentir une grosse fatigue soudaine", exemple: "« Après le déjeuner, j'ai toujours un coup de barre. »", registre: "courant" },
  { expr: "ça te dit ?", sens: "est-ce que ça te tente, est-ce que tu en as envie ?", exemple: "« Ciné ce soir, ça te dit ? »", registre: "courant" },
  { expr: "être dans le mal", sens: "aller mal, être fatigué ou mal en point", exemple: "« J'ai dormi trois heures, je suis dans le mal. »", registre: "entre potes" },
  { expr: "kiffer", sens: "adorer, prendre beaucoup de plaisir", exemple: "« Franchement, je kiffe ce quartier. »", registre: "entre potes" },
  { expr: "relou", sens: "pénible, lourd, agaçant (verlan de « lourd »)", exemple: "« Le métro était bondé, c'était relou. »", registre: "entre potes" },
  { expr: "en mode", sens: "dans un certain état d'esprit, d'une certaine manière", exemple: "« Ce week-end je suis en mode canapé-série. »", registre: "entre potes" },
  { expr: "chiller", sens: "se détendre, ne rien faire de spécial", exemple: "« On a chillé au parc tout l'aprèm. »", registre: "entre potes" },
  { expr: "avoir la dalle", sens: "avoir très faim", exemple: "« On mange quand ? J'ai trop la dalle. »", registre: "entre potes" },
  { expr: "ça caille", sens: "il fait très froid", exemple: "« Mets une veste, ça caille dehors. »", registre: "courant" },
  { expr: "un afterwork", sens: "un verre entre collègues après le travail", exemple: "« On se fait un afterwork jeudi avec l'équipe ? »", registre: "boulot" },
  { expr: "carrément", sens: "oui, tout à fait, complètement", exemple: "« On y va à pied ? » — « Carrément, il fait beau. »", registre: "courant" },
  { expr: "être vénère", sens: "être très énervé (verlan de « énervé »)", exemple: "« Il a encore annulé, je suis vénère. »", registre: "entre potes" },
  { expr: "gérer", sens: "très bien s'en sortir, assurer", exemple: "« Elle a géré sa présentation, tout le monde a adoré. »", registre: "courant" },
  { expr: "se motiver", sens: "trouver le courage de faire quelque chose", exemple: "« Faut que je me motive à aller à la salle. »", registre: "courant" },
  { expr: "un date", sens: "un rendez-vous amoureux", exemple: "« Il a un date ce soir, il est trop stressé. »", registre: "entre potes" },
  { expr: "bosser", sens: "travailler", exemple: "« Je peux pas, je bosse tard ce soir. »", registre: "courant" },
  { expr: "la base", sens: "c'est évident, c'est le minimum (approbation)", exemple: "« Je t'ai gardé une part de gâteau. » — « La base ! »", registre: "entre potes" },
  { expr: "avoir du mal", sens: "trouver quelque chose difficile", exemple: "« J'ai du mal avec les horaires de réunion à 8h. »", registre: "courant" },
  { expr: "ça se tente", sens: "c'est une idée qui mérite d'être essayée", exemple: "« Un week-end à Lisbonne pas cher ? Ça se tente. »", registre: "entre potes" },
];

function genererId(expr) {
  return expr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lireArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const cle = args[i].slice(2);
      const valeur = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      options[cle] = valeur;
    }
  }
  return options;
}

const options = lireArgs();
const existantes = JSON.parse(readFileSync(FICHIER, "utf-8"));
const idsExistants = new Set(existantes.map((e) => e.id || genererId(e.expr)));

let aAjouter = [];

if (options.auto) {
  const n = Math.max(1, parseInt(options.auto, 10) || 4);
  const candidates = RESERVE.filter((e) => !idsExistants.has(genererId(e.expr)));
  if (!candidates.length) {
    console.log("Réserve épuisée : toutes les expressions intégrées sont déjà dans le fichier.");
    process.exit(0);
  }
  // mélange de Fisher-Yates puis prise des n premières
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  aAjouter = candidates.slice(0, n);
} else if (options.expr) {
  aAjouter = [{
    expr: options.expr,
    sens: options.sens || "",
    exemple: options.exemple || "",
    registre: options.registre || "courant",
  }];
  if (idsExistants.has(genererId(options.expr))) {
    console.error(`Déjà présente : « ${options.expr} »`);
    process.exit(1);
  }
} else {
  console.log(`Usage :
  node scripts/ajouter.mjs --auto 4
  node scripts/ajouter.mjs --expr "…" --sens "…" --exemple "…" --registre "…"`);
  process.exit(0);
}

const date = aujourdhui();
const nouvelles = aAjouter.map((e) => ({ ...e, date }));
writeFileSync(FICHIER, JSON.stringify([...nouvelles, ...existantes], null, 2) + "\n", "utf-8");

for (const e of nouvelles) console.log(`+ ${e.expr}`);
console.log(`${nouvelles.length} expression(s) ajoutée(s) à expressions.json (${date}).`);
