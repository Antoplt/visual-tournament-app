# Visual Arena - Tournoi Visuel en Arbre Ascendant

**Visual Arena** est une application web purement visuelle permettant d'organiser des tournois a elimination directe entre des images (de **2 a 64 participants**). L'application fonctionne integralement cote client en memoire vive, sans serveur ni base de donnees.

---

## 1. Concept et Fonctionnalites Cles

- **Interface 100 % Visuelle :** Aucun texte ni nom de fichier n'est affiche sur les cartes afin de garantir des choix purement instinctifs et esthetiques.
- **Importation Multi-Sources (2 a 64 images) :**
  - Selection classique de fichiers multiples (`JPG`, `PNG`, `WEBP`, `AVIF`, `GIF`, `SVG`, `BMP`, `ICO`).
  - Glisser-deposer direct de fichiers ou de **dossiers complets** (parcours recursif).
  - Collage rapide depuis le presse-papiers via `Ctrl+V` / `Cmd+V`.
- **Gestion Automatique des Exemptions (Byes) :** Lorsque le nombre d'images n'est pas une puissance de 2 (ex. 5, 13 ou 27 cartes), le moteur calcule la puissance de 2 superieure et repartit les exemptions de maniere equilibree sur le premier palier.
- **Vue Duel & Mode Loupe :**
  - Confrontation face a face en grand format avec selection directe au clic.
  - Inspection haute definition en plein ecran via le bouton Loupe (`Espace` ou `Z`).
- **Arbre de Tournoi Interactif (Ascendant) :**
  - Construction de bas en haut : le premier tour est a la base et la finale trone au sommet.
  - Navigation fluide **Pan & Zoom** (molette, glisser-deposer, bouton *Recentrer*).
  - **Illumination dynamique au survol :** survoler une carte eclaire en bleu continu son parcours deja remporte et en pointilles son chemin potentiel jusqu'a la finale.
  - Cartes eliminees grisees et barrees d'une croix ; duels futurs representes par `?`.
  - Possibilite de cliquer directement sur n'importe quel duel pret (`READY`) de l'etage actif pour le jouer en priorite.
- **Historique d'Annulation (Undo) :** Retour arriere illimite coup par coup (`Ctrl+Z` ou `Backspace`), y compris lors des changements de palier.
- **Podium Final & Export PNG :** Mise en valeur du vainqueur, frise des adversaires battus a chaque tour et telechargement haute resolution de l'arbre complet au format `.png`.

---

## 2. Raccourcis Clavier

| Raccourci | Contexte | Action |
| :--- | :--- | :--- |
| `Fleche Gauche` / `A` | Vue Duel | Choisir la carte de gauche |
| `Fleche Droite` / `D` | Vue Duel | Choisir la carte de droite |
| `Espace` / `Z` | Vue Duel | Ouvrir ou fermer la loupe plein ecran |
| `Tab` / `T` | Duel / Arbre | Basculer instantanement entre Duel et Arbre |
| `Ctrl+Z` / `Backspace` | Duel / Arbre | Annuler le dernier vote (Undo) |
| `Echap` | Mode Loupe | Fermer l'apercu plein ecran |

---

## 3. Architecture et Structure du Projet

Le code est decoupe selon une separation stricte entre le **moteur metier pur** (deterministe et testable sans DOM), les **utilitaires medias/export** et les **composants d'interface React**.

```text
visual-tournament-app/
├── .gitignore                        # Exclusions Git (node_modules, dist, logs)
├── index.html                        # Point d'entree HTML
├── package.json                      # Dependances et scripts npm
├── tsconfig.json                     # Configuration TypeScript stricte
├── vite.config.ts                    # Configuration Vite & Vitest
├── tailwind.config.js                # Palette graphique et theme sombre
├── postcss.config.js                 # Configuration PostCSS
├── README.md                         # Documentation du projet
├── src/
│   ├── main.tsx                      # Montage React
│   ├── index.css                     # Styles globaux et animations
│   ├── App.tsx                       # Orchestrateur d'etat et raccourcis clavier
│   ├── types/
│   │   └── tournament.ts             # Interfaces et types stricts du domaine
│   ├── engine/
│   │   └── tournamentEngine.ts       # Algorithmes purs (arbre, Byes, Undo, chemins)
│   ├── utils/
│   │   ├── imageLoader.ts            # Validation MIME, dossiers, gestion URLs Blob
│   │   └── bracketPngExporter.ts     # Rendu Canvas hors-ecran et export PNG
│   └── components/
│       ├── TopNavigationBar.tsx      # Barre superieure (onglets, jauge, Undo, Reset)
│       ├── SetupLobby.tsx            # Zone d'importation et grille visuelle
│       ├── DuelArena.tsx             # Arene de duel face a face + Modale Loupe
│       ├── BracketTreeView.tsx       # Arbre ascendant Pan & Zoom + calque SVG
│       └── VictoryPodiumView.tsx     # Ecran du champion et tableau de chasse
└── tests/
    ├── tournamentEngine.test.ts      # Tests unitaires du moteur de tournoi
    └── imageLoader.test.ts           # Tests unitaires de validation des medias
```

---

## 4. Installation, Execution et Tests

### Prerequis
- **Node.js** version 18 ou superieure
- **npm** (inclus avec Node.js)

### Commandes principales

```bash
# 1. Installer les dependances
npm install

# 2. Lancer le serveur de developpement local
npm run dev

# 3. Executer la suite de tests unitaires (Vitest)
npm test

# 4. Compiler le build de production
npm run build
```

---

## 5. Choix de Maintenabilite et Qualite Logicielle

1. **Gestion Memoire Sans Fuite (`Blob URLs`) :** Les images importees sont referencees via `URL.createObjectURL(file)` plutot qu'en Base64 afin de reduire l'empreinte RAM de plus de 30 % avec 64 images haute resolution. Chaque reinitialisation libere explicitement les descripteurs via `URL.revokeObjectURL()`.
2. **Moteur Pur et Deterministe :** Toutes les fonctions de `src/engine/tournamentEngine.ts` sont pures et acceptent un generateur aleatoire injectable (`rng`), garantissant des tests unitaires 100 % reproductibles.
3. **Historique Immutable (Undo) :** Chaque vote sauvegarde un cliche profond (`TournamentSnapshot`) dans une pile `history`, permettant de revenir en arriere sans effet de bord sur les pointeurs de l'arbre.
