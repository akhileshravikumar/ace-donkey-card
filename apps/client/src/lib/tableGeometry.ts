/**
 * Table shape (wireframe): a polygon with one side per player — triangle for 3, square for 4, …
 * heptagon for 7 — with a flat bottom edge where you sit. Players sit at the middle of each edge,
 * going clockwise (bottom → left → top → right) in turn order.
 *
 * Angles are in degrees in screen space (y down): 90° points down, 180° left, 270° up, 0° right.
 */
export interface Point {
  x: number;
  y: number;
}

export interface TableShape {
  /** Polygon corners, in order. */
  vertices: Point[];
  /** Middle of each player's edge; index 0 is the bottom edge (you). */
  edgeMidpoints: Point[];
  /** Outward direction of each player's edge, in degrees. */
  seatAngles: number[];
  /** Centre of the polygon (where played cards gather). */
  center: Point;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * A regular polygon (`sides` clamped to 3+) scaled to fill a box of 2·rx × 2·ry centred on cx/cy.
 * Triangles and squares keep their true proportions; 5+ sides may stretch wider, like the oval-ish
 * table in the 7-player wireframe.
 */
export function tableShape(
  sides: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): TableShape {
  const n = Math.max(3, sides);
  const step = 360 / n;
  const unit = (a: number): Point => ({ x: Math.cos(rad(a)), y: Math.sin(rad(a)) });
  const rawAngles = Array.from({ length: n }, (_, k) => 90 + k * step);
  const raw = rawAngles.map((a) => unit(a + step / 2));

  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const sy = (2 * ry) / (maxY - minY);
  const sx = Math.min((2 * rx) / (maxX - minX), n >= 5 ? sy * (rx / ry) : sy);
  const map = (p: Point): Point => ({
    x: cx + (p.x - (minX + maxX) / 2) * sx,
    y: cy + (p.y - (minY + maxY) / 2) * sy,
  });

  const vertices = raw.map(map);
  const edgeMidpoints = vertices.map((_, i) => {
    const p = vertices[(i + n - 1) % n]!;
    const q = vertices[i]!;
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  });
  // Normals stretch by the inverse scale, so edges stay perpendicular to their seat direction.
  const seatAngles = rawAngles.map((a, i) => {
    if (i === 0) return 90;
    const u = unit(a);
    const d = deg(Math.atan2(u.y / sy, u.x / sx));
    return d < 90 ? d + 360 : d;
  });
  return { vertices, edgeMidpoints, seatAngles, center: map({ x: 0, y: 0 }) };
}

/** Move a point `distance` along an angle. */
export function offset(p: Point, angleDeg: number, distance: number): Point {
  return {
    x: p.x + distance * Math.cos(rad(angleDeg)),
    y: p.y + distance * Math.sin(rad(angleDeg)),
  };
}

export const toSvgPoints = (points: Point[]) =>
  points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
