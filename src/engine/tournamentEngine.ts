import {
  CardItem,
  HighlightedPathResult,
  MatchNode,
  TournamentSnapshot,
  TournamentStore
} from '../types/tournament';

/** Nombre minimum de cartes requises pour lancer un tournoi. */
export const MIN_CARDS = 2;

/** Plafond strict de cartes autorisees dans un tournoi. */
export const MAX_CARDS = 64;

/**
 * Genere l'identifiant deterministe d'un noeud de match.
 *
 * @param floorIndex Index de l'etage (0 = base).
 * @param matchIndex Position horizontale de gauche a droite sur l'etage.
 */
export function buildMatchId(floorIndex: number, matchIndex: number): string {
  return `floor-${floorIndex}-match-${matchIndex}`;
}

/**
 * Melange un tableau de maniere uniforme via l'algorithme de Fisher-Yates.
 * Fonction pure : ne mute pas le tableau d'entree.
 *
 * @param items Liste d'elements a melanger.
 * @param rng Generateur pseudo-aleatoire optionnel (injectable pour les tests).
 */
export function shuffleItems<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Calcule les dimensions structurelles de l'arbre binaire pour N participants.
 *
 * @param cardCount Nombre total de cartes (entre 2 et 64).
 * @returns Taille de puissance de 2 (bracketSize), nombre d'etages (totalFloors),
 *          nombre de matchs au premier etage (firstFloorMatches) et nombre d'exemptions (byeCount).
 */
export function calculateBracketDimensions(cardCount: number): {
  bracketSize: number;
  totalFloors: number;
  firstFloorMatches: number;
  byeCount: number;
} {
  if (cardCount < MIN_CARDS || cardCount > MAX_CARDS) {
    throw new Error(`Le nombre de cartes doit etre compris entre ${MIN_CARDS} et ${MAX_CARDS}.`);
  }

  const totalFloors = Math.ceil(Math.log2(cardCount));
  const bracketSize = Math.pow(2, totalFloors);
  const firstFloorMatches = bracketSize / 2;
  const byeCount = bracketSize - cardCount;

  return {
    bracketSize,
    totalFloors,
    firstFloorMatches,
    byeCount
  };
}

/**
 * Repartit uniformement les exemptions (Byes) sur les matchs du premier etage
 * afin d'eviter de concentrer tous les passages automatiques d'un seul cote de l'arbre.
 *
 * @param firstFloorMatches Nombre de matchs sur l'etage 0.
 * @param byeCount Nombre de cartes exemptees (entre 0 et firstFloorMatches - 1).
 * @returns Tableau booleen indiquant pour chaque match de l'etage 0 s'il s'agit d'un Bye.
 */
export function distributeByesEvenly(firstFloorMatches: number, byeCount: number): boolean[] {
  const byeFlags = new Array<boolean>(firstFloorMatches).fill(false);
  if (byeCount <= 0) {
    return byeFlags;
  }

  // Distribution par pas regulier sur l'intervalle [0, firstFloorMatches - 1]
  for (let i = 0; i < byeCount; i++) {
    const slotIndex = Math.floor(((i + 0.5) * firstFloorMatches) / byeCount);
    byeFlags[slotIndex] = true;
  }

  return byeFlags;
}

/**
 * Recherche le premier match jouable (status === 'READY') de gauche a droite
 * sur un etage donne.
 *
 * @param matches Dictionnaire de tous les matchs.
 * @param floorIndex Etage a inspecter.
 * @returns L'identifiant du prochain match pret, ou null si l'etage est termine.
 */
export function findNextReadyMatchOnFloor(
  matches: Record<string, MatchNode>,
  floorIndex: number
): string | null {
  const floorMatches = Object.values(matches)
    .filter((m) => m.floorIndex === floorIndex && m.status === 'READY')
    .sort((a, b) => a.matchIndex - b.matchIndex);

  return floorMatches.length > 0 ? floorMatches[0].id : null;
}

/**
 * Clone profondement un snapshot de tournoi pour garantir l'immutabilite
 * de la pile d'historique (Undo).
 */
