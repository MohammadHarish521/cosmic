"use client";

import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";

import { EARTH_RADIUS_UNITS, KM_TO_UNITS, MISSION_EPOCH_MS } from "@/lib/constants";
import { FLEET } from "@/lib/fleet";
import { propagate, sampleOrbit } from "@/lib/orbits";
import { useSimTimeRef } from "@/state/mission-store";
import type { Satellite } from "@/lib/types";
import { createGlowTexture, createLabelTexture } from "./labelTexture";

const TRAIL_POINTS = 44;
const ORBIT_SEGMENTS = 320;

const TRAIL_VERTEX = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

const TRAIL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4( uColor, vAlpha * uOpacity );
  }
`;

interface ConstellationProps {
  selectedId: string | null;
  showOrbits: boolean;
  showTrails: boolean;
  showSatellites: boolean;
  showLabels: boolean;
  onSelect: (id: string) => void;
}

/**
 * Renders the simulated constellation: orbital tracks, motion trails,
 * satellite markers and on-globe labels.
 *
 * All per-frame work happens in a single `useFrame` pass writing straight
 * into object transforms, so the React tree never re-renders during motion.
 */
export function Constellation({
  selectedId,
  showOrbits,
  showTrails,
  showSatellites,
  showLabels,
  onSelect,
}: ConstellationProps) {
  const simTimeRef = useSimTimeRef();
  const camera = useThree((s) => s.camera);
  const viewport = useThree((s) => s.size);

  const groupRef = useRef<THREE.Group>(null);
  const markerRefs = useRef<(THREE.Group | null)[]>([]);
  const labelRefs = useRef<(THREE.Sprite | null)[]>([]);
  const trailRefs = useRef<(THREE.Line | null)[]>([]);
  const dropLineRef = useRef<THREE.Line>(null);
  const dropMarkerRef = useRef<THREE.Mesh>(null);

  // Static per-satellite data.
  const orbits = useMemo(
    () =>
      FLEET.map((sat) => {
        const raw = sampleOrbit(sat.element, ORBIT_SEGMENTS, KM_TO_UNITS);
        const points: [number, number, number][] = [];
        for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
          points.push([raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]]);
        }
        return { sat, points, raw };
      }),
    []
  );

  const labels = useMemo(
    () =>
      FLEET.map((sat) =>
        createLabelTexture({
          title: sat.name,
          subtitle: sat.id,
          accent: sat.accent,
        })
      ),
    []
  );

  const glow = useMemo(() => createGlowTexture("#ffffff", 1.1), []);
  const selectedGlow = useMemo(() => createGlowTexture("#4FE3FF", 1), []);

  // Trail geometry (one per satellite).
  const trailGeometries = useMemo(() => {
    return FLEET.map(() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3)
      );
      geo.setAttribute(
        "aAlpha",
        new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS), 1)
      );
      geo.setDrawRange(0, TRAIL_POINTS);
      return geo;
    });
  }, []);

  const trailMaterials = useMemo(
    () =>
      FLEET.map(
        (sat) =>
          new THREE.ShaderMaterial({
            vertexShader: TRAIL_VERTEX,
            fragmentShader: TRAIL_FRAGMENT,
            uniforms: {
              uColor: { value: new THREE.Color(sat.accent) },
              uOpacity: { value: 0.85 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
      ),
    []
  );

  const trailObjects = useMemo(
    () => FLEET.map((_, i) => new THREE.Line(trailGeometries[i], trailMaterials[i])),
    [trailGeometries, trailMaterials]
  );

  const dropGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    return geo;
  }, []);

  const dropMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#4FE3FF",
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  const dropLine = useMemo(
    () => new THREE.Line(dropGeometry, dropMaterial),
    [dropGeometry, dropMaterial]
  );

  const scratch = useMemo(
    () => ({
      satPos: new THREE.Vector3(),
      camDir: new THREE.Vector3(),
      seg: new THREE.Vector3(),
      closest: new THREE.Vector3(),
      labelScale: new THREE.Vector3(),
      screenUp: new THREE.Vector3(),
    }),
    []
  );

  const handleSelect = useCallback(
    (id: string) => (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onSelect(id);
    },
    [onSelect]
  );

  useFrame(() => {
    const t = simTimeRef.current;
    const aspect = viewport.height > 0 ? viewport.width / viewport.height : 1.6;
    const fovRad = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const tanHalf = Math.tan(fovRad / 2);

    for (let i = 0; i < FLEET.length; i++) {
      const sat: Satellite = FLEET[i];
      const state = propagate(sat.element, t, { epochMs: MISSION_EPOCH_MS });
      const x = state.render.x * KM_TO_UNITS;
      const y = state.render.z * KM_TO_UNITS;
      const z = state.render.y * KM_TO_UNITS;

      const marker = markerRefs.current[i];
      const camDist = camera.position.distanceTo(
        scratch.satPos.set(x, y, z)
      );
      // Apparent size of the marker is kept constant across zoom levels.
      const visibleHeight = 2 * camDist * tanHalf;
      const markerScale = (visibleHeight * 0.0042) / 0.05;

      if (marker) {
        marker.position.set(x, y, z);
        marker.scale.setScalar(Math.max(0.08, markerScale));
      }

      // --- label ------------------------------------------------------
      const label = labelRefs.current[i];
      if (label) {
        const visibleWidth = visibleHeight * aspect;
        const s = visibleWidth * 0.075;
        const labelAspect = (labels[i].userData.aspect as number) || 3.8;
        label.scale.set(s, s / labelAspect, 1);

        // Lift the label off the marker along the screen-up axis.
        scratch.screenUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        const lift = visibleHeight * 0.028;
        label.position.set(
          x + scratch.screenUp.x * lift,
          y + scratch.screenUp.y * lift,
          z + scratch.screenUp.z * lift
        );

        // Occlusion test against the globe.
        scratch.camDir.copy(camera.position);
        scratch.seg.set(x - camera.position.x, y - camera.position.y, z - camera.position.z);        const segLen2 = scratch.seg.lengthSq();
        const proj = -scratch.camDir.dot(scratch.seg) / segLen2;
        let occluded = false;
        if (proj > 0 && proj < 1) {
          scratch.closest
            .copy(camera.position)
            .addScaledVector(scratch.seg, proj);
          occluded = scratch.closest.length() < EARTH_RADIUS_UNITS;
        }
        const material = label.material as THREE.SpriteMaterial;
        const wanted = showLabels && !occluded ? 1 : 0;
        material.opacity += (wanted - material.opacity) * 0.25;
        label.visible = material.opacity > 0.02;
      }

      // --- trail ------------------------------------------------------
      const trail = trailRefs.current[i];
      if (trail) {
        const geo = trailGeometries[i];
        const pos = geo.getAttribute("position") as THREE.BufferAttribute;
        const alpha = geo.getAttribute("aAlpha") as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const alphaArr = alpha.array as Float32Array;

        const head = Math.round(
          (state.trueAnomalyDeg / 360) * ORBIT_SEGMENTS
        ) % ORBIT_SEGMENTS;
        const raw = orbits[i].raw;
        for (let p = 0; p < TRAIL_POINTS; p++) {
          const idx = (head - (TRAIL_POINTS - 1 - p) + ORBIT_SEGMENTS * 2) % ORBIT_SEGMENTS;
          arr[p * 3] = raw[idx * 3];
          arr[p * 3 + 1] = raw[idx * 3 + 1];
          arr[p * 3 + 2] = raw[idx * 3 + 2];
          const f = p / (TRAIL_POINTS - 1);
          alphaArr[p] = Math.pow(f, 2.1);
        }
        pos.needsUpdate = true;
        alpha.needsUpdate = true;
        geo.computeBoundingSphere();
      }
    }

    // --- selected drop line -------------------------------------------
    const selIndex = FLEET.findIndex((s) => s.id === selectedId);
    if (selIndex >= 0 && dropLineRef.current && dropMarkerRef.current) {
      const state = propagate(
        FLEET[selIndex].element,
        t,
        { epochMs: MISSION_EPOCH_MS }
      );
      const x = state.render.x * KM_TO_UNITS;
      const y = state.render.z * KM_TO_UNITS;
      const z = state.render.y * KM_TO_UNITS;
      const r = Math.hypot(x, y, z) || 1;
      const k = (EARTH_RADIUS_UNITS * 1.002) / r;

      const pos = dropGeometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      arr[0] = x;
      arr[1] = y;
      arr[2] = z;
      arr[3] = x * k;
      arr[4] = y * k;
      arr[5] = z * k;
      pos.needsUpdate = true;
      dropGeometry.computeBoundingSphere();
      dropMarkerRef.current.position.set(x * k, y * k, z * k);
    }
  });

  return (
    <group ref={groupRef}>
      {/* --- orbital tracks ------------------------------------------- */}
      {showOrbits &&
        orbits.map(({ sat, points }) => {
          const selected = sat.id === selectedId;
          return (
            <Line
              key={`orbit-${sat.id}`}
              points={points}
              color={sat.accent}
              lineWidth={selected ? 1.7 : 0.75}
              transparent
              opacity={selected ? 0.72 : 0.2}
              depthWrite={false}
              toneMapped={false}
            />
          );
        })}

      {/* --- motion trails -------------------------------------------- */}
      {showTrails &&
        FLEET.map((sat, i) => (
          <primitive
            key={`trail-${sat.id}`}
            object={trailObjects[i]}
            ref={(obj: THREE.Line | null) => {
              trailRefs.current[i] = obj;
            }}
          />
        ))}

      {/* --- satellite markers ---------------------------------------- */}
      {showSatellites &&
        FLEET.map((sat, i) => {
          const selected = sat.id === selectedId;
          return (
            <group
              key={`marker-${sat.id}`}
              ref={(obj) => {
                markerRefs.current[i] = obj;
              }}
            >
              <mesh
                onPointerDown={handleSelect(sat.id)}
                onPointerOver={() => {
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  document.body.style.cursor = "";
                }}
              >
                <octahedronGeometry args={[selected ? 0.075 : 0.05, 0]} />
                <meshBasicMaterial color={sat.accent} toneMapped={false} />
              </mesh>

              <sprite scale={[0.85, 0.85, 1]}>
                <spriteMaterial
                  map={glow}
                  color={sat.accent}
                  transparent
                  opacity={selected ? 0.95 : 0.6}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                  toneMapped={false}
                />
              </sprite>

              {selected && (
                <>
                  <sprite scale={[2.1, 2.1, 1]}>
                    <spriteMaterial
                      map={selectedGlow}
                      color="#4FE3FF"
                      transparent
                      opacity={0.45}
                      depthWrite={false}
                      blending={THREE.AdditiveBlending}
                      toneMapped={false}
                    />
                  </sprite>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.16, 0.185, 48]} />
                    <meshBasicMaterial
                      color="#4FE3FF"
                      transparent
                      opacity={0.9}
                      side={THREE.DoubleSide}
                      toneMapped={false}
                    />
                  </mesh>
                </>
              )}
            </group>
          );
        })}

      {/* --- on-globe labels ------------------------------------------ */}
      {showLabels &&
        FLEET.map((sat, i) => (
          <sprite
            key={`label-${sat.id}`}
            ref={(obj) => {
              labelRefs.current[i] = obj;
            }}
          >
            <spriteMaterial
              map={labels[i]}
              transparent
              opacity={0}
              depthTest={false}
              depthWrite={false}
              sizeAttenuation
              toneMapped={false}
            />
          </sprite>
        ))}

      {/* --- ground track drop line for the focused satellite --------- */}
      {selectedId && showSatellites && (
        <>
          <primitive
            object={dropLine}
            ref={(obj: THREE.Line | null) => {
              dropLineRef.current = obj;
            }}
          />
          <mesh ref={dropMarkerRef} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.05, 0.062, 32]} />
            <meshBasicMaterial
              color="#4FE3FF"
              transparent
              opacity={0.75}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
