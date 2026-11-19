import React from 'react';
import { GitFork, RotateCcw, Swords, Trophy, Undo2 } from 'lucide-react';
import { TournamentPhase } from '../types/tournament';

interface TopNavigationBarProps {
  phase: TournamentPhase;
  currentFloor: number;
  totalFloors: number;
  completedCount: number;
  totalPlayableMatches: number;
  canUndo: boolean;
  onSwitchPhase: (target: 'DUEL' | 'TREE') => void;
  onUndo: () => void;
  onReset: () => void;
}

/**
 * Barre de navigation superieure persistante pendant le tournoi.
 * Permet de basculer entre la vue Duel et la vue Arbre, d'annuler le dernier vote (Undo)
 * et de visualiser la progression globale.
 */
export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  phase,
  currentFloor,
  totalFloors,
  completedCount,
  totalPlayableMatches,
  canUndo,
  onSwitchPhase,
  onUndo,
  onReset
}) => {
  const progressPercent =
    totalPlayableMatches > 0 ? Math.round((completedCount / totalPlayableMatches) * 100) : 0;

  return (
    <header className="h-16 px-6 bg-arena-surface/90 backdrop-blur-md border-b border-arena-border flex items-center justify-between z-30 shrink-0">
      {/* Indicateur d'etage et jauge de progression */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-amber-400 font-semibold tracking-wide">
          <Trophy className="w-5 h-5" />
          <span>
            Palier {Math.min(currentFloor + 1, totalFloors)} / {totalFloors}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2.5">
          <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {completedCount}/{totalPlayableMatches}
          </span>
        </div>
      </div>

      {/* Onglets centraux de navigation Duel / Arbre */}
      {phase !== 'PODIUM' && (
        <nav className="flex items-center bg-arena-bg p-1 rounded-xl border border-arena-border">
          <button
            type="button"
            onClick={() => onSwitchPhase('DUEL')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              phase === 'DUEL'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>Duel</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchPhase('TREE')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              phase === 'TREE'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className="w-4 h-4" />
            <span>Arbre</span>
          </button>
        </nav>
      )}

      {/* Actions rapides : Annuler (Undo) et Reinitialiser */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler le dernier vote (Ctrl+Z)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-arena-border bg-arena-card text-slate-200 hover:border-amber-500/60 hover:text-amber-300 disabled:opacity-35 disabled:pointer-events-none transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          <span className="hidden md:inline">Annuler</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          title="Nouveau tournoi"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-arena-border bg-arena-card text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden md:inline">Quitter</span>
        </button>
      </div>
    </header>
  );
};
