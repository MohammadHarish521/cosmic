"use client";

/**
 * Mission store.
 *
 * Two contexts are exposed:
 *  - `MissionStoreContext` — durable UI state (selection, filters, layers).
 *  - `MissionClockContext` — the simulation clock, republished at ~15 Hz for
 *    the DOM while `simTimeRef` carries the per-frame value used by the 3D
 *    scene. Splitting them keeps expensive panels from re-rendering on every
 *    pointer interaction.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import {
  MISSION_EPOCH_MS,
  MISSION_END_MS,
  MISSION_START_MS,
  TIME_SCALES,
  type TimeScale,
} from "@/lib/constants";
import { buildMissionEvents } from "@/lib/events";
import { hashString } from "@/lib/rng";
import type {
  ActiveAlert,
  AppMode,
  CameraMode,
  MissionEvent,
  MissionType,
  SatStatus,
} from "@/lib/types";

const INITIAL_SIM_TIME = MISSION_EPOCH_MS + 58 * 60 * 1000;

export interface MissionState {
  running: boolean;
  speed: TimeScale;
  simTimeMs: number;
  selectedId: string | null;
  cameraMode: CameraMode;
  appMode: AppMode;
  search: string;
  typeFilter: MissionType | "all";
  statusFilter: SatStatus | "all";
  showOrbits: boolean;
  showLabels: boolean;
  showSatellites: boolean;
  showAtmosphere: boolean;
  showGrid: boolean;
  showStars: boolean;
  showTrails: boolean;
  alerts: ActiveAlert[];
  liveEvents: MissionEvent[];
  eventFeedOpen: boolean;
  selectedEventId: string | null;
}

export type MissionAction =
  | { type: "SET_TIME"; t: number }
  | { type: "SET_RUNNING"; running: boolean }
  | { type: "TOGGLE_RUNNING" }
  | { type: "SET_SPEED"; speed: TimeScale }
  | { type: "SELECT"; id: string | null }
  | { type: "SET_CAMERA_MODE"; mode: CameraMode }
  | { type: "SET_APP_MODE"; mode: AppMode }
  | { type: "SET_SEARCH"; value: string }
  | { type: "SET_TYPE_FILTER"; value: MissionType | "all" }
  | { type: "SET_STATUS_FILTER"; value: SatStatus | "all" }
  | { type: "TOGGLE_LAYER"; layer: LayerKey }
  | { type: "SET_LAYER"; layer: LayerKey; value: boolean }
  | { type: "TRIGGER_ALERT"; alert: ActiveAlert }
  | { type: "RESOLVE_ALERT"; id: string }
  | { type: "CLEAR_ALERTS" }
  | { type: "ADD_EVENT"; event: MissionEvent }
  | { type: "SET_EVENT_FEED"; open: boolean }
  | { type: "SELECT_EVENT"; id: string | null };

export type LayerKey =
  | "showOrbits"
  | "showLabels"
  | "showSatellites"
  | "showAtmosphere"
  | "showGrid"
  | "showStars"
  | "showTrails";

const initialState: MissionState = {
  running: true,
  speed: 5,
  simTimeMs: INITIAL_SIM_TIME,
  selectedId: "AETHER-01",
  cameraMode: "overview",
  appMode: "orbit",
  search: "",
  typeFilter: "all",
  statusFilter: "all",
  showOrbits: true,
  showLabels: true,
  showSatellites: true,
  showAtmosphere: true,
  showGrid: false,
  showStars: true,
  showTrails: true,
  alerts: [],
  liveEvents: [],
  eventFeedOpen: false,
  selectedEventId: null,
};

function reducer(state: MissionState, action: MissionAction): MissionState {
  switch (action.type) {
    case "SET_TIME":
      return { ...state, simTimeMs: action.t };
    case "SET_RUNNING":
      return { ...state, running: action.running };
    case "TOGGLE_RUNNING":
      return { ...state, running: !state.running };
    case "SET_SPEED":
      return { ...state, speed: action.speed };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "SET_CAMERA_MODE":
      return { ...state, cameraMode: action.mode };
    case "SET_APP_MODE":
      return { ...state, appMode: action.mode };
    case "SET_SEARCH":
      return { ...state, search: action.value };
    case "SET_TYPE_FILTER":
      return { ...state, typeFilter: action.value };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.value };
    case "TOGGLE_LAYER":
      return { ...state, [action.layer]: !state[action.layer] } as MissionState;
    case "SET_LAYER":
      return { ...state, [action.layer]: action.value } as MissionState;
    case "TRIGGER_ALERT":
      return {
        ...state,
        alerts: [...state.alerts.filter((a) => a.id !== action.alert.id), action.alert],
      };
    case "RESOLVE_ALERT":
      return { ...state, alerts: state.alerts.filter((a) => a.id !== action.id) };
    case "CLEAR_ALERTS":
      return { ...state, alerts: [] };
    case "ADD_EVENT":
      return { ...state, liveEvents: [action.event, ...state.liveEvents].slice(0, 120) };
    case "SET_EVENT_FEED":
      return { ...state, eventFeedOpen: action.open };
    case "SELECT_EVENT":
      return { ...state, selectedEventId: action.id };
    default:
      return state;
  }
}

interface MissionStoreValue {
  state: MissionState;
  dispatch: React.Dispatch<MissionAction>;
  /** Per-frame simulation time (milliseconds). */
  simTimeRef: React.MutableRefObject<number>;
  /** All mission events, scheduled + live. */
  events: MissionEvent[];
}

