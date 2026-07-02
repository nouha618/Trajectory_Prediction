/**
 * Geodesic Navigation & Spherical Trigonometry Helpers
 * Translates equations from physics.py and destination_point.py to TS.
 */

const R = 6371.0; // Mean Earth Radius in km

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dphi = toRadians(lat2 - lat1);
  const dlambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the initial bearing/heading from start point to destination.
 * Returns azimuth degrees in range [0, 360).
 */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Direct Geodesic Problem: computes destination coordinates given start point,
 * bearing, and distance traveled.
 */
export function destinationPoint(
  lat: number,
  lon: number,
  distanceKm: number,
  bearingDegValue: number
): { lat: number; lon: number } {
  const angularDist = distanceKm / R;
  const theta = toRadians(bearingDegValue);

  const phi1 = toRadians(lat);
  const lambda1 = toRadians(lon);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(angularDist) +
      Math.cos(phi1) * Math.sin(angularDist) * Math.cos(theta)
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angularDist) * Math.cos(phi1),
      Math.cos(angularDist) - Math.sin(phi1) * Math.sin(phi2)
    );

  return {
    lat: toDegrees(phi2),
    lon: toDegrees(lambda2),
  };
}

/**
 * Computes Cross-Track (XT) error and Along-Track (AT) distance from nominal course line.
 * Nominal path is defined from start to end coordinates. Current point is computed.
 * Returns object with xtError and atDistance in km.
 */
export function crossAlongTrack(
  latStart: number,
  lonStart: number,
  latEnd: number,
  lonEnd: number,
  latCur: number,
  lonCur: number
): { xtError: number; atDistance: number } {
  const d_ad = haversineKm(latStart, lonStart, latCur, lonCur) / R;
  const theta_ad = toRadians(bearingDeg(latStart, lonStart, latCur, lonCur));
  const theta_ab = toRadians(bearingDeg(latStart, lonStart, latEnd, lonEnd));

  // Cross-track angular distance
  const d_xt = Math.asin(Math.sin(d_ad) * Math.sin(theta_ad - theta_ab));

  // Along-track angular distance
  const d_at = Math.acos(Math.cos(d_ad) / Math.cos(d_xt));

  return {
    xtError: d_xt * R,
    atDistance: isNaN(d_at) ? d_ad * R : d_at * R, // fallback if rounding results in NaN
  };
}

/**
 * Stepper function implementing predict_next_hybrid.py concepts.
 * Steps flight forward with physics kinematic limits, wind drift, and altitude climb.
 * Uses aviation wind triangle vector calculations for realistic drift.
 */
export function predictNextHybrid(
  current: {
    lat: number;
    lon: number;
    alt: number;
    speed: number; // TAS in km/h
    bearing: number; // Current heading in degrees
    climbRate: number;
  },
  dtSeconds: number,
  targetBearing: number,
  windSpeed: number = 0, // wind speed in km/h
  windDirection: number = 0 // direction from which wind blows (0-360)
): {
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  bearing: number; // Heading
  climbRate: number;
  groundSpeed: number;
  groundTrack: number;
} {
  // Capped turning limit from hybrid physics model (e.g. max banking rate of 3 deg/sec)
  const maxTurnDegPerSec = 3.0;
  const maxTurnThisStep = maxTurnDegPerSec * dtSeconds;

  // 1. Calculate the required heading to achieve the target ground track (targetBearing)
  // this is the Wind Correction Angle (WCA) calculation.
  let requiredHeading = targetBearing;
  if (windSpeed > 0) {
    const windFromRad = toRadians(windDirection);
    const trackRad = toRadians(targetBearing);
    
    // sin(WCA) = (Vwind / Vtas) * sin(wind_direction_from - desired_track)
    const sinWCA = (windSpeed / current.speed) * Math.sin(windFromRad - trackRad);
    
    // Check if the aircraft's speed is sufficient to overcome the crosswind component
    if (Math.abs(sinWCA) < 0.95) {
      const wcaRad = Math.asin(sinWCA);
      requiredHeading = (targetBearing + toDegrees(wcaRad) + 360) % 360;
    } else {
      // Wind is extremely strong, point nose directly at target bearing or max correction
      const wcaDeg = sinWCA > 0 ? 70 : -70;
      requiredHeading = (targetBearing + wcaDeg + 360) % 360;
    }
  }

  // 2. Shortest turn direction from current heading to required heading
  let diff = requiredHeading - current.bearing;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;

  // Clip turn rate based on aerodynamic limitations
  const turn = Math.max(-maxTurnThisStep, Math.min(maxTurnThisStep, diff));
  
  let nextBearing = (current.bearing + turn) % 360;
  if (nextBearing < 0) nextBearing += 360;

  // 3. Compute Ground Speed (GS) and Ground Track based on actual physical heading (nextBearing)
  let groundSpeed = current.speed;
  let groundTrack = nextBearing;

  if (windSpeed > 0) {
    const headingRad = toRadians(nextBearing);
    // Wind "blowing to" is 180 degrees opposite of "coming from"
    const windToRad = toRadians((windDirection + 180) % 360);

    // True Velocity relative to Air (True Airspeed components)
    const ax = current.speed * Math.sin(headingRad);
    const ay = current.speed * Math.cos(headingRad);

    // Wind velocity relative to Ground
    const wx = windSpeed * Math.sin(windToRad);
    const wy = windSpeed * Math.cos(windToRad);

    // Ground velocity vector components (resultant)
    const gx = ax + wx;
    const gy = ay + wy;

    groundSpeed = Math.sqrt(gx * gx + gy * gy);
    if (groundSpeed > 0.01) {
      groundTrack = (toDegrees(Math.atan2(gx, gy)) + 360) % 360;
    } else {
      groundSpeed = 0;
      groundTrack = nextBearing;
    }
  }

  const dtHours = dtSeconds / 3600;
  const distanceKm = groundSpeed * dtHours;

  // Move aircraft position via direct geodesic formula along the actual ground track
  const nextCoords = destinationPoint(current.lat, current.lon, distanceKm, groundTrack);

  // Climb kinematics
  let nextAlt = current.alt + current.climbRate * (dtSeconds / 60);
  nextAlt = Math.max(0, nextAlt);

  return {
    lat: nextCoords.lat,
    lon: nextCoords.lon,
    alt: nextAlt,
    speed: current.speed,
    bearing: nextBearing, // Aerodynamic Heading (nose direction)
    climbRate: current.climbRate,
    groundSpeed,         // Resulting Ground Speed
    groundTrack,         // Resulting Ground Track angle
  };
}
