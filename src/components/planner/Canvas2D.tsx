import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MATERIALS,
  ASSET_SPECS,
  OPENING_SPECS,
  dist,
  pointOnWall,
  projectOnSegment,
  rectWalls,
  snapPoint,
  uid,
  wallAngle,
  type AssetItem,
  type Opening,
  type PlanElement,
  type Vec2,
  type Wall,
} from "@/lib/planner/types";

export type Tool =
  | "select"
  | "pan"
  | "wall"
  | "room"
  | "stairs"
  | "door"
  | "window"
  | "calibrate";

export type PhotoState = {
  src: string | null;
  opacity: number;
  scale: number; // cm per image pixel
  offset: Vec2;
};

type View = { zoom: number; pan: Vec2 };

type Props = {
  elements: PlanElement[];
  tool: Tool;
  selectedId: string | null;
  photo: PhotoState;
  onSelect: (id: string | null) => void;
  onAdd: (els: PlanElement[]) => void;
  onCalibrated: (worldDistance: number, pts: [Vec2, Vec2]) => void;
};

export default function Canvas2D({
  elements,
  tool,
  selectedId,
  photo,
  onSelect,
  onAdd,
  onCalibrated,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ zoom: 0.55, pan: { x: 0, y: 0 } });
  const [draft, setDraft] = useState<Vec2 | null>(null);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const [calibPts, setCalibPts] = useState<Vec2[]>([]);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const panning = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const walls = useMemo(
    () => elements.filter((e): e is Wall => e.kind === "wall"),
    [elements],
  );

  useEffect(() => {
    if (!photo.src) {
      setImg(null);
      return;
    }
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = photo.src;
  }, [photo.src]);

  // keep the canvas sized to its container
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // center the origin on first mount
  useEffect(() => {
    setView((v) => ({ ...v, pan: { x: size.w / 2, y: size.h / 2 } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w === 0]);

  const toWorld = useCallback(
    (sx: number, sy: number): Vec2 => ({
      x: (sx - view.pan.x) / view.zoom,
      y: (sy - view.pan.y) / view.zoom,
    }),
    [view],
  );

  const pointerWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  const nearestWall = useCallback(
    (p: Vec2) => {
      let best: { wall: Wall; t: number; distance: number } | null = null;
      for (const w of walls) {
        const pr = projectOnSegment(p, w.a, w.b);
        if (!best || pr.distance < best.distance) best = { wall: w, t: pr.t, distance: pr.distance };
      }
      return best;
    },
    [walls],
  );

  const hitTest = useCallback(
    (p: Vec2): string | null => {
      const tol = 14 / view.zoom;
      for (const el of [...elements].reverse()) {
        if (el.kind === "asset") {
          const spec = ASSET_SPECS[el.asset];
          const dx = p.x - el.pos.x;
          const dy = p.y - el.pos.y;
          const lx = dx * Math.cos(-el.rot) - dy * Math.sin(-el.rot);
          const ly = dx * Math.sin(-el.rot) + dy * Math.cos(-el.rot);
          if (Math.abs(lx) <= spec.w / 2 && Math.abs(ly) <= spec.d / 2) return el.id;
        } else if (el.kind === "wall" || el.kind === "stairs") {
          if (projectOnSegment(p, el.a, el.b).distance <= tol) return el.id;
        } else {
          const w = walls.find((x) => x.id === el.wallId);
          if (w && dist(p, pointOnWall(w, el.t)) <= Math.max(tol, el.width / 2)) return el.id;
        }
      }
      return null;
    },
    [elements, walls, view.zoom],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pointerWorld(e);
    if (e.button === 1 || e.button === 2 || tool === "pan" || e.shiftKey) {
      panning.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const sp = snapPoint(p);

    if (tool === "select") {
      onSelect(hitTest(p));
      return;
    }
    if (tool === "calibrate") {
      const next = calibPts.length >= 2 ? [sp] : [...calibPts, sp];
      setCalibPts(next);
      if (next.length === 2) onCalibrated(dist(next[0], next[1]), [next[0], next[1]]);
      return;
    }
    if (tool === "door" || tool === "window") {
      const near = nearestWall(p);
      if (!near) return;
      const spec = OPENING_SPECS[tool];
      const op: Opening = {
        id: uid(tool),
        kind: tool,
        wallId: near.wall.id,
        t: near.t,
        width: spec.width,
      };
      onAdd([op]);
      onSelect(op.id);
      return;
    }
    if (tool === "wall" || tool === "room" || tool === "stairs") {
      if (!draft) {
        setDraft(sp);
        return;
      }
      if (tool === "wall") {
        if (dist(draft, sp) > 1) {
          const w: Wall = { id: uid("wall"), kind: "wall", a: draft, b: sp };
          onAdd([w]);
        }
        setDraft(sp); // chain walls
        return;
      }
      if (tool === "room") {
        if (Math.abs(sp.x - draft.x) > 10 && Math.abs(sp.y - draft.y) > 10) {
          onAdd(rectWalls(draft, sp));
        }
        setDraft(null);
        return;
      }
      if (dist(draft, sp) > 1) {
        onAdd([
          {
            id: uid("stairs"),
            kind: "stairs",
            a: draft,
            b: sp,
            width: 100,
            steps: Math.max(3, Math.round(dist(draft, sp) / 28)),
          },
        ]);
      }
      setDraft(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (panning.current) {
      const dx = e.clientX - panning.current.x;
      const dy = e.clientY - panning.current.y;
      panning.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, pan: { x: v.pan.x + dx, y: v.pan.y + dy } }));
      return;
    }
    setHover(snapPoint(pointerWorld(e)));
  };

  const handlePointerUp = () => {
    panning.current = null;
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const zoom = Math.min(4, Math.max(0.06, v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        const wx = (mx - v.pan.x) / v.zoom;
        const wy = (my - v.pan.y) / v.zoom;
        return { zoom, pan: { x: mx - wx * zoom, y: my - wy * zoom } };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft(null);
        setCalibPts([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setDraft(null);
    if (tool !== "calibrate") setCalibPts([]);
  }, [tool]);

  // ---------- rendering ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = "#050b10";
    ctx.fillRect(0, 0, size.w, size.h);

    const { zoom, pan } = view;
    const sx = (x: number) => x * zoom + pan.x;
    const sy = (y: number) => y * zoom + pan.y;

    // photo tracing layer (behind grid)
    if (img) {
      ctx.save();
      ctx.globalAlpha = photo.opacity;
      const w = img.naturalWidth * photo.scale * zoom;
      const h = img.naturalHeight * photo.scale * zoom;
      ctx.drawImage(img, sx(photo.offset.x), sy(photo.offset.y), w, h);
      ctx.restore();
    }

    // grid: 10 cm minor, 100 cm major
    const step = 10 * zoom;
    if (step > 3) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(34,211,238,0.07)";
      ctx.beginPath();
      const startX = pan.x % step;
      for (let x = startX; x < size.w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size.h);
      }
      const startY = pan.y % step;
      for (let y = startY; y < size.h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(size.w, y);
      }
      ctx.stroke();
    }
    const major = 100 * zoom;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(34,211,238,0.16)";
    ctx.beginPath();
    for (let x = pan.x % major; x < size.w; x += major) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.h);
    }
    for (let y = pan.y % major; y < size.h; y += major) {
      ctx.moveTo(0, y);
      ctx.lineTo(size.w, y);
    }
    ctx.stroke();

    // axes
    ctx.strokeStyle = "rgba(34,211,238,0.4)";
    ctx.beginPath();
    ctx.moveTo(sx(0), 0);
    ctx.lineTo(sx(0), size.h);
    ctx.moveTo(0, sy(0));
    ctx.lineTo(size.w, sy(0));
    ctx.stroke();

    const label = (text: string, x: number, y: number, color = "#22d3ee") => {
      ctx.font = "600 11px 'Space Grotesk', sans-serif";
      const w = ctx.measureText(text).width + 10;
      ctx.fillStyle = "rgba(5,11,16,0.85)";
      ctx.fillRect(x - w / 2, y - 9, w, 18);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2, y - 9, w, 18);
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x, y + 1);
    };

    // walls
    for (const w of walls) {
      const sel = w.id === selectedId;
      ctx.strokeStyle = sel ? "#f97316" : "#22d3ee";
      ctx.lineWidth = sel ? 7 : 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx(w.a.x), sy(w.a.y));
      ctx.lineTo(sx(w.b.x), sy(w.b.y));
      ctx.stroke();
      const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
      if (zoom > 0.2) label(`${Math.round(dist(w.a, w.b))} cm`, sx(mid.x), sy(mid.y) - 16, sel ? "#f97316" : "#22d3ee");
    }

    // stairs
    for (const el of elements) {
      if (el.kind !== "stairs") continue;
      const sel = el.id === selectedId;
      const ang = Math.atan2(el.b.y - el.a.y, el.b.x - el.a.x);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      const len = dist(el.a, el.b);
      ctx.strokeStyle = sel ? "#f97316" : "#7dd3fc";
      ctx.lineWidth = 2;
      for (let i = 0; i <= el.steps; i++) {
        const t = i / el.steps;
        const px = el.a.x + (el.b.x - el.a.x) * t;
        const py = el.a.y + (el.b.y - el.a.y) * t;
        ctx.beginPath();
        ctx.moveTo(sx(px + (nx * el.width) / 2), sy(py + (ny * el.width) / 2));
        ctx.lineTo(sx(px - (nx * el.width) / 2), sy(py - (ny * el.width) / 2));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(sx(el.a.x), sy(el.a.y));
      ctx.lineTo(sx(el.b.x), sy(el.b.y));
      ctx.stroke();
      label(`STAIRS ${Math.round(len)} cm`, sx((el.a.x + el.b.x) / 2), sy((el.a.y + el.b.y) / 2), sel ? "#f97316" : "#7dd3fc");
    }

    // openings
    for (const el of elements) {
      if (el.kind !== "door" && el.kind !== "window") continue;
      const w = walls.find((x) => x.id === el.wallId);
      if (!w) continue;
      const c = pointOnWall(w, el.t);
      const ang = wallAngle(w);
      const dx = (Math.cos(ang) * el.width) / 2;
      const dy = (Math.sin(ang) * el.width) / 2;
      const sel = el.id === selectedId;
      ctx.strokeStyle = sel ? "#f97316" : el.kind === "door" ? "#facc15" : "#a5f3fc";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(sx(c.x - dx), sy(c.y - dy));
      ctx.lineTo(sx(c.x + dx), sy(c.y + dy));
      ctx.stroke();
      if (el.kind === "window") {
        ctx.strokeStyle = "#050b10";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      label(el.kind.toUpperCase(), sx(c.x), sy(c.y) + 18, sel ? "#f97316" : "#94a3b8");
    }

    // assets
    for (const el of elements) {
      if (el.kind !== "asset") continue;
      const spec = ASSET_SPECS[el.asset];
      const sel = el.id === selectedId;
      ctx.save();
      ctx.translate(sx(el.pos.x), sy(el.pos.y));
      ctx.rotate(el.rot);
      ctx.fillStyle = sel ? "rgba(249,115,22,0.25)" : "rgba(34,211,238,0.12)";
      ctx.strokeStyle = sel ? "#f97316" : MATERIALS[el.material].swatch;
      ctx.lineWidth = 2;
      const w = spec.w * view.zoom;
      const h = spec.d * view.zoom;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
      label(
        `${spec.label} ${spec.w}×${spec.d}`,
        sx(el.pos.x),
        sy(el.pos.y),
        sel ? "#f97316" : "#94a3b8",
      );
    }

    // drafts
    if (draft && hover && (tool === "wall" || tool === "room" || tool === "stairs")) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      if (tool === "room") {
        ctx.strokeRect(
          sx(Math.min(draft.x, hover.x)),
          sy(Math.min(draft.y, hover.y)),
          Math.abs(hover.x - draft.x) * zoom,
          Math.abs(hover.y - draft.y) * zoom,
        );
        label(
          `${Math.abs(Math.round(hover.x - draft.x))} × ${Math.abs(Math.round(hover.y - draft.y))} cm`,
          sx((draft.x + hover.x) / 2),
          sy((draft.y + hover.y) / 2),
          "#f97316",
        );
      } else {
        ctx.beginPath();
        ctx.moveTo(sx(draft.x), sy(draft.y));
        ctx.lineTo(sx(hover.x), sy(hover.y));
        ctx.stroke();
        label(`${Math.round(dist(draft, hover))} cm`, sx((draft.x + hover.x) / 2), sy((draft.y + hover.y) / 2) - 16, "#f97316");
      }
      ctx.setLineDash([]);
    }

    // calibration preview
    if (calibPts.length) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      for (const p of calibPts) {
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (calibPts.length === 2) {
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx(calibPts[0].x), sy(calibPts[0].y));
        ctx.lineTo(sx(calibPts[1].x), sy(calibPts[1].y));
        ctx.stroke();
        ctx.setLineDash([]);
        label(
          `REF ${Math.round(dist(calibPts[0], calibPts[1]))} cm`,
          sx((calibPts[0].x + calibPts[1].x) / 2),
          sy((calibPts[0].y + calibPts[1].y) / 2) - 16,
          "#facc15",
        );
      }
    }

    // cursor crosshair
    if (hover && tool !== "select" && tool !== "pan") {
      ctx.strokeStyle = "rgba(249,115,22,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx(hover.x), sy(hover.y), 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [elements, walls, view, size, draft, hover, selectedId, tool, calibPts, img, photo]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        style={{ width: size.w, height: size.h, cursor: tool === "pan" ? "grab" : "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-md border border-border bg-panel/80 px-3 py-1.5 text-[10px] tracking-widest text-muted-foreground uppercase backdrop-blur">
        <span>Zoom {(view.zoom * 100).toFixed(0)}%</span>
        <span>Snap 10 cm</span>
        {hover && (
          <span className="text-cyanx">
            X {Math.round(hover.x)} · Y {Math.round(hover.y)}
          </span>
        )}
      </div>
    </div>
  );
}

export type { AssetItem };