const MissionStoreContext = createContext<MissionStoreValue | null>(null);
const MissionClockContext = createContext<number>(INITIAL_SIM_TIME);

let scheduledEvents: MissionEvent[] | null = null;

export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const simTimeRef = useRef<number>(INITIAL_SIM_TIME);
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- simulation clock -------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPublish = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (s.running) {
        const next = simTimeRef.current + dt * 1000 * s.speed;
        simTimeRef.current = Math.min(MISSION_END_MS, next);
      }
      if (now - lastPublish > 66) {
        lastPublish = now;
        dispatch({ type: "SET_TIME", t: simTimeRef.current });
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keep the clock ref in sync when the user scrubs the timeline.
  const lastSetTime = useRef(state.simTimeMs);
  useEffect(() => {
    if (Math.abs(state.simTimeMs - lastSetTime.current) > 400) {
      lastSetTime.current = state.simTimeMs;
      simTimeRef.current = state.simTimeMs;
    }
  }, [state.simTimeMs]);

  const events = useMemo(() => {
    if (!scheduledEvents) scheduledEvents = buildMissionEvents();
    return [...state.liveEvents, ...scheduledEvents].sort(
      (a, b) => b.tMs - a.tMs || b.createdAt - a.createdAt
    );
  }, [state.liveEvents]);

  // --- alert lifecycle ---------------------------------------------------
  // Faults expire on the mission clock, producing a recovery record and
  // returning the spacecraft to nominal.
  useEffect(() => {
    if (state.alerts.length === 0) return;
    const now = state.simTimeMs;
    const expired = state.alerts.filter(
      (a) => now - a.startedAtSimMs >= a.durationSimMs
    );
    if (expired.length === 0) return;

    for (const alert of expired) {
      dispatch({
        type: "ADD_EVENT",
        event: {
          id: `${alert.id}-recovery`,
          tMs: now,
          createdAt: Date.now(),
          category: "recovery",
          title: "RECOVERED · Link margin restored",
          detail: `${alert.satelliteId} has re-established a nominal downlink. Telemetry integrity confirmed and the fault condition has been cleared.`,
          satelliteId: alert.satelliteId,
          severity: "info",
          source: "FLIGHT",
        },
      });
      dispatch({ type: "RESOLVE_ALERT", id: alert.id });
    }
  }, [state.simTimeMs, state.alerts]);

  const storeValue = useMemo<MissionStoreValue>(
    () => ({ state, dispatch, simTimeRef, events }),
    [state, events]
  );

  return (
    <MissionStoreContext.Provider value={storeValue}>
      <MissionClockContext.Provider value={state.simTimeMs}>
        {children}
      </MissionClockContext.Provider>
    </MissionStoreContext.Provider>
  );
}

export function useMissionStore(): MissionStoreValue {
  const ctx = useContext(MissionStoreContext);
  if (!ctx) throw new Error("useMissionStore must be used inside <MissionProvider>");
  return ctx;
}

export function useMissionState(): MissionState {
  return useMissionStore().state;
}

export function useMissionDispatch(): React.Dispatch<MissionAction> {
  return useMissionStore().dispatch;
}

/** Current simulated instant (published at ~15 Hz). */
export function useSimTime(): number {
  return useContext(MissionClockContext);
}

/** Per-frame simulated instant — for the 3D scene and high-rate effects. */
export function useSimTimeRef(): React.MutableRefObject<number> {
  return useMissionStore().simTimeRef;
}

/**
 * Resolve the simulated time to a wall-clock value for a given epoch.
 * Used by the timeline scrubber.
 */
export function useSeek(): (t: number) => void {
  const dispatch = useMissionDispatch();
  const simTimeRef = useSimTimeRef();
  return useCallback(
    (t: number) => {
      const clamped = Math.min(MISSION_END_MS, Math.max(MISSION_START_MS, t));
      simTimeRef.current = clamped;
      dispatch({ type: "SET_TIME", t: clamped });
    },
    [dispatch, simTimeRef]
  );
}

/** Build a deterministic alert identifier. */
export function alertId(satelliteId: string, tMs: number): string {
  return `alert-${hashString(`${satelliteId}:${Math.floor(tMs / 1000)}`)}`;
}

/**
 * Enter the cinematic launch sequence.
 *
 * The clock rewinds to the terminal count so the countdown, ignition and
 * ascent phases all play out from a coherent starting point.
 */
export function useEnterLaunchMode(): () => void {
  const dispatch = useMissionDispatch();
  const simTimeRef = useSimTimeRef();
  return useCallback(() => {
    const start = MISSION_EPOCH_MS - 30_000;
    simTimeRef.current = start;
    dispatch({ type: "SET_TIME", t: start });
    dispatch({ type: "SET_SPEED", speed: 1 });
    dispatch({ type: "SET_APP_MODE", mode: "launch" });
    dispatch({ type: "SET_CAMERA_MODE", mode: "launch" });
  }, [dispatch, simTimeRef]);
}

/** Return to constellation operations. */
export function useEnterOrbitMode(): () => void {
  const dispatch = useMissionDispatch();
  return useCallback(() => {
    dispatch({ type: "SET_APP_MODE", mode: "orbit" });
    dispatch({ type: "SET_CAMERA_MODE", mode: "overview" });
  }, [dispatch]);
}

export { TIME_SCALES };
