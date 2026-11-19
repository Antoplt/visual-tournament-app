import { describe, expect, it } from 'vitest';
import { isValidImageFile } from '../src/utils/imageLoader';

function createMockFile(name: string, type: string): File {
  return new File(['binary-content'], name, { type });
}

describe('Chargeur d images - Validation des formats', () => {
  it('accepte tous les formats image standards par type MIME', () => {
    expect(isValidImageFile(createMockFile('photo.jpg', 'image/jpeg'))).toBe(true);
    expect(isValidImageFile(createMockFile('art.png', 'image/png'))).toBe(true);
    expect(isValidImageFile(createMockFile('modern.webp', 'image/webp'))).toBe(true);
    expect(isValidImageFile(createMockFile('nextgen.avif', 'image/avif'))).toBe(true);
    expect(isValidImageFile(createMockFile('anim.gif', 'image/gif'))).toBe(true);
    expect(isValidImageFile(createMockFile('vector.svg', 'image/svg+xml'))).toBe(true);
  });

  it('accepte une image par extension meme si le type MIME navigateur est vide', () => {
    expect(isValidImageFile(createMockFile('archive_pic.WEBP', ''))).toBe(true);
    expect(isValidImageFile(createMockFile('bitmap.bmp', ''))).toBe(true);
  });

  it('rejette les fichiers non images (PDF, texte, video, executable)', () => {
    expect(isValidImageFile(createMockFile('document.pdf', 'application/pdf'))).toBe(false);
    expect(isValidImageFile(createMockFile('notes.txt', 'text/plain'))).toBe(false);
    expect(isValidImageFile(createMockFile('clip.mp4', 'video/mp4'))).toBe(false);
  });
});
