import demoBefore from '@/assets/demo-botox-before.jpg';

/** Synthetic demo markers resolve consistently in staff and patient photo views. */
export function consultPhotoSource(image: string): string {
  return image === 'demo:botox-before' ? demoBefore : image;
}