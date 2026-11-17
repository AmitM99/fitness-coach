/**
 * Photos are re-encoded to JPEG before they are stored. Drawing through a
 * canvas drops EXIF (GPS position, device, timestamps), caps the pixel size,
 * and guarantees the stored bytes are a real image rather than whatever the
 * file's name or type claimed.
 */

export const MAX_PHOTO_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 2000;

export async function sanitizePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('That is not a photo the app can use.');
  }
  if (file.size > MAX_PHOTO_INPUT_BYTES) {
    throw new Error('That photo is larger than 25 MB.');
  }
  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the EXIF rotation before the metadata is dropped.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That photo could not be read.');
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('That photo could not be processed.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('That photo could not be processed.');
    return blob;
  } finally {
    bitmap.close();
  }
}
