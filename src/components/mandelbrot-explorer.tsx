import { useEffect, useRef, useState } from "react";
import { Ellipsis, Minus, Plus, X } from "lucide-react";
import { MandelbrotRenderer } from "@/lib/mandelbrot/renderer";
import {
  BANDS_MAX,
  BANDS_MIN,
  CANONICAL_SCALE,
  ITER_MAX,
  ITER_MIN,
  OVERVIEW,
  PRESETS,
  clamp,
  clampView,
  densityFromBands,
  formatMag,
  formatPoint,
  homeView,
  type Preset,
  type View,
} from "@/lib/mandelbrot/math";

const STORAGE_KEY = "mandelbrot.view.v1";

type Hud = {
  cx: number;
  cy: number;
  scale: number;
  fit: number;
};

type Saved = {
  v: 1;
  cx: number;
  cy: number;
  scale: number;
  iter: number;
  bands: number;
  shift: number;
  preset: string | null;
};

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Saved>;
    const nums = [data.cx, data.cy, data.scale, data.iter, data.bands, data.shift];
    if (data.v !== 1 || nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
    return {
      v: 1,
      cx: data.cx as number,
      cy: data.cy as number,
      scale: data.scale as number,
      iter: data.iter as number,
      bands: data.bands as number,
      shift: data.shift as number,
      preset: typeof data.preset === "string" ? data.preset : null,
    };
  } catch {
    return null;
  }
}

