import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  ASSET_SPECS,
  CUTAWAY_HEIGHT,
  MATERIALS,
  OPENING_SPECS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  dist,
  planBounds,
  type AssetItem,
  type MaterialKey,
  type Opening,
  type PlanElement,
  type Stairs,
  type Wall,
} from "@/lib/planner/types";

type Piece = { u0: number; u1: number; y0: number; y1: number };

function wallPieces(length: number, openings: Opening[]): Piece[] {
  const H = WALL_HEIGHT;
  const holes = openings
    .map((o) => {
      const spec = OPENING_SPECS[o.kind as "door" | "window"];
      return { c: o.t * length, w: o.width, sill: spec.sill, top: spec.top };
    })
    .sort((a, b) => a.c - b.c);

  const pieces: Piece[] = [];
  let cursor = 0;
  for (const h of holes) {
    const s = Math.max(0, Math.min(length, h.c - h.w / 2));
    const e = Math.max(0, Math.min(length, h.c + h.w / 2));
    if (e <= cursor) continue;
    if (s > cursor) pieces.push({ u0: cursor, u1: s, y0: 0, y1: H });
    if (h.sill > 0) pieces.push({ u0: s, u1: e, y0: 0, y1: h.sill });
    if (h.top < H) pieces.push({ u0: s, u1: e, y0: h.top, y1: H });
    cursor = e;
  }
  if (cursor < length) pieces.push({ u0: cursor, u1: length, y0: 0, y1: H });
  return pieces;
}

function Wall3D({
  wall,
  openings,
  center,
  selected,
  onSelect,
}: {
  wall: Wall;
  openings: Opening[];
  center: { cx: number; cy: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const cutRef = useRef(0);
  const length = dist(wall.a, wall.b);
  const pieces = useMemo(() => wallPieces(length, openings), [length, openings]);
  const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
  const mid = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.y + wall.b.y) / 2 };

  const normal = useMemo(
    () => new THREE.Vector2(-Math.sin(angle), Math.cos(angle)),
    [angle],
  );

  useFrame(({ camera }, delta) => {
    if (!group.current) return;
    const toWall = new THREE.Vector2(mid.x - center.cx, mid.z - center.cy);
    const toCam = new THREE.Vector2(camera.position.x - center.cx, camera.position.z - center.cy);
    if (toWall.length() > 1) toWall.normalize();
    if (toCam.length() > 1) toCam.normalize();
    const facing = Math.abs(normal.dot(toCam));
    const target = toWall.dot(toCam) > 0.25 && facing > 0.35 ? 1 : 0;
    cutRef.current += (target - cutRef.current) * Math.min(1, delta * 6);

    const cutTop = WALL_HEIGHT - (WALL_HEIGHT - CUTAWAY_HEIGHT) * cutRef.current;
    group.current.children.forEach((child, i) => {
      const piece = pieces[i];
      if (!piece || !(child instanceof THREE.Mesh)) return;
      const top = Math.min(piece.y1, cutTop);
      const h = Math.max(0, top - piece.y0);
      child.visible = h > 1;
      child.scale.set(1, h, 1);
      child.position.y = piece.y0 + h / 2;
    });
  });

  return (
    <group position={[mid.x, 0, mid.z]} rotation={[0, -angle, 0]}>
      <group ref={group}>
        {pieces.map((p, i) => (
          <mesh
            key={i}
            castShadow
            receiveShadow
            position={[(p.u0 + p.u1) / 2 - length / 2, p.y0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <boxGeometry args={[p.u1 - p.u0, 1, WALL_THICKNESS]} />
            <meshStandardMaterial
              color={selected ? "#f97316" : "#c9d4dc"}
              emissive={selected ? "#f97316" : "#000000"}
              emissiveIntensity={selected ? 0.25 : 0}
              roughness={0.85}
            />
          </mesh>
        ))}
      </group>
      <Html center position={[0, WALL_HEIGHT + 26, 0]} distanceFactor={900}>
        <div className="rounded border border-cyanx/50 bg-shell/80 px-2 py-0.5 text-[11px] whitespace-nowrap text-cyanx">
          {Math.round(length)} cm
        </div>
      </Html>
    </group>
  );
}

function Stairs3D({ stairs, selected, onSelect }: { stairs: Stairs; selected: boolean; onSelect: () => void }) {
  const length = dist(stairs.a, stairs.b);
  const angle = Math.atan2(stairs.b.y - stairs.a.y, stairs.b.x - stairs.a.x);
  const stepLen = length / stairs.steps;
  const riser = 18;
  return (
    <group
      position={[(stairs.a.x + stairs.b.x) / 2, 0, (stairs.a.y + stairs.b.y) / 2]}
      rotation={[0, -angle, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {Array.from({ length: stairs.steps }).map((_, i) => {
        const h = riser * (i + 1);
        return (
          <mesh key={i} castShadow receiveShadow position={[-length / 2 + stepLen * (i + 0.5), h / 2, 0]}>
            <boxGeometry args={[stepLen, h, stairs.width]} />
            <meshStandardMaterial
              color={selected ? "#f97316" : "#9aa7b1"}
              roughness={0.7}
            />
          </mesh>
        );
      })}
      <Html center position={[0, riser * stairs.steps + 40, 0]} distanceFactor={900}>
        <div className="rounded border border-cyanx/50 bg-shell/80 px-2 py-0.5 text-[11px] whitespace-nowrap text-cyanx">
          Stairs · {stairs.steps} steps · {Math.round(length)} cm
        </div>
      </Html>
    </group>
  );
}

function Mat({ material }: { material: MaterialKey }) {
  const m = MATERIALS[material];
  return <meshStandardMaterial color={m.color} roughness={m.roughness} metalness={m.metalness} />;
}

function Sofa({ material }: { material: MaterialKey }) {
  const { w, d } = ASSET_SPECS.sofa;
  const legH = 12;
  const seatH = 30;
  const armW = 18;
  return (
    <group>
      {/* base */}
      <mesh castShadow receiveShadow position={[0, legH + seatH / 2, 0]}>
        <boxGeometry args={[w, seatH, d]} />
        <Mat material={material} />
      </mesh>
      {/* backrest */}
      <mesh castShadow position={[0, legH + seatH + 22, -d / 2 + 9]}>
        <boxGeometry args={[w, 44, 18]} />
        <Mat material={material} />
      </mesh>
      {/* armrests */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * (w / 2 - armW / 2), legH + seatH + 6, 4]}>
          <boxGeometry args={[armW, 26, d - 12]} />
          <Mat material={material} />
        </mesh>
      ))}
      {/* legs */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} castShadow position={[sx * (w / 2 - 10), legH / 2, sz * (d / 2 - 10)]}>
          <cylinderGeometry args={[3.5, 3, legH, 12]} />
          <meshStandardMaterial color="#2b2b2b" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Cabinet({ material }: { material: MaterialKey }) {
  const { w, d, h } = ASSET_SPECS.cabinet;
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <Mat material={material} />
      </mesh>
      {/* marble countertop */}
      <mesh castShadow position={[0, h + 2, 0]}>
        <boxGeometry args={[w + 4, 4, d + 4]} />
        <meshStandardMaterial color={MATERIALS.marble.color} roughness={0.15} metalness={0.05} />
      </mesh>
      {/* door lines */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 4), h / 2, d / 2 + 0.6]}>
          <boxGeometry args={[w / 2 - 3, h - 8, 1]} />
          <meshStandardMaterial color="#000000" transparent opacity={0.12} />
        </mesh>
      ))}
    </group>
  );
}

