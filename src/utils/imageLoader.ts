import { CardItem } from '../types/tournament';
import { MAX_CARDS } from '../engine/tournamentEngine';

/**
 * Extensions d'images acceptees en complement de la verification du type MIME.
 */
const ACCEPTED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'svg',
  'bmp',
  'ico'
]);

/**
 * Verifie si un fichier correspond a un format d'image exploitable par le navigateur.
 */
export function isValidImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }

  const parts = file.name.toLowerCase().split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1];
    return ACCEPTED_EXTENSIONS.has(ext);
  }

  return false;
}

/**
 * Extrait recursivement tous les fichiers depuis un DataTransfer (glisser-deposer
 * de fichiers individuels ou de dossiers complets).
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => entry !== null && entry !== undefined);

  if (entries.length === 0) {
    return Array.from(dataTransfer.files ?? []);
  }

  const collected: File[] = [];

  async function readEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      collected.push(file);
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const readBatch = (): Promise<FileSystemEntry[]> =>
        new Promise((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });

      let batch = await readBatch();
      while (batch.length > 0) {
        for (const child of batch) {
          await readEntry(child);
        }
        batch = await readBatch();
      }
    }
  }

  for (const entry of entries) {
    await readEntry(entry);
  }

  return collected;
}

/**
 * Charge une liste de fichiers images en memoire via URL.createObjectURL,
 * calcule leur ratio d'aspect naturel et respecte le plafond strict de MAX_CARDS.
 *
 * @param files Fichiers candidats a l'importation.
 * @param currentCount Nombre de cartes deja presentes dans le lobby.
 */
export async function loadCardItemsFromFiles(
  files: readonly File[],
  currentCount: number
): Promise<{ accepted: CardItem[]; ignoredCount: number; cappedCount: number }> {
  const availableSlots = Math.max(0, MAX_CARDS - currentCount);
  const validFiles: File[] = [];
  let ignoredCount = 0;

  for (const file of files) {
    if (isValidImageFile(file)) {
      validFiles.push(file);
    } else {
      ignoredCount++;
    }
  }

  const filesToProcess = validFiles.slice(0, availableSlots);
  const cappedCount = Math.max(0, validFiles.length - filesToProcess.length);

  const accepted = await Promise.all(
    filesToProcess.map(async (file, index) => {
      const objectUrl = URL.createObjectURL(file);
      const aspectRatio = await measureImageAspectRatio(objectUrl);
      const id = `card-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;

      return {
        id,
        objectUrl,
        aspectRatio
      };
    })
  );

  return { accepted, ignoredCount, cappedCount };
}

/**
 * Mesure le ratio largeur/hauteur d'une URL Blob via un element Image hors DOM.
 */
function measureImageAspectRatio(objectUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img.naturalWidth / img.naturalHeight);
      } else {
        resolve(1);
      }
    };
    img.onerror = () => resolve(1);
    img.src = objectUrl;
  });
}

/**
 * Libere proprement la memoire allouee aux URLs Blob des cartes.
 */
export function revokeCardObjectUrls(cards: Iterable<CardItem>): void {
  for (const card of cards) {
    if (card.objectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(card.objectUrl);
    }
  }
}
