"use client";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useAtlas } from "@/lib/store";
import type { InfrastructureService, VultrInstance } from "@/lib/types";

const RACK_W = 0.62;
const RACK_D = 1.02;
const RACK_H = 2.25;
const SLOT_COUNT = 8;
const ROW_GAP = 1.95;
const RACK_GAP = 0.16;

function healthColor(health?: string, temp?: number) {
  if (health === "degraded") return "#f87171";
  if (health === "maintenance") return "#a78bfa";
  if (health === "watch") return "#fbbf24";
  if (temp && temp > 75) return "#f87171";
  if (temp && temp > 62) return "#fbbf24";
  return "#34d399";
}

function ServerUnit({ instance, y, selected, onClick }: { instance: VultrInstance; y: number; selected: boolean; onClick: () => void }) {
  const material = useRef<THREE.MeshStandardMaterial>(null!);
  const led = useRef<THREE.Mesh>(null!);
  const color = healthColor(instance.health, instance.temp_c);

  useFrame((state) => {
    const cpuPulse = 0.2 + ((instance.cpu ?? 20) / 100) * 0.85;
    if (material.current) material.current.emissiveIntensity = cpuPulse + Math.sin(state.clock.elapsedTime * 3 + y) * 0.06;
    if (led.current) (led.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(state.clock.elapsedTime * 5 + y) * 0.5;
  });

  return (
    <group position={[0, y, 0]} onClick={onClick}>
      <mesh castShadow>
        <boxGeometry args={[RACK_W * 0.9, 0.18, RACK_D * 0.9]} />
        <meshStandardMaterial ref={material} color="#0a1329" emissive={color} metalness={0.62} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0, RACK_D * 0.46]}>
        <boxGeometry args={[RACK_W * 0.78, 0.13, 0.025]} />
        <meshStandardMaterial color="#1d3a72" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh ref={led} position={[RACK_W * 0.36, 0, RACK_D * 0.49]}>
        <sphereGeometry args={[0.013, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} toneMapped={false} />
      </mesh>
      {selected && (
        <mesh>
          <boxGeometry args={[RACK_W, 0.23, RACK_D]} />
          <meshBasicMaterial color="#a78bfa" wireframe />
        </mesh>
      )}
      {(instance.health === "degraded" || instance.health === "watch") && (
        <Html center distanceFactor={7} position={[0, 0.22, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded border border-warn/50 bg-bg/80 px-1.5 py-0.5 font-mono text-[9px] uppercase text-warn backdrop-blur">
            {instance.health}
          </div>
        </Html>
      )}
    </group>
  );
}

function Rack({ x, z, row, instances, rackIndex, selectedId, onPick }: { x: number; z: number; row: number; instances: VultrInstance[]; rackIndex: number; selectedId: string | null; onPick: (id: string) => void }) {
  const slotH = (RACK_H - 0.28) / SLOT_COUNT;
  const avgTemp = instances.length ? instances.reduce((sum, item) => sum + (item.temp_c ?? 0), 0) / instances.length : 0;
  const statusColor = healthColor(instances.some((item) => item.health === "degraded") ? "degraded" : instances.some((item) => item.health === "watch") ? "watch" : "ok", avgTemp);

  return (
    <group position={[x, 0, z]} rotation={[0, row === 0 ? 0 : Math.PI, 0]}>
      <mesh position={[0, RACK_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[RACK_W, RACK_H, RACK_D]} />
        <meshStandardMaterial color="#070b14" metalness={0.76} roughness={0.48} transparent opacity={0.62} />
      </mesh>
      <mesh position={[0, RACK_H / 2, 0]}>
        <boxGeometry args={[RACK_W * 1.002, RACK_H * 1.002, RACK_D * 1.002]} />
        <meshBasicMaterial color="#24477c" wireframe transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, RACK_H + 0.025, 0]}>
        <boxGeometry args={[RACK_W * 0.92, 0.04, RACK_D * 0.92]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.55} toneMapped={false} />
      </mesh>
      <Html center distanceFactor={6} position={[0, RACK_H + 0.2, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded border border-line bg-panel/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent backdrop-blur">
          R{String(rackIndex + 1).padStart(2, "0")} · {instances.length}/{SLOT_COUNT} · {avgTemp ? `${avgTemp.toFixed(0)}°C` : "thermal N/A"}
        </div>
      </Html>
      {Array.from({ length: SLOT_COUNT }).map((_, index) => {
        const instance = instances[index];
        const y = 0.18 + index * slotH + slotH / 2;
        if (!instance) {
          return (
            <mesh key={`empty-${index}`} position={[0, y, 0]}>
              <boxGeometry args={[RACK_W * 0.88, slotH * 0.82, RACK_D * 0.88]} />
              <meshStandardMaterial color="#0a0f1c" metalness={0.7} roughness={0.76} />
            </mesh>
          );
        }
        return <ServerUnit key={instance.id} instance={instance} y={y} selected={instance.id === selectedId} onClick={() => onPick(instance.id)} />;
      })}
    </group>
  );
}

function ServicePod({ service, position, target, degraded }: { service: InfrastructureService; position: [number, number, number]; target: [number, number, number]; degraded: boolean }) {
  const color = healthColor(service.health);
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y += 0.006 + Math.sin(state.clock.elapsedTime) * 0.001;
  });
  return (
    <group position={position}>
      <mesh ref={ref} castShadow>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#0b1020" emissive={color} emissiveIntensity={0.75} metalness={0.6} roughness={0.32} />
      </mesh>
      <Line from={[0, 0, 0]} to={[target[0] - position[0], target[1] - position[1], target[2] - position[2]]} color={degraded ? "#f87171" : color} dashed={degraded} />
      <Html center distanceFactor={7} position={[0, 0.36, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded border border-line bg-panel/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-gray-200 backdrop-blur">
          {service.kind.replace(/_/g, " ")} · {service.health}
        </div>
      </Html>
    </group>
  );
}

function Line({ from, to, color, dashed }: { from: [number, number, number]; to: [number, number, number]; color: string; dashed?: boolean }) {
  const points = useMemo(() => [new THREE.Vector3(...from), new THREE.Vector3(...to)], [from, to]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const line = useMemo(
    () => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: dashed ? 0.85 : 0.5 })),
    [color, dashed, geometry],
  );
  return <primitive object={line} />;
}

function CRACUnit({ x }: { x: number }) {
  const fan = useRef<THREE.Mesh>(null!);
  useFrame((_state, delta) => {
    if (fan.current) fan.current.rotation.z += delta * 7;
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1.22, 2, 1]} />
        <meshStandardMaterial color="#0a1226" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh ref={fan} position={[0, 1.38, 0.52]}>
        <torusGeometry args={[0.25, 0.045, 8, 18]} />
        <meshStandardMaterial color="#5eead4" emissive="#5eead4" emissiveIntensity={0.65} />
      </mesh>
      <Html center distanceFactor={7} position={[0, 2.22, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded border border-line bg-panel/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent2 backdrop-blur">
          cooling system
        </div>
      </Html>
    </group>
  );
}

function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 42, 40, 40]} />
        <meshStandardMaterial color="#060a13" metalness={0.42} roughness={0.82} />
      </mesh>
      <gridHelper args={[42, 42, "#1d3a72", "#0d1730"]} position={[0, 0.005, 0]} />
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, ROW_GAP * 0.82]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

