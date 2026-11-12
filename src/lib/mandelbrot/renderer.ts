import {
  escapeTime,
  needsHighPrecision,
  splitDouble,
  writeColor,
  type RenderParams,
  type View,
} from "@/lib/mandelbrot/math";

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

function fragmentSource(highPrec: boolean): string {
  const body = highPrec
    ? `
  vec2 cx = dfAdd(vec2(uCenterHi.x, uCenterLo.x), vec2(dx, 0.0));
  vec2 cy = dfAdd(vec2(uCenterHi.y, uCenterLo.y), vec2(dy, 0.0));
  vec2 zx = vec2(0.0);
  vec2 zy = vec2(0.0);
  for (int i = 0; i < 1600; i++) {
    if (i >= maxIter) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    float mag2 = zx.x * zx.x + zy.x * zy.x;
    if (mag2 > 256.0) { fragColor = vec4(shade(smoothCount(i, mag2)), 1.0); return; }
    vec2 zx2 = dfMul(zx, zx);
    vec2 zy2 = dfMul(zy, zy);
    vec2 nzy = dfAdd(dfMul(dfMul(zx, zy), vec2(2.0, 0.0)), cy);
    zx = dfAdd(dfAdd(zx2, vec2(-zy2.x, -zy2.y)), cx);
    zy = nzy;
  }`
    : `
  vec2 c = uCenterHi + vec2(dx, dy);
  float cr = c.x;
  float ci = c.y;
  float q = cr - 0.25;
  float q2 = q * q + ci * ci;
  if (q2 * (q2 + q) < 0.25 * ci * ci) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if ((cr + 1.0) * (cr + 1.0) + ci * ci < 0.0625) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 z = vec2(0.0);
  for (int i = 0; i < 1600; i++) {
    if (i >= maxIter) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    float x2 = z.x * z.x;
    float y2 = z.y * z.y;
    float mag2 = x2 + y2;
    if (mag2 > 256.0) { fragColor = vec4(shade(smoothCount(i, mag2)), 1.0); return; }
    z = vec2(x2 - y2, 2.0 * z.x * z.y) + c;
  }`;

  const df = highPrec
    ? `
vec2 dfAdd(vec2 a, vec2 b) {
  float s = a.x + b.x;
  float v = s - a.x;
  float r = (a.x - (s - v)) + (b.x - v) + a.y + b.y;
  float h = s + r;
  return vec2(h, r - (h - s));
}
vec2 dfMul(vec2 a, vec2 b) {
  const float split = 4097.0;
  float pa = split * a.x;
  float ahi = pa - (pa - a.x);
  float alo = a.x - ahi;
  float pb = split * b.x;
  float bhi = pb - (pb - b.x);
  float blo = b.x - bhi;
  float p = a.x * b.x;
  float e = ((ahi * bhi - p) + ahi * blo + alo * bhi) + alo * blo;
  e += a.x * b.y + a.y * b.x;
  float h = p + e;
  return vec2(h, e - (h - p));
}`
    : "";

  return `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uResolution;
uniform vec2 uCenterHi;
uniform vec2 uCenterLo;
uniform float uScale;
uniform float uDensity;
uniform float uShift;
uniform int uIter;
${df}
vec3 rainbow(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
vec3 shade(float iter) {
  float hue = fract(uShift + iter * uDensity);
  float glow = clamp(iter / 2.2, 0.0, 1.0);
  vec3 rgb = rainbow(hue) * glow;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  return clamp(rgb + (n - 0.5) / 255.0, 0.0, 1.0);
}
float smoothCount(int i, float mag2) {
  float logZn = log(mag2) * 0.5;
  float nu = log(logZn * 1.4426950408889634) * 1.4426950408889634;
  return float(i) + 1.0 - nu;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float dx = uv.x * 2.0 * uScale;
  float dy = uv.y * 2.0 * uScale;
  int maxIter = uIter < 1 ? 1 : uIter;
  ${body}
  fragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`;
}

type Mode = "gl" | "cpu";

type Program = {
  program: WebGLProgram;
  resolution: WebGLUniformLocation | null;
  centerHi: WebGLUniformLocation | null;
  centerLo: WebGLUniformLocation | null;
  scale: WebGLUniformLocation | null;
  density: WebGLUniformLocation | null;
  shift: WebGLUniformLocation | null;
  iter: WebGLUniformLocation | null;
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(shader) || "Shader compile failed");
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, fragment: string): Program | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program) || "Program link failed");
    gl.deleteProgram(program);
    return null;
  }
  return {
    program,
    resolution: gl.getUniformLocation(program, "uResolution"),
    centerHi: gl.getUniformLocation(program, "uCenterHi"),
    centerLo: gl.getUniformLocation(program, "uCenterLo"),
    scale: gl.getUniformLocation(program, "uScale"),
    density: gl.getUniformLocation(program, "uDensity"),
    shift: gl.getUniformLocation(program, "uShift"),
    iter: gl.getUniformLocation(program, "uIter"),
  };
}

