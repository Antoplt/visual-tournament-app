/**
 * Phases principales du cycle de vie d'un tournoi.
 * - LOBBY  : Importation et preparation des images (2 a 64 cartes).
 * - DUEL   : Confrontation face a face entre deux cartes du palier actif.
 * - TREE   : Visualisation globale de l'arbre ascendant avec Pan & Zoom.
 * - PODIUM : Ecran final celebrant le vainqueur et son parcours.
 */
export type TournamentPhase = 'LOBBY' | 'DUEL' | 'TREE' | 'PODIUM';

/**
 * Etats possibles d'un noeud de match dans l'arbre binaire.
 * - PENDING   : En attente d'au moins un vainqueur de l'etage inferieur (affiche '?').
 * - READY     : Les deux cartes sont presentes, le duel peut etre joue.
 * - COMPLETED : Le duel a ete tranche (vainqueur et perdant definis).
 * - BYE       : Exemption automatique au premier tour (1 seule carte presente).
 */
export type MatchStatus = 'PENDING' | 'READY' | 'COMPLETED' | 'BYE';

/**
 * Representation purement visuelle d'un participant.
 * Aucune donnee textuelle (nom de fichier) n'est exposee dans l'interface.
 */
export interface CardItem {
  id: string;
  objectUrl: string;
  aspectRatio: number;
}

/**
 * Noeud atomique de l'arbre de tournoi.
 * L'arbre est construit de bas en haut :
 * - floorIndex = 0 represente la base (premier tour).
 * - floorIndex = totalFloors - 1 represente la finale (sommet).
 */
export interface MatchNode {
  id: string;
  floorIndex: number;
  matchIndex: number;
  leftCardId: string | null;
  rightCardId: string | null;
  winnerCardId: string | null;
  loserCardId: string | null;
  status: MatchStatus;
  parentMatchId: string | null;
  parentSlot: 'LEFT' | 'RIGHT' | null;
  leftChildMatchId: string | null;
  rightChildMatchId: string | null;
}

/**
 * Cliche immutable de l'etat d'avancement du tournoi.
 * Utilise dans une pile d'historique pour permettre l'annulation (Undo).
 */
export interface TournamentSnapshot {
  matches: Record<string, MatchNode>;
  currentFloor: number;
  activeMatchId: string | null;
}

/**
 * Etat global complet de l'application en memoire.
 */
export interface TournamentStore {
  phase: TournamentPhase;
  cards: Record<string, CardItem>;
  cardOrder: string[];
  totalFloors: number;
  current: TournamentSnapshot;
  history: TournamentSnapshot[];
  hoveredCardId: string | null;
  zoomedCardId: string | null;
}

/**
 * Resultat du calcul d'illumination d'un chemin au survol d'une carte.
 */
export interface HighlightedPathResult {
  /** Identifiants des matchs deja gagnes par la carte survolee (trait plein lumineux). */
  acquiredMatchIds: Set<string>;
  /** Identifiants des matchs futurs potentiels jusqu'a la finale (trait pointille). */
  projectedMatchIds: Set<string>;
  /** Identifiant du match ou la carte a ete eliminee, le cas echeant. */
  eliminatedMatchId: string | null;
}
