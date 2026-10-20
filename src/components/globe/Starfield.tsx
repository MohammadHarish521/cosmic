"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { createRng } from "@/lib/rng";

interface StarfieldProps {
  /** 0..1 — how bright the field renders. */
  intensity?: number;
}

const STAR_VERTEX = /* glsl */ `
  attribute float size;
  attribute float phase;
  attribute vec3 tint;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vTint;
  varying float vTwinkle;

  void main() {
    vTint = tint;
    vTwinkle = 0.72 + 0.28 * sin(uTime * 1.4 + phase * 6.2831);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uPixelRatio * (1650.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.02, d);
    alpha *= alpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vTint * vTwinkle * 1.45, alpha);
  }
`;

/**
 * Deep-space backdrop: a deterministic star field with a faint galactic band.
 * Rendered additively so it layers cleanly behind the globe.
 */
export function Starfield({ intensity = 1 }: StarfieldProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const rng = createRng("aether:starfield");
    const count = 2600;
    const bandCount = 1500;

    const positions = new Float32Array((count + bandCount) * 3);
    const sizes = new Float32Array(count + bandCount);
    const phases = new Float32Array(count + bandCount);
    const tints = new Float32Array((count + bandCount) * 3);

    const radius = 520;

    const push = (i: number, x: number, y: number, z: number, size: number) => {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sizes[i] = size;
      phases[i] = rng.next();
      // Stellar colour spread: mostly white with blue and amber outliers.
      const roll = rng.next();
      const warm = new THREE.Color("#ffd8b0");
      const cool = new THREE.Color("#bcd4ff");
      const white = new THREE.Color("#ffffff");
      const color = roll > 0.88 ? warm : roll < 0.82 ? cool : white;
      tints[i * 3] = color.r;
      tints[i * 3 + 1] = color.g;
      tints[i * 3 + 2] = color.b;
    };

    for (let i = 0; i < count; i++) {
      const u = rng.next() * 2 - 1;
      const theta = rng.next() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const mag = Math.pow(rng.next(), 3.2);
      push(
        i,
        radius * s * Math.cos(theta),
        radius * u,
        radius * s * Math.sin(theta),
        0.8 + mag * 2.1
      );
    }

    // Galactic band: concentrate faint stars near a tilted great circle.
    const bandNormal = new THREE.Vector3(0.32, 0.86, -0.4).normalize();
    for (let i = count; i < count + bandCount; i++) {
      const v = new THREE.Vector3();
      let guard = 0;
      do {
        v.set(rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1);
        guard++;
      } while (v.length() === 0 || guard < 4);
      v.normalize();
      // Pull toward the band plane.
      const d = v.dot(bandNormal);
      v.addScaledVector(bandNormal, -d * rng.range(0.72, 0.97)).normalize();
      const mag = Math.pow(rng.next(), 2.1);
      push(i, v.x * radius, v.y * radius, v.z * radius, 0.5 + mag * 1.1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("tint", new THREE.BufferAttribute(tints, 3));
    return geo;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1) },
    }),
    []
  );

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      materialRef.current.opacity = intensity;
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={STAR_VERTEX}
        fragmentShader={STAR_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
