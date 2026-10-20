"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { EARTH_RADIUS_UNITS, KM_TO_UNITS, MISSION_EPOCH_MS } from "@/lib/constants";
import { GROUND_STATIONS } from "@/lib/fleet";
import { gmstDeg, latLonToRender } from "@/lib/orbits";
import { useSimTimeRef } from "@/state/mission-store";
import type { Vec3 } from "@/lib/types";
import { createGlowTexture, createLabelTexture } from "./labelTexture";

interface GroundStationsProps {
  showLabels?: boolean;
}

/**
 * Tracking stations, fixed to the rotating Earth.
 */
export function GroundStations({ showLabels = true }: GroundStationsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const labelRefs = useRef<(THREE.Sprite | null)[]>([]);
  const simTimeRef = useSimTimeRef();
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const glow = useMemo(() => createGlowTexture("#8FE9FF", 1.2), []);
  const labels = useMemo(
    () =>
      GROUND_STATIONS.map((gs) =>
        createLabelTexture({ title: gs.name, subtitle: gs.code, accent: "#8FE9FF", dim: true })
      ),
    []
  );

  const positions = useMemo(
    () =>
      GROUND_STATIONS.map((gs) => {
        const v = latLonToRender(gs.lat, gs.lon);
        const r = EARTH_RADIUS_UNITS * 1.003;
        return [v.x * r, v.y * r, v.z * r] as [number, number, number];
      }),
    []
  );

  useFrame(() => {
    if (!groupRef.current) return;
    const theta =
      ((gmstDeg(simTimeRef.current) - gmstDeg(MISSION_EPOCH_MS)) * Math.PI) / 180;
    groupRef.current.rotation.y = -theta;

    if (!showLabels) return;
    const aspect = viewport.height > 0 ? viewport.width / viewport.height : 1.6;
    const tanHalf = Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    for (let i = 0; i < GROUND_STATIONS.length; i++) {
      const sprite = labelRefs.current[i];
      if (!sprite) continue;
      sprite.getWorldPosition(tmp);
      const dist = camera.position.distanceTo(tmp);
      const visibleWidth = 2 * dist * tanHalf * aspect;
      const s = visibleWidth * 0.042;
      const labelAspect = (labels[i].userData.aspect as number) || 4;
      sprite.scale.set(s, s / labelAspect, 1);
    }
  });

  return (
    <group ref={groupRef}>
      {GROUND_STATIONS.map((gs, i) => (
        <group key={gs.id} position={positions[i]}>
          <mesh>
            <sphereGeometry args={[0.022, 12, 12]} />
            <meshBasicMaterial color="#9FF0FF" toneMapped={false} />
          </mesh>
          <sprite scale={[0.16, 0.16, 1]}>
            <spriteMaterial
              map={glow}
              color="#7FE4FF"
              transparent
              opacity={0.55}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          {showLabels && (
            <sprite
              ref={(obj) => {
                labelRefs.current[i] = obj;
              }}
              position={[0.1, 0.055, 0]}
              scale={[0.17, 0.05, 1]}
            >
              <spriteMaterial
                map={labels[i]}
                transparent
                opacity={0.75}
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          )}
        </group>
      ))}
    </group>
  );
}

interface LatLonGridProps {
  /** 0 = invisible, 1 = full. */
  opacity?: number;
}

/**
 * Earth-fixed graticule. Rotates with the surface, matching the ground
 * stations and giving the globe a sense of scale.
 */
export function LatLonGrid({ opacity = 0.16 }: LatLonGridProps) {
  const groupRef = useRef<THREE.Group>(null);
  const simTimeRef = useSimTimeRef();

  const geometry = useMemo(() => {
    const r = EARTH_RADIUS_UNITS * 1.0015;
    const points: number[] = [];
    const push = (a: Vec3, b: Vec3) => {
      points.push(a.x * r, a.y * r, a.z * r, b.x * r, b.y * r, b.z * r);
    };

    // Meridians
    for (let lon = 0; lon < 180; lon += 30) {
      const rad = (lon * Math.PI) / 180;
      let prev = latLonToRender(-90, lon);
      for (let lat = -90; lat <= 90; lat += 5) {
        const cur = latLonToRender(lat, lon);
        push(prev, cur);
        prev = cur;
      }
    }
    // Parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      let prev = latLonToRender(lat, 0);
      for (let lon = 0; lon <= 360; lon += 5) {
        const cur = latLonToRender(lat, lon);
        push(prev, cur);
        prev = cur;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const theta =
      ((gmstDeg(simTimeRef.current) - gmstDeg(MISSION_EPOCH_MS)) * Math.PI) / 180;
    groupRef.current.rotation.y = -theta;
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color="#4FE3FF"
          transparent
          opacity={opacity}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}

export const GROUND_STATION_KM_SCALE = KM_TO_UNITS;
