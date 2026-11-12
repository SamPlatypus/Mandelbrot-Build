import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Ellipsis, i as Minus, r as Plus, t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CXXg27-u.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Half the vertical span of a fitted overview on a typical landscape screen. */
var CANONICAL_SCALE = 1.25;
var ITER_MAX = 1600;
var SCALE_MIN = 1e-14;
var HOME_FRAME = {
	cx: -.7,
	cy: 0,
	spanX: 3.35,
	spanY: 2.5
};
var PRESETS = [
	{
		id: "overview",
		name: "Overview",
		cx: HOME_FRAME.cx,
		cy: HOME_FRAME.cy,
		scale: CANONICAL_SCALE,
		iter: 256,
		bands: 14
	},
	{
		id: "seahorse",
		name: "Seahorse",
		cx: -.743643887037151,
		cy: .13182590420533,
		scale: 42e-5,
		iter: 720,
		bands: 2
	},
	{
		id: "elephant",
		name: "Elephant",
		cx: .281717921930775,
		cy: .577591832272226,
		scale: .018,
		iter: 480,
		bands: 3
	},
	{
		id: "spiral",
		name: "Spiral",
		cx: -.77568377,
		cy: .13646737,
		scale: .0034,
		iter: 560,
		bands: 3
	},
	{
		id: "star",
		name: "Star",
		cx: -.235125,
		cy: .827215,
		scale: .028,
		iter: 400,
		bands: 4
	},
	{
		id: "filament",
		name: "Filament",
		cx: -.088,
		cy: .654,
		scale: .011,
		iter: 480,
		bands: 3
	}
];
var OVERVIEW = PRESETS[0];
function densityFromBands(bands) {
	return clamp(bands, 1, 30) * .02;
}
function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n));
}
function clampScale(scale) {
	return clamp(scale, SCALE_MIN, 8);
}
function homeView(width, height) {
	if (width < 2 || height < 2) return {
		cx: HOME_FRAME.cx,
		cy: HOME_FRAME.cy,
		scale: CANONICAL_SCALE
	};
	const aspect = width / height;
	const scale = Math.max(HOME_FRAME.spanY / 2, HOME_FRAME.spanX / (2 * aspect));
	return {
		cx: HOME_FRAME.cx,
		cy: HOME_FRAME.cy,
		scale: clampScale(scale)
	};
}
function clampView(view) {
	const scale = clampScale(view.scale);
	const limit = Math.max(4, scale * 4);
	return {
		cx: clamp(view.cx, -limit, limit),
		cy: clamp(view.cy, -limit, limit),
		scale
	};
}
function splitDouble(v) {
	const hi = Math.fround(v);
	return [hi, v - hi];
}
function needsHighPrecision(view, bufferHeight) {
	const pixel = 2 * view.scale / Math.max(1, bufferHeight);
	const mag = Math.max(Math.abs(view.cx), Math.abs(view.cy), view.scale, 1e-8);
	return pixel < 2 ** (Math.floor(Math.log2(mag)) - 23) * 4;
}
/** Smooth escape time. maxIter means the point did not escape. */
function escapeTime(cx, cy, maxIter) {
	const q = cx - .25;
	const q2 = q * q + cy * cy;
	if (q2 * (q2 + q) < .25 * cy * cy) return maxIter;
	const xp = cx + 1;
	if (xp * xp + cy * cy < .0625) return maxIter;
	let zx = 0;
	let zy = 0;
	for (let i = 0; i < maxIter; i++) {
		const x2 = zx * zx;
		const y2 = zy * zy;
		const mag2 = x2 + y2;
		if (mag2 > 256) {
			const logZn = Math.log(mag2) * .5;
			const nu = Math.log(logZn * Math.LOG2E) * Math.LOG2E;
			return i + 1 - nu;
		}
		zy = 2 * zx * zy + cy;
		zx = x2 - y2 + cx;
	}
	return maxIter;
}
function writeColor(data, offset, iter, maxIter, density, shift) {
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
	const offsets = [
		0,
		4,
		2
	];
	for (let k = 0; k < 3; k++) {
		const p = Math.abs((hue * 6 + offsets[k]) % 6 - 3) - 1;
		const channel = Math.min(1, Math.max(0, p)) * glow;
		data[offset + k] = Math.round(channel * 255);
	}
	data[offset + 3] = 255;
}
function formatCoord(n) {
	const a = Math.abs(n);
	if (a !== 0 && (a < 1e-4 || a >= 100)) return n.toExponential(2);
	if (a >= 10) return n.toFixed(2);
	if (a >= 1) return n.toFixed(4);
	return n.toFixed(6);
}
function formatPoint(cx, cy) {
	const re = formatCoord(cx);
	const im = formatCoord(Math.abs(cy));
	return `${re} ${cy < 0 ? "−" : "+"} ${im}i`;
}
function formatMag(mag) {
	if (!Number.isFinite(mag) || mag <= 0) return "—";
	if (mag < 10) return `${mag.toFixed(1)}×`;
	if (mag < 100) return `${mag.toFixed(0)}×`;
	if (mag < 1e4) return `${Math.round(mag)}×`;
	if (mag < 1e6) return `${(mag / 1e3).toFixed(1)}k×`;
	const exp = Math.floor(Math.log10(mag));
	return `${(mag / 10 ** exp).toFixed(1)}e${exp}×`;
}
var VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
function fragmentSource(highPrec) {
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
${highPrec ? `
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
}` : ""}
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
  ${highPrec ? `
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
  }` : `
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
  }`}
  fragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`;
}
function compileShader(gl, type, source) {
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
function linkProgram(gl, fragment) {
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
		iter: gl.getUniformLocation(program, "uIter")
	};
}
var MandelbrotRenderer = class {
	canvas;
	host;
	gl = null;
	ctx2d = null;
	mode = "cpu";
	single = null;
	dual = null;
	vao = null;
	observer = null;
	lastView = null;
	lastParams = null;
	lastQuality = 1;
	cpuToken = 0;
	constructor(host) {
		this.host = host;
		this.canvas = document.createElement("canvas");
		this.canvas.className = "explorer-canvas";
		this.canvas.setAttribute("role", "img");
		this.canvas.setAttribute("aria-label", "Mandelbrot set. Drag to pan, tap to zoom in, pinch or shift-tap to zoom out.");
		host.replaceChildren(this.canvas);
		this.initContext();
		this.observer = new ResizeObserver(() => {
			if (this.lastView && this.lastParams) this.draw(this.lastView, this.lastParams, this.lastQuality);
		});
		this.observer.observe(host);
	}
	get usingGpu() {
		return this.mode === "gl";
	}
	destroy() {
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
	draw(view, params, quality) {
		this.lastView = view;
		this.lastParams = params;
		this.lastQuality = quality;
		const size = this.bufferSize(quality);
		if (size.w < 2 || size.h < 2) return;
		if (this.mode === "gl" && this.gl) this.drawGL(view, params, size.w, size.h, quality);
		else this.drawCPU(view, params, size.w, size.h);
	}
	initContext() {
		const gl = this.canvas.getContext("webgl2", {
			alpha: false,
			antialias: false,
			depth: false,
			stencil: false,
			powerPreference: "high-performance",
			preserveDrawingBuffer: false,
			failIfMajorPerformanceCaveat: false
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
	replaceCanvas() {
		this.canvas.remove();
		const canvas = document.createElement("canvas");
		canvas.className = "explorer-canvas";
		canvas.setAttribute("role", "img");
		canvas.setAttribute("aria-label", this.canvas.getAttribute("aria-label") ?? "Mandelbrot set");
		this.host.replaceChildren(canvas);
		this.canvas = canvas;
	}
	useCPU() {
		const ctx = this.canvas.getContext("2d", { alpha: false });
		if (!ctx) throw new Error("Couldn't start graphics in this browser.");
		this.ctx2d = ctx;
		this.mode = "cpu";
	}
	bufferSize(quality) {
		const rect = this.host.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const q = clampQuality(quality);
		let w = Math.max(1, Math.round(rect.width * dpr * q));
		let h = Math.max(1, Math.round(rect.height * dpr * q));
		const cap = q < .9 ? 7e5 : 18e5;
		const pixels = w * h;
		if (pixels > cap) {
			const s = Math.sqrt(cap / pixels);
			w = Math.max(1, Math.round(w * s));
			h = Math.max(1, Math.round(h * s));
		}
		return {
			w,
			h
		};
	}
	drawGL(view, params, w, h, quality) {
		const gl = this.gl;
		if (!gl || !this.single) return;
		const high = needsHighPrecision(view, h) && this.dual !== null;
		const prog = high ? this.dual : this.single;
		if (this.canvas.width !== w || this.canvas.height !== h) {
			this.canvas.width = w;
			this.canvas.height = h;
		}
		gl.viewport(0, 0, w, h);
		gl.useProgram(prog.program);
		const [cxHi, cxLo] = splitDouble(view.cx);
		const [cyHi, cyLo] = splitDouble(view.cy);
		let iter = params.maxIter;
		if (quality < .9 && high) iter = Math.min(iter, 320);
		gl.uniform2f(prog.resolution, w, h);
		gl.uniform2f(prog.centerHi, cxHi, cyHi);
		gl.uniform2f(prog.centerLo, cxLo, cyLo);
		gl.uniform1f(prog.scale, view.scale);
		gl.uniform1f(prog.density, params.density);
		gl.uniform1f(prog.shift, params.shift);
		gl.uniform1i(prog.iter, iter);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	drawCPU(view, params, w, h) {
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
			const cyy = cy + (.5 - (y + .5) / h) * 2 * scale;
			for (let x = 0; x < w; x++) {
				const iter = escapeTime(cx + ((x + .5) / w - .5) * 2 * scale * aspect, cyy, params.maxIter);
				writeColor(data, (y * w + x) * 4, iter, params.maxIter, params.density, params.shift);
			}
			if ((y & 31) === 0 && token !== this.cpuToken) return;
		}
		if (token !== this.cpuToken) return;
		ctx.putImageData(image, 0, 0);
	}
};
function clampQuality(quality) {
	if (quality >= .9) return 1;
	return Math.min(.7, Math.max(.35, quality));
}
var STORAGE_KEY = "mandelbrot.view.v1";
function readSaved() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		const nums = [
			data.cx,
			data.cy,
			data.scale,
			data.iter,
			data.bands,
			data.shift
		];
		if (data.v !== 1 || nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
		return {
			v: 1,
			cx: data.cx,
			cy: data.cy,
			scale: data.scale,
			iter: data.iter,
			bands: data.bands,
			shift: data.shift,
			preset: typeof data.preset === "string" ? data.preset : null
		};
	} catch {
		return null;
	}
}
function MandelbrotExplorer() {
	const stageRef = (0, import_react.useRef)(null);
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [iterations, setIterations] = (0, import_react.useState)(OVERVIEW.iter);
	const [bands, setBands] = (0, import_react.useState)(OVERVIEW.bands);
	const [shift, setShift] = (0, import_react.useState)(0);
	const [presetId, setPresetId] = (0, import_react.useState)(OVERVIEW.id);
	const [hud, setHud] = (0, import_react.useState)({
		cx: OVERVIEW.cx,
		cy: OVERVIEW.cy,
		scale: CANONICAL_SCALE,
		fit: CANONICAL_SCALE
	});
	const api = (0, import_react.useRef)({
		setIterations: (_n) => {},
		setBands: (_n) => {},
		setShift: (_n) => {},
		zoomCenter: (_factor) => {},
		goPreset: (_preset) => {},
		reset: () => {},
		toggleMenu: () => {}
	});
	(0, import_react.useEffect)(() => {
		const stage = stageRef.current;
		if (!stage) return;
		let dead = false;
		let renderer;
		try {
			renderer = new MandelbrotRenderer(stage);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't start graphics.");
			return;
		}
		const saved = readSaved();
		const rect = stage.getBoundingClientRect();
		const fitted = homeView(rect.width || 1, rect.height || 1);
		const viewRef = { current: saved ? clampView({
			cx: saved.cx,
			cy: saved.cy,
			scale: saved.scale
		}) : fitted };
		const iterRef = { current: clamp(saved?.iter ?? OVERVIEW.iter, 32, ITER_MAX) };
		const bandsRef = { current: clamp(saved?.bands ?? OVERVIEW.bands, 1, 30) };
		const shiftRef = { current: clamp(saved?.shift ?? 0, 0, 1) };
		const presetRef = { current: saved ? saved.preset : OVERVIEW.id };
		const menuRef = { current: false };
		const pointers = /* @__PURE__ */ new Map();
		let gesture = null;
		let anim = 0;
		let settle = 0;
		let raf = 0;
		setIterations(iterRef.current);
		setBands(bandsRef.current);
		setShift(shiftRef.current);
		setPresetId(presetRef.current);
		const params = () => ({
			maxIter: iterRef.current,
			density: densityFromBands(bandsRef.current),
			shift: shiftRef.current
		});
		const fitScale = () => {
			const box = stage.getBoundingClientRect();
			return homeView(box.width || 1, box.height || 1).scale;
		};
		const syncHud = () => {
			if (dead) return;
			const view = viewRef.current;
			setHud({
				cx: view.cx,
				cy: view.cy,
				scale: view.scale,
				fit: fitScale()
			});
		};
		const persist = () => {
			const view = viewRef.current;
			const payload = {
				v: 1,
				cx: view.cx,
				cy: view.cy,
				scale: view.scale,
				iter: iterRef.current,
				bands: bandsRef.current,
				shift: shiftRef.current,
				preset: presetRef.current
			};
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
			} catch {}
		};
		const drawAt = (quality) => {
			if (dead) return;
			renderer.draw(viewRef.current, params(), quality);
		};
		const drawInteractive = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				drawAt(.55);
				if (menuRef.current) syncHud();
			});
		};
		const scheduleSettle = () => {
			window.clearTimeout(settle);
			settle = window.setTimeout(() => {
				if (dead) return;
				drawAt(1);
				syncHud();
				persist();
			}, 90);
		};
		const markCustom = () => {
			if (presetRef.current !== null) {
				presetRef.current = null;
				setPresetId(null);
			}
		};
		const cancelAnim = () => {
			if (anim) cancelAnimationFrame(anim);
			anim = 0;
		};
		const animateTo = (target) => {
			cancelAnim();
			window.clearTimeout(settle);
			const from = { ...viewRef.current };
			const next = clampView(target);
			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				viewRef.current = next;
				drawAt(1);
				syncHud();
				persist();
				return;
			}
			const t0 = performance.now();
			const step = (now) => {
				if (dead) return;
				const t = Math.min(1, (now - t0) / 380);
				const e = 1 - (1 - t) ** 3;
				viewRef.current = clampView({
					cx: from.cx + (next.cx - from.cx) * e,
					cy: from.cy + (next.cy - from.cy) * e,
					scale: Math.exp(Math.log(from.scale) + (Math.log(next.scale) - Math.log(from.scale)) * e)
				});
				drawAt(t < 1 ? .55 : 1);
				if (menuRef.current || t === 1) syncHud();
				if (t < 1) anim = requestAnimationFrame(step);
				else {
					anim = 0;
					persist();
				}
			};
			anim = requestAnimationFrame(step);
		};
		const zoomTarget = (clientX, clientY, factor) => {
			const box = stage.getBoundingClientRect();
			const view = viewRef.current;
			const x = clientX - box.left;
			const y = clientY - box.top;
			const dx = (x / box.width - .5) * 2 * view.scale * (box.width / Math.max(1, box.height));
			const dy = (.5 - y / Math.max(1, box.height)) * 2 * view.scale;
			const nextScale = clamp(view.scale * factor, 1e-14, 8);
			const applied = nextScale / view.scale;
			return clampView({
				cx: view.cx + dx * (1 - applied),
				cy: view.cy + dy * (1 - applied),
				scale: nextScale
			});
		};
		const panPixels = (dx, dy) => {
			const box = stage.getBoundingClientRect();
			const view = viewRef.current;
			const k = 2 * view.scale / Math.max(1, box.height);
			viewRef.current = clampView({
				...view,
				cx: view.cx - dx * k,
				cy: view.cy + dy * k
			});
		};
		const closeMenu = () => {
			menuRef.current = false;
			setMenuOpen(false);
		};
		const pinchMetrics = () => {
			const pts = [...pointers.values()];
			const a = pts[0] ?? {
				x: 0,
				y: 0
			};
			const b = pts[1] ?? a;
			return {
				dist: Math.hypot(a.x - b.x, a.y - b.y),
				x: (a.x + b.x) / 2,
				y: (a.y + b.y) / 2
			};
		};
		const onPointerDown = (event) => {
			if (event.button > 2) return;
			stage.setPointerCapture(event.pointerId);
			pointers.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY
			});
			cancelAnim();
			if (pointers.size === 1) {
				gesture = {
					mode: "single",
					moved: false,
					dismiss: menuRef.current,
					button: event.button,
					shift: event.shiftKey,
					startX: event.clientX,
					startY: event.clientY,
					lastX: event.clientX,
					lastY: event.clientY,
					pinchDist: 0
				};
				if (menuRef.current) closeMenu();
			} else if (pointers.size >= 2) {
				const info = pinchMetrics();
				gesture = {
					mode: "pinch",
					moved: true,
					dismiss: true,
					button: 0,
					shift: false,
					startX: info.x,
					startY: info.y,
					lastX: info.x,
					lastY: info.y,
					pinchDist: Math.max(8, info.dist)
				};
				stage.classList.add("is-dragging");
			}
		};
		const onPointerMove = (event) => {
			if (!pointers.has(event.pointerId) || !gesture) return;
			pointers.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY
			});
			if (gesture.mode === "pinch" && pointers.size >= 2) {
				const info = pinchMetrics();
				const factor = clamp(gesture.pinchDist / Math.max(8, info.dist), .5, 2);
				markCustom();
				viewRef.current = zoomTarget(info.x, info.y, factor);
				panPixels(info.x - gesture.lastX, info.y - gesture.lastY);
				gesture.pinchDist = Math.max(8, info.dist);
				gesture.lastX = info.x;
				gesture.lastY = info.y;
				gesture.moved = true;
				drawInteractive();
				return;
			}
			if (gesture.mode !== "single" || pointers.size !== 1) return;
			const dx = event.clientX - gesture.lastX;
			const dy = event.clientY - gesture.lastY;
			if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 5) {
				gesture.moved = true;
				stage.classList.add("is-dragging");
			}
			if (gesture.moved) {
				markCustom();
				panPixels(dx, dy);
				drawInteractive();
			}
			gesture.lastX = event.clientX;
			gesture.lastY = event.clientY;
		};
		const endPointer = (event) => {
			if (!pointers.has(event.pointerId)) return;
			pointers.delete(event.pointerId);
			const current = gesture;
			if (pointers.size === 0) {
				stage.classList.remove("is-dragging");
				if (current && current.mode === "single" && !current.moved && !current.dismiss && current.button !== 1) {
					const zoomOut = current.button === 2 || current.shift;
					markCustom();
					animateTo(zoomTarget(event.clientX, event.clientY, zoomOut ? 2 : .5));
				} else if (current?.moved) scheduleSettle();
				gesture = null;
			} else if (current?.mode === "pinch") {
				const remaining = [...pointers.values()][0];
				if (remaining) gesture = {
					mode: "single",
					moved: true,
					dismiss: true,
					button: 0,
					shift: false,
					startX: remaining.x,
					startY: remaining.y,
					lastX: remaining.x,
					lastY: remaining.y,
					pinchDist: 0
				};
			}
		};
		const onWheel = (event) => {
			event.preventDefault();
			let dy = event.deltaY;
			if (event.deltaMode === 1) dy *= 16;
			else if (event.deltaMode === 2) dy *= window.innerHeight;
			if (dy === 0) return;
			cancelAnim();
			markCustom();
			const factor = clamp(Math.exp(dy * .00115), .5, 2);
			viewRef.current = zoomTarget(event.clientX, event.clientY, factor);
			drawInteractive();
			scheduleSettle();
		};
		const onKey = (event) => {
			const target = event.target;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
			const view = viewRef.current;
			const step = view.scale * .16;
			if (event.key === "Escape") {
				closeMenu();
				return;
			}
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				markCustom();
				viewRef.current = clampView({
					...view,
					cx: view.cx - step
				});
			} else if (event.key === "ArrowRight") {
				event.preventDefault();
				markCustom();
				viewRef.current = clampView({
					...view,
					cx: view.cx + step
				});
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				markCustom();
				viewRef.current = clampView({
					...view,
					cy: view.cy + step
				});
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				markCustom();
				viewRef.current = clampView({
					...view,
					cy: view.cy - step
				});
			} else if (event.key === "+" || event.key === "=") {
				event.preventDefault();
				const box = stage.getBoundingClientRect();
				markCustom();
				animateTo(zoomTarget(box.left + box.width / 2, box.top + box.height / 2, .5));
				return;
			} else if (event.key === "-" || event.key === "_") {
				event.preventDefault();
				const box = stage.getBoundingClientRect();
				markCustom();
				animateTo(zoomTarget(box.left + box.width / 2, box.top + box.height / 2, 2));
				return;
			} else return;
			drawInteractive();
			scheduleSettle();
		};
		const onContext = (event) => event.preventDefault();
		stage.addEventListener("pointerdown", onPointerDown);
		stage.addEventListener("pointermove", onPointerMove);
		stage.addEventListener("pointerup", endPointer);
		stage.addEventListener("pointercancel", endPointer);
		stage.addEventListener("wheel", onWheel, { passive: false });
		stage.addEventListener("contextmenu", onContext);
		window.addEventListener("keydown", onKey);
		api.current = {
			setIterations: (n) => {
				iterRef.current = clamp(Math.round(n), 32, ITER_MAX);
				setIterations(iterRef.current);
				drawInteractive();
				scheduleSettle();
			},
			setBands: (n) => {
				bandsRef.current = clamp(Math.round(n), 1, 30);
				setBands(bandsRef.current);
				drawInteractive();
				scheduleSettle();
			},
			setShift: (n) => {
				shiftRef.current = clamp(n, 0, 1);
				setShift(shiftRef.current);
				drawInteractive();
				scheduleSettle();
			},
			zoomCenter: (factor) => {
				const box = stage.getBoundingClientRect();
				markCustom();
				animateTo(zoomTarget(box.left + box.width / 2, box.top + box.height / 2, factor));
			},
			goPreset: (preset) => {
				cancelAnim();
				presetRef.current = preset.id;
				setPresetId(preset.id);
				iterRef.current = preset.iter;
				bandsRef.current = preset.bands;
				setIterations(preset.iter);
				setBands(preset.bands);
				const destination = preset.id === OVERVIEW.id ? homeView(stage.clientWidth || 1, stage.clientHeight || 1) : preset;
				animateTo(destination);
			},
			reset: () => {
				api.current.goPreset(OVERVIEW);
			},
			toggleMenu: () => {
				menuRef.current = !menuRef.current;
				if (menuRef.current) syncHud();
				setMenuOpen(menuRef.current);
			}
		};
		drawAt(1);
		syncHud();
		const probe = {
			getView: () => ({ ...viewRef.current }),
			getIterations: () => iterRef.current,
			getBands: () => bandsRef.current
		};
		window.__mandelbrot = probe;
		return () => {
			dead = true;
			cancelAnim();
			window.clearTimeout(settle);
			if (raf) cancelAnimationFrame(raf);
			stage.removeEventListener("pointerdown", onPointerDown);
			stage.removeEventListener("pointermove", onPointerMove);
			stage.removeEventListener("pointerup", endPointer);
			stage.removeEventListener("pointercancel", endPointer);
			stage.removeEventListener("wheel", onWheel);
			stage.removeEventListener("contextmenu", onContext);
			window.removeEventListener("keydown", onKey);
			renderer.destroy();
			if (window.__mandelbrot === probe) delete window.__mandelbrot;
		};
	}, []);
	const mag = hud.fit / hud.scale;
	const shiftDegrees = Math.round(shift * 360);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "explorer",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "sr-only",
				children: "Mandelbrot explorer"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: stageRef,
				className: "stage"
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "stage-error",
				role: "alert",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "dock",
				children: [menuOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "panel",
					id: "explorer-menu",
					role: "region",
					"aria-label": "Explorer controls",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "panel-head",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "panel-title",
								children: "Mandelbrot"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "coords",
								children: formatPoint(hud.cx, hud.cy)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "zoom-row",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "icon-btn",
									"aria-label": "Zoom out",
									onClick: () => api.current.zoomCenter(2),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, {
										size: 18,
										strokeWidth: 2,
										"aria-hidden": "true"
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "zoom-readout",
									children: formatMag(mag)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "icon-btn",
									"aria-label": "Zoom in",
									onClick: () => api.current.zoomCenter(.5),
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
										size: 18,
										strokeWidth: 2,
										"aria-hidden": "true"
									})
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "stack",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "slider",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "slider-top",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Iterations" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "num",
											children: iterations
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "range",
										min: 32,
										max: ITER_MAX,
										step: 1,
										value: iterations,
										"aria-valuemin": 32,
										"aria-valuemax": ITER_MAX,
										"aria-valuenow": iterations,
										"aria-label": "Iterations",
										onChange: (event) => api.current.setIterations(Number(event.target.value))
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "split",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "slider",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "slider-top",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Bands" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "num",
												children: bands
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "range",
											min: 1,
											max: 30,
											step: 1,
											value: bands,
											"aria-label": "Color bands",
											onChange: (event) => api.current.setBands(Number(event.target.value))
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "slider",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "slider-top",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Shift" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "num",
												children: [shiftDegrees, "°"]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "range",
											min: 0,
											max: 360,
											step: 1,
											value: shiftDegrees,
											"aria-label": "Color shift",
											onChange: (event) => api.current.setShift(Number(event.target.value) / 360)
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "kicker",
									children: "Places"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "places",
									children: PRESETS.map((preset) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn",
										"aria-pressed": presetId === preset.id,
										onClick: () => api.current.goPreset(preset),
										children: preset.name
									}, preset.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn btn-block",
									onClick: () => api.current.reset(),
									children: "Reset view"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "hint",
									children: [
										"Tap to zoom in · drag to pan",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"Pinch or Shift-tap to zoom out"
									]
								})
							]
						})
					]
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "icon-btn",
					"aria-expanded": menuOpen,
					"aria-controls": "explorer-menu",
					"aria-label": menuOpen ? "Close controls" : "Open controls",
					onClick: () => api.current.toggleMenu(),
					children: menuOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
						size: 20,
						strokeWidth: 2,
						"aria-hidden": "true"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ellipsis, {
						size: 22,
						strokeWidth: 2,
						"aria-hidden": "true"
					})
				})]
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MandelbrotExplorer, {});
}
//#endregion
export { Home as component };