export function Datacenter() {
  const { regions, instances, services, selectedRegion, selectedInstance, selectInstance, regionStatus, maintenanceEvents } = useAtlas();
  const region = regions.find((item) => item.id === selectedRegion) ?? regions[0];
  const regionId = region?.id;
  const zoneInstances = useMemo(() => (regionId ? instances.filter((item) => item.region === regionId) : []), [instances, regionId]);
  const zoneServices = useMemo(() => services.filter((service) => service.kind !== "instance" && (!service.region || service.region === regionId)).slice(0, 8), [services, regionId]);
  const zoneStatus = regionStatus.find((item) => item.region_id === regionId);
  const zoneEvents = maintenanceEvents.filter((event) => event.region_id === regionId);

  const rackCount = Math.ceil(zoneInstances.length / SLOT_COUNT);
  const racksPerRow = Math.max(1, Math.ceil(rackCount / 2));
  const rowSpan = Math.max(2.2, racksPerRow * (RACK_W + RACK_GAP));
  const racks = useMemo(() => {
    return Array.from({ length: rackCount }).map((_, index) => {
      const row = index < racksPerRow ? 0 : 1;
      const column = index - row * racksPerRow;
      const x = -rowSpan / 2 + column * (RACK_W + RACK_GAP) + RACK_W / 2;
      const z = row === 0 ? -ROW_GAP / 2 - RACK_D / 2 : ROW_GAP / 2 + RACK_D / 2;
      return { x, z, row, instances: zoneInstances.slice(index * SLOT_COUNT, index * SLOT_COUNT + SLOT_COUNT), index };
    });
  }, [rackCount, racksPerRow, rowSpan, zoneInstances]);

  const centerTarget: [number, number, number] = [0, 1.25, 0];

  return (
    <Canvas shadows camera={{ position: [5.3, 3.5, 6.4], fov: 38 }} dpr={[1, 2]}>
      <color attach="background" args={["#03050a"]} />
      <fog attach="fog" args={["#03050a", 9, 24]} />
      <ambientLight intensity={0.34} />
      <directionalLight position={[6, 8, 5]} intensity={0.75} castShadow />
      <pointLight position={[0, 4, 0]} intensity={0.8} color="#5eead4" />
      <pointLight position={[-4, 3, 1.5]} intensity={0.4} color="#a78bfa" />

      <Floor />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={22} blur={2.6} far={4} />
      {rackCount > 0 && <CRACUnit x={-rowSpan / 2 - 1.25} />}
      {rackCount > 0 && <CRACUnit x={rowSpan / 2 + 1.25} />}

      {racks.map((rack) => (
        <Rack key={rack.index} x={rack.x} z={rack.z} row={rack.row} instances={rack.instances} rackIndex={rack.index} selectedId={selectedInstance} onPick={(id) => selectInstance(id === selectedInstance ? null : id)} />
      ))}

      {zoneServices.map((service, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const lane = Math.floor(index / 2);
        const position: [number, number, number] = [side * (rowSpan / 2 + 2.3), 1.05 + lane * 0.34, -1.4 + lane * 0.78];
        return <ServicePod key={service.id} service={service} position={position} target={centerTarget} degraded={service.health !== "ok" || zoneStatus?.status === "planned" || zoneStatus?.status === "degraded"} />;
      })}

      {rackCount === 0 && zoneServices.length === 0 && (
        <Html center distanceFactor={5} position={[0, 1.6, 0]} style={{ pointerEvents: "none" }}>
          <div className="max-w-sm rounded-lg border border-warn/40 bg-panel/85 p-4 text-center backdrop-blur">
            <div className="font-mono text-[10px] uppercase tracking-widest text-warn">No real assets loaded</div>
            <div className="mt-1 text-sm font-semibold text-gray-100">Connect VULTR_API_KEY to render account infrastructure</div>
            <div className="mt-2 text-[11px] leading-relaxed text-gray-400">Atlas is not drawing placeholder racks, services or servers.</div>
          </div>
        </Html>
      )}

      {rackCount > 0 && (
        <>
          <mesh position={[0, RACK_H + 0.52, -ROW_GAP / 2 - RACK_D / 2]}>
            <boxGeometry args={[rowSpan + 0.5, 0.055, 0.08]} />
            <meshStandardMaterial color="#1d3a72" emissive="#5eead4" emissiveIntensity={0.45} />
          </mesh>
          <mesh position={[0, RACK_H + 0.52, ROW_GAP / 2 + RACK_D / 2]}>
            <boxGeometry args={[rowSpan + 0.5, 0.055, 0.08]} />
            <meshStandardMaterial color="#1d3a72" emissive="#5eead4" emissiveIntensity={0.45} />
          </mesh>
        </>
      )}

      <Html center distanceFactor={6} position={[0, RACK_H + 1.22, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded-md border border-accent/40 bg-panel/85 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent backdrop-blur">
          {region?.city ?? "Zone"} · {zoneInstances.length} servers · {zoneServices.length} services · {zoneStatus?.status ?? "unknown"}
        </div>
      </Html>

      {zoneEvents.length > 0 && (
        <Html center distanceFactor={6} position={[0, RACK_H + 0.82, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded-md border border-warn/50 bg-warn/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-warn backdrop-blur">
            maintenance window · {zoneEvents[0].id}
          </div>
        </Html>
      )}

      <OrbitControls target={[0, 1, 0]} enablePan minDistance={3} maxDistance={20} maxPolarAngle={Math.PI / 2.08} />
      <Environment preset="city" />
    </Canvas>
  );
}
