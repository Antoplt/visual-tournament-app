import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CardItem, TournamentStore } from './types/tournament';
import {
  createTournament,
  getChampionJourney,
  MAX_CARDS,
  resolveDuel,
  selectMatchFromTree,
  undoLastVote
} from './engine/tournamentEngine';
import { revokeCardObjectUrls } from './utils/imageLoader';
import { SetupLobby } from './components/SetupLobby';
import { TopNavigationBar } from './components/TopNavigationBar';
import { DuelArena } from './components/DuelArena';
import { BracketTreeView } from './components/BracketTreeView';
import { VictoryPodiumView } from './components/VictoryPodiumView';

/**
 * Composant racine orchestrant les 4 phases du tournoi (LOBBY, DUEL, TREE, PODIUM),
 * les raccourcis clavier globaux et le cycle de vie memoire des URLs Blob.
 */
export const App: React.FC = () => {
  const [lobbyCards, setLobbyCards] = useState<CardItem[]>([]);
  const [store, setStore] = useState<TournamentStore | null>(null);
  const [hoveredDuelCardId, setHoveredDuelCardId] = useState<string | null>(null);

  const handleAddCards = useCallback((newCards: CardItem[]) => {
    setLobbyCards((prev) => [...prev, ...newCards].slice(0, MAX_CARDS));
  }, []);

  const handleRemoveCard = useCallback((cardId: string) => {
    setLobbyCards((prev) => {
      const target = prev.find((c) => c.id === cardId);
      if (target) {
        revokeCardObjectUrls([target]);
      }
      return prev.filter((c) => c.id !== cardId);
    });
  }, []);

  const handleClearLobby = useCallback(() => {
    setLobbyCards((prev) => {
      revokeCardObjectUrls(prev);
      return [];
    });
  }, []);

  const handleStartTournament = useCallback(() => {
    if (lobbyCards.length < 2) {
      return;
    }

    const cardMap: Record<string, CardItem> = {};
    const orderedIds: string[] = [];

    for (const card of lobbyCards) {
      cardMap[card.id] = card;
      orderedIds.push(card.id);
    }

    const initialStore = createTournament(cardMap, orderedIds);
    setStore(initialStore);
  }, [lobbyCards]);

  const handleResetTournament = useCallback(() => {
    revokeCardObjectUrls(lobbyCards);
    setLobbyCards([]);
    setStore(null);
  }, [lobbyCards]);

  const handleSelectWinner = useCallback((winnerCardId: string) => {
    setStore((prev) => {
      if (!prev || !prev.current.activeMatchId) {
        return prev;
      }
      return resolveDuel(prev, prev.current.activeMatchId, winnerCardId);
    });
  }, []);

  const handleUndo = useCallback(() => {
    setStore((prev) => (prev ? undoLastVote(prev) : prev));
  }, []);

  const handleSwitchPhase = useCallback((target: 'DUEL' | 'TREE') => {
    setStore((prev) => {
      if (!prev) {
        return prev;
      }
      if (target === 'DUEL' && !prev.current.activeMatchId) {
        return prev;
      }
      return { ...prev, phase: target, zoomedCardId: null };
    });
  }, []);

  useEffect(() => {
    if (!store) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && store.zoomedCardId) {
        event.preventDefault();
        setStore((prev) => (prev ? { ...prev, zoomedCardId: null } : prev));
        return;
      }

      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') ||
        event.key === 'Backspace'
      ) {
        if (store.history.length > 0) {
          event.preventDefault();
          handleUndo();
        }
        return;
      }

      if (event.key === 'Tab' || event.key.toLowerCase() === 't') {
        if (store.phase === 'DUEL' || store.phase === 'TREE') {
          event.preventDefault();
          handleSwitchPhase(store.phase === 'DUEL' ? 'TREE' : 'DUEL');
        }
        return;
      }

      if (store.phase === 'DUEL' && store.current.activeMatchId) {
        const activeMatch = store.current.matches[store.current.activeMatchId];
        if (!activeMatch || !activeMatch.leftCardId || !activeMatch.rightCardId) {
          return;
        }

        if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
          event.preventDefault();
          handleSelectWinner(activeMatch.leftCardId);
        } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
          event.preventDefault();
          handleSelectWinner(activeMatch.rightCardId);
        } else if (event.key === ' ' || event.key.toLowerCase() === 'z') {
          event.preventDefault();
          const targetZoomId =
            store.zoomedCardId
              ? null
              : hoveredDuelCardId ?? activeMatch.leftCardId;
          setStore((prev) => (prev ? { ...prev, zoomedCardId: targetZoomId } : prev));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, hoveredDuelCardId, handleSelectWinner, handleUndo, handleSwitchPhase]);

  const progressStats = useMemo(() => {
    if (!store) {
      return { completedCount: 0, totalPlayableMatches: 0 };
    }
    const allMatches = Object.values(store.current.matches);
    const playable = allMatches.filter((m) => m.status !== 'BYE');
    const completed = playable.filter((m) => m.status === 'COMPLETED');
    return {
      completedCount: completed.length,
      totalPlayableMatches: playable.length
    };
  }, [store]);

  if (!store) {
    return (
      <main className="h-full w-full bg-arena-bg">
        <SetupLobby
          cards={lobbyCards}
          onAddCards={handleAddCards}
          onRemoveCard={handleRemoveCard}
          onClearAll={handleClearLobby}
          onStartTournament={handleStartTournament}
        />
      </main>
    );
  }

  const activeMatch = store.current.activeMatchId
    ? store.current.matches[store.current.activeMatchId]
    : null;

  const leftCard =
    activeMatch && activeMatch.leftCardId ? store.cards[activeMatch.leftCardId] : null;
  const rightCard =
    activeMatch && activeMatch.rightCardId ? store.cards[activeMatch.rightCardId] : null;
  const zoomedCard = store.zoomedCardId ? store.cards[store.zoomedCardId] ?? null : null;

  const { champion, defeatedOpponents } = getChampionJourney(store);

  return (
    <div className="h-full w-full flex flex-col bg-arena-bg overflow-hidden">
      <TopNavigationBar
        phase={store.phase}
        currentFloor={store.current.currentFloor}
        totalFloors={store.totalFloors}
        completedCount={progressStats.completedCount}
        totalPlayableMatches={progressStats.totalPlayableMatches}
        canUndo={store.history.length > 0}
        onSwitchPhase={handleSwitchPhase}
        onUndo={handleUndo}
        onReset={handleResetTournament}
      />

      <main className="flex-1 overflow-hidden relative">
        {store.phase === 'DUEL' && leftCard && rightCard && (
          <DuelArena
            leftCard={leftCard}
            rightCard={rightCard}
            zoomedCard={zoomedCard}
            onSelectWinner={handleSelectWinner}
            onOpenZoom={(cardId) => setStore({ ...store, zoomedCardId: cardId })}
            onCloseZoom={() => setStore({ ...store, zoomedCardId: null })}
            onHoverSideChange={setHoveredDuelCardId}
          />
        )}

        {store.phase === 'TREE' && (
          <BracketTreeView
            matches={store.current.matches}
            cards={store.cards}
            totalFloors={store.totalFloors}
            currentFloor={store.current.currentFloor}
            activeMatchId={store.current.activeMatchId}
            hoveredCardId={store.hoveredCardId}
            onHoverCard={(cardId) => setStore({ ...store, hoveredCardId: cardId })}
            onSelectMatch={(matchId) => setStore(selectMatchFromTree(store, matchId))}
          />
        )}

        {store.phase === 'PODIUM' && champion && (
          <VictoryPodiumView
            store={store}
            champion={champion}
            defeatedOpponents={defeatedOpponents}
            onViewFinalTree={() => setStore({ ...store, phase: 'TREE' })}
            onStartNewTournament={handleResetTournament}
          />
        )}
      </main>
    </div>
  );
};

export default App;
