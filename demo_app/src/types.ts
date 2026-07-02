export interface GraphNode {
  id: string;
  label: string;
  community: number;
  communityName: string;
  description: string;
  details: string;
  code?: string;
  connectionsCount: number;
  type: "function" | "concept" | "documentation";
}

export interface GraphLink {
  source: string;
  target: string;
  type: "calls" | "explains" | "references";
  isCrossCommunity: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface FlightState {
  lat: number;      // current latitude (deg)
  lon: number;      // current longitude (deg)
  alt: number;      // altitude (meters)
  speed: number;    // speed / true airspeed (km/h)
  bearing: number;  // current heading (deg)
  groundSpeed?: number; // actual ground speed (km/h)
  groundTrack?: number; // actual ground track (deg)
  timeElapsed: number; // minutes elapsed
  distanceCovered: number; // km
  xtError: number;  // cross-track error (km)
  atError: number;  // along-track error (km)
  isActive: boolean;
  isCompleted: boolean;
}

export interface FlightPreset {
  name: string;
  startLat: number;
  startLon: number;
  destLat: number;
  destLon: number;
  initialAlt: number;
  initialSpeed: number;
}
