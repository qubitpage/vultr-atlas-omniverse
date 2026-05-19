// lib/world-borders.ts — Loads country polygons from world-atlas (TopoJSON) and
// returns them as a list of lat/lon polylines ready to be drawn as line segments
// on the globe. Run once on module load; output is memoised at import time.
import { feature, mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";

type Pos2 = [number, number];

function flattenCoords(geometry: any): Pos2[][] {
  // Returns one array of points per linestring.
  if (!geometry) return [];
  const type = geometry.type as string;
  const coords = geometry.coordinates;
  if (type === "MultiLineString") return coords as Pos2[][];
  if (type === "LineString") return [coords as Pos2[]];
  if (type === "Polygon") return (coords as Pos2[][]).map((ring) => ring);
  if (type === "MultiPolygon") {
    const out: Pos2[][] = [];
    for (const poly of coords as Pos2[][][]) for (const ring of poly) out.push(ring);
    return out;
  }
  return [];
}

const topo = countries110m as unknown as Topology;
// Use shared boundary mesh so we get inter-country borders without duplicate edges.
const meshGeom = mesh(topo, topo.objects.countries as GeometryCollection, (a: any, b: any) => a !== b);
// Also include coastline (where country edge touches ocean — a !== b is false there).
const coastGeom = mesh(topo, topo.objects.countries as GeometryCollection, (a: any, b: any) => a === b);

export const COUNTRY_BORDERS: Pos2[][] = flattenCoords(meshGeom);
export const COASTLINES: Pos2[][] = flattenCoords(coastGeom);

// Land polygons (for the green continent fill).
const land = feature(topo, topo.objects.land as any) as any;
function landPolygons(): Pos2[][] {
  const out: Pos2[][] = [];
  const fc = land.type === "FeatureCollection" ? land.features : [land];
  for (const f of fc) {
    const geom = f.geometry ?? f;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) out.push(ring);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) for (const ring of poly) out.push(ring);
    }
  }
  return out;
}
export const LAND_POLYGONS: Pos2[][] = landPolygons();
