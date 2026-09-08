import { Sofa, CookingPot } from "lucide-react";
import { ASSET_SPECS, type AssetKind } from "@/lib/planner/types";

const ICONS = { sofa: Sofa, cabinet: CookingPot } as const;

export default function AssetsCatalog({ onPlace }: { onPlace: (kind: AssetKind) => void }) {
  return (
    <aside className="panel-surface flex w-60 shrink-0 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Assets Catalog</p>
      {(Object.keys(ASSET_SPECS) as AssetKind[]).map((kind) => {
        const spec = ASSET_SPECS[kind];
        const Icon = ICONS[kind];
        return (
          <button
            key={kind}
            onClick={() => onPlace(kind)}
            className="group rounded-lg border border-border p-3 text-left transition hover:border-cyanx/70 hover:bg-cyanx/5"
          >
            <Icon size={22} className="text-cyanx" />
            <p className="mt-2 text-sm font-medium text-foreground">{spec.label}</p>
            <p className="text-[11px] text-muted-foreground">
              {spec.w} × {spec.d} × {spec.h} cm
            </p>
            <p className="mt-1 text-[10px] tracking-widest text-muted-foreground uppercase opacity-0 transition group-hover:opacity-100">
              Click to place
            </p>
          </button>
        );
      })}
      <p className="mt-auto text-[10px] leading-relaxed text-muted-foreground">
        Placed assets build as compound procedural 3D meshes. Select one to open the Material
        Inspector.
      </p>
    </aside>
  );
}
