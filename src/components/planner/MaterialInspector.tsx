import { X } from "lucide-react";
import { MATERIALS, ASSET_SPECS, type AssetItem, type MaterialKey } from "@/lib/planner/types";

export default function MaterialInspector({
  item,
  onChange,
  onClose,
  onRotate,
}: {
  item: AssetItem;
  onChange: (m: MaterialKey) => void;
  onRotate: () => void;
  onClose: () => void;
}) {
  const spec = ASSET_SPECS[item.asset];
  return (
    <div className="panel-surface glow-cyan absolute top-4 right-4 z-20 w-64 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Material Inspector</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">{spec.label}</h3>
          <p className="text-[11px] text-muted-foreground">
            {spec.w} × {spec.d} × {spec.h} cm
          </p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close inspector">
          <X size={16} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(Object.keys(MATERIALS) as MaterialKey[]).map((key) => {
          const m = MATERIALS[key];
          const active = item.material === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`rounded-md border p-2 text-left transition ${
                active ? "border-cyanx bg-cyanx/10" : "border-border hover:border-cyanx/60"
              }`}
            >
              <span className="block h-7 w-full rounded" style={{ backgroundColor: m.swatch }} />
              <span className="mt-1.5 block text-[10px] tracking-wider text-muted-foreground uppercase">
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onRotate}
        className="mt-3 w-full rounded-md border border-border py-1.5 text-[11px] tracking-widest text-muted-foreground uppercase hover:border-cyanx/60 hover:text-foreground"
      >
        Rotate 15°
      </button>
    </div>
  );
}
