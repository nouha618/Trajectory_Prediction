import { useState, useEffect, useRef } from "react";
import { FlightState, FlightPreset } from "../types";
import {
  haversineKm,
  bearingDeg,
  destinationPoint,
  crossAlongTrack,
  predictNextHybrid,
} from "../utils/navigation";
import {
  Plane,
  Play,
  Pause,
  RotateCcw,
  Compass,
  ArrowRight,
  Wind,
  Gauge,
  TrendingUp,
  Activity,
  ChevronRight,
  Info,
} from "lucide-react";

const FLIGHT_PRESETS: FlightPreset[] = [
  {
    name: "Paris (CDG) ➔ London (LHR)",
    startLat: 49.0097,
    startLon: 2.5479,
    destLat: 51.47,
    destLon: -0.4543,
    initialAlt: 6500, // meters
    initialSpeed: 520, // km/h
  },
  {
    name: "New York (JFK) ➔ Chicago (ORD)",
    startLat: 40.6413,
    startLon: -73.7781,
    destLat: 41.9742,
    destLon: -87.9073,
    initialAlt: 10500,
    initialSpeed: 820,
  },
  {
    name: "Tokyo (HND) ➔ San Francisco (SFO)",
    startLat: 35.5494,
    startLon: 139.7798,
    destLat: 37.6213,
    destLon: -122.379,
    initialAlt: 11500,
    initialSpeed: 890,
  },
];

function getWindDirectionCardinal(deg: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(((deg % 360) / 22.5)) % 16;
  return directions[index];
}

