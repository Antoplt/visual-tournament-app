import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Focus, ZoomIn, ZoomOut } from 'lucide-react';
import { CardItem, MatchNode } from '../types/tournament';
import { buildMatchId, computeHighlightedPaths } from '../engine/tournamentEngine';

interface BracketTreeViewProps {
  matches: Record<string, MatchNode>;
  cards: Record<string, CardItem>;
  totalFloors: number;
  currentFloor: number;
  activeMatchId: string | null;
  hoveredCardId: string | null;
  onHoverCard: (cardId: string | null) => void;
  onSelectMatch: (matchId: string) => void;
}

const CARD_SIZE = 64;
const PAIR_GAP = 6;
const MATCH_GAP = 22;
const FLOOR_HEIGHT = 136;
const CANVAS_PADDING = 72;

/**
 * Vue globale de l'arbre de tournoi ascendant (de bas en haut).
 * Integre :
 * - Navigation Pan & Zoom fluide a la souris et au pave tactile + bouton Recentrer.
 * - Calque SVG dynamique illuminant le chemin acquis (trait plein) et projete (pointille)
 *   de la carte survolee.
 * - Cartes perdantes grisees et barrees, cases futures marquees d'un '?'.
 * - Clic direct sur un duel jouable de l'etage actif pour y acceder immediatement.
 */
