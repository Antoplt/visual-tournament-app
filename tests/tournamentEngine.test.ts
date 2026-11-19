import { describe, expect, it } from 'vitest';
import {
  buildMatchId,
  calculateBracketDimensions,
  computeHighlightedPaths,
  createTournament,
  distributeByesEvenly,
  getChampionJourney,
  MAX_CARDS,
  MIN_CARDS,
  resolveDuel,
  selectMatchFromTree,
  undoLastVote
} from '../src/engine/tournamentEngine';
import { CardItem } from '../src/types/tournament';

function buildMockCards(count: number): {
  cards: Record<string, CardItem>;
  ids: string[];
} {
  const cards: Record<string, CardItem> = {};
  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const id = `card-${i}`;
    cards[id] = {
      id,
      objectUrl: `blob:mock-${i}`,
      aspectRatio: 1
    };
    ids.push(id);
  }

  return { cards, ids };
}

function createDeterministicRng(seed = 42): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('Moteur de tournoi - Dimensions et Byes', () => {
  it('calcule correctement les dimensions pour des puissances de 2 et des nombres impairs', () => {
    expect(calculateBracketDimensions(2)).toEqual({
      bracketSize: 2,
      totalFloors: 1,
      firstFloorMatches: 1,
      byeCount: 0
    });

    expect(calculateBracketDimensions(5)).toEqual({
      bracketSize: 8,
      totalFloors: 3,
      firstFloorMatches: 4,
      byeCount: 3
    });

    expect(calculateBracketDimensions(64)).toEqual({
      bracketSize: 64,
      totalFloors: 6,
      firstFloorMatches: 32,
      byeCount: 0
    });
  });

  it('rejette un nombre de cartes hors de l intervalle [2, 64]', () => {
    expect(() => calculateBracketDimensions(MIN_CARDS - 1)).toThrow();
    expect(() => calculateBracketDimensions(MAX_CARDS + 1)).toThrow();
  });

  it('repartit uniformement les Byes sur le premier etage', () => {
    const flags = distributeByesEvenly(4, 2);
    expect(flags.filter(Boolean)).toHaveLength(2);
    expect(flags).toEqual([false, true, false, true]);
  });
});

describe('Moteur de tournoi - Construction et Deroulement complet', () => {
  it('promouvoit immediatement les cartes exemptees (Byes) vers l etage 1', () => {
    const { cards, ids } = buildMockCards(3);
    const store = createTournament(cards, ids, createDeterministicRng(1));

    const m0 = store.current.matches[buildMatchId(0, 0)];
    const m1 = store.current.matches[buildMatchId(0, 1)];
    const statuses = [m0.status, m1.status].sort();

    expect(statuses).toEqual(['BYE', 'READY']);
    expect(store.current.currentFloor).toBe(0);
    expect(store.current.activeMatchId).not.toBeNull();
  });

  it('enchaine les duels de gauche a droite puis monte d etage jusqu au podium (6 cartes)', () => {
    const { cards, ids } = buildMockCards(6);
    let store = createTournament(cards, ids, createDeterministicRng(7));

    let playedDuels = 0;

    while (store.phase !== 'PODIUM' && store.current.activeMatchId) {
      const match = store.current.matches[store.current.activeMatchId];
      expect(match.status).toBe('READY');
      expect(match.leftCardId).not.toBeNull();

      store = resolveDuel(store, match.id, match.leftCardId!);
      playedDuels++;
    }

    expect(playedDuels).toBe(5);
    expect(store.phase).toBe('PODIUM');

    const journey = getChampionJourney(store);
    expect(journey.champion).not.toBeNull();
    expect(journey.defeatedOpponents.length).toBeGreaterThanOrEqual(2);
  });

  it('supporte un tournoi maximal de 64 cartes sans erreur', () => {
    const { cards, ids } = buildMockCards(64);
    let store = createTournament(cards, ids, createDeterministicRng(99));

    expect(store.totalFloors).toBe(6);
    let votes = 0;

    while (store.phase !== 'PODIUM' && store.current.activeMatchId) {
      const match = store.current.matches[store.current.activeMatchId];
      store = resolveDuel(store, match.id, match.rightCardId!);
      votes++;
    }

    expect(votes).toBe(63);
    expect(store.phase).toBe('PODIUM');
  });
});

describe('Moteur de tournoi - Navigation Arbre, Undo et Illumination', () => {
  it('autorise le changement manuel de duel uniquement sur l etage actif et les matchs READY', () => {
    const { cards, ids } = buildMockCards(4);
    const store = createTournament(cards, ids, createDeterministicRng(10));

    const matchLeftId = buildMatchId(0, 0);
    const matchRightId = buildMatchId(0, 1);
    const finalMatchId = buildMatchId(1, 0);

    expect(store.current.activeMatchId).toBe(matchLeftId);

    const jumped = selectMatchFromTree({ ...store, phase: 'TREE' }, matchRightId);
    expect(jumped.phase).toBe('DUEL');
    expect(jumped.current.activeMatchId).toBe(matchRightId);

    const forbidden = selectMatchFromTree(jumped, finalMatchId);
    expect(forbidden.current.activeMatchId).toBe(matchRightId);
  });

  it('restaure fidelement l etat precedent lors d un Undo apres franchissement d etage', () => {
    const { cards, ids } = buildMockCards(4);
    let store = createTournament(cards, ids, createDeterministicRng(12));

    const m0 = store.current.matches[buildMatchId(0, 0)];
    store = resolveDuel(store, m0.id, m0.leftCardId!);

    const m1 = store.current.matches[buildMatchId(0, 1)];
    store = resolveDuel(store, m1.id, m1.leftCardId!);

    expect(store.current.currentFloor).toBe(1);
    expect(store.current.activeMatchId).toBe(buildMatchId(1, 0));

    const reverted = undoLastVote(store);
    expect(reverted.phase).toBe('DUEL');
    expect(reverted.current.currentFloor).toBe(0);
    expect(reverted.current.activeMatchId).toBe(m1.id);
    expect(reverted.current.matches[m1.id].status).toBe('READY');
  });

  it('calcule les chemins acquis et projetes lors du survol d une carte', () => {
    const { cards, ids } = buildMockCards(4);
    let store = createTournament(cards, ids, createDeterministicRng(5));

    const m0 = store.current.matches[buildMatchId(0, 0)];
    const winnerId = m0.leftCardId!;
    const loserId = m0.rightCardId!;

    store = resolveDuel(store, m0.id, winnerId);

    const winnerPaths = computeHighlightedPaths(store.current.matches, winnerId);
    expect(winnerPaths.acquiredMatchIds.has(m0.id)).toBe(true);
    expect(winnerPaths.projectedMatchIds.has(buildMatchId(1, 0))).toBe(true);
    expect(winnerPaths.eliminatedMatchId).toBeNull();

    const loserPaths = computeHighlightedPaths(store.current.matches, loserId);
    expect(loserPaths.eliminatedMatchId).toBe(m0.id);
    expect(loserPaths.projectedMatchIds.size).toBe(0);
  });
});
