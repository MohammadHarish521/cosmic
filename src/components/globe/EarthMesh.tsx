"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

import { EARTH_RADIUS_UNITS, MISSION_EPOCH_MS } from "@/lib/constants";
import { eciToRender, gmstDeg, sunDirectionEci } from "@/lib/orbits";
import { useSimTimeRef } from "@/state/mission-store";

interface EarthMeshProps {
  showClouds?: boolean;
  showNightLights?: boolean;
}

/**
 * The globe.
 *
 * A standard PBR material is patched at compile time so that:
 *  - ocean surfaces pick up a specular sheen (roughness driven by the
 *    water mask) while land stays matte;
 *  - city lights only emit on the night side of the terminator.
 */
export function EarthMesh({ showClouds = true, showNightLights = true }: EarthMeshProps) {
  const [dayMap, normalMap, specMap, nightMap, cloudMap] = useTexture([
    "/textures/earth_atmos_2048.jpg",
    "/textures/earth_normal_2048.jpg",
    "/textures/earth_specular_2048.jpg",
    "/textures/earth_lights_2048.png",
    "/textures/earth_clouds_1024.png",
  ]);

  const meshRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const shaderRef = useRef<{ uniforms: Record<string, THREE.IUniform> } | null>(null);
  const simTimeRef = useSimTimeRef();

  useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = 8;
    normalMap.anisotropy = 4;
    return null;
  }, [dayMap, nightMap, normalMap]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: dayMap,
      normalMap,
      roughness: 0.9,
      metalness: 0.06,
      emissiveMap: nightMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1,
    });
    mat.normalScale.set(0.9, 0.9);

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSunView = { value: new THREE.Vector3(1, 0, 0) };
      shader.uniforms.uSpecMap = { value: specMap };
      shader.fragmentShader =
        "uniform vec3 uSunView;\nuniform sampler2D uSpecMap;\n" + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float oceanMask = texture2D( uSpecMap, vMapUv ).g;
        roughnessFactor = mix( 0.95, 0.24, oceanMask );`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float sunFacing = dot( normalize( normal ), uSunView );
        float nightMask = smoothstep( 0.18, -0.14, sunFacing );
        totalEmissiveRadiance *= ( 0.04 + 1.55 * nightMask );`
      );

      shaderRef.current = shader as unknown as {
        uniforms: Record<string, THREE.IUniform>;
      };
    };

    return mat;
  }, [dayMap, normalMap, specMap, nightMap]);

  const cloudMaterial = useMemo(() => {
    // The source cloud plate is a hard 1-bit mask, so the alpha is softened
    // before use and lit with a simple terminator term.
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: cloudMap },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uOpacity: { value: 0.58 },
        uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        void main() {
          vUv = uv;
          vNormalW = normalize( mat3( modelMatrix ) * normal );
          vec4 wp = modelMatrix * vec4( position, 1.0 );
          vPosW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uSunDir;
        uniform float uOpacity;
        uniform vec2 uTexel;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;

        // The source cloud plate is a hard 1-bit mask, so it is resampled
        // with a small multi-tap blur to recover soft edges.
        float density( vec2 uv ) {
          vec4 sum = texture2D( uMap, uv ) * 0.36;
          sum += texture2D( uMap, uv + vec2( uTexel.x, 0.0 ) * 1.6 ) * 0.11;
          sum += texture2D( uMap, uv - vec2( uTexel.x, 0.0 ) * 1.6 ) * 0.11;
          sum += texture2D( uMap, uv + vec2( 0.0, uTexel.y ) * 1.6 ) * 0.11;
          sum += texture2D( uMap, uv - vec2( 0.0, uTexel.y ) * 1.6 ) * 0.11;
          sum += texture2D( uMap, uv + uTexel * 2.4 ) * 0.05;
          sum += texture2D( uMap, uv - uTexel * 2.4 ) * 0.05;
          sum += texture2D( uMap, uv + vec2( uTexel.x, -uTexel.y ) * 2.4 ) * 0.05;
          sum += texture2D( uMap, uv + vec2( -uTexel.x, uTexel.y ) * 2.4 ) * 0.05;
          return sum.g;
        }

        void main() {
          float d = density( vUv );
          float a = smoothstep( 0.30, 0.72, d );
          if ( a < 0.004 ) discard;
          float ndl = dot( normalize( vNormalW ), uSunDir );
          float daylight = smoothstep( -0.22, 0.32, ndl );
          vec3 lit = vec3( 0.97, 0.985, 1.0 ) * ( 0.06 + 0.98 * daylight );
          float twilight = pow( 1.0 - abs( ndl ), 8.0 );
          lit += vec3( 1.0, 0.55, 0.26 ) * twilight * 0.8;
          gl_FragColor = vec4( lit, a * uOpacity );
        }
      `,
    });
    return mat;
  }, [cloudMap]);

  const sunWorld = useMemo(() => new THREE.Vector3(), []);
  const sunView = useMemo(() => new THREE.Vector3(), []);
  const camera = useThree((s) => s.camera);

  useFrame(() => {
    const t = simTimeRef.current;

    // Sidereal rotation of the surface relative to the inertial frame.
    const theta =
      ((gmstDeg(t) - gmstDeg(MISSION_EPOCH_MS)) * Math.PI) / 180;
    if (meshRef.current) meshRef.current.rotation.y = -theta;
    if (cloudRef.current) {
      cloudRef.current.rotation.y = -theta + (t - MISSION_EPOCH_MS) * 0.00000035;
    }

    // Sun direction, converted into the render frame and then into view space.
    const eci = sunDirectionEci(t);
    const r = eciToRender(eci);
    sunWorld.set(r.x, r.y, r.z).normalize();
    if (lightRef.current) lightRef.current.position.copy(sunWorld).multiplyScalar(120);
    sunView.copy(sunWorld).transformDirection(camera.matrixWorldInverse);

    const shader = shaderRef.current;
    if (shader) {
      const u = shader.uniforms.uSunView as THREE.IUniform<THREE.Vector3> | undefined;
      u?.value.copy(sunView);
    }

    const cloudUniforms = (cloudMaterial as THREE.ShaderMaterial).uniforms;
    cloudUniforms.uSunDir.value.copy(sunWorld);

    material.emissiveIntensity = showNightLights ? 1 : 0;
  });

  return (
    <group>
      <ambientLight intensity={0.035} color="#5f83a8" />
      <hemisphereLight intensity={0.09} color="#4b7ba8" groundColor="#050a12" />
      <directionalLight
        ref={lightRef}
        intensity={3.1}
        color="#fff6e8"
        castShadow={false}
      />
      {/* Cool bounce light from the opposite side keeps the night limb readable. */}
      <directionalLight intensity={0.22} color="#2b6f9c" position={[-90, -30, -60]} />

      <mesh ref={meshRef} receiveShadow={false}>
        <sphereGeometry args={[EARTH_RADIUS_UNITS, 128, 96]} />
        <primitive object={material} attach="material" />
      </mesh>

      {showClouds && (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[EARTH_RADIUS_UNITS * 1.004, 96, 64]} />
          <primitive object={cloudMaterial} attach="material" />
        </mesh>
      )}
    </group>
  );
}