export default function FlightSimulator() {
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  
  // Simulation configuration
  const [startLat, setStartLat] = useState(FLIGHT_PRESETS[0].startLat);
  const [startLon, setStartLon] = useState(FLIGHT_PRESETS[0].startLon);
  const [destLat, setDestLat] = useState(FLIGHT_PRESETS[0].destLat);
  const [destLon, setDestLon] = useState(FLIGHT_PRESETS[0].destLon);
  const [cruiseAlt, setCruiseAlt] = useState(FLIGHT_PRESETS[0].initialAlt);
  const [speed, setSpeed] = useState(FLIGHT_PRESETS[0].initialSpeed);
  
  const [climbRate, setClimbRate] = useState(150); // m/min
  const [windSpeed, setWindSpeed] = useState(45); // wind speed in km/h
  const [windDirection, setWindDirection] = useState(220); // wind direction (angle wind is coming from, degrees)
  const [simSpeed, setSimSpeed] = useState(4); // seconds per tick, step multiplier
  const [autopilot, setAutopilot] = useState(true); // Autopilot heading correction toggle
  
  // Simulation runtime state
  const [flight, setFlight] = useState<FlightState>({
    lat: FLIGHT_PRESETS[0].startLat,
    lon: FLIGHT_PRESETS[0].startLon,
    alt: 0,
    speed: FLIGHT_PRESETS[0].initialSpeed,
    bearing: 0,
    groundSpeed: FLIGHT_PRESETS[0].initialSpeed,
    groundTrack: 0,
    timeElapsed: 0,
    distanceCovered: 0,
    xtError: 0,
    atError: 0,
    isActive: false,
    isCompleted: false,
  });

  const [actualPath, setActualPath] = useState<{ lat: number; lon: number; alt: number }[]>([]);
  const [predictedPath, setPredictedPath] = useState<{ lat: number; lon: number }[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  // Ref to hold simulation tick interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load Preset
  const applyPreset = (index: number) => {
    const p = FLIGHT_PRESETS[index];
    setSelectedPreset(index);
    setStartLat(p.startLat);
    setStartLon(p.startLon);
    setDestLat(p.destLat);
    setDestLon(p.destLon);
    setCruiseAlt(p.initialAlt);
    setSpeed(p.initialSpeed);
    
    resetSimulation({
      sLat: p.startLat,
      sLon: p.startLon,
      dLat: p.destLat,
      dLon: p.destLon,
      initSpeed: p.initialSpeed,
    });
  };

  const resetSimulation = (overrides?: {
    sLat?: number;
    sLon?: number;
    dLat?: number;
    dLon?: number;
    initSpeed?: number;
  }) => {
    const latS = overrides?.sLat ?? startLat;
    const lonS = overrides?.sLon ?? startLon;
    const latD = overrides?.dLat ?? destLat;
    const lonD = overrides?.dLon ?? destLon;
    const spd = overrides?.initSpeed ?? speed;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const initialBearing = bearingDeg(latS, lonS, latD, lonD);

    setFlight({
      lat: latS,
      lon: lonS,
      alt: 0, // starts from ground/0 meters
      speed: spd,
      bearing: initialBearing,
      groundSpeed: spd,
      groundTrack: initialBearing,
      timeElapsed: 0,
      distanceCovered: 0,
      xtError: 0,
      atError: 0,
      isActive: false,
      isCompleted: false,
    });

    setActualPath([{ lat: latS, lon: lonS, alt: 0 }]);
    setPredictedPath([]);
    setLogs(["Flight simulator initialized. Ready for takeoff."]);
  };

  // Run simulation stepping logic
  const stepSimulation = () => {
    setFlight((prev) => {
      if (prev.isCompleted) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return prev;
      }

      // Step size is 30 seconds of flight, scaled by multiplier
      const dtSeconds = 15 * simSpeed;
      const totalDistance = haversineKm(startLat, startLon, destLat, destLon);
      const remainingDistance = haversineKm(prev.lat, prev.lon, destLat, destLon);

      // Takeoff or terminal completed check
      if (remainingDistance < 5.0 || prev.distanceCovered >= totalDistance) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setLogs((l) => [...l.slice(-12), `[COMPLETED] Arrival at destination coordinates! Flight time: ${prev.timeElapsed.toFixed(1)} mins.`]);
        return { ...prev, isActive: false, isCompleted: true, lat: destLat, lon: destLon };
      }

      // Calculate perfect heading/track to destination (desired ground track)
      // If autopilot is false, targetBearing is set to current bearing so no correction is made
      const targetBearing = autopilot ? bearingDeg(prev.lat, prev.lon, destLat, destLon) : prev.bearing;

      // Adjust altitude climb
      let currentClimb = climbRate;
      if (prev.alt >= cruiseAlt) {
        currentClimb = 0; // reached cruise
      }

      // Next position using hybrid physics step (incorporating vector wind drift)
      const nextState = predictNextHybrid(
        {
          lat: prev.lat,
          lon: prev.lon,
          alt: prev.alt,
          speed: prev.speed,
          bearing: prev.bearing,
          climbRate: currentClimb,
        },
        dtSeconds,
        targetBearing,
        windSpeed,
        windDirection
      );

      const distanceStep = ((nextState.groundSpeed ?? prev.speed) * (dtSeconds / 3600));
      const nextDistanceCovered = prev.distanceCovered + distanceStep;
      const timeStepMins = dtSeconds / 60;
      const nextTime = prev.timeElapsed + timeStepMins;

      // Compute Cross-track and Along-track error from linear course line
      const errors = crossAlongTrack(startLat, startLon, destLat, destLon, nextState.lat, nextState.lon);

      // Log updates occasionally
      if (Math.floor(nextTime) % 3 === 0) {
        setLogs((l) => [
          ...l.slice(-12),
          `[LOG] Time: ${nextTime.toFixed(1)} min | Pos: ${nextState.lat.toFixed(4)}, ${nextState.lon.toFixed(4)} | GS: ${Math.round(nextState.groundSpeed)} km/h | TRK: ${Math.round(nextState.groundTrack)}° | HDG: ${Math.round(nextState.bearing)}° | Drift: ${errors.xtError.toFixed(2)} km`,
        ]);
      }

      // Append state to path
      setActualPath((path) => [...path, { lat: nextState.lat, lon: nextState.lon, alt: nextState.alt }]);

      // Generate future hybrid physics projection path (forward predicting 15 steps, 1 step/min)
      const futureProjection: { lat: number; lon: number }[] = [];
      let tempState = { ...nextState };
      for (let i = 0; i < 15; i++) {
        const target = autopilot ? bearingDeg(tempState.lat, tempState.lon, destLat, destLon) : tempState.bearing;
        tempState = predictNextHybrid(tempState, 60, target, windSpeed, windDirection);
        futureProjection.push({ lat: tempState.lat, lon: tempState.lon });
      }
      setPredictedPath(futureProjection);

      return {
        ...prev,
        lat: nextState.lat,
        lon: nextState.lon,
        alt: nextState.alt,
        bearing: nextState.bearing,
        groundSpeed: nextState.groundSpeed,
        groundTrack: nextState.groundTrack,
        timeElapsed: nextTime,
        distanceCovered: nextDistanceCovered,
        xtError: errors.xtError,
        atError: errors.atDistance,
      };
    });
  };

  // Toggle active interval
  const togglePlay = () => {
    if (flight.isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setFlight((prev) => ({ ...prev, isActive: false }));
      setLogs((l) => [...l, "Simulation paused."]);
    } else {
      if (flight.isCompleted) {
        resetSimulation();
      }
      setFlight((prev) => ({ ...prev, isActive: true }));
      setLogs((l) => [...l, "Simulation started... Takeoff roll!"]);
      intervalRef.current = setInterval(() => {
        stepSimulation();
      }, 300);
    }
  };

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Map coordinates to 2D canvas/SVG space for flight plot
  // Uses bounding box of coordinates
  const minLat = Math.min(startLat, destLat, ...actualPath.map((p) => p.lat)) - 1.5;
  const maxLat = Math.max(startLat, destLat, ...actualPath.map((p) => p.lat)) + 1.5;
  const minLon = Math.min(startLon, destLon, ...actualPath.map((p) => p.lon)) - 1.5;
  const maxLon = Math.max(startLon, destLon, ...actualPath.map((p) => p.lon)) + 1.5;

  const latSpan = maxLat - minLat || 1;
  const lonSpan = maxLon - minLon || 1;

  const toSvgCoords = (lat: number, lon: number) => {
    const width = 500;
    const height = 300;
    const padding = 40;

    // Standard linear scaling (simple orthographic map representation)
    const x = padding + ((lon - minLon) / lonSpan) * (width - 2 * padding);
    // Invert Y coordinate
    const y = height - padding - ((lat - minLat) / latSpan) * (height - 2 * padding);
    return { x, y };
  };

  const startCoords = toSvgCoords(startLat, startLon);
  const destCoords = toSvgCoords(destLat, destLon);
  const planeCoords = toSvgCoords(flight.lat, flight.lon);

  const totalFlightDistance = haversineKm(startLat, startLon, destLat, destLon);
  const percentCompleted = totalFlightDistance > 0 ? (flight.distanceCovered / totalFlightDistance) * 100 : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
      {/* Control Presets & Parameters (Left Column) */}
      <div className="xl:col-span-4 flex flex-col gap-4">
        {/* Presets and Presets Selection */}
        <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5">
          <h3 className="font-sans font-medium text-slate-100 flex items-center gap-2 mb-3">
            <Plane className="w-4 h-4 text-teal-400" />
            Flight Geodesic Routes
          </h3>
          <div className="flex flex-col gap-2">
            {FLIGHT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(idx)}
                className={`w-full py-2.5 px-4 rounded-xl font-sans text-xs text-left transition-all flex items-center justify-between border cursor-pointer ${
                  selectedPreset === idx
                    ? "bg-teal-500/10 border-teal-500/40 text-teal-300"
                    : "bg-slate-900/40 hover:bg-slate-900/80 border-slate-800 text-slate-400"
                }`}
              >
                <span>{p.name}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${selectedPreset === idx ? "text-teal-400" : "text-slate-600"}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Flight Parameter Settings */}
        <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-sans font-medium text-slate-100 flex items-center gap-2 mb-4">
              <Wind className="w-4 h-4 text-sky-400" />
              Kinematic Parameter Tuning
            </h3>

            <div className="space-y-4">
              {/* Cruise Speed */}
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1.5">
                  <span>Cruise Velocity (Ground Speed)</span>
                  <span className="text-teal-400">{speed} km/h</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="1100"
                  step="20"
                  value={speed}
                  disabled={flight.isActive}
                  onChange={(e) => {
                    setSpeed(Number(e.target.value));
                    setFlight((prev) => ({ ...prev, speed: Number(e.target.value) }));
                  }}
                  className="w-full accent-teal-500 h-1 bg-slate-900 rounded-lg cursor-pointer disabled:opacity-50"
                />
              </div>

              {/* Cruise altitude */}
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1.5">
                  <span>Target Cruise Altitude</span>
                  <span className="text-teal-400">{cruiseAlt} m</span>
                </div>
                <input
                  type="range"
                  min="2000"
                  max="14000"
                  step="500"
                  value={cruiseAlt}
                  disabled={flight.isActive}
                  onChange={(e) => setCruiseAlt(Number(e.target.value))}
                  className="w-full accent-teal-500 h-1 bg-slate-900 rounded-lg cursor-pointer disabled:opacity-50"
                />
              </div>

              {/* Climb Rate */}
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1.5">
                  <span>Rate of Climb</span>
                  <span className="text-teal-400">{climbRate} m/min</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={climbRate}
                  onChange={(e) => setClimbRate(Number(e.target.value))}
                  className="w-full accent-teal-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                />
              </div>

              {/* Vecteur de Vent / Wind Vector Parameter Controls */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3.5 space-y-3.5">
                <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  Vecteur du vent (Wind Vector)
                </span>
                
                {/* Wind Speed Slider */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                    <span>Force du vent (Wind Speed)</span>
                    <span className="text-sky-400 font-bold">{windSpeed} km/h</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    step="5"
                    value={windSpeed}
                    onChange={(e) => setWindSpeed(Number(e.target.value))}
                    className="w-full accent-sky-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Wind Direction Slider */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                    <span>Provenance (Wind From)</span>
                    <span className="text-sky-400 font-bold">{windDirection}° ({getWindDirectionCardinal(windDirection)})</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    step="5"
                    value={windDirection}
                    onChange={(e) => setWindDirection(Number(e.target.value))}
                    className="w-full accent-sky-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Wind direction relative visual arrow card */}
                <div className="flex items-center gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-900/60">
                  <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center relative shrink-0">
                    <div 
                      className="transition-transform duration-300"
                      style={{ transform: `rotate(${(windDirection + 180) % 360}deg)` }}
                    >
                      <ArrowRight className="w-4 h-4 text-sky-400" />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-normal">
                    <p className="font-semibold text-slate-300">
                      Blowing to {(windDirection + 180) % 360}°
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      {windSpeed > 0 
                        ? `Real-time physical displacement. Autopilot adjusts WCA (Wind Correction Angle).`
                        : "No wind displacement active."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Autopilot heading-hold mode toggle */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-400" />
                    Correcteur Autopilote (Correction Active)
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autopilot}
                      onChange={(e) => setAutopilot(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500 peer-checked:after:bg-slate-950"></div>
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  {autopilot
                    ? "Activé : l'autopilote recalcule et corrige instantanément le cap pour intercepter la cible."
                    : "Désactivé (Dérive libre) : l'avion maintient son orientation de départ, laissant le vent le dévier visiblement."}
                </p>
              </div>

              {/* Warp Multiplier */}
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-300 mb-1.5">
                  <span>Time Multiplier (Warp)</span>
                  <span className="text-amber-400">{simSpeed}x speed</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={simSpeed}
                  onChange={(e) => setSimSpeed(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-slate-900 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Preset details info */}
          <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2 bg-slate-900/30 p-2.5 rounded-xl">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <p>
              The hybrid physics model (Community 1) uses geodesic equations (Community 2) to compute coordinate transitions. Increasing heading drift will produce continuous cross-track lateral divergence, which you can see plotted in orange and logged in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Trajectory Plot Canvas & Cockpit Dials (Right Column) */}
      <div className="xl:col-span-8 flex flex-col gap-4">
        {/* Top telemetry HUD and map */}
        <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 flex flex-col overflow-hidden relative">
          
          {/* Controls Bar */}
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800/60 z-10">
            <div>
              <h3 className="font-sans font-medium text-slate-100 text-sm">
                Great-Circle Geodesic Projection Radar
              </h3>
              <p className="text-xs text-slate-400">Green: actual trajectory | Orange: hybrid forward state predictions</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={togglePlay}
                className={`py-1.5 px-4 rounded-xl font-sans font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                  flight.isActive
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                    : "bg-teal-500 text-slate-950 hover:bg-teal-400"
                }`}
              >
                {flight.isActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Launch
                  </>
                )}
              </button>
              <button
                onClick={() => resetSimulation()}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 cursor-pointer transition-colors"
                title="Reset simulation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SVG Flight Map plot */}
          <div className="relative h-[240px] bg-[#030610]/90 border border-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
            {/* Compass background grids */}
            <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
              <div className="w-[180px] h-[180px] rounded-full border border-teal-500 border-dashed" />
              <div className="w-[280px] h-[280px] rounded-full border border-teal-500" />
              <div className="absolute top-0 bottom-0 left-1/2 border-l border-teal-500" />
              <div className="absolute left-0 right-0 top-1/2 border-t border-teal-500" />
            </div>

            <svg className="w-full h-full min-h-[220px]" viewBox="0 0 500 300">
              {/* Map grids/gridlines */}
              <g stroke="#1e293b" strokeWidth={0.5} strokeDasharray="3 3">
                <line x1="0" y1="50" x2="500" y2="50" />
                <line x1="0" y1="150" x2="500" y2="150" />
                <line x1="0" y1="250" x2="500" y2="250" />
                <line x1="100" y1="0" x2="100" y2="300" />
                <line x1="250" y1="0" x2="250" y2="300" />
                <line x1="400" y1="0" x2="400" y2="300" />
              </g>

              {/* Nominal Track (Dashed Geodesic Great Circle line) */}
              <line
                x1={startCoords.x}
                y1={startCoords.y}
                x2={destCoords.x}
                y2={destCoords.y}
                stroke="#475569"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                opacity={0.8}
              />

              {/* Actual Path Flown (Green solid path) */}
              {actualPath.length > 1 && (
                <path
                  d={actualPath
                    .map((p, idx) => {
                      const coord = toSvgCoords(p.lat, p.lon);
                      return `${idx === 0 ? "M" : "L"} ${coord.x} ${coord.y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  className="transition-all duration-300"
                />
              )}

              {/* Predicted Hybrid Trajectory Vector (Orange projection from current point) */}
              {predictedPath.length > 0 && (
                <path
                  d={[{ lat: flight.lat, lon: flight.lon }, ...predictedPath]
                    .map((p, idx) => {
                      const coord = toSvgCoords(p.lat, p.lon);
                      return `${idx === 0 ? "M" : "L"} ${coord.x} ${coord.y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1.8}
                  strokeDasharray="3 3"
                  opacity={0.8}
                />
              )}

              {/* Origin Point */}
              <g transform={`translate(${startCoords.x}, ${startCoords.y})`}>
                <circle r={5} fill="#0284c7" />
                <text y="-8" textAnchor="middle" className="font-mono text-[8px] fill-sky-400">
                  DEP
                </text>
              </g>

              {/* Destination Point */}
              <g transform={`translate(${destCoords.x}, ${destCoords.y})`}>
                <circle r={5} fill="#e11d48" />
                <text y="-8" textAnchor="middle" className="font-mono text-[8px] fill-rose-400">
                  ARR
                </text>
              </g>

              {/* Active Plane Position & Orientation heading vector */}
              <g
                transform={`translate(${planeCoords.x}, ${planeCoords.y})`}
                className="transition-all duration-300"
              >
                {/* Ground track vector direction (Blue line) */}
                {flight.groundTrack !== undefined && (
                  <g transform={`rotate(${flight.groundTrack})`}>
                    <line x1="0" y1="0" x2="0" y2="-22" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="2 1" opacity={0.8} />
                    <polygon points="0,-22 -3,-18 3,-18" fill="#38bdf8" opacity={0.8} />
                  </g>
                )}
                
                {/* Heading vector direction (actual plane nose orientation) */}
                <g transform={`rotate(${flight.bearing})`}>
                  {/* plane visual body */}
                  <path
                    d="M0,-8 L2,-3 L7,-1 L2,-1 L0,3 L-2,-1 L-7,-1 L-2,-3 Z"
                    fill="#34d399"
                    stroke="#10b981"
                    strokeWidth={1}
                  />
                </g>
              </g>
            </svg>

            {/* Flight progress overlay bar */}
            <div className="absolute bottom-3 left-4 right-4 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800/80 backdrop-blur flex justify-between items-center">
              <div className="flex-1 mr-4">
                <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-0.5">
                  <span>En-route progress</span>
                  <span>{percentCompleted.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${percentCompleted}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-500 block">Total Great Circle Dist</span>
                <span className="text-xs font-mono text-slate-300 font-medium">
                  {totalFlightDistance.toFixed(0)} km
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cockpit Gauges panel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Compass Heading & Track Dial */}
          <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 flex flex-col items-center justify-between">
            <Compass className="w-5 h-5 text-teal-400 mb-2" />
            <span className="text-[10px] text-slate-500 block font-mono font-medium uppercase">HDG (Nose) / TRK (Track)</span>
            <span className="text-sm font-mono font-bold text-slate-100 mt-1">
              {Math.round(flight.bearing)}° <span className="text-slate-500">/</span> <span className="text-sky-400">{Math.round(flight.groundTrack ?? flight.bearing)}°</span>
            </span>
            <div className="w-16 h-16 rounded-full border border-slate-800/80 mt-2 flex items-center justify-center relative overflow-hidden bg-slate-950/50">
              <div
                className="w-12 h-12 rounded-full border border-dashed border-teal-500/40 flex items-center justify-center transition-transform duration-300"
                style={{ transform: `rotate(${-flight.bearing}deg)` }}
              >
                <span className="absolute top-0 text-[8px] font-bold text-teal-400">N</span>
                <span className="absolute right-0 text-[8px] font-bold text-slate-600">E</span>
                <span className="absolute bottom-0 text-[8px] font-bold text-slate-600">S</span>
                <span className="absolute left-0 text-[8px] font-bold text-slate-600">W</span>
                <div className="w-1 h-4 bg-teal-400 absolute top-1.5" />
              </div>
              {/* Ground track line relative to heading */}
              {flight.groundTrack !== undefined && (
                <div
                  className="absolute w-0.5 h-10 bg-sky-400/80 origin-center transition-transform duration-300"
                  style={{ transform: `rotate(${flight.groundTrack - flight.bearing}deg)` }}
                />
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
            </div>
          </div>

          {/* Speed Indicator */}
          <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 flex flex-col items-center justify-center">
            <Gauge className="w-5 h-5 text-amber-400 mb-2" />
            <span className="text-[10px] text-slate-500 block font-mono font-medium uppercase">GROUND SPEED (GS)</span>
            <span className="text-lg font-mono font-bold text-slate-100 mt-1">
              {Math.round(flight.groundSpeed ?? flight.speed)} <span className="text-xs text-slate-400">km/h</span>
            </span>
            <span className="text-[9px] text-slate-400 font-mono mt-1.5">
              TAS (Air): {Math.round(flight.speed)} km/h
            </span>
            <span className="text-[9px] text-slate-500 font-mono">
              ≈ {((flight.groundSpeed ?? flight.speed) * 0.539957).toFixed(0)} knots
            </span>
          </div>

          {/* Altimeter Climb */}
          <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 flex flex-col items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-400 mb-2" />
            <span className="text-[10px] text-slate-500 block font-mono font-medium uppercase">BARO ALTITUDE</span>
            <span className="text-lg font-mono font-bold text-slate-100 mt-1">
              {Math.round(flight.alt)} <span className="text-xs text-slate-400">m</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-2">
              ≈ {Math.round(flight.alt * 3.28084)} feet
            </span>
          </div>

          {/* Deviation Errors (XT / AT) */}
          <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 flex flex-col items-center justify-center">
            <Activity className="w-5 h-5 text-sky-400 mb-2" />
            <span className="text-[10px] text-slate-500 block font-mono font-medium uppercase">LATERAL DEVIATION</span>
            <span className={`text-lg font-mono font-bold mt-1 ${Math.abs(flight.xtError) > 10 ? 'text-rose-400' : 'text-slate-100'}`}>
              {flight.xtError > 0 ? "+" : ""}
              {flight.xtError.toFixed(2)}{" "}
              <span className="text-xs text-slate-400">km</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-2 uppercase">
              Cross-Track Error
            </span>
          </div>
        </div>

        {/* Flight computer printout logs */}
        <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 flex flex-col flex-1 overflow-hidden">
          <span className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
            <Activity className="w-3.5 h-3.5 text-teal-400" />
            Active Flight Computer Log / ADSB Output
          </span>
          <div className="bg-slate-950 rounded-xl p-3 font-mono text-[10px] text-slate-400 h-[100px] overflow-y-auto space-y-1">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-slate-600 shrink-0 select-none">&gt;</span>
                <span className={log.includes("[COMPLETED]") ? "text-teal-400" : log.includes("[LOG]") ? "text-slate-300" : "text-slate-500"}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
