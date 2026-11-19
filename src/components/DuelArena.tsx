import React, { useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { CardItem } from '../types/tournament';

interface DuelArenaProps {
  leftCard: CardItem;
  rightCard: CardItem;
  zoomedCard: CardItem | null;
  onSelectWinner: (cardId: string) => void;
  onOpenZoom: (cardId: string) => void;
  onCloseZoom: () => void;
  onHoverSideChange?: (cardId: string | null) => void;
}

/**
 * Vue principale d'affrontement face a face.
 * Presente deux cartes strictement visuelles (aucun texte) avec selection directe au clic
 * et bouton Loupe pour inspecter une image en haute definition.
 */
export const DuelArena: React.FC<DuelArenaProps> = ({
  leftCard,
  rightCard,
  zoomedCard,
  onSelectWinner,
  onOpenZoom,
  onCloseZoom,
  onHoverSideChange
}) => {
  const [hoveredSide, setHoveredSide] = useState<'LEFT' | 'RIGHT' | null>(null);

  const renderCardFrame = (card: CardItem, side: 'LEFT' | 'RIGHT') => {
    const isHovered = hoveredSide === side;

    return (
      <div
        onMouseEnter={() => {
          setHoveredSide(side);
          onHoverSideChange?.(card.id);
        }}
        onMouseLeave={() => {
          setHoveredSide(null);
          onHoverSideChange?.(null);
        }}
        onClick={() => onSelectWinner(card.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSelectWinner(card.id);
          }
        }}
        className={`group relative flex-1 h-full max-h-[72vh] rounded-3xl overflow-hidden bg-arena-card border-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
          isHovered
            ? 'border-amber-400 scale-[1.015] shadow-2xl shadow-amber-500/20'
            : 'border-arena-border hover:border-amber-400/80'
        }`}
      >
        <img
          src={card.objectUrl}
          alt=""
          draggable={false}
          className="w-full h-full object-contain p-2 select-none transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {/* Bouton Loupe plein ecran */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenZoom(card.id);
          }}
          title="Agrandir l'image (Espace)"
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-slate-950/75 backdrop-blur-sm border border-white/10 text-slate-200 hover:text-amber-400 hover:border-amber-400/60 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="relative h-full w-full flex items-center justify-center px-6 md:px-14 py-8">
      <div className="w-full max-w-6xl h-full flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
        {renderCardFrame(leftCard, 'LEFT')}

        {/* Badge central minimaliste VS */}
        <div className="shrink-0 w-12 h-12 rounded-full bg-arena-surface border border-arena-border flex items-center justify-center text-xs font-black tracking-widest text-amber-400 shadow-lg">
          VS
        </div>

        {renderCardFrame(rightCard, 'RIGHT')}
      </div>

      {/* Modale Loupe plein ecran */}
      {zoomedCard && (
        <div
          onClick={onCloseZoom}
          className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-6 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={onCloseZoom}
            className="absolute top-6 right-6 w-11 h-11 rounded-full bg-arena-surface border border-arena-border text-slate-200 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={zoomedCard.objectUrl}
            alt=""
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
