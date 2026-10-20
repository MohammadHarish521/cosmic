"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";

import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { INSERTION_OFFSET_MS, MISSION_EPOCH_MS } from "@/lib/constants";
import { useMissionStore, useSimTime } from "@/state/mission-store";
import { Atmosphere } from "./Atmosphere";
import { CameraRig } from "./CameraRig";
import { Constellation } from "./Constellation";
import { EarthMesh } from "./EarthMesh";
import { GroundStations, LatLonGrid } from "./GroundStations";
import { LaunchVehicle } from "./LaunchVehicle";
import { Starfield } from "./Starfield";

function hasWebGL(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

function WebGLFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="glass max-w-sm rounded-xl p-6 text-center">
        <div className="label-xs mb-2 text-amber">Renderer unavailable</div>
        <p className="text-sm leading-relaxed text-muted">
          This console renders the orbital picture with WebGL. Your browser or
          graphics driver did not provide a context.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-faint">
          All telemetry, timelines and event data remain fully available in the
          side panels.
        </p>
      </div>
    </div>
  );
}

export function GlobeCanvas() {
  const { state, dispatch } = useMissionStore();
  const reducedMotion = usePrefersReducedMotion();
  const simTime = useSimTime();
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(hasWebGL());
  }, []);

  // The constellation only exists after orbit insertion — before that the
  // stack is still riding the launch vehicle.
  const fleetVisible =
    state.appMode === "orbit" || simTime >= MISSION_EPOCH_MS + INSERTION_OFFSET_MS;

  const camera = useMemo(
    () => ({ fov: 30, near: 0.05, far: 2400, position: [11, 6.5, 11] as [number, number, number] }),
    []
  );

  if (webgl === false) return <WebGLFallback />;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={camera}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(new THREE.Color("#05070B"), 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        scene.fog = new THREE.Fog("#05070B", 90, 420);
      }}
      fallback={<WebGLFallback />}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig
        mode={state.cameraMode}
        selectedId={state.selectedId}
        reducedMotion={reducedMotion}
      />

      {state.showStars && <Starfield />}

      <Suspense fallback={null}>
        <EarthMesh showClouds={state.showAtmosphere} showNightLights={true} />
      </Suspense>

      {state.showAtmosphere && <Atmosphere strength={1} />}

      <Constellation
        selectedId={state.selectedId}
        showOrbits={state.showOrbits && fleetVisible}
        showTrails={state.showTrails && fleetVisible}
        showSatellites={state.showSatellites && fleetVisible}
        showLabels={state.showLabels && fleetVisible}
        onSelect={(id) => {
          dispatch({ type: "SELECT", id });
          if (state.cameraMode !== "launch") {
            dispatch({ type: "SET_CAMERA_MODE", mode: "tracking" });
          }
        }}
      />

      <GroundStations showLabels={state.showLabels} />

      {state.showGrid && <LatLonGrid opacity={0.18} />}

      {state.appMode === "launch" && <LaunchVehicle />}
    </Canvas>
  );
}
