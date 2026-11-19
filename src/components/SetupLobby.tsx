import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FolderUp, ImagePlus, Play, Trash2, X } from 'lucide-react';
import { CardItem } from '../types/tournament';
import { MAX_CARDS, MIN_CARDS } from '../engine/tournamentEngine';
import {
  extractFilesFromDataTransfer,
  loadCardItemsFromFiles
} from '../utils/imageLoader';

interface SetupLobbyProps {
  cards: CardItem[];
  onAddCards: (newCards: CardItem[]) => void;
  onRemoveCard: (cardId: string) => void;
  onClearAll: () => void;
  onStartTournament: () => void;
}

/**
 * Ecran d'accueil permettant d'importer jusqu'a 64 images par selection,
 * glisser-deposer (fichiers ou dossiers) ou collage presse-papiers (Ctrl+V).
 * L'apercu des cartes est strictement visuel, sans aucun texte affiche.
 */
export const SetupLobby: React.FC<SetupLobbyProps> = ({
  cards,
  onAddCards,
  onRemoveCard,
  onClearAll,
  onStartTournament
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processIncomingFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      const { accepted, ignoredCount, cappedCount } = await loadCardItemsFromFiles(
        files,
        cards.length
      );

      if (accepted.length > 0) {
        onAddCards(accepted);
      }

      if (cappedCount > 0) {
        setFeedbackNotice(`Plafond de ${MAX_CARDS} cartes atteint (${cappedCount} ignorees).`);
      } else if (ignoredCount > 0) {
        setFeedbackNotice(`${ignoredCount} fichier(s) non image ignore(s).`);
      } else {
        setFeedbackNotice(null);
      }
    },
    [cards.length, onAddCards]
  );

  // Support global du collage d'images via Ctrl+V / Cmd+V
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const clipboardFiles = Array.from(event.clipboardData?.files ?? []);
      if (clipboardFiles.length > 0) {
        event.preventDefault();
        void processIncomingFiles(clipboardFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processIncomingFiles]);

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const extracted = await extractFilesFromDataTransfer(event.dataTransfer);
    await processIncomingFiles(extracted);
  };

  const canStart = cards.length >= MIN_CARDS && cards.length <= MAX_CARDS;

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto px-6 py-8 overflow-hidden">
      {/* En-tete de configuration */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Visual Arena
          </h1>
          <p className="text-sm text-slate-400">
            Importez de {MIN_CARDS} a {MAX_CARDS} images (glisser-deposer, dossiers ou Ctrl+V)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-arena-surface border border-arena-border font-mono text-sm">
            <span className="text-amber-400 font-bold">{cards.length}</span>
            <span className="text-slate-500"> / {MAX_CARDS}</span>
          </div>

          {cards.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-arena-surface border border-arena-border text-slate-400 hover:text-rose-400 hover:border-rose-500/40 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Vider</span>
            </button>
          )}

          <button
            type="button"
            disabled={!canStart}
            onClick={onStartTournament}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Lancer le tournoi</span>
          </button>
        </div>
      </div>

      {/* Zone de depot interactive */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`shrink-0 mb-6 rounded-2xl border-2 border-dashed p-7 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
            : 'border-arena-border bg-arena-surface/60 hover:border-amber-500/60 hover:bg-arena-surface'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            void processIncomingFiles(selected);
            e.target.value = '';
          }}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-arena-card border border-arena-border flex items-center justify-center text-amber-400">
            {isDragging ? <FolderUp className="w-6 h-6" /> : <ImagePlus className="w-6 h-6" />}
          </div>
          <p className="text-sm font-medium text-slate-200">
            Cliquez ou deposez vos images et dossiers ici
          </p>
          <p className="text-xs text-slate-500">
            JPG, PNG, WEBP, AVIF, GIF, SVG, BMP - Traitement 100 % local en memoire
          </p>
        </div>
      </div>

      {feedbackNotice && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs shrink-0">
          {feedbackNotice}
        </div>
      )}

      {/* Grille purement visuelle des cartes importees (zero texte sur les vignettes) */}
      <div className="flex-1 overflow-y-auto pr-1">
        {cards.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-sm">
            Aucune image importee pour le moment
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 pb-6">
            {cards.map((card) => (
              <div
                key={card.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-arena-card border border-arena-border hover:border-amber-400/70 transition-all"
              >
                <img
                  src={card.objectUrl}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCard(card.id);
                  }}
                  aria-label="Retirer"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-950/80 text-slate-200 hover:bg-rose-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