export function cloneSnapshot(snapshot: TournamentSnapshot): TournamentSnapshot {
  const clonedMatches: Record<string, MatchNode> = {};
  for (const [id, node] of Object.entries(snapshot.matches)) {
    clonedMatches[id] = { ...node };
  }

  return {
    matches: clonedMatches,
    currentFloor: snapshot.currentFloor,
    activeMatchId: snapshot.activeMatchId
  };
}

/**
 * Construit un nouvel arbre de tournoi complet a partir d'une liste de cartes.
 * Gere le melange initial, la creation de tous les etages de bas en haut,
 * le chainage des pointeurs parent/enfant et la promotion immediate des Byes.
 *
 * @param cards Dictionnaire des cartes importees.
 * @param orderedCardIds Liste ordonnee des identifiants de cartes.
 * @param rng Generateur aleatoire optionnel (pour reproductibilite en test).
 */
export function createTournament(
  cards: Record<string, CardItem>,
  orderedCardIds: readonly string[],
  rng: () => number = Math.random
): TournamentStore {
  const shuffledIds = shuffleItems(orderedCardIds, rng);
  const { totalFloors, firstFloorMatches, byeCount } = calculateBracketDimensions(
    shuffledIds.length
  );

  const matches: Record<string, MatchNode> = {};

  // 1. Creation de tous les noeuds de l'arbre de l'etage 0 jusqu'au sommet
  for (let floor = 0; floor < totalFloors; floor++) {
    const matchesOnFloor = firstFloorMatches / Math.pow(2, floor);

    for (let idx = 0; idx < matchesOnFloor; idx++) {
      const id = buildMatchId(floor, idx);
      const hasParent = floor < totalFloors - 1;
      const parentMatchId = hasParent ? buildMatchId(floor + 1, Math.floor(idx / 2)) : null;
      const parentSlot = hasParent ? (idx % 2 === 0 ? 'LEFT' : 'RIGHT') : null;

      const hasChildren = floor > 0;
      const leftChildMatchId = hasChildren ? buildMatchId(floor - 1, idx * 2) : null;
      const rightChildMatchId = hasChildren ? buildMatchId(floor - 1, idx * 2 + 1) : null;

      matches[id] = {
        id,
        floorIndex: floor,
        matchIndex: idx,
        leftCardId: null,
        rightCardId: null,
        winnerCardId: null,
        loserCardId: null,
        status: 'PENDING',
        parentMatchId,
        parentSlot,
        leftChildMatchId,
        rightChildMatchId
      };
    }
  }

  // 2. Placement des cartes sur l'etage 0 avec repartition equilibree des Byes
  const byeFlags = distributeByesEvenly(firstFloorMatches, byeCount);
  let cursor = 0;

  for (let idx = 0; idx < firstFloorMatches; idx++) {
    const match = matches[buildMatchId(0, idx)];
    const isBye = byeFlags[idx];

    if (isBye) {
      const soloCardId = shuffledIds[cursor++];
      match.leftCardId = soloCardId;
      match.rightCardId = null;
      match.winnerCardId = soloCardId;
      match.loserCardId = null;
      match.status = 'BYE';

      // Promotion immediate vers l'etage 1
      if (match.parentMatchId && match.parentSlot) {
        const parent = matches[match.parentMatchId];
        if (match.parentSlot === 'LEFT') {
          parent.leftCardId = soloCardId;
        } else {
          parent.rightCardId = soloCardId;
        }
        if (parent.leftCardId && parent.rightCardId) {
          parent.status = 'READY';
        }
      }
    } else {
      const leftId = shuffledIds[cursor++];
      const rightId = shuffledIds[cursor++];
      match.leftCardId = leftId;
      match.rightCardId = rightId;
      match.status = 'READY';
    }
  }

  // 3. Determination du premier etage actif et du premier duel a jouer
  let initialFloor = 0;
  let initialActiveMatchId = findNextReadyMatchOnFloor(matches, 0);

  while (!initialActiveMatchId && initialFloor < totalFloors - 1) {
    initialFloor++;
    initialActiveMatchId = findNextReadyMatchOnFloor(matches, initialFloor);
  }

  return {
    phase: 'DUEL',
    cards,
    cardOrder: [...orderedCardIds],
    totalFloors,
    current: {
      matches,
      currentFloor: initialFloor,
      activeMatchId: initialActiveMatchId
    },
    history: [],
    hoveredCardId: null,
    zoomedCardId: null
  };
}