function Asset3D({ item, selected, onSelect }: { item: AssetItem; selected: boolean; onSelect: () => void }) {
  const spec = ASSET_SPECS[item.asset];
  return (
    <group
      position={[item.pos.x, 0, item.pos.y]}
      rotation={[0, -item.rot, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {item.asset === "sofa" ? <Sofa material={item.material} /> : <Cabinet material={item.material} />}
      {selected && (
        <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(spec.w, spec.d) / 2 + 4, Math.max(spec.w, spec.d) / 2 + 10, 48]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
      )}
      <Html center position={[0, spec.h + 45, 0]} distanceFactor={900}>
        <div
          className={`rounded border px-2 py-0.5 text-[11px] whitespace-nowrap ${
            selected ? "border-orangex/70 bg-shell/85 text-orangex" : "border-cyanx/50 bg-shell/80 text-cyanx"
          }`}
        >
          {spec.label} · {spec.w}×{spec.d}×{spec.h} cm
        </div>
      </Html>
    </group>
  );
}

export default function Scene3D({
  elements,
  selectedId,
  onSelect,
}: {
  elements: PlanElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const walls = elements.filter((e): e is Wall => e.kind === "wall");
  const openings = elements.filter((e): e is Opening => e.kind === "door" || e.kind === "window");
  const stairs = elements.filter((e): e is Stairs => e.kind === "stairs");
  const assets = elements.filter((e): e is AssetItem => e.kind === "asset");
  const bounds = planBounds(walls);
  const camDist = bounds.size * 1.5 + 400;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [bounds.cx + camDist * 0.7, camDist * 0.6, bounds.cy + camDist], fov: 45, far: 40000 }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#050b10"]} />
      <fog attach="fog" args={["#050b10", camDist * 1.6, camDist * 5]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[bounds.cx + 600, 1200, bounds.cy + 800]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-2000}
        shadow-camera-right={2000}
        shadow-camera-top={2000}
        shadow-camera-bottom={-2000}
        shadow-camera-far={6000}
      />
      <Suspense fallback={null}>
        <Environment>
          <Lightformer intensity={1.6} position={[0, 900, 0]} scale={[900, 900, 1]} />
          <Lightformer intensity={0.8} color="#7fd7e8" position={[-900, 300, 0]} rotation-y={Math.PI / 2} scale={[1600, 200, 1]} />
        </Environment>

        {/* floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bounds.cx, -1, bounds.cy]} receiveShadow>
          <planeGeometry args={[bounds.size * 6, bounds.size * 6]} />
          <meshStandardMaterial color="#0d1a22" roughness={0.95} />
        </mesh>
        <gridHelper
          args={[bounds.size * 6, Math.round((bounds.size * 6) / 100), "#164e5c", "#0f2b34"]}
          position={[bounds.cx, 0, bounds.cy]}
        />
        <ContactShadows
          position={[bounds.cx, 0.5, bounds.cy]}
          scale={bounds.size * 3}
          opacity={0.5}
          blur={2.4}
          far={400}
        />

        {walls.map((w) => (
          <Wall3D
            key={w.id}
            wall={w}
            openings={openings.filter((o) => o.wallId === w.id)}
            center={{ cx: bounds.cx, cy: bounds.cy }}
            selected={selectedId === w.id}
            onSelect={() => onSelect(w.id)}
          />
        ))}
        {stairs.map((s) => (
          <Stairs3D key={s.id} stairs={s} selected={selectedId === s.id} onSelect={() => onSelect(s.id)} />
        ))}
        {assets.map((a) => (
          <Asset3D key={a.id} item={a} selected={selectedId === a.id} onSelect={() => onSelect(a.id)} />
        ))}
      </Suspense>
      <OrbitControls
        target={[bounds.cx, 80, bounds.cy]}
        enablePan
        enableZoom
        maxPolarAngle={Math.PI / 2.05}
        minDistance={120}
        maxDistance={camDist * 4}
      />
    </Canvas>
  );
}
