import { TournamentStore } from '../types/tournament';
import { buildMatchId } from '../engine/tournamentEngine';

/**
 * Genere un rendu haute definition de l'arbre complet sur un Canvas HTML5 hors-ecran
 * et declenche le telechargement direct au format PNG.
 */
export async function exportBracketToPng(store: TournamentStore): Promise<void> {
  const firstFloorCount = Math.pow(2, store.totalFloors - 1);
  const cardWidth = 96;
  const cardHeight = 96;
  const matchGap = 24;
  const pairGap = 10;
  const floorHeight = 165;
  const padding = 64;

  const matchBoxWidth = cardWidth * 2 + pairGap;
  const totalWidth = Math.max(
    900,
    firstFloorCount * (matchBoxWidth + matchGap) - matchGap + padding * 2
  );
  const totalHeight = store.totalFloors * floorHeight + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  // Fond sombre uniforme
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Prechargement des images HTMLImageElement a partir des URLs Blob
  const loadedImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    Object.values(store.cards).map(
      (card) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            loadedImages.set(card.id, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = card.objectUrl;
        })
    )
  );

  // Calcul des coordonnees (x, y) de chaque match de bas en haut
  const positions = new Map<string, { centerX: number; centerY: number }>();

  for (let floor = 0; floor < store.totalFloors; floor++) {
    const matchesOnFloor = Math.pow(2, store.totalFloors - 1 - floor);
    const y = totalHeight - padding - floor * floorHeight - cardHeight / 2;

    for (let idx = 0; idx < matchesOnFloor; idx++) {
      const id = buildMatchId(floor, idx);
      let centerX: number;

      if (floor === 0) {
        centerX = padding + idx * (matchBoxWidth + matchGap) + matchBoxWidth / 2;
      } else {
        const leftChild = positions.get(buildMatchId(floor - 1, idx * 2));
        const rightChild = positions.get(buildMatchId(floor - 1, idx * 2 + 1));
        centerX =
          leftChild && rightChild
            ? (leftChild.centerX + rightChild.centerX) / 2
            : totalWidth / 2;
      }

      positions.set(id, { centerX, centerY: y });
    }
  }

  // Dessin des branches de connexion entre les etages
  ctx.lineWidth = 3;
  for (const match of Object.values(store.current.matches)) {
    if (!match.parentMatchId) {
      continue;
    }
    const from = positions.get(match.id);
    const to = positions.get(match.parentMatchId);
    if (!from || !to) {
      continue;
    }

    const midY = (from.centerY + to.centerY) / 2;
    ctx.strokeStyle = match.winnerCardId ? '#f59e0b' : '#2a3759';
    ctx.beginPath();
    ctx.moveTo(from.centerX, from.centerY - cardHeight / 2);
    ctx.lineTo(from.centerX, midY);
    ctx.lineTo(to.centerX, midY);
    ctx.lineTo(to.centerX, to.centerY + cardHeight / 2);
    ctx.stroke();
  }

  // Dessin des cartes de chaque noeud
  for (const match of Object.values(store.current.matches)) {
    const pos = positions.get(match.id);
    if (!pos) {
      continue;
    }

    const slots: Array<{ cardId: string | null; offsetX: number }> = [
      { cardId: match.leftCardId, offsetX: -(cardWidth + pairGap / 2) },
      { cardId: match.rightCardId, offsetX: pairGap / 2 }
    ];

    for (const slot of slots) {
      const x = pos.centerX + slot.offsetX;
      const y = pos.centerY - cardHeight / 2;

      ctx.fillStyle = '#1a233a';
      ctx.strokeStyle =
        slot.cardId && match.winnerCardId === slot.cardId ? '#f59e0b' : '#2a3759';
      ctx.lineWidth = slot.cardId && match.winnerCardId === slot.cardId ? 3 : 1.5;

      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, 10);
      ctx.fill();
      ctx.stroke();

      if (slot.cardId && loadedImages.has(slot.cardId)) {
        const img = loadedImages.get(slot.cardId)!;
        const isLoser = match.loserCardId === slot.cardId;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, cardWidth - 4, cardHeight - 4, 8);
        ctx.clip();

        if (isLoser) {
          ctx.globalAlpha = 0.35;
        }

        const scale = Math.max(cardWidth / img.width, cardHeight / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        ctx.drawImage(
          img,
          x + (cardWidth - drawW) / 2,
          y + (cardHeight - drawH) / 2,
          drawW,
          drawH
        );
        ctx.restore();

        if (isLoser) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + 12, y + 12);
          ctx.lineTo(x + cardWidth - 12, y + cardHeight - 12);
          ctx.moveTo(x + cardWidth - 12, y + 12);
          ctx.lineTo(x + 12, y + cardHeight - 12);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + cardWidth / 2, y + cardHeight / 2);
      }
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `tournoi-arbre-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}
