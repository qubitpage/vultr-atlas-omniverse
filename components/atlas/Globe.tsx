"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import { latLonToVec3, geoFor } from "@/lib/regions";
import { useAtlas } from "@/lib/store";
import type { VultrInstance } from "@/lib/types";
import { COUNTRY_BORDERS, COASTLINES, LAND_POLYGONS } from "@/lib/world-borders";
import { CAPITALS } from "@/lib/capitals";

const GLOBE_RADIUS = 2;

// Convert a [lon, lat] GeoJSON point to a THREE.Vector3 on a sphere of given radius.
function lonLatToVec(lon: number, lat: number, radius = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Reusable line geometry built from an array of lon/lat polylines.
function buildLineGeometry(lines: [number, number][][], radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [aLon, aLat] = line[i];
      const [bLon, bLat] = line[i + 1];
      const a = lonLatToVec(aLon, aLat, radius);
      const b = lonLatToVec(bLon, bLat, radius);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

// Triangulate (fan) each ring of land polygons so we get a green continent fill
// over the ocean sphere. This is approximate (fan, not earcut) but it looks
// good enough for low-res 110m polygons.
function buildLandGeometry(polygons: [number, number][][], radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const ring of polygons) {
    if (ring.length < 3) continue;
    const [lon0, lat0] = ring[0];
    const v0 = lonLatToVec(lon0, lat0, radius);
    for (let i = 1; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      const v1 = lonLatToVec(lon1, lat1, radius);
      const v2 = lonLatToVec(lon2, lat2, radius);
      positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// Rasterize the world map onto an equirectangular canvas, then use it as a
// texture on the globe sphere. This avoids the broken fan-triangulation of
// large/wrapping polygons (Russia, Antarctica) that produced giant cross-globe
// triangles when we tried to render land as 3D geometry.
function buildEarthTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Ocean gradient (north pole lighter, equator deeper) for a nicer 3D look.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a3d5a");
  grad.addColorStop(0.5, "#0e4f74");
  grad.addColorStop(1, "#0a3d5a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Equirectangular projection: lon ∈ [-180,180] → x, lat ∈ [-90,90] → y inverted.
  const project = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * W,
    ((90 - lat) / 180) * H,
  ];

  // Fill land polygons (green continents).
  ctx.fillStyle = "#2f8f4e";
  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = 0.6;
  for (const ring of LAND_POLYGONS as [number, number][][]) {
    if (ring.length < 3) continue;
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const [lon, lat] = ring[i];
      const [x, y] = project(lon, lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Country borders (thin emerald lines).
  ctx.strokeStyle = "rgba(180, 240, 200, 0.55)";
  ctx.lineWidth = 0.7;
  for (const line of COUNTRY_BORDERS as [number, number][][]) {
    if (line.length < 2) continue;
    ctx.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [lon, lat] = line[i];
      const [x, y] = project(lon, lat);
      // Break the path when crossing the antimeridian to avoid wrap streaks.
      if (i === 0) ctx.moveTo(x, y);
      else {
        const [prevLon] = line[i - 1];
        if (Math.abs(lon - prevLon) > 180) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // Plot capital city dots so they show through any rotation.
  for (const c of CAPITALS) {
    const [x, y] = project(c.lon, c.lat);
    const r = c.major ? 3.2 : 1.8;
    ctx.fillStyle = c.major ? "#fde68a" : "#fcd34d";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (c.major) {
      ctx.fillStyle = "rgba(253, 230, 138, 0.35)";
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Earth() {
  const earthTex = useMemo(() => buildEarthTexture(), []);

  // The whole scene (earth + markers) is spun by OrbitControls.autoRotate, so
  // we don't rotate the earth group here — that would desynchronise the markers
  // from the continents underneath them.

  return (
    <group>
      {/* Single textured globe — Blue Marble style canvas painted from real GeoJSON */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 128, 128]} />
        <meshStandardMaterial
          map={earthTex}
          emissive="#0a2b3a"
          emissiveIntensity={0.25}
          roughness={0.78}
          metalness={0.1}
        />
      </mesh>

      {/* Atmospheric halo */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.06, 64, 64]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.12, 64, 64]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.03} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function RegionMarker({
  regionId,
  city,
  instances,
  status,
  onClick,
  onHover,
  selected,
  hovered,
  labelsHidden,
}: {
  regionId: string;
  city: string;
  instances: VultrInstance[];
  status?: string;
  onClick: () => void;
  onHover: (id: string | null) => void;
  selected: boolean;
  hovered: boolean;
  labelsHidden?: boolean;
}) {
  const geo = geoFor(regionId);
  const groupRef = useRef<THREE.Group>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame((s) => {
    if (ringRef.current) {
      const t = s.clock.getElapsedTime();
      const scale = 1 + 0.25 * Math.sin(t * 2);
      ringRef.current.scale.setScalar(scale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.6 - 0.4 * Math.sin(t * 2);
    }
  });

  if (!geo) return null;
  const pos = latLonToVec3(geo.lat, geo.lon, GLOBE_RADIUS * 1.01);
  const count = instances.length;
  const avgCpu = count
    ? instances.reduce((a, b) => a + (b.cpu ?? 0), 0) / count
    : 0;
  const hasAttention = instances.some((instance) => (instance.attention?.length ?? 0) > 0 || instance.health === "degraded" || instance.health === "watch");
  const towerH = Math.max(0.04, Math.min(0.6, 0.05 + count * 0.08));
  const color =
    status === "degraded" || avgCpu > 75
      ? "#f87171"
      : status === "planned" || hasAttention || avgCpu > 50
        ? "#fbbf24"
        : avgCpu > 0 || status === "ok"
          ? "#34d399"
          : "#5eead4";

  return (
    <group
      ref={groupRef}
      position={pos as any}
      onClick={(e) => {
        e.stopPropagation?.();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation?.();
        onHover(regionId);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      {/* Tower whose height = instance count */}
      <mesh position={[0, towerH / 2, 0]} lookAt={[0, 0, 0] as any}>
        <cylinderGeometry args={[0.015, 0.015, towerH, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      {/* Pulsing ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.04, 0.06, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Selection halo */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.1, 48]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* HTML label — only when relevant to keep the globe clean */}
      {!labelsHidden && (hovered || selected || count > 0 || status === "degraded") && (
        <Html
          center
          distanceFactor={4}
          position={[0, towerH + 0.06, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            className={
              (selected || hovered
                ? "bg-panel/95 border-accent text-accent shadow-glow "
                : "bg-panel/70 border-line text-gray-300 ") +
              "rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest backdrop-blur whitespace-nowrap"
            }
          >
            {city}{count > 0 ? ` · ${count}` : ""}
          </div>
        </Html>
      )}
    </group>
  );
}

export function Globe({ onPick }: { onPick?: (regionId: string) => void } = {}) {
  const { regions, instances, regionStatus, selectedRegion, focusRegion, autoRotate, openConfigurator, configuratorRegion } = useAtlas();
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const labelsHidden = !!configuratorRegion;
  const grouped = useMemo(() => {
    const m: Record<string, VultrInstance[]> = {};
    for (const i of instances) {
      (m[i.region] ??= []).push(i);
    }
    return m;
  }, [instances]);

  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 4, 5]} intensity={1.4} color="#fff7e6" />
      <directionalLight position={[-5, -2, -3]} intensity={0.35} color="#bae6fd" />
      <Stars radius={50} depth={50} count={5000} factor={2.2} fade speed={0.5} />
      <Earth />
      <CameraDriver />
      {regions.map((r) => (
        <RegionMarker
          key={r.id}
          regionId={r.id}
          city={r.city}
          instances={grouped[r.id] ?? []}
          status={regionStatus.find((status) => status.region_id === r.id)?.status}
          onClick={() => {
            focusRegion(r.id);
            if (onPick) onPick(r.id);
            else openConfigurator(r.id);
          }}
          onHover={setHovered}
          selected={selectedRegion === r.id}
          hovered={hovered === r.id}
          labelsHidden={labelsHidden}
        />
      ))}
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={12}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        autoRotate={autoRotate}
        autoRotateSpeed={0.18}
      />
    </Canvas>
  );
}

function CameraDriver() {
  const { camera } = useThree();
  const target = useAtlas((s) => s.cameraTargetRegion);
  const nonce = useAtlas((s) => s.cameraTargetNonce);
  const animRef = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    if (!target) return;
    const geo = geoFor(target);
    if (!geo) return;
    const dest = latLonToVec3(geo.lat, geo.lon, GLOBE_RADIUS * 3.4);
    const to = new THREE.Vector3(...dest);
    animRef.current = { from: camera.position.clone(), to, t: 0 };
  }, [target, nonce, camera]);

  useFrame((_s, dt) => {
    const a = animRef.current;
    if (!a) return;
    // Slow, cinematic ease-in-out over ~1.4s
    a.t = Math.min(1, a.t + dt * 0.7);
    const k = a.t < 0.5
      ? 4 * a.t * a.t * a.t
      : 1 - Math.pow(-2 * a.t + 2, 3) / 2;
    camera.position.lerpVectors(a.from, a.to, k);
    camera.lookAt(0, 0, 0);
    if (a.t >= 1) animRef.current = null;
  });
  return null;
}
