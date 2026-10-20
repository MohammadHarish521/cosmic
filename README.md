# AETHER — Orbital Operations Console

A cinematic, fully interactive mission-control interface: a real-time 3D orbital
console with synchronized telemetry, a scrubbable mission timeline and a
cinematic launch sequence.

> **All data is simulated.** The orbital element sets, telemetry, ground-station
> passes and event log are produced by a deterministic client-side model. Nothing
> here tracks a real spacecraft, and no live or paid data source is used.

---

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start   # production build
npm run typecheck             # tsc --noEmit
```

---

## What's in the box

### The stage — a real 3D Earth
- Photoreal NASA Blue Marble textures (day, night lights, specular water mask,
  normal map, cloud plate) rendered through a patched `MeshStandardMaterial`:
  ocean gets a specular sheen, land stays matte, and **city lights only emit on
  the night side** of the terminator.
- Two-layer atmospheric scattering shell with a sun-facing rim, a warm
  terminator band and a wide outer halo.
- Procedural starfield (2 600 stars + a faint galactic band) with per-star
  twinkle, all from a fixed seed.
- Solar direction computed from a low-precision ephemeris, so the terminator is
  correct for the simulated instant.

### Orbital mechanics that actually work
- Real Keplerian propagation: mean anomaly → eccentric anomaly (Newton–Raphson)
  → perifocal coordinates → ECI.
- Vis-viva velocity, J2-free but physically consistent altitude, sub-satellite
  point, orbital period, true anomaly.
- Earth-fixed longitude derived from GMST, so the Earth rotates under the
  inertial orbits exactly as it should.
- Ground-station passes are detected from real horizon geometry
  (`acos(Re / R)`), so "AOS / LOS" in the event log lands at the moment the
  satellite truly enters the station's cone.

### The console
| Region | Contents |
| --- | --- |
| **Left** | Mission navigation, searchable/filterable spacecraft roster, orbital parameters, spacecraft health gauges |
| **Centre** | The 3D stage, head-up framing, launch overlay |
| **Right** | Identity card, telemetry tiles, orbital profile + link-quality charts, communications status, live event feed with fault injection |
| **Bottom** | Transport controls, 1× / 5× / 20× time control, phase markers, draggable scrubber, phase readout |

### Interactions
1. **Select** a spacecraft (roster or click it on the globe) → the camera flies
   into a satellite-tracking chase view and every readout updates.
2. **Play / pause** and **1× / 5× / 20×** time control drive one coherent
   simulation clock.
3. **Layer toggles** (eye menu): orbital paths, motion trails, spacecraft,
   labels, atmosphere, graticule, starfield.
4. **Camera modes**: global overview, satellite tracking, launch ascent.
5. **Search + filter** the roster by name, mission type or status.
6. **Inject fault** raises a real communications fault: the signal degrades,
   the link drops, an amber alert appears in the header, the event log records
   the fault, and the system recovers automatically on the mission clock.
7. **Expand the event log** for the full record set with filters, inspection
   and jump-to-time.
8. **Launch sequence**: terminal count → liftoff → max-Q → MECO → stage sep →
   fairing sep → orbit insertion, with a flown ascent path, ignition plume and
   phase-synced timeline.
9. **Responsive**: three columns on desktop, stacked sheets + a control dock on
   mobile, with viewport-aware camera framing and label scaling.
10. **Reduced motion** is respected: camera drift, pulsing and decorative
    animation are disabled, the simulation stays fully usable.

---

## Architecture

```
src/
  app/                 layout, global styles, page, icon
  lib/                 domain model — no React
    constants.ts       physical + mission constants
    types.ts           typed data models
    rng.ts             seeded PRNG + deterministic smooth noise
    orbits.ts          Keplerian propagation, GMST, sun ephemeris
    fleet.ts           the simulated constellation + ground stations
    telemetry.ts       telemetry synthesis + link geometry
    events.ts          deterministic mission event generation
    timeline.ts        mission phases + piecewise-linear scrubber scale
    launch.ts          launch vehicle trajectory model
    format.ts          formatting helpers
  state/mission-store.tsx   mission state + simulation clock (two contexts)
  hooks/               useTelemetryHistory, useSatelliteSnapshot, media queries
  components/
    globe/             EarthMesh, Atmosphere, Constellation, GroundStations,
                       Starfield, LaunchVehicle, CameraRig, GlobeCanvas
    shell/             TopBar, LeftRail, RightRail, BottomTimeline,
                       EventFeed, LaunchOverlay, StageHUD, MissionConsole
    ui/                GlassPanel, Controls, Sparkline
```

### The simulation clock
One clock drives everything. It is kept in a ref (read per animation frame by
the 3D scene) and republished to React at ~15 Hz (read by the DOM panels), so
the globe, the telemetry, the charts and the event log are never out of sync.
Scrubbing the timeline moves the entire console.

### Determinism
Every "random" value — element jitter, telemetry noise, star field, event
ordering, battery and thermal cycles — comes from a fixed seed through a
mulberry32 PRNG and a smooth sine-bank noise function. Replaying the same
timeline always produces the same numbers.

### Performance
- The 3D scene never re-renders React during motion: all per-frame work writes
  into transforms and buffer attributes inside a single `useFrame` pass.
- Orbit ellipses are sampled once per satellite; trails update a 44-vertex
  buffer.
- Labels and markers are canvas-textured sprites sized from the camera
  distance, so they hold a constant apparent size at any zoom.
- `dpr` is capped at 1.75; the renderer is throttled to the display refresh
  rate.
- A graceful WebGL fallback replaces the stage with an explanatory panel if no
  context is available, while every data panel keeps working.

### Accessibility
Semantic landmarks and headings, radiogroup semantics for segmented controls,
`aria-pressed` toggles, a keyboard-operable timeline slider (arrow keys,
shift for minute steps), visible focus rings, and full `prefers-reduced-motion`
support.

---

## Third-party assets

Earth textures are NASA Blue Marble / Earth at Night derivatives obtained from
the three.js example assets (public domain). Inter and JetBrains Mono are
bundled locally via `next/font/local`, so the app has no runtime font or
texture CDN dependency.
