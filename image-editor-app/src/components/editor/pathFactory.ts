import { baseLayer, type PathLayer } from "@/lib/editor/types";

/** Build a path layer from document-space points, auto-fitting the bounding box. */
export function makePath(opts: Partial<PathLayer> & { points: { x: number; y: number }[] }): PathLayer {
  const pts = opts.points;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxX = xs.length ? Math.max(...xs) : 100;
  const maxY = ys.length ? Math.max(...ys) : 100;
  const strokeWidth = opts.stroke?.width ?? 8;
  const pad = Math.ceil(strokeWidth / 2) + 4;
  const x = minX - pad;
  const y = minY - pad;
  const width = Math.max(4, maxX - minX + pad * 2);
  const height = Math.max(4, maxY - minY + pad * 2);

  const { points: _ignored, ...rest } = opts;

  return {
    ...baseLayer({ name: "Path", x, y, width, height }),
    type: "path",
    pathType: "freehand",
    stroke: { enabled: true, color: "#8b5cf6", width: 8 },
    fill: "#8b5cf6",
    filled: false,
    closed: false,
    smooth: true,
    ...rest,
    points: pts.map((p) => ({ x: p.x - x, y: p.y - y })),
  };
}
