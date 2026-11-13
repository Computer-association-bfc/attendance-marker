// Photos are stored as small JPEG data URLs directly in Firestore (~20-40 KB
// each), which avoids needing Firebase Storage and its paid Blaze plan.
const MAX_SIDE = 320;
const QUALITY = 0.7;

function drawScaled(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export function snapshotFromVideo(video: HTMLVideoElement): string | null {
  if (!video.videoWidth) return null;
  return drawScaled(video, video.videoWidth, video.videoHeight);
}

export async function photoFromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    return drawScaled(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