export function MandelbrotExplorer() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iterations, setIterations] = useState(OVERVIEW.iter);
  const [bands, setBands] = useState(OVERVIEW.bands);
  const [shift, setShift] = useState(0);
  const [presetId, setPresetId] = useState<string | null>(OVERVIEW.id);
  const [hud, setHud] = useState<Hud>({
    cx: OVERVIEW.cx,
    cy: OVERVIEW.cy,
    scale: CANONICAL_SCALE,
    fit: CANONICAL_SCALE,
  });

  const api = useRef({
    setIterations: (_n: number) => {},
    setBands: (_n: number) => {},
    setShift: (_n: number) => {},
    zoomCenter: (_factor: number) => {},
    goPreset: (_preset: Preset) => {},
    reset: () => {},
    toggleMenu: () => {},
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let dead = false;
    let renderer: MandelbrotRenderer;
    try {
      renderer = new MandelbrotRenderer(stage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start graphics.");
      return;
    }

    const saved = readSaved();
    const rect = stage.getBoundingClientRect();
    const fitted = homeView(rect.width || 1, rect.height || 1);
    const viewRef = {
      current: saved
        ? clampView({ cx: saved.cx, cy: saved.cy, scale: saved.scale })
        : fitted,
    };
    const iterRef = { current: clamp(saved?.iter ?? OVERVIEW.iter, ITER_MIN, ITER_MAX) };
    const bandsRef = { current: clamp(saved?.bands ?? OVERVIEW.bands, BANDS_MIN, BANDS_MAX) };
    const shiftRef = { current: clamp(saved?.shift ?? 0, 0, 1) };
    const presetRef = { current: saved ? saved.preset : OVERVIEW.id };
    const menuRef = { current: false };
    const pointers = new Map<number, { x: number; y: number }>();
    let gesture: {
      mode: "single" | "pinch";
      moved: boolean;
      dismiss: boolean;
      button: number;
      shift: boolean;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      pinchDist: number;
    } | null = null;
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
      shift: shiftRef.current,
    });

    const fitScale = () => {
      const box = stage.getBoundingClientRect();
      return homeView(box.width || 1, box.height || 1).scale;
    };

    const syncHud = () => {
      if (dead) return;
      const view = viewRef.current;
      setHud({ cx: view.cx, cy: view.cy, scale: view.scale, fit: fitScale() });
    };

    const persist = () => {
      const view = viewRef.current;
      const payload: Saved = {
        v: 1,
        cx: view.cx,
        cy: view.cy,
        scale: view.scale,
        iter: iterRef.current,
        bands: bandsRef.current,
        shift: shiftRef.current,
        preset: presetRef.current,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* storage can be unavailable */
      }
    };

    const drawAt = (quality: number) => {
      if (dead) return;
      renderer.draw(viewRef.current, params(), quality);
    };

    const drawInteractive = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        drawAt(0.55);
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

    const animateTo = (target: View) => {
      cancelAnim();
      window.clearTimeout(settle);
      const from = { ...viewRef.current };
      const next = clampView(target);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        viewRef.current = next;
        drawAt(1);
        syncHud();
        persist();
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        if (dead) return;
        const t = Math.min(1, (now - t0) / 380);
        const e = 1 - (1 - t) ** 3;
        viewRef.current = clampView({
          cx: from.cx + (next.cx - from.cx) * e,
          cy: from.cy + (next.cy - from.cy) * e,
          scale: Math.exp(Math.log(from.scale) + (Math.log(next.scale) - Math.log(from.scale)) * e),
        });
        drawAt(t < 1 ? 0.55 : 1);
        if (menuRef.current || t === 1) syncHud();
        if (t < 1) anim = requestAnimationFrame(step);
        else {
          anim = 0;
          persist();
        }
      };
      anim = requestAnimationFrame(step);
    };

    const zoomTarget = (clientX: number, clientY: number, factor: number): View => {
      const box = stage.getBoundingClientRect();
      const view = viewRef.current;
      const x = clientX - box.left;
      const y = clientY - box.top;
      const dx = (x / box.width - 0.5) * 2 * view.scale * (box.width / Math.max(1, box.height));
      const dy = (0.5 - y / Math.max(1, box.height)) * 2 * view.scale;
      const nextScale = clamp(view.scale * factor, 1e-14, 8);
      const applied = nextScale / view.scale;
      return clampView({
        cx: view.cx + dx * (1 - applied),
        cy: view.cy + dy * (1 - applied),
        scale: nextScale,
      });
    };

    const panPixels = (dx: number, dy: number) => {
      const box = stage.getBoundingClientRect();
      const view = viewRef.current;
      const k = (2 * view.scale) / Math.max(1, box.height);
      viewRef.current = clampView({
        ...view,
        cx: view.cx - dx * k,
        cy: view.cy + dy * k,
      });
    };

    const closeMenu = () => {
      menuRef.current = false;
      setMenuOpen(false);
    };

    const pinchMetrics = () => {
      const pts = [...pointers.values()];
      const a = pts[0] ?? { x: 0, y: 0 };
      const b = pts[1] ?? a;
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button > 2) return;
      stage.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
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
          pinchDist: 0,
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
          pinchDist: Math.max(8, info.dist),
        };
        stage.classList.add("is-dragging");
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId) || !gesture) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (gesture.mode === "pinch" && pointers.size >= 2) {
        const info = pinchMetrics();
        const factor = clamp(gesture.pinchDist / Math.max(8, info.dist), 0.5, 2);
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

    const endPointer = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      const current = gesture;
      if (pointers.size === 0) {
        stage.classList.remove("is-dragging");
        if (
          current &&
          current.mode === "single" &&
          !current.moved &&
          !current.dismiss &&
          current.button !== 1
        ) {
          const zoomOut = current.button === 2 || current.shift;
          markCustom();
          animateTo(zoomTarget(event.clientX, event.clientY, zoomOut ? 2 : 0.5));
        } else if (current?.moved) {
          scheduleSettle();
        }
        gesture = null;
      } else if (current?.mode === "pinch") {
        const remaining = [...pointers.values()][0];
        if (remaining) {
          gesture = {
            mode: "single",
            moved: true,
            dismiss: true,
            button: 0,
            shift: false,
            startX: remaining.x,
            startY: remaining.y,
            lastX: remaining.x,
            lastY: remaining.y,
            pinchDist: 0,
          };
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 16;
      else if (event.deltaMode === 2) dy *= window.innerHeight;
      if (dy === 0) return;
      cancelAnim();
      markCustom();
      const factor = clamp(Math.exp(dy * 0.00115), 0.5, 2);
      viewRef.current = zoomTarget(event.clientX, event.clientY, factor);
      drawInteractive();
      scheduleSettle();
    };

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const view = viewRef.current;
      const step = view.scale * 0.16;
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        markCustom();
        viewRef.current = clampView({ ...view, cx: view.cx - step });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        markCustom();
        viewRef.current = clampView({ ...view, cx: view.cx + step });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        markCustom();
        viewRef.current = clampView({ ...view, cy: view.cy + step });
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        markCustom();
        viewRef.current = clampView({ ...view, cy: view.cy - step });
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const box = stage.getBoundingClientRect();
        markCustom();
        animateTo(zoomTarget(box.left + box.width / 2, box.top + box.height / 2, 0.5));
        return;
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        const box = stage.getBoundingClientRect();
        markCustom();
        animateTo(zoomTarget(box.left + box.width / 2, box.top + box.height / 2, 2));
        return;
      } else {
        return;
      }
      drawInteractive();
      scheduleSettle();
    };

    const onContext = (event: Event) => event.preventDefault();

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", endPointer);
    stage.addEventListener("pointercancel", endPointer);
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);

    api.current = {
      setIterations: (n) => {
        iterRef.current = clamp(Math.round(n), ITER_MIN, ITER_MAX);
        setIterations(iterRef.current);
        drawInteractive();
        scheduleSettle();
      },
      setBands: (n) => {
        bandsRef.current = clamp(Math.round(n), BANDS_MIN, BANDS_MAX);
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
        const destination =
          preset.id === OVERVIEW.id ? homeView(stage.clientWidth || 1, stage.clientHeight || 1) : preset;
        animateTo(destination);
      },
      reset: () => {
        api.current.goPreset(OVERVIEW);
      },
      toggleMenu: () => {
        menuRef.current = !menuRef.current;
        if (menuRef.current) syncHud();
        setMenuOpen(menuRef.current);
      },
    };

    drawAt(1);
    syncHud();

    const probe = {
      getView: () => ({ ...viewRef.current }),
      getIterations: () => iterRef.current,
      getBands: () => bandsRef.current,
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

  return (
    <main className="explorer">
      <h1 className="sr-only">Mandelbrot explorer</h1>
      <div ref={stageRef} className="stage" />
      {error ? (
        <p className="stage-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dock">
        {menuOpen ? (
          <div className="panel" id="explorer-menu" role="region" aria-label="Explorer controls">
            <div className="panel-head">
              <h2 className="panel-title">Mandelbrot</h2>
              <p className="coords">{formatPoint(hud.cx, hud.cy)}</p>
            </div>
            <div className="zoom-row">
              <button
                type="button"
                className="icon-btn"
                aria-label="Zoom out"
                onClick={() => api.current.zoomCenter(2)}
              >
                <Minus size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <p className="zoom-readout">{formatMag(mag)}</p>
              <button
                type="button"
                className="icon-btn"
                aria-label="Zoom in"
                onClick={() => api.current.zoomCenter(0.5)}
              >
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="stack">
              <label className="slider">
                <span className="slider-top">
                  <span>Iterations</span>
                  <span className="num">{iterations}</span>
                </span>
                <input
                  type="range"
                  min={ITER_MIN}
                  max={ITER_MAX}
                  step={1}
                  value={iterations}
                  aria-valuemin={ITER_MIN}
                  aria-valuemax={ITER_MAX}
                  aria-valuenow={iterations}
                  aria-label="Iterations"
                  onChange={(event) => api.current.setIterations(Number(event.target.value))}
                />
              </label>
              <div className="split">
                <label className="slider">
                  <span className="slider-top">
                    <span>Bands</span>
                    <span className="num">{bands}</span>
                  </span>
                  <input
                    type="range"
                    min={BANDS_MIN}
                    max={BANDS_MAX}
                    step={1}
                    value={bands}
                    aria-label="Color bands"
                    onChange={(event) => api.current.setBands(Number(event.target.value))}
                  />
                </label>
                <label className="slider">
                  <span className="slider-top">
                    <span>Shift</span>
                    <span className="num">{shiftDegrees}°</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={shiftDegrees}
                    aria-label="Color shift"
                    onChange={(event) => api.current.setShift(Number(event.target.value) / 360)}
                  />
                </label>
              </div>
              <p className="kicker">Places</p>
              <div className="places">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="btn"
                    aria-pressed={presetId === preset.id}
                    onClick={() => api.current.goPreset(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-block" onClick={() => api.current.reset()}>
                Reset view
              </button>
              <p className="hint">
                Tap to zoom in · drag to pan
                <br />
                Pinch or Shift-tap to zoom out
              </p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="icon-btn"
          aria-expanded={menuOpen}
          aria-controls="explorer-menu"
          aria-label={menuOpen ? "Close controls" : "Open controls"}
          onClick={() => api.current.toggleMenu()}
        >
          {menuOpen ? (
            <X size={20} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Ellipsis size={22} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>
    </main>
  );
}

declare global {
  interface Window {
    __mandelbrot?: {
      getView: () => View;
      getIterations: () => number;
      getBands: () => number;
    };
  }
}