/**
 * Enregistre le choix de l'utilisateur pour un duel donne, propage le vainqueur
 * au palier superieur et fait avancer automatiquement le tournoi.
 *
 * @param store Etat courant du tournoi.
 * @param matchId Identifiant du duel tranche.
 * @param winnerCardId Identifiant de la carte selectionnee comme gagnante.
 * @returns Nouvel etat mis a jour (avec sauvegarde dans l'historique Undo).
 */
export function resolveDuel(
  store: TournamentStore,
  matchId: string,
  winnerCardId: string
): TournamentStore {
  const targetMatch = store.current.matches[matchId];
  if (!targetMatch || targetMatch.status !== 'READY') {
    return store;
  }

  if (winnerCardId !== targetMatch.leftCardId && winnerCardId !== targetMatch.rightCardId) {
    throw new Error('La carte gagnante ne participe pas a ce duel.');
  }

  // Sauvegarde du cliche avant modification pour permettre le Undo
  const previousSnapshot = cloneSnapshot(store.current);
  const nextSnapshot = cloneSnapshot(store.current);
  const match = nextSnapshot.matches[matchId];

  const loserCardId =
    winnerCardId === match.leftCardId ? match.rightCardId : match.leftCardId;

  match.winnerCardId = winnerCardId;
  match.loserCardId = loserCardId;
  match.status = 'COMPLETED';

  // Propagation du vainqueur vers le noeud parent
  if (match.parentMatchId && match.parentSlot) {
    const parent = nextSnapshot.matches[match.parentMatchId];
    if (match.parentSlot === 'LEFT') {
      parent.leftCardId = winnerCardId;
    } else {
      parent.rightCardId = winnerCardId;
    }

    if (parent.leftCardId && parent.rightCardId) {
      parent.status = 'READY';
    }
  }

  // Recherche du prochain duel sur l'etage courant (de gauche a droite)
  let nextFloor = nextSnapshot.currentFloor;
  let nextMatchId = findNextReadyMatchOnFloor(nextSnapshot.matches, nextFloor);
  let nextPhase = store.phase;

  if (!nextMatchId) {
    // Tous les duels de l'etage courant sont termines
    if (nextFloor < store.totalFloors - 1) {
      nextFloor += 1;
      nextMatchId = findNextReadyMatchOnFloor(nextSnapshot.matches, nextFloor);
    } else {
      // La finale vient d'etre jouee : passage au podium final
      nextPhase = 'PODIUM';
      nextMatchId = null;
    }
  }

  nextSnapshot.currentFloor = nextFloor;
  nextSnapshot.activeMatchId = nextMatchId;

  return {
    ...store,
    phase: nextPhase,
    current: nextSnapshot,
    history: [...store.history, previousSnapshot],
    zoomedCardId: null
  };
}

/**
 * Permet a l'utilisateur de selectionner manuellement un duel depuis la vue Arbre.
 * Autorise uniquement si le match appartient a l'etage actif et possede le statut READY.
 *
 * @param store Etat courant du tournoi.
 * @param matchId Identifiant du match clique dans l'arbre.
 */
export function selectMatchFromTree(store: TournamentStore, matchId: string): TournamentStore {
  const target = store.current.matches[matchId];
  if (!target) {
    return store;
  }

  if (target.floorIndex !== store.current.currentFloor || target.status !== 'READY') {
    return store;
  }

  return {
    ...store,
    phase: 'DUEL',
    current: {
      ...store.current,
      activeMatchId: matchId
    }
  };
}

