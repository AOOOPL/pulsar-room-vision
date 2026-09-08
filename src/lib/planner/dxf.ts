import { uid, type Wall } from "./types";

/**
 * Minimal DXF helper: reads LINE entities into 2D walls and writes walls back
 * out as DXF text. DXF uses a Y-up axis, the 2D canvas uses Y-down, so Y is
 * flipped in both directions.
 */
export function parseDxf(text: string): Wall[] {
  const raw = text.split(/\r?\n/).map((l) => l.trim());
  const walls: Wall[] = [];
  let i = 0;
  let current: Record<number, number> | null = null;

  const flush = () => {
    if (
      current &&
      [10, 20, 11, 21].every((k) => typeof current![k] === "number" && !Number.isNaN(current![k]))
    ) {
      walls.push({
        id: uid("wall"),
        kind: "wall",
        a: { x: current[10], y: -current[20] },
        b: { x: current[11], y: -current[21] },
      });
    }
    current = null;
  };

  while (i < raw.length - 1) {
    const code = Number(raw[i]);
    const value = raw[i + 1];
    i += 2;
    if (Number.isNaN(code)) continue;
    if (code === 0) {
      flush();
      if (value.toUpperCase() === "LINE") current = {};
      continue;
    }
    if (current && (code === 10 || code === 20 || code === 11 || code === 21)) {
      current[code] = Number(value);
    }
  }
  flush();
  return walls.filter((w) => w.a.x !== w.b.x || w.a.y !== w.b.y);
}

export function exportDxf(walls: Wall[]): string {
  const out: string[] = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$INSUNITS",
    "70",
    "4",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
  ];
  for (const w of walls) {
    out.push(
      "0",
      "LINE",
      "8",
      "PULSAR-WALLS",
      "10",
      w.a.x.toFixed(3),
      "20",
      (-w.a.y).toFixed(3),
      "30",
      "0.0",
      "11",
      w.b.x.toFixed(3),
      "21",
      (-w.b.y).toFixed(3),
      "31",
      "0.0",
    );
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\n");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
