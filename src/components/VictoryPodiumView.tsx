import React, { useState } from 'react';
import { Crown, Download, GitFork, RotateCcw } from 'lucide-react';
import { CardItem, TournamentStore } from '../types/tournament';
import { exportBracketToPng } from '../utils/bracketPngExporter';

interface VictoryPodiumViewProps {
  store: TournamentStore;
  champion: CardItem;
  defeatedOpponents: Array<{ floorIndex: number; card: CardItem }>;
  onViewFinalTree: () => void;
  onStartNewTournament: () => void;
}

/**
 * Ecran final celebrant le vainqueur absolu du tournoi, son tableau de chasse
 * a chaque palier et permettant d'exporter l'arbre complet en PNG.
 */
export const VictoryPodiumView: React.FC<VictoryPodiumViewProps> = ({
  store,
  champion,
  defeatedOpponents,
  onViewFinalTree,
  onStartNewTournament
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadPng = async () => {
    setIsExporting(true);
    try {
      await exportBracketToPng(store);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="max-w-3xl w-full flex flex-col items-center text-center">
        {/* Couronne et carte championne */}
        <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-widest">
          <Crown className="w-4 h-4" />
          <span>Vainqueur du Tournoi</span>
        </div>

        <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden bg-arena-card border-4 border-amber-400 shadow-2xl shadow-amber-500/30 mb-8">
          <img
            src={champion.objectUrl}
            alt=""
            className="w-full h-full object-contain p-2"
          />
        </div>

        {/* Frise des adversaires vaincus tout au long du parcours */}
        {defeatedOpponents.length > 0 && (
          <div className="w-full mb-8">
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">
              Parcours victorieux ({defeatedOpponents.length} duels remportes)
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {defeatedOpponents.map(({ floorIndex, card }) => (
                <div
                  key={`${floorIndex}-${card.id}`}
                  className="relative w-16 h-16 rounded-xl overflow-hidden bg-arena-surface border border-arena-border"
                >
                  <img
                    src={card.objectUrl}
                    alt=""
                    className="w-full h-full object-cover opacity-65 grayscale"
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/85 text-[10px] font-mono text-amber-300">
                    T{floorIndex + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boutons d'actions finales */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exportation...' : 'Exporter l arbre (PNG)'}</span>
          </button>

          <button
            type="button"
            onClick={onViewFinalTree}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-arena-surface hover:bg-arena-card border border-arena-border text-slate-200 font-medium text-sm transition-colors"
          >
            <GitFork className="w-4 h-4" />
            <span>Explorer l'arbre</span>
          </button>

          <button
            type="button"
            onClick={onStartNewTournament}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-arena-surface hover:bg-arena-card border border-arena-border text-slate-300 font-medium text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Nouveau tournoi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
