/* Fotoğrafı tarayıcıda küçült: ek depolama hizmeti olmadan kaydın içinde saklanır. */

export const MAX_SIDE = 1280;
export const MAX_BYTES = 150_000;

/** En uzun kenarı max'a sığdıran boyut */
export function fitSize(w: number, h: number, max = MAX_SIDE): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const r = Math.min(max / w, max / h);
  return { w: Math.round(w * r), h: Math.round(h * r) };
}

/** data URL'nin yaklaşık bayt boyutu */
export const dataUrlBytes = (url: string) => Math.ceil((url.length - url.indexOf(',') - 1) * 3 / 4);

export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let side = MAX_SIDE;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { w, h } = fitSize(bitmap.width, bitmap.height, side);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (dataUrlBytes(url) <= MAX_BYTES) return url;
    }
    side = Math.round(side * 0.75);
  }
  throw new Error('Fotoğraf yeterince küçültülemedi');
}
