"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { EARTH_RADIUS_UNITS, MISSION_EPOCH_MS } from "@/lib/constants";
import { eciToRender, sunDirectionEci } from "@/lib/orbits";
import { useSimTimeRef } from "@/state/mission-store";

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vNormalW = normalize( mat3( modelMatrix ) * normal );
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vPosW = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uRimColor;
  uniform vec3 uSunsetColor;
  uniform float uStrength;
  uniform float uPower;
  uniform float uSunset;

  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 viewDir = normalize( cameraPosition - vPosW );
    float facing = clamp( dot( vNormalW, viewDir ), 0.0, 1.0 );
    float rim = pow( 1.0 - facing, uPower );

    float sunFacing = clamp( dot( vNormalW, uSunDir ), -1.0, 1.0 );
    float lit = pow( max( sunFacing, 0.0 ), 1.4 );
    // Warm band along the terminator where the atmosphere scatters low sun.
    float terminator = pow( 1.0 - abs( sunFacing ), 7.0 );

    vec3 color = mix( uRimColor, uSunsetColor, clamp( lit * 0.32 + terminator * uSunset * 0.55, 0.0, 1.0 ) );
    float intensity = rim * ( 0.16 + 1.0 * lit + terminator * 0.45 );

    gl_FragColor = vec4( color * intensity * uStrength, 1.0 );
  }
`;

interface AtmosphereProps {
  /** Overall opacity of the atmospheric shell. */
  strength?: number;
}

/**
 * Two-layer atmospheric scattering shell.
 * The inner layer hugs the limb, the outer layer provides the wide halo.
 */
export function Atmosphere({ strength = 1 }: AtmosphereProps) {
  const simTimeRef = useSimTimeRef();
  const innerRef = useRef<THREE.ShaderMaterial>(null);
  const outerRef = useRef<THREE.ShaderMaterial>(null);

  const sunWorld = useMemo(() => new THREE.Vector3(), []);

  const makeUniforms = (power: number, intensity: number, sunset: number) => ({
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    uRimColor: { value: new THREE.Color("#48b4ff") },
    uSunsetColor: { value: new THREE.Color("#ff8f3a") },
    uStrength: { value: intensity },
    uPower: { value: power },
    uSunset: { value: sunset },
  });

  const innerUniforms = useMemo(() => makeUniforms(3.1, 1.5 * strength, 0.9), [strength]);
  const outerUniforms = useMemo(() => makeUniforms(1.6, 0.3 * strength, 0.35), [strength]);

  useFrame(() => {
    const eci = sunDirectionEci(simTimeRef.current);
    const r = eciToRender(eci);
    sunWorld.set(r.x, r.y, r.z).normalize();
    innerUniforms.uSunDir.value.copy(sunWorld);
    outerUniforms.uSunDir.value.copy(sunWorld);
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_UNITS * 1.022, 96, 64]} />
        <shaderMaterial
          ref={innerRef}
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={innerUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_UNITS * 1.115, 64, 48]} />
        <shaderMaterial
          ref={outerRef}
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={outerUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
