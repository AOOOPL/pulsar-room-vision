import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Box,
  DoorOpen,
  Grid2x2,
  Hand,
  Image as ImageIcon,
  LayoutPanelLeft,
  MousePointer2,
  PanelRight,
  Ruler,
  Scan,
  SquareDashed,
  StretchHorizontal,
  Trash2,
  Upload,
  Download,
  Layers,
} from "lucide-react";
import Canvas2D, { type PhotoState, type Tool } from "@/components/planner/Canvas2D";
import Scene3D from "@/components/planner/Scene3D";
import AssetsCatalog from "@/components/planner/AssetsCatalog";
import MaterialInspector from "@/components/planner/MaterialInspector";
import { exportDxf, parseDxf, downloadText } from "@/lib/planner/dxf";
import {
  ASSET_SPECS,
  dist,
  uid,
  type AssetItem,
  type AssetKind,
  type MaterialKey,
  type PlanElement,
  type Vec2,
  type Wall,
} from "@/lib/planner/types";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pulsar PRO v4.0 — Architectural Room Planner" },
      {
        name: "description",
        content:
          "Draft rooms in a 2D CAD grid, trace photos, import and export DXF, and view instant 3D wall extrusions with procedural furniture.",
      },
      { property: "og:title", content: "Pulsar PRO v4.0 — Architectural Room Planner" },
      {
        property: "og:description",
        content:
          "2D CAD drafting with 10 cm snapping, photo tracing, DXF import/export and live 3D extrusion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Planner,
});

const TOOLS: { id: Tool; label: string; icon: typeof Box }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "wall", label: "Wall", icon: StretchHorizontal },
  { id: "room", label: "Room", icon: SquareDashed },
  { id: "stairs", label: "Stairs", icon: Layers },
  { id: "door", label: "Door", icon: DoorOpen },
  { id: "window", label: "Window", icon: Grid2x2 },
];