/**
 * Annule le dernier vote en depilant le dernier cliche de l'historique.
 * Restaure automatiquement l'etage precedent si un changement de palier venait d'avoir lieu
 * et rouvre directement la vue Duel sur le match annule.
 */
export function undoLastVote(store: TournamentStore): TournamentStore {
  if (store.history.length === 0) {
    return store;
  }

  const previousSnapshot = store.history[store.history.length - 1];
  const remainingHistory = store.history.slice(0, -1);

  return {
    ...store,
    phase: 'DUEL',
    current: cloneSnapshot(previousSnapshot),
    history: remainingHistory,
    zoomedCardId: null
  };
}

/**
 * Calcule l'ensemble des branches a illuminer dans l'arbre lorsqu'une carte est survolee :
 * 1. Chemin acquis : tous les matchs deja remportes (ou Byes) par cette carte.
 * 2. Chemin projete : si la carte n'est pas eliminee, ses matchs futurs potentiels jusqu'au sommet.
 * 3. Match d'elimination : le duel ou elle a perdu le cas echeant.
 */
export function computeHighlightedPaths(
  matches: Record<string, MatchNode>,
  cardId: string | null
): HighlightedPathResult {
  const acquiredMatchIds = new Set<string>();
  const projectedMatchIds = new Set<string>();
  let eliminatedMatchId: string | null = null;

  if (!cardId) {
    return { acquiredMatchIds, projectedMatchIds, eliminatedMatchId };
  }

  let highestPresenceMatch: MatchNode | null = null;

  for (const match of Object.values(matches)) {
    const isParticipant = match.leftCardId === cardId || match.rightCardId === cardId;
    if (!isParticipant) {
      continue;
    }

    if (match.winnerCardId === cardId) {
      acquiredMatchIds.add(match.id);
    } else if (match.loserCardId === cardId) {
      eliminatedMatchId = match.id;
    }

    if (!highestPresenceMatch || match.floorIndex > highestPresenceMatch.floorIndex) {
      highestPresenceMatch = match;
    }
  }

  // Si la carte est toujours en lice (non eliminee), on projette son chemin jusqu'a la finale
  if (highestPresenceMatch && !eliminatedMatchId) {
    if (highestPresenceMatch.status === 'READY' || highestPresenceMatch.status === 'PENDING') {
      projectedMatchIds.add(highestPresenceMatch.id);
    }

    let cursorParentId = highestPresenceMatch.parentMatchId;
    while (cursorParentId) {
      projectedMatchIds.add(cursorParentId);
      cursorParentId = matches[cursorParentId]?.parentMatchId ?? null;
    }
  }

  return {
    acquiredMatchIds,
    projectedMatchIds,
    eliminatedMatchId
  };
}

/**
 * Extrait les informations du vainqueur final et la liste ordonnee des adversaires
 * qu'il a battus a chaque etage pour l'affichage du podium.
 */
export function getChampionJourney(store: TournamentStore): {
  champion: CardItem | null;
  defeatedOpponents: Array<{ floorIndex: number; card: CardItem }>;
} {
  const finalMatchId = buildMatchId(store.totalFloors - 1, 0);
  const finalMatch = store.current.matches[finalMatchId];

  if (!finalMatch || finalMatch.status !== 'COMPLETED' || !finalMatch.winnerCardId) {
    return { champion: null, defeatedOpponents: [] };
  }

  const championId = finalMatch.winnerCardId;
  const champion = store.cards[championId] ?? null;

  const defeatedOpponents: Array<{ floorIndex: number; card: CardItem }> = [];
  const wonMatches = Object.values(store.current.matches)
    .filter((m) => m.status === 'COMPLETED' && m.winnerCardId === championId && m.loserCardId)
    .sort((a, b) => a.floorIndex - b.floorIndex);

  for (const match of wonMatches) {
    if (match.loserCardId && store.cards[match.loserCardId]) {
      defeatedOpponents.push({
        floorIndex: match.floorIndex,
        card: store.cards[match.loserCardId]
      });
    }
  }

  return { champion, defeatedOpponents };
}
