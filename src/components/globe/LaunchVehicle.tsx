"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { MISSION_EPOCH_MS } from "@/lib/constants";
import { launchStateAt, sampleAscentPath } from "@/lib/launch";
import { useSimTimeRef } from "@/state/mission-store";
import { createGlowTexture } from "./labelTexture";

const UP = new THREE.Vector3(0, 1, 0);

/**
 * The booster is ~70 m tall, which is sub-pixel at this scale (1 unit =
 * 1000 km). It is drawn at an exaggerated scale so the ascent reads
 * clearly on screen.
 */
const VEHICLE_SCALE = 0.17;

const PATH_VERTEX = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

const PATH_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4( uColor, vAlpha * uOpacity );
  }
`;

interface LaunchVehicleProps {
  /** Simulated metres per render unit — the vehicle is exaggerated for legibility. */
  visible?: boolean;
}

/**
 * The launch vehicle and its ascent trail.
 *
 * The stack is drawn at an exaggerated scale (a 70 m booster would be
 * sub-pixel at this zoom) and oriented along its computed flight path.
 */
export function LaunchVehicle({ visible = true }: LaunchVehicleProps) {
  const simTimeRef = useSimTimeRef();
  const groupRef = useRef<THREE.Group>(null);
  const plumeRef = useRef<THREE.Mesh>(null);
  const plumeGlowRef = useRef<THREE.Sprite>(null);
  const engineRef = useRef<THREE.Mesh>(null);
  const pathRef = useRef<THREE.Line>(null);

  const glow = useMemo(() => createGlowTexture("#FFB877", 0.9), []);
  const cyanGlow = useMemo(() => createGlowTexture("#7FE0FF", 1), []);

  const pathGeometry = useMemo(() => {
    const samples = 260;
    const raw = sampleAscentPath(samples);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(raw, 3));
    geo.setAttribute(
      "aAlpha",
      new THREE.BufferAttribute(new Float32Array(samples), 1)
    );
    return geo;
  }, []);

  const pathMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PATH_VERTEX,
        fragmentShader: PATH_FRAGMENT,
        uniforms: {
          uColor: { value: new THREE.Color("#FFB020") },
          uOpacity: { value: 0.9 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  const pathLine = useMemo(
    () => new THREE.Line(pathGeometry, pathMaterial),
    [pathGeometry, pathMaterial]
  );

  const scratch = useMemo(
    () => ({
      heading: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
    }),
    []
  );

  useFrame(() => {
    const t = simTimeRef.current;
    const s = launchStateAt(t);

    if (groupRef.current) {
      groupRef.current.position.set(s.position.x, s.position.y, s.position.z);
      groupRef.current.scale.setScalar(VEHICLE_SCALE);
      scratch.heading.set(s.heading.x, s.heading.y, s.heading.z).normalize();
      scratch.quaternion.setFromUnitVectors(UP, scratch.heading);
      groupRef.current.quaternion.copy(scratch.quaternion);
      groupRef.current.visible = visible && s.progress < 1.06;
    }

    const throttle = s.throttle;
    if (plumeRef.current) {
      const scale = 0.25 + throttle * 1.15;
      plumeRef.current.scale.set(0.55 + throttle * 0.55, scale, 0.55 + throttle * 0.55);
      (plumeRef.current.material as THREE.MeshBasicMaterial).opacity = 0.22 + throttle * 0.6;
    }
    if (plumeGlowRef.current) {
      const scale = 0.18 + throttle * 0.5;
      plumeGlowRef.current.scale.set(scale, scale, 1);
      (plumeGlowRef.current.material as THREE.SpriteMaterial).opacity = 0.2 + throttle * 0.75;
    }
    if (engineRef.current) {
      (engineRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + throttle * 0.65;
    }

    // Ascent trail: a short bright segment trailing the vehicle.
    const alpha = pathGeometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const arr = alpha.array as Float32Array;
    const count = arr.length;
    const head = s.progress * (count - 1);
    for (let i = 0; i < count; i++) {
      const behind = head - i;
      arr[i] = behind < 0 ? 0 : Math.min(1, behind / 26) * 0.9;
    }
    alpha.needsUpdate = true;
  });

  return (
    <group>
      <group ref={groupRef}>
        {/* --- first stage ------------------------------------------- */}
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.028, 0.03, 0.2, 24]} />
          <meshStandardMaterial color="#d7dde5" roughness={0.42} metalness={0.35} />
        </mesh>
        {/* interstage */}
        <mesh position={[0, 0.145, 0]}>
          <cylinderGeometry args={[0.026, 0.028, 0.03, 24]} />
          <meshStandardMaterial color="#1b222b" roughness={0.7} metalness={0.2} />
        </mesh>
        {/* --- second stage ------------------------------------------ */}
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.023, 0.026, 0.12, 24]} />
          <meshStandardMaterial color="#eef2f6" roughness={0.35} metalness={0.3} />
        </mesh>
        {/* payload fairing */}
        <mesh position={[0, 0.32, 0]}>
          <coneGeometry args={[0.023, 0.08, 24]} />
          <meshStandardMaterial color="#f2f5f8" roughness={0.3} metalness={0.25} />
        </mesh>
        {/* engine bell */}
        <mesh ref={engineRef} position={[0, -0.085, 0]}>
          <coneGeometry args={[0.017, 0.05, 20, 1, true]} />
          <meshBasicMaterial
            color="#ffcf8a"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        {/* fins */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.032, -0.045, Math.sin(angle) * 0.032]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[0.006, 0.06, 0.022]} />
              <meshStandardMaterial color="#c7ced6" roughness={0.5} metalness={0.3} />
            </mesh>
          );
        })}
        {/* plume */}
        <mesh ref={plumeRef} position={[0, -0.22, 0]}>
          <coneGeometry args={[0.03, 0.34, 20, 1, true]} />
          <meshBasicMaterial
            color="#ffa552"
            transparent
            opacity={0.5}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <sprite ref={plumeGlowRef} position={[0, -0.1, 0]} scale={[0.3, 0.3, 1]}>
          <spriteMaterial
            map={glow}
            color="#ffb066"
            transparent
            opacity={0.8}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      </group>

      {/* ascent trail */}
      <primitive object={pathLine} ref={pathRef} />

      {/* launch complex glow at the pad */}
      <LaunchPadGlow />
    </group>
  );
}

function LaunchPadGlow() {
  const ref = useRef<THREE.Sprite>(null);
  const glow = useMemo(() => createGlowTexture("#7FE0FF", 1.2), []);
  const simTimeRef = useSimTimeRef();

  useFrame(() => {
    const s = launchStateAt(simTimeRef.current);
    if (ref.current) {
      ref.current.visible = s.progress < 0.02;
      const pulse = 0.22 + Math.sin(performance.now() / 420) * 0.05;
      (ref.current.material as THREE.SpriteMaterial).opacity = pulse;
    }
  });

  const pad = useMemo(() => {
    const s = launchStateAt(MISSION_EPOCH_MS);
    return s.position;
  }, []);

  return (
    <sprite ref={ref} position={[pad.x, pad.y, pad.z]} scale={[0.14, 0.14, 1]}>
      <spriteMaterial
        map={glow}
        color="#7FE0FF"
        transparent
        opacity={0.25}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </sprite>
  );
}
