export type View = {
  cx: number;
  cy: number;
  scale: number;
};

export type RenderParams = {
  maxIter: number;
  density: number;
  shift: number;
};

export type Preset = {
  id: string;
  name: string;
  cx: number;
  cy: number;
  scale: number;
  iter: number;
  bands: number;
};

/** Half the vertical span of a fitted overview on a typical landscape screen. */
export const CANONICAL_SCALE = 1.25;

export const ITER_MIN = 32;
export const ITER_MAX = 1600;
export const BANDS_MIN = 1;
export const BANDS_MAX = 30;
export const SCALE_MIN = 1e-14;
export const SCALE_MAX = 8;

export const HOME_FRAME = {
  cx: -0.7,
  cy: 0,
  spanX: 3.35,
  spanY: 2.5,
};

export const PRESETS: readonly Preset[] = [
  {
    id: "overview",
    name: "Overview",
    cx: HOME_FRAME.cx,
    cy: HOME_FRAME.cy,
    scale: CANONICAL_SCALE,
    iter: 256,
    bands: 14,
  },
  {
    id: "seahorse",
    name: "Seahorse",
    cx: -0.743643887037151,
    cy: 0.13182590420533,
    scale: 0.00042,
    iter: 720,
    bands: 2,
  },
  {
    id: "elephant",
    name: "Elephant",
    cx: 0.281717921930775,
    cy: 0.577591832272226,
    scale: 0.018,
    iter: 480,
    bands: 3,
  },
  {
    id: "spiral",
    name: "Spiral",
    cx: -0.77568377,
    cy: 0.13646737,
    scale: 0.0034,
    iter: 560,
    bands: 3,
  },
  {
    id: "star",
    name: "Star",
    cx: -0.235125,
    cy: 0.827215,
    scale: 0.028,
    iter: 400,
    bands: 4,
  },
  {
    id: "filament",
    name: "Filament",
    cx: -0.088,
    cy: 0.654,
    scale: 0.011,
    iter: 480,
    bands: 3,
  },
];

export const OVERVIEW = PRESETS[0]!;

export function densityFromBands(bands: number): number {
  return clamp(bands, BANDS_MIN, BANDS_MAX) * 0.02;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function clampScale(scale: number): number {
  return clamp(scale, SCALE_MIN, SCALE_MAX);
}

export function homeView(width: number, height: number): View {
  if (width < 2 || height < 2) {
    return { cx: HOME_FRAME.cx, cy: HOME_FRAME.cy, scale: CANONICAL_SCALE };
  }
  const aspect = width / height;
  const scale = Math.max(HOME_FRAME.spanY / 2, HOME_FRAME.spanX / (2 * aspect));
  return { cx: HOME_FRAME.cx, cy: HOME_FRAME.cy, scale: clampScale(scale) };
}

export function clampView(view: View): View {
  const scale = clampScale(view.scale);
  const limit = Math.max(4, scale * 4);
  return {
    cx: clamp(view.cx, -limit, limit),
    cy: clamp(view.cy, -limit, limit),
    scale,
  };
}

export function splitDouble(v: number): [number, number] {
  const hi = Math.fround(v);
  return [hi, v - hi];
}

export function needsHighPrecision(view: View, bufferHeight: number): boolean {
  const pixel = (2 * view.scale) / Math.max(1, bufferHeight);
  const mag = Math.max(Math.abs(view.cx), Math.abs(view.cy), view.scale, 1e-8);
  const ulp = 2 ** (Math.floor(Math.log2(mag)) - 23);
  return pixel < ulp * 4;
}

/** Smooth escape time. maxIter means the point did not escape. */
export function escapeTime(cx: number, cy: number, maxIter: number): number {
  const q = cx - 0.25;
  const q2 = q * q + cy * cy;
  if (q2 * (q2 + q) < 0.25 * cy * cy) return maxIter;
  const xp = cx + 1;
  if (xp * xp + cy * cy < 0.0625) return maxIter;

  let zx = 0;
  let zy = 0;
  for (let i = 0; i < maxIter; i++) {
    const x2 = zx * zx;
    const y2 = zy * zy;
    const mag2 = x2 + y2;
    if (mag2 > 256) {
      const logZn = Math.log(mag2) * 0.5;
      const nu = Math.log(logZn * Math.LOG2E) * Math.LOG2E;
      return i + 1 - nu;
    }
    zy = 2 * zx * zy + cy;
    zx = x2 - y2 + cx;
  }
  return maxIter;
}

export function writeColor(
  data: Uint8ClampedArray,
  offset: number,
  iter: number,
  maxIter: number,
  density: number,
  shift: number,
): void {
  if (iter >= maxIter - 1e-6) {
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 255;
    return;
  }
  let hue = (shift + iter * density) % 1;
  if (hue < 0) hue += 1;
  const glow = Math.min(1, iter / 2.2);
  const offsets = [0, 4, 2];
  for (let k = 0; k < 3; k++) {
    const p = Math.abs(((hue * 6 + offsets[k]!) % 6) - 3) - 1;
    const channel = Math.min(1, Math.max(0, p)) * glow;
    data[offset + k] = Math.round(channel * 255);
  }
  data[offset + 3] = 255;
}

export function formatCoord(n: number): string {
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-4 || a >= 100)) return n.toExponential(2);
  if (a >= 10) return n.toFixed(2);
  if (a >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export function formatPoint(cx: number, cy: number): string {
  const re = formatCoord(cx);
  const im = formatCoord(Math.abs(cy));
  return `${re} ${cy < 0 ? "−" : "+"} ${im}i`;
}

export function formatMag(mag: number): string {
  if (!Number.isFinite(mag) || mag <= 0) return "—";
  if (mag < 10) return `${mag.toFixed(1)}×`;
  if (mag < 100) return `${mag.toFixed(0)}×`;
  if (mag < 10000) return `${Math.round(mag)}×`;
  if (mag < 1e6) return `${(mag / 1000).toFixed(1)}k×`;
  const exp = Math.floor(Math.log10(mag));
  const mant = mag / 10 ** exp;
  return `${mant.toFixed(1)}e${exp}×`;
}
