export interface FrameData {
  t: number;
  dataUrl: string;
  palette: string[];
}

export interface VideoMeta {
  duration: number;
  w: number;
  h: number;
  aspect: string;
  fps: number;
}

export interface ExtractionResult {
  meta: VideoMeta;
  frames: FrameData[];
}

export interface ExtractionProgress {
  stage: "loading" | "seeking" | "done";
  current: number;
  total: number;
}

interface ExtractOptions {
  fps?: number;
  maxFrames?: number;
  longSide?: number;
  swatches?: number;
}

function dominantColors(pixels: Uint8ClampedArray, count: number): string[] {
  const buckets = new Map<string, number>();
  const step = Math.max(4, Math.floor(pixels.length / 4 / 2000) * 4);

  for (let i = 0; i < pixels.length; i += step) {
    const r = Math.round(pixels[i] / 32) * 32;
    const g = Math.round(pixels[i + 1] / 32) * 32;
    const b = Math.round(pixels[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const results: string[] = [];

  for (const [key] of sorted.slice(0, count)) {
    const [r, g, b] = key.split(",").map(Number);
    results.push(
      "#" +
        [r, g, b]
          .map((v) => Math.min(255, v).toString(16).padStart(2, "0"))
          .join("")
    );
  }

  return results;
}

export async function extractFramesAndPalette(
  file: File,
  opts: ExtractOptions = {},
  onProgress?: (p: ExtractionProgress) => void
): Promise<ExtractionResult> {
  const { fps = 1, maxFrames = 36, longSide = 512, swatches = 5 } = opts;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  onProgress?.({ stage: "loading", current: 0, total: 0 });

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video metadata"));
  });

  const meta: VideoMeta = {
    duration: video.duration,
    w: video.videoWidth,
    h: video.videoHeight,
    aspect: simplifyAspect(video.videoWidth, video.videoHeight),
    fps,
  };

  const step = Math.max(1 / fps, meta.duration / maxFrames);
  const times: number[] = [];
  for (let t = 0.1; t < meta.duration && times.length < maxFrames; t += step) {
    times.push(t);
  }

  const scale = longSide / Math.max(meta.w, meta.h);
  const cw = Math.round(meta.w * scale);
  const ch = Math.round(meta.h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  const frames: FrameData[] = [];

  for (let i = 0; i < times.length; i++) {
    onProgress?.({ stage: "seeking", current: i + 1, total: times.length });

    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = times[i];
    });

    ctx.drawImage(video, 0, 0, cw, ch);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    const imageData = ctx.getImageData(0, 0, cw, ch);
    const palette = dominantColors(imageData.data, swatches);

    frames.push({ t: +times[i].toFixed(2), dataUrl, palette });
  }

  URL.revokeObjectURL(url);
  onProgress?.({ stage: "done", current: times.length, total: times.length });

  return { meta, frames };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function simplifyAspect(w: number, h: number): string {
  const d = gcd(w, h);
  const sw = w / d;
  const sh = h / d;
  if (sw === 9 && sh === 16) return "9:16";
  if (sw === 16 && sh === 9) return "16:9";
  if (sw === 4 && sh === 5) return "4:5";
  if (sw === 1 && sh === 1) return "1:1";
  return `${sw}:${sh}`;
}