function Planner() {
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [tool, setTool] = useState<Tool>("room");
  const [elements, setElements] = useState<PlanElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [photoPanel, setPhotoPanel] = useState(false);
  const [photo, setPhoto] = useState<PhotoState>({
    src: null,
    opacity: 0.5,
    scale: 1,
    offset: { x: -400, y: -300 },
  });
  const [measured, setMeasured] = useState<number | null>(null);
  const [realLength, setRealLength] = useState("100");

  const photoInput = useRef<HTMLInputElement>(null);
  const dxfInput = useRef<HTMLInputElement>(null);

  const walls = useMemo(() => elements.filter((e): e is Wall => e.kind === "wall"), [elements]);
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const selectedAsset = selected && selected.kind === "asset" ? (selected as AssetItem) : null;

  const addElements = (els: PlanElement[]) => setElements((prev) => [...prev, ...els]);

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) =>
      prev.filter((e) => e.id !== selectedId && !(e.kind !== "wall" && "wallId" in e && e.wallId === selectedId)),
    );
    setSelectedId(null);
  };

  const placeAsset = (kind: AssetKind) => {
    const spot: Vec2 = { x: 0, y: 0 };
    const item: AssetItem = {
      id: uid("asset"),
      kind: "asset",
      asset: kind,
      pos: spot,
      rot: 0,
      material: kind === "cabinet" ? "gloss" : "velvet",
    };
    addElements([item]);
    setSelectedId(item.id);
    setTool("select");
  };

  const updateSelectedAsset = (patch: Partial<AssetItem>) =>
    setElements((prev) =>
      prev.map((e) => (e.id === selectedId && e.kind === "asset" ? { ...e, ...patch } : e)),
    );

  const handlePhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto((p) => ({ ...p, src: String(reader.result) }));
      setPhotoPanel(true);
      setView("2d");
    };
    reader.readAsDataURL(file);
  };

  const handleDxf = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseDxf(String(reader.result));
      if (parsed.length) {
        addElements(parsed);
        setView("2d");
      }
    };
    reader.readAsText(file);
  };

  const applyCalibration = () => {
    const real = Number(realLength);
    if (!measured || !real) return;
    setPhoto((p) => ({ ...p, scale: (p.scale * real) / measured }));
    setMeasured(null);
    setTool("select");
  };

  const selectedInfo = () => {
    if (!selected) return "";
    if (selected.kind === "wall") return `Wall · ${Math.round(dist(selected.a, selected.b))} cm`;
    if (selected.kind === "stairs")
      return `Stairs · ${Math.round(dist(selected.a, selected.b))} cm · ${selected.steps} steps`;
    if (selected.kind === "asset") {
      const s = ASSET_SPECS[selected.asset];
      return `${s.label} · ${s.w} × ${s.d} × ${s.h} cm`;
    }
    return `${selected.kind === "door" ? "Door" : "Window"} · ${selected.width} cm`;
  };

  return (
    <div className="flex h-screen flex-col bg-shell text-foreground">
      <header className="panel-surface z-20 shrink-0 border-b">
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="glow-cyan flex h-8 w-8 items-center justify-center rounded-md bg-cyanx text-shell">
              <Box size={18} />
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-bold tracking-[0.25em]">PULSAR PRO</h1>
              <p className="text-[10px] tracking-[0.3em] text-cyanx">V4.0 ARCHITECT</p>
            </div>
          </div>

          <div className="flex rounded-md border border-border p-0.5">
            {(["2d", "3d"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`tool-btn ${view === v ? "tool-btn-active" : ""}`}
              >
                {v === "2d" ? <LayoutPanelLeft size={14} /> : <Box size={14} />}
                {v === "2d" ? "2D Draft" : "3D View"}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1">
            <button className="tool-btn" onClick={() => photoInput.current?.click()}>
              <ImageIcon size={14} /> Import Photo
            </button>
            <button className="tool-btn" onClick={() => dxfInput.current?.click()}>
              <Upload size={14} /> Import DXF
            </button>
            <button
              className="tool-btn"
              onClick={() => downloadText("pulsar-pro-layout.dxf", exportDxf(walls))}
            >
              <Download size={14} /> Export DXF
            </button>
            <button
              className={`tool-btn ${catalogOpen ? "tool-btn-active" : ""}`}
              onClick={() => setCatalogOpen((o) => !o)}
            >
              <PanelRight size={14} /> Assets
            </button>
          </div>
        </div>

        {view === "2d" && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border px-4 py-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`tool-btn ${tool === t.id ? "tool-btn-active" : ""}`}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
            <span className="mx-2 h-4 w-px bg-border" />
            <button
              className={`tool-btn ${photoPanel ? "tool-btn-active" : ""}`}
              onClick={() => setPhotoPanel((o) => !o)}
            >
              <Scan size={14} /> Photo Tracing
            </button>
            <button
              className={`tool-btn ${tool === "calibrate" ? "tool-btn-active" : ""}`}
              onClick={() => {
                setTool("calibrate");
                setPhotoPanel(true);
              }}
            >
              <Ruler size={14} /> Calibrate
            </button>
          </div>
        )}
      </header>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
      />
      <input
        ref={dxfInput}
        type="file"
        accept=".dxf,text/plain"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleDxf(e.target.files[0])}
      />

      <main className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {view === "2d" ? (
            <Canvas2D
              elements={elements}
              tool={tool}
              selectedId={selectedId}
              photo={photo}
              onSelect={setSelectedId}
              onAdd={addElements}
              onCalibrated={(d) => setMeasured(d)}
            />
          ) : (
            <Scene3D elements={elements} selectedId={selectedId} onSelect={setSelectedId} />
          )}

          {!elements.length && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="max-w-sm text-center text-xs leading-relaxed tracking-widest text-muted-foreground uppercase">
                Pick the Room tool and drag two corners to draft your first space
              </p>
            </div>
          )}

          {selected && (
            <div className="panel-surface glow-cyan absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 rounded-lg px-4 py-2">
              <div>
                <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Selected</p>
                <p className="text-xs font-medium text-orangex">{selectedInfo()}</p>
              </div>
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-[11px] tracking-widest text-destructive-foreground uppercase hover:opacity-90"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}

          {view === "2d" && photoPanel && (
            <div className="panel-surface absolute top-4 left-4 z-20 w-64 rounded-lg p-4">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                Photo Tracing Workstation
              </p>
              {!photo.src ? (
                <button
                  onClick={() => photoInput.current?.click()}
                  className="mt-3 w-full rounded-md border border-dashed border-border py-4 text-[11px] tracking-widest text-muted-foreground uppercase hover:border-cyanx/60"
                >
                  Load reference photo
                </button>
              ) : (
                <>
                  <label className="mt-3 block text-[11px] text-muted-foreground">
                    Opacity · {Math.round(photo.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(photo.opacity * 100)}
                    onChange={(e) => setPhoto((p) => ({ ...p, opacity: Number(e.target.value) / 100 }))}
                    className="mt-1 w-full accent-cyanx"
                  />
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                    Calibrate: click two points on a known edge, then enter its real length.
                  </p>
                  {measured !== null && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={realLength}
                        onChange={(e) => setRealLength(e.target.value)}
                        className="w-20 rounded border border-border bg-shell px-2 py-1 text-xs"
                      />
                      <span className="text-[11px] text-muted-foreground">cm</span>
                      <button
                        onClick={applyCalibration}
                        className="rounded bg-cyanx px-2 py-1 text-[10px] tracking-widest text-shell uppercase"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                  <p className="mt-3 text-[10px] tracking-widest text-muted-foreground uppercase">
                    Scale {photo.scale.toFixed(2)} cm / px
                  </p>
                </>
              )}
            </div>
          )}

          {selectedAsset && (
            <MaterialInspector
              item={selectedAsset}
              onChange={(m: MaterialKey) => updateSelectedAsset({ material: m })}
              onRotate={() => updateSelectedAsset({ rot: selectedAsset.rot + Math.PI / 12 })}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>

        {catalogOpen && <AssetsCatalog onPlace={placeAsset} />}
      </main>
    </div>
  );
}
