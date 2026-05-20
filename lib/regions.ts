// lib/regions.ts
// Vultr region IDs → approximate lat/lon for globe markers.
// Source: Vultr docs region list. Coordinates are city-level.
import type { RegionGeo } from "./types";

export const REGION_GEO: Record<string, RegionGeo> = {
  ams: { id: "ams", lat: 52.3676, lon: 4.9041 },
  atl: { id: "atl", lat: 33.749, lon: -84.388 },
  blr: { id: "blr", lat: 12.9716, lon: 77.5946 },
  bom: { id: "bom", lat: 19.076, lon: 72.8777 },
  cdg: { id: "cdg", lat: 49.0097, lon: 2.5479 },
  del: { id: "del", lat: 28.7041, lon: 77.1025 },
  dfw: { id: "dfw", lat: 32.7767, lon: -96.797 },
  ewr: { id: "ewr", lat: 40.6895, lon: -74.1745 },
  fra: { id: "fra", lat: 50.1109, lon: 8.6821 },
  hnl: { id: "hnl", lat: 21.3069, lon: -157.8583 },
  icn: { id: "icn", lat: 37.5665, lon: 126.978 },
  itm: { id: "itm", lat: 34.7855, lon: 135.4382 },
  jnb: { id: "jnb", lat: -26.2041, lon: 28.0473 },
  lax: { id: "lax", lat: 33.9416, lon: -118.4085 },
  lhr: { id: "lhr", lat: 51.47, lon: -0.4543 },
  mad: { id: "mad", lat: 40.4168, lon: -3.7038 },
  man: { id: "man", lat: 53.4808, lon: -2.2426 },
  mel: { id: "mel", lat: -37.8136, lon: 144.9631 },
  mex: { id: "mex", lat: 19.4326, lon: -99.1332 },
  mia: { id: "mia", lat: 25.7617, lon: -80.1918 },
  mxp: { id: "mxp", lat: 45.4642, lon: 9.19 },
  nrt: { id: "nrt", lat: 35.7647, lon: 140.3863 },
  ord: { id: "ord", lat: 41.9742, lon: -87.9073 },
  osa: { id: "osa", lat: 34.6937, lon: 135.5023 },
  scl: { id: "scl", lat: -33.4489, lon: -70.6693 },
  sea: { id: "sea", lat: 47.4502, lon: -122.3088 },
  sgp: { id: "sgp", lat: 1.3521, lon: 103.8198 },
  sjc: { id: "sjc", lat: 37.3639, lon: -121.929 },
  sto: { id: "sto", lat: 59.3293, lon: 18.0686 },
  syd: { id: "syd", lat: -33.8688, lon: 151.2093 },
  tlv: { id: "tlv", lat: 32.0853, lon: 34.7818 },
  waw: { id: "waw", lat: 52.2297, lon: 21.0122 },
  yto: { id: "yto", lat: 43.6532, lon: -79.3832 },
};

export function geoFor(regionId: string): RegionGeo | null {
  return REGION_GEO[regionId] ?? null;
}

// Convert lat/lon to 3D position on a sphere of given radius
export function latLonToVec3(lat: number, lon: number, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z] as [number, number, number];
}
