"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { EARTH_RADIUS_UNITS, KM_TO_UNITS, MISSION_EPOCH_MS } from "@/lib/constants";
import { FLEET } from "@/lib/fleet";
import { launchStateAt } from "@/lib/launch";
import { propagate, sunDirectionEci } from "@/lib/orbits";
import type { CameraMode } from "@/lib/types";
import { useSimTimeRef } from "@/state/mission-store";

const ORIGIN = new THREE.Vector3(0, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const OVERVIEW_DISTANCE = 27;
const MIN_DISTANCE = EARTH_RADIUS_UNITS * 1.06;
const MAX_DISTANCE = 160;

/**
 * Opening framing: place the camera just off the solar terminator so the
 * globe reads as a crescent-to-half lit body on first load.
 */
const INITIAL_AZ = (() => {
  const sun = sunDirectionEci(MISSION_EPOCH_MS);
  return Math.atan2(sun.y, sun.x) + 0.92;
})();

interface CameraRigProps {
  mode: CameraMode;
  selectedId: string | null;
  reducedMotion: boolean;
}

/**
 * Purpose-built orbital camera.
 *
 * A bespoke controller (rather than OrbitControls) gives the console exact
 * control over every transition. The camera is always described in a
 * spherical frame *relative to the subject*:
 *
 *  - overview  — the subject is the Earth, so the frame is the global one;
 *  - tracking  — the subject is a spacecraft, so the frame is anchored to the
 *                local horizon at the spacecraft, which keeps the camera
 *                above the surface no matter where the craft is;
 *  - launch    — the subject is the vehicle, framed the same way.
 *
 * Because the desired state is expressed the same way in every mode, the
 * camera can always fly the shortest path between them.
 */
export function CameraRig({ mode, selectedId, reducedMotion }: CameraRigProps) {
  const { camera, gl } = useThree();
  const viewport = useThree((s) => s.size);
  const simTimeRef = useSimTimeRef();

  // Global spherical state relative to the look-at target.
  const az = useRef(INITIAL_AZ);
  const el = useRef(0.3);
  const dist = useRef(OVERVIEW_DISTANCE);
  const target = useRef(new THREE.Vector3());

  // Subject-local offsets (tracking / launch).
  const localAz = useRef(0.95);
  const localEl = useRef(0.42);
  const zoomFactor = useRef(1);

  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const desired = useRef({
    az: INITIAL_AZ,
    el: 0.3,
    dist: OVERVIEW_DISTANCE,
    target: new THREE.Vector3(),
  });

  const scratch = useMemo(
    () => ({
      subject: new THREE.Vector3(),
      radial: new THREE.Vector3(),
      east: new THREE.Vector3(),
      north: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      pos: new THREE.Vector3(),
    }),
    []
  );

  /** Build a unit vector pointing above the local horizon of `subject`. */
  const localFrame = (subject: THREE.Vector3) => {
    const s = scratch;
    s.radial.copy(subject).normalize();
    s.east.crossVectors(WORLD_UP, s.radial);
    if (s.east.lengthSq() < 1e-6) {
      s.east.set(1, 0, 0);
    } else {
      s.east.normalize();
    }
    s.north.crossVectors(s.radial, s.east).normalize();
  };

  // --- pointer interaction ---------------------------------------------
  useEffect(() => {
    const element = gl.domElement;
    element.style.touchAction = "none";

    const onPointerDown = (e: PointerEvent) => {
      dragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      element.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      const sensitivity = 0.005;
      if (mode === "overview") {
        az.current -= dx * sensitivity;
        el.current = clamp(el.current + dy * sensitivity, -1.15, 1.15);
      } else {
        localAz.current -= dx * sensitivity;
        localEl.current = clamp(localEl.current + dy * sensitivity, -0.35, 1.3);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging.current = false;
      if (element.hasPointerCapture(e.pointerId)) {
        element.releasePointerCapture(e.pointerId);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.0011);
      if (mode === "overview") {
        dist.current = clamp(dist.current * factor, MIN_DISTANCE, MAX_DISTANCE);
      } else {
        zoomFactor.current = clamp(zoomFactor.current * factor, 0.3, 3.2);
      }
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("contextmenu", onContextMenu);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl, mode]);

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const t = simTimeRef.current;
    const d = desired.current;
    const s = scratch;

    // Widen the framing on portrait viewports so the subject still fits.
    const aspect = viewport.height > 0 ? viewport.width / viewport.height : 1.6;
    const fit = aspect < 1.35 ? Math.min(1.85, 1.32 / Math.max(0.45, aspect)) : 1;

    if (mode === "overview") {
      if (!reducedMotion && !dragging.current) az.current += dt * 0.035;
      d.target.copy(ORIGIN);
      d.az = az.current;
      d.el = el.current;
      d.dist = dist.current * fit;
    } else if (mode === "tracking" && selectedId) {
      const satDef = FLEET.find((s2) => s2.id === selectedId);
      if (satDef) {
        const orbit = propagate(satDef.element, t, { epochMs: MISSION_EPOCH_MS });
        s.subject.set(
          orbit.render.x * KM_TO_UNITS,
          orbit.render.z * KM_TO_UNITS,
          orbit.render.y * KM_TO_UNITS
        );
        localFrame(s.subject);

        const radius = s.subject.length();
        const camDist = clamp(radius * 1.3 + 2.2, 6, 34) * zoomFactor.current * fit;

        const ce = Math.cos(localEl.current);
        const se = Math.sin(localEl.current);
        s.dir
          .copy(s.radial)
          .multiplyScalar(ce)
          .addScaledVector(s.east, se * Math.cos(localAz.current))
          .addScaledVector(s.north, se * Math.sin(localAz.current))
          .normalize();

        s.offset.copy(s.dir).multiplyScalar(camDist);
        d.target.copy(s.subject);
        d.az = Math.atan2(s.offset.z, s.offset.x);
        d.el = Math.asin(clamp(s.offset.y / camDist, -1, 1));
        d.dist = camDist;
      }
    } else if (mode === "launch") {
      const launch = launchStateAt(t);
      s.subject.set(launch.position.x, launch.position.y, launch.position.z);
      localFrame(s.subject);

      const camDist = clamp(0.26 + launch.altitudeKm * 0.0026, 0.26, 1.5) * zoomFactor.current * fit;

      const ce = Math.cos(localEl.current);
      const se = Math.sin(localEl.current);
      s.dir
        .copy(s.radial)
        .multiplyScalar(ce)
        .addScaledVector(s.east, se * Math.cos(localAz.current))
        .addScaledVector(s.north, se * Math.sin(localAz.current))
        .normalize();

      s.offset.copy(s.dir).multiplyScalar(camDist);
      d.target.copy(s.subject);
      d.az = Math.atan2(s.offset.z, s.offset.x);
      d.el = Math.asin(clamp(s.offset.y / camDist, -1, 1));
      d.dist = camDist;

      if (!reducedMotion && !dragging.current) localAz.current += dt * 0.08;
    }

    // Smooth approach — frame-rate independent exponential damping.
    const posK = 1 - Math.exp(-dt * 3.1);
    const angK = 1 - Math.exp(-dt * 3.3);
    const distK = 1 - Math.exp(-dt * 3.0);

    az.current += shortestAngle(az.current, d.az) * angK;
    el.current += (d.el - el.current) * angK;
    dist.current += (d.dist - dist.current) * distK;
    target.current.lerp(d.target, posK);

    const cosEl = Math.cos(el.current);
    s.pos.set(
      target.current.x + dist.current * cosEl * Math.cos(az.current),
      target.current.y + dist.current * Math.sin(el.current),
      target.current.z + dist.current * cosEl * Math.sin(az.current)
    );

    // Never let the camera penetrate the globe.
    const radial = s.pos.length();
    const minRadius = EARTH_RADIUS_UNITS * 1.045;
    if (radial < minRadius) {
      s.pos.multiplyScalar(minRadius / (radial || 1));
    }

    camera.position.copy(s.pos);
    camera.lookAt(target.current);
  });

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shortestAngle(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