export class MandelbrotRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly host: HTMLElement;
  private gl: WebGL2RenderingContext | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private mode: Mode = "cpu";
  private single: Program | null = null;
  private dual: Program | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private observer: ResizeObserver | null = null;
  private lastView: View | null = null;
  private lastParams: RenderParams | null = null;
  private lastQuality = 1;
  private cpuToken = 0;

  constructor(host: HTMLElement) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "explorer-canvas";
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute(
      "aria-label",
      "Mandelbrot set. Drag to pan, tap to zoom in, pinch or shift-tap to zoom out.",
    );
    host.replaceChildren(this.canvas);
    this.initContext();
    this.observer = new ResizeObserver(() => {
      if (this.lastView && this.lastParams) this.draw(this.lastView, this.lastParams, this.lastQuality);
    });
    this.observer.observe(host);
  }

  get usingGpu(): boolean {
    return this.mode === "gl";
  }

  destroy(): void {
    this.cpuToken += 1;
    this.observer?.disconnect();
    this.observer = null;
    if (this.gl) {
      if (this.single) this.gl.deleteProgram(this.single.program);
      if (this.dual) this.gl.deleteProgram(this.dual.program);
      if (this.vao) this.gl.deleteVertexArray(this.vao);
      this.gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    this.canvas.remove();
  }

  draw(view: View, params: RenderParams, quality: number): void {
    this.lastView = view;
    this.lastParams = params;
    this.lastQuality = quality;
    const size = this.bufferSize(quality);
    if (size.w < 2 || size.h < 2) return;
    if (this.mode === "gl" && this.gl) this.drawGL(view, params, size.w, size.h, quality);
    else this.drawCPU(view, params, size.w, size.h);
  }

  private initContext(): void {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false,
    });
    if (!gl) {
      this.useCPU();
      return;
    }
    const single = linkProgram(gl, fragmentSource(false));
    if (!single) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      this.replaceCanvas();
      this.useCPU();
      return;
    }
    const dual = linkProgram(gl, fragmentSource(true));
    this.gl = gl;
    this.single = single;
    this.dual = dual;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.mode = "gl";
  }

  private replaceCanvas(): void {
    this.canvas.remove();
    const canvas = document.createElement("canvas");
    canvas.className = "explorer-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", this.canvas.getAttribute("aria-label") ?? "Mandelbrot set");
    this.host.replaceChildren(canvas);
    // The field is readonly via the class type, but we swap the element once on fallback.
    (this as { canvas: HTMLCanvasElement }).canvas = canvas;
  }

  private useCPU(): void {
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Couldn't start graphics in this browser.");
    this.ctx2d = ctx;
    this.mode = "cpu";
  }

  private bufferSize(quality: number): { w: number; h: number } {
    const rect = this.host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const q = clampQuality(quality);
    let w = Math.max(1, Math.round(rect.width * dpr * q));
    let h = Math.max(1, Math.round(rect.height * dpr * q));
    const cap = q < 0.9 ? 700_000 : 1_800_000;
    const pixels = w * h;
    if (pixels > cap) {
      const s = Math.sqrt(cap / pixels);
      w = Math.max(1, Math.round(w * s));
      h = Math.max(1, Math.round(h * s));
    }
    return { w, h };
  }

  private drawGL(
    view: View,
    params: RenderParams,
    w: number,
    h: number,
    quality: number,
  ): void {
    const gl = this.gl;
    if (!gl || !this.single) return;
    const high = needsHighPrecision(view, h) && this.dual !== null;
    const prog = high ? this.dual! : this.single;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.program);
    const [cxHi, cxLo] = splitDouble(view.cx);
    const [cyHi, cyLo] = splitDouble(view.cy);
    let iter = params.maxIter;
    if (quality < 0.9 && high) iter = Math.min(iter, 320);
    gl.uniform2f(prog.resolution, w, h);
    gl.uniform2f(prog.centerHi, cxHi, cyHi);
    gl.uniform2f(prog.centerLo, cxLo, cyLo);
    gl.uniform1f(prog.scale, view.scale);
    gl.uniform1f(prog.density, params.density);
    gl.uniform1f(prog.shift, params.shift);
    gl.uniform1i(prog.iter, iter);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawCPU(view: View, params: RenderParams, w: number, h: number): void {
    const ctx = this.ctx2d;
    if (!ctx) return;
    this.cpuToken += 1;
    const token = this.cpuToken;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const image = ctx.createImageData(w, h);
    const data = image.data;
    const { cx, cy, scale } = view;
    const aspect = w / h;
    for (let y = 0; y < h; y++) {
      const ny = (0.5 - (y + 0.5) / h) * 2 * scale;
      const cyy = cy + ny;
      for (let x = 0; x < w; x++) {
        const nx = ((x + 0.5) / w - 0.5) * 2 * scale * aspect;
        const iter = escapeTime(cx + nx, cyy, params.maxIter);
        writeColor(data, (y * w + x) * 4, iter, params.maxIter, params.density, params.shift);
      }
      if ((y & 31) === 0 && token !== this.cpuToken) return;
    }
    if (token !== this.cpuToken) return;
    ctx.putImageData(image, 0, 0);
  }
}

function clampQuality(quality: number): number {
  if (quality >= 0.9) return 1;
  return Math.min(0.7, Math.max(0.35, quality));
}
