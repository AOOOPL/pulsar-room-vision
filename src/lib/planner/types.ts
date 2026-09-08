export type Vec2 = { x: number; y: number };

export const WALL_HEIGHT = 280; // cm
export const WALL_THICKNESS = 18; // cm
export const CUTAWAY_HEIGHT = 100; // cm
export const SNAP = 10; // cm

export type MaterialKey = "oak" | "marble" | "velvet" | "gloss";

export const MATERIALS: Record<
  MaterialKey,
  { label: string; color: string; roughness: number; metalness: number; swatch: string }
> = {
  oak: { label: "Oak", color: "#b98a53", roughness: 0.75, metalness: 0.02, swatch: "#b98a53" },
  marble: { label: "Marble", color: "#e8e6e1", roughness: 0.18, metalness: 0.04, swatch: "#e8e6e1" },
  velvet: { label: "Gray Velvet", color: "#6b7280", roughness: 0.95, metalness: 0, swatch: "#6b7280" },
  gloss: { label: "White Gloss", color: "#f8fafc", roughness: 0.05, metalness: 0.12, swatch: "#f8fafc" },
};

export type Wall = { id: string; kind: "wall"; a: Vec2; b: Vec2 };
export type Stairs = {
  id: string;
  kind: "stairs";
  a: Vec2;
  b: Vec2;
  width: number;
  steps: number;
};
export type Opening = {
  id: string;
  kind: "door" | "window";
  wallId: string;
  t: number; // 0..1 along wall
  width: number;
};
export type AssetKind = "sofa" | "cabinet";
export type AssetItem = {
  id: string;
  kind: "asset";
  asset: AssetKind;
  pos: Vec2;
  rot: number; // radians
  material: MaterialKey;
};

export type PlanElement = Wall | Stairs | Opening | AssetItem;

export const ASSET_SPECS: Record<AssetKind, { label: string; w: number; d: number; h: number }> = {
  sofa: { label: "Sofa", w: 200, d: 90, h: 80 },
  cabinet: { label: "Kitchen Cabinet", w: 140, d: 60, h: 90 },
};

export const OPENING_SPECS = {
  door: { width: 90, sill: 0, top: 210 },
  window: { width: 120, sill: 90, top: 210 },
} as const;

let counter = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const snap = (v: number, step = SNAP) => Math.round(v / step) * step;
export const snapPoint = (p: Vec2, step = SNAP): Vec2 => ({ x: snap(p.x, step), y: snap(p.y, step) });

export const dist = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y);

export function projectOnSegment(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { t, point, distance: dist(p, point) };
}

export function wallAngle(w: Wall) {
  return Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
}

export function pointOnWall(w: Wall, t: number): Vec2 {
  return { x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t };
}

export function rectWalls(a: Vec2, b: Vec2): Wall[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const c: Vec2[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  return c.map((p, i) => ({
    id: uid("wall"),
    kind: "wall" as const,
    a: p,
    b: c[(i + 1) % 4],
  }));
}

export function planBounds(walls: Wall[]) {
  if (!walls.length) return { cx: 0, cy: 0, size: 600 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of walls) {
    minX = Math.min(minX, w.a.x, w.b.x);
    maxX = Math.max(maxX, w.a.x, w.b.x);
    minY = Math.min(minY, w.a.y, w.b.y);
    maxY = Math.max(maxY, w.a.y, w.b.y);
  }
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    size: Math.max(400, maxX - minX, maxY - minY),
  };
}