export const BracketTreeView: React.FC<BracketTreeViewProps> = ({
  matches,
  cards,
  totalFloors,
  currentFloor,
  activeMatchId,
  hoveredCardId,
  onHoverCard,
  onSelectMatch
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panOriginRef = useRef({ x: 0, y: 0 });

  // Calcul geometrique des dimensions de l'arbre complet
  const geometry = useMemo(() => {
    const firstFloorCount = Math.pow(2, totalFloors - 1);
    const matchBoxWidth = CARD_SIZE * 2 + PAIR_GAP;
    const width = Math.max(
      640,
      firstFloorCount * (matchBoxWidth + MATCH_GAP) - MATCH_GAP + CANVAS_PADDING * 2
    );
    const height = Math.max(420, totalFloors * FLOOR_HEIGHT + CANVAS_PADDING * 2);

    const nodePositions = new Map<string, { centerX: number; centerY: number }>();

    for (let floor = 0; floor < totalFloors; floor++) {
      const count = Math.pow(2, totalFloors - 1 - floor);
      const centerY = height - CANVAS_PADDING - floor * FLOOR_HEIGHT - CARD_SIZE / 2;

      for (let idx = 0; idx < count; idx++) {
        const id = buildMatchId(floor, idx);
        let centerX: number;

        if (floor === 0) {
          centerX = CANVAS_PADDING + idx * (matchBoxWidth + MATCH_GAP) + matchBoxWidth / 2;
        } else {
          const leftChild = nodePositions.get(buildMatchId(floor - 1, idx * 2));
          const rightChild = nodePositions.get(buildMatchId(floor - 1, idx * 2 + 1));
          centerX =
            leftChild && rightChild
              ? (leftChild.centerX + rightChild.centerX) / 2
              : width / 2;
        }

        nodePositions.set(id, { centerX, centerY });
      }
    }

    return { width, height, matchBoxWidth, nodePositions };
  }, [totalFloors]);

  // Recentrage automatique adaptatif a la taille de la fenetre
  const resetViewToFit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const scaleX = (rect.width - 48) / geometry.width;
    const scaleY = (rect.height - 48) / geometry.height;
    const fitScale = Math.min(1, Math.max(0.22, Math.min(scaleX, scaleY)));

    const centeredX = (rect.width - geometry.width * fitScale) / 2;
    const centeredY = (rect.height - geometry.height * fitScale) / 2;

    setTransform({ x: centeredX, y: centeredY, scale: fitScale });
  }, [geometry.height, geometry.width]);

  useEffect(() => {
    resetViewToFit();
  }, [resetViewToFit]);

  // Calcul des branches illuminees au survol d'une carte
  const highlighted = useMemo(
    () => computeHighlightedPaths(matches, hoveredCardId),
    [matches, hoveredCardId]
  );

  // Gestion du zoom a la molette centre sur le curseur
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.89;
    const nextScale = Math.min(2.2, Math.max(0.2, transform.scale * zoomFactor));

    const worldX = (pointerX - transform.x) / transform.scale;
    const worldY = (pointerY - transform.y) / transform.scale;

    setTransform({
      scale: nextScale,
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale
    });
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    setIsPanning(true);
    panOriginRef.current = {
      x: event.clientX - transform.x,
      y: event.clientY - transform.y
    };
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) {
      return;
    }
    setTransform((prev) => ({
      ...prev,
      x: event.clientX - panOriginRef.current.x,
      y: event.clientY - panOriginRef.current.y
    }));
  };

  const stopPanning = () => setIsPanning(false);

  const renderSlotCard = (match: MatchNode, cardId: string | null) => {
    const card = cardId ? cards[cardId] : null;
    const isWinner = cardId !== null && match.winnerCardId === cardId;
    const isLoser = cardId !== null && match.loserCardId === cardId;
    const isHovered = cardId !== null && hoveredCardId === cardId;

    return (
      <div
        onMouseEnter={() => cardId && onHoverCard(cardId)}
        onMouseLeave={() => cardId && onHoverCard(null)}
        style={{ width: CARD_SIZE, height: CARD_SIZE }}
        className={`relative rounded-xl overflow-hidden border transition-all flex items-center justify-center ${
          !card
            ? 'bg-arena-surface/70 border-arena-border/70 text-slate-600'
            : isHovered
            ? 'border-sky-400 ring-2 ring-sky-400/50 scale-105 z-10'
            : isWinner
            ? 'border-amber-400/90 bg-arena-card'
            : isLoser
            ? 'border-slate-800 bg-slate-950'
            : 'border-arena-border bg-arena-card'
        }`}
      >
        {card ? (
          <>
            <img
              src={card.objectUrl}
              alt=""
              draggable={false}
              className={`w-full h-full object-cover transition-opacity ${
                isLoser ? 'opacity-30 grayscale' : 'opacity-100'
              }`}
            />
            {isLoser && (
              <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 w-full h-full p-2 text-rose-500/85 pointer-events-none"
              >
                <line
                  x1="3"
                  y1="3"
                  x2="21"
                  y2="21"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="21"
                  y1="3"
                  x2="3"
                  y2="21"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </>
        ) : (
          <span className="text-lg font-bold select-none">?</span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPanning}
      onMouseLeave={stopPanning}
      className={`relative w-full h-full overflow-hidden bg-arena-bg ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Conteneur transforme par matrice CSS 3D */}
      <div
        style={{
          width: geometry.width,
          height: geometry.height,
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transformOrigin: '0 0'
        }}
        className="relative"
      >
        {/* Calque SVG des branches de connexion */}
        <svg
          width={geometry.width}
          height={geometry.height}
          className="absolute inset-0 pointer-events-none"
        >
          {Object.values(matches).map((match) => {
            if (!match.parentMatchId) {
              return null;
            }
            const from = geometry.nodePositions.get(match.id);
            const to = geometry.nodePositions.get(match.parentMatchId);
            if (!from || !to) {
              return null;
            }

            const startY = from.centerY - CARD_SIZE / 2;
            const endY = to.centerY + CARD_SIZE / 2;
            const midY = (startY + endY) / 2;
            const pathData = `M ${from.centerX} ${startY} L ${from.centerX} ${midY} L ${to.centerX} ${midY} L ${to.centerX} ${endY}`;

            const isAcquiredPath =
              highlighted.acquiredMatchIds.has(match.id) &&
              (highlighted.acquiredMatchIds.has(match.parentMatchId) ||
                highlighted.projectedMatchIds.has(match.parentMatchId) ||
                highlighted.eliminatedMatchId === match.parentMatchId);

            const isProjectedPath =
              !isAcquiredPath &&
              (highlighted.projectedMatchIds.has(match.id) ||
                highlighted.acquiredMatchIds.has(match.id)) &&
              highlighted.projectedMatchIds.has(match.parentMatchId);

            let strokeColor = '#263352';
            let strokeWidth = 2;
            let dashArray: string | undefined = undefined;

            if (isAcquiredPath) {
              strokeColor = '#38bdf8';
              strokeWidth = 4;
            } else if (isProjectedPath) {
              strokeColor = '#38bdf8';
              strokeWidth = 3;
              dashArray = '6 6';
            } else if (match.winnerCardId) {
              strokeColor = '#b45309';
              strokeWidth = 2.5;
            }

            return (
              <path
                key={`edge-${match.id}`}
                d={pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-colors duration-150"
              />
            );
          })}
        </svg>

        {/* Noeuds de matchs positionnes par etage de bas en haut */}
        {Object.values(matches).map((match) => {
          const pos = geometry.nodePositions.get(match.id);
          if (!pos) {
            return null;
          }

          const isPlayableOnCurrentFloor =
            match.floorIndex === currentFloor && match.status === 'READY';
          const isCurrentActiveMatch = match.id === activeMatchId;
          const isNodeHighlighted =
            highlighted.acquiredMatchIds.has(match.id) ||
            highlighted.projectedMatchIds.has(match.id) ||
            highlighted.eliminatedMatchId === match.id;

          return (
            <div
              key={match.id}
              onClick={(e) => {
                if (isPlayableOnCurrentFloor) {
                  e.stopPropagation();
                  onSelectMatch(match.id);
                }
              }}
              style={{
                left: pos.centerX - geometry.matchBoxWidth / 2,
                top: pos.centerY - CARD_SIZE / 2,
                width: geometry.matchBoxWidth
              }}
              title={
                isPlayableOnCurrentFloor
                  ? 'Cliquer pour jouer ce duel'
                  : undefined
              }
              className={`absolute flex items-center justify-center gap-[6px] p-1 rounded-2xl transition-all ${
                isCurrentActiveMatch
                  ? 'active-match-pulse bg-amber-500/15'
                  : isPlayableOnCurrentFloor
                  ? 'cursor-pointer hover:bg-amber-500/10 ring-1 ring-amber-400/50'
                  : ''
              } ${isNodeHighlighted ? 'ring-2 ring-sky-400/70 bg-sky-500/10' : ''}`}
            >
              {renderSlotCard(match, match.leftCardId)}
              {renderSlotCard(match, match.rightCardId)}
            </div>
          );
        })}
      </div>

      {/* Controles flottants de Zoom & Recentrage */}
      <div className="absolute bottom-6 right-6 flex items-center gap-1.5 p-1.5 rounded-2xl bg-arena-surface/90 backdrop-blur-md border border-arena-border shadow-xl">
        <button
          type="button"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.max(0.2, prev.scale * 0.85)
            }))
          }
          title="Zoom arriere"
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-arena-card transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={resetViewToFit}
          title="Recentrer l'arbre complet"
          className="px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:text-amber-300 hover:bg-arena-card flex items-center gap-1.5 transition-colors"
        >
          <Focus className="w-4 h-4" />
          <span>Recentrer</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setTransform((prev) => ({
              ...prev,
              scale: Math.min(2.2, prev.scale * 1.18)
            }))
          }
          title="Zoom avant"
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-arena-card transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
