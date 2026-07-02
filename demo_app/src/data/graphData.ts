import { GraphNode, GraphLink } from "../types";

export const communities = [
  { id: 0, name: "physics.py", color: "bg-teal-500", border: "border-teal-400", text: "text-teal-400" },
  { id: 1, name: "predict_hybrid.py", color: "bg-amber-500", border: "border-amber-400", text: "text-amber-400" },
  { id: 2, name: "destination_point.py", color: "bg-indigo-500", border: "border-indigo-400", text: "text-indigo-400" },
  { id: 3, name: "data_loader.py", color: "bg-emerald-500", border: "border-emerald-400", text: "text-emerald-400" },
  { id: 4, name: "metrics.py", color: "bg-sky-500", border: "border-sky-400", text: "text-sky-400" },
  { id: 5, name: "visualization_cli.py", color: "bg-rose-500", border: "border-rose-400", text: "text-rose-400" }
];

export const graphNodes: GraphNode[] = [
  // --- Community 0 (physics.py) ---
  {
    id: "haversine_km",
    label: "haversine_km()",
    community: 0,
    communityName: "physics.py",
    description: "Distance grand cercle (km) entre deux points GPS.",
    details: "Calculates the great-circle distance between two latitude/longitude points on a spherical Earth (mean radius R = 6371 km) using the numerically stable Haversine formula to prevent loss of precision near antipodal coordinates.",
    type: "function",
    connectionsCount: 6,
    code: `import math

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance grand cercle (km) entre deux points GPS."""
    R = 6371.0  # Earth mean radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = (math.sin(dphi / 2) ** 2 + 
         math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c`
  },
  {
    id: "bearing_deg",
    label: "bearing_deg()",
    community: 0,
    communityName: "physics.py",
    description: "Cap initial entre deux points GPS [0-360°].",
    details: "Computes the initial heading (bearing) from a starting coordinate to a destination coordinate on a great circle path. The result is mapped from radians to degrees, normalized, and bounded in the range [0, 360°].",
    type: "function",
    connectionsCount: 6,
    code: `import math

def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Cap initial entre deux points GPS [0-360°]."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = (math.cos(phi1) * math.sin(phi2) - 
         math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda))
    
    theta = math.atan2(y, x)
    return (math.degrees(theta) + 360) % 360`
  },
  {
    id: "cross_along_track",
    label: "cross_along_track()",
    community: 0,
    communityName: "physics.py",
    description: "Décomposition erreur trajectoire (formules de navigation sphérique) : - c",
    details: "Decomposes the geographic error between a actual flight position and its nominal linear path between an origin and destination. Calculates both cross-track error (perpendicular distance to course) and along-track error (parallel distance along course) using great-circle geometry.",
    type: "function",
    connectionsCount: 5,
    code: `import math
from physics import haversine_km, bearing_deg

def cross_along_track(lat_start: float, lon_start: float, 
                      lat_end: float, lon_end: float, 
                      lat_cur: float, lon_cur: float) -> tuple[float, float]:
    """
    Decomposes error into cross-track (XT) and along-track (AT) distances in km.
    Returns: (cross_track_km, along_track_km)
    """
    R = 6371.0
    d_ad = haversine_km(lat_start, lon_start, lat_cur, lon_cur) / R
    theta_ad = math.radians(bearing_deg(lat_start, lon_start, lat_cur, lon_cur))
    theta_ab = math.radians(bearing_deg(lat_start, lon_start, lat_end, lon_end))
    
    # Cross-track angular distance
    d_xt = math.asin(math.sin(d_ad) * math.sin(theta_ad - theta_ab))
    
    # Along-track angular distance
    d_at = math.acos(math.cos(d_ad) / math.cos(d_xt))
    
    return d_xt * R, d_at * R`
  },
  {
    id: "doc_haversine",
    label: "Distance grand cercle (km)",
    community: 0,
    communityName: "physics.py",
    description: "Documentation: Distance grand cercle (km) entre deux points GPS.",
    details: "Primary geographic math formulation. Establishes the geodesic line equations for distance modeling.",
    type: "documentation",
    connectionsCount: 1
  },
  {
    id: "doc_bearing",
    label: "Cap initial",
    community: 0,
    communityName: "physics.py",
    description: "Documentation: Cap initial entre deux points GPS [0-360°].",
    details: "Heading calculations. Establishes formulas for initial horizontal azimuth angle mapping.",
    type: "documentation",
    connectionsCount: 1
  },
  {
    id: "doc_cross_along",
    label: "Décomposition erreur",
    community: 0,
    communityName: "physics.py",
    description: "Documentation: Décomposition de l'erreur en cross-track et along-track.",
    details: "Navigation safety standard. Distinguishes lateral drift (cross-track) from timing or headway mismatch (along-track).",
    type: "documentation",
    connectionsCount: 1
  },

  // --- Community 1 (predict_hybrid.py) ---
  {
    id: "get_seed_state_from_flight",
    label: "get_seed_state_from_flight()",
    community: 1,
    communityName: "predict_hybrid.py",
    description: "Extraction de l'état initial (seed) d'un vol.",
    details: "Fetches the sliding window initial history (lat, lon, altitude, course, rate of climb, speed) from raw flight segments to seed the physics predictor.",
    type: "function",
    connectionsCount: 2,
    code: `def get_seed_state_from_flight(flight_history: list, window_size: int = 3) -> dict:
    """Extract initial state from flight history sequence."""
    if len(flight_history) < window_size:
        raise ValueError("Flight history too short to seed predictor")
    latest = flight_history[-1]
    penultimate = flight_history[-2]
    
    # Compute climb rate and turn rate
    dt = latest['timestamp'] - penultimate['timestamp']
    climb_rate = (latest['alt'] - penultimate['alt']) / (dt / 60.0) if dt > 0 else 0.0
    
    return {
        "lat": latest["lat"],
        "lon": latest["lon"],
        "alt": latest["alt"],
        "speed": latest["speed"],
        "bearing": latest["bearing"],
        "climb_rate": climb_rate,
        "timestamp": latest["timestamp"]
    }`
  },
  {
    id: "predict_next_hybrid",
    label: "predict_next_hybrid()",
    community: 1,
    communityName: "predict_hybrid.py",
    description: "Prédiction du prochain état par modèle physique hybride.",
    details: "Simulates the state transition vector over a time step dt. Uses a hybrid approach combining kinematics with physical boundary clipping (maximum banking/turn rate and acceleration boundaries). No heavy Kalman filters are used; physical constraints and clipping are sufficient.",
    type: "function",
    connectionsCount: 5,
    code: `from physics import destination_point, haversine_km, bearing_deg

def predict_next_hybrid(state: dict, dt_seconds: float, wind_drift: float = 0.0) -> dict:
    """
    Predict next state using kinematic trajectory and clipping bounds.
    No Kalman filter needed: physics + clipping + bearing rate limiting are sufficient.
    """
    R = 6371.0
    dt_hours = dt_seconds / 3600.0
    
    # Distance covered in km
    distance = state["speed"] * dt_hours
    
    # Apply heading turn limit (clipping)
    max_turn_deg_per_sec = 3.0  # Limit to standard rate turn (3 deg/s)
    capped_turn = max(-max_turn_deg_per_sec * dt_seconds, 
                      min(max_turn_deg_per_sec * dt_seconds, wind_drift))
    new_bearing = (state["bearing"] + capped_turn) % 360
    
    # Move coordinates using destination_point
    new_lat, new_lon = destination_point(state["lat"], state["lon"], 
                                         distance, new_bearing)
    
    # Climb kinematics
    new_alt = state["alt"] + state.get("climb_rate", 0.0) * (dt_seconds / 60.0)
    new_alt = max(0.0, new_alt) # Can't fly underground
    
    return {
        "lat": new_lat,
        "lon": new_lon,
        "alt": new_alt,
        "speed": state["speed"],
        "bearing": new_bearing,
        "climb_rate": state.get("climb_rate", 0.0)
    }`
  },
  {
    id: "predict_trajectory_hybrid",
    label: "predict_trajectory_hybrid()",
    community: 1,
    communityName: "predict_hybrid.py",
    description: "Génération de la trajectoire complète prédite.",
    details: "Iteratively rolls forward predict_next_hybrid over a specified future horizon (e.g., 30 minutes, 1-minute steps) to construct the complete predicted flight trajectory sequence.",
    type: "function",
    connectionsCount: 4,
    code: `from predict_hybrid import predict_next_hybrid, get_seed_state_from_flight

def predict_trajectory_hybrid(flight_segment: list, steps: int, dt_seconds: float) -> list:
    """Generates sequential state list of predicted futures."""
    seed = get_seed_state_from_flight(flight_segment)
    trajectory = [seed]
    
    current_state = seed
    for _ in range(steps):
        next_state = predict_next_hybrid(current_state, dt_seconds)
        trajectory.append(next_state)
        current_state = next_state
        
    return trajectory`
  },
  {
    id: "doc_no_kalman",
    label: "Hybride sans Kalman",
    community: 1,
    communityName: "predict_hybrid.py",
    description: "Documentation: Pas de filtre de Kalman : la physique + le clipping + la limite de cap suffisent.",
    details: "A key engineering architectural insight: for short-term aircraft predictions, strict geodesic physics combined with kinematic acceleration/heading rate clipping outperforms complex, noisy Kalman filters.",
    type: "documentation",
    connectionsCount: 1
  },

  // --- Community 2 (destination_point) ---
  {
    id: "destination_point",
    label: "destination_point()",
    community: 2,
    communityName: "destination_point.py",
    description: "Position GPS après déplacement sur grand cercle (problème géodésique direct).",
    details: "Solves the direct geodesic problem on a spherical Earth: given a start coordinate, initial bearing, and distance in km, computes the terminal latitude and longitude.",
    type: "function",
    connectionsCount: 5,
    code: `import math

def destination_point(lat: float, lon: float, distance_km: float, bearing_deg: float) -> tuple[float, float]:
    """Position GPS après déplacement sur grand cercle (problème géodésique direct)."""
    R = 6371.0
    angular_dist = distance_km / R
    theta = math.radians(bearing_deg)
    
    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)
    
    phi2 = math.asin(math.sin(phi1) * math.cos(angular_dist) + 
                     math.cos(phi1) * math.sin(angular_dist) * math.cos(theta))
    
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(angular_dist) * math.cos(phi1),
        math.cos(angular_dist) - math.sin(phi1) * math.sin(phi2)
    )
    
    return math.degrees(phi2), math.degrees(lambda2)`
  },
  {
    id: "doc_direct_problem",
    label: "Problème géodésique direct",
    community: 2,
    communityName: "destination_point.py",
    description: "Documentation: Résolution du problème géodésique direct.",
    details: "Solving terminal coordinates given starting point, geodesic course angle, and flight step displacement.",
    type: "documentation",
    connectionsCount: 1
  },

  // --- Community 3 (data_loader.py) ---
  {
    id: "parse_adsb_raw",
    label: "parse_adsb_raw()",
    community: 3,
    communityName: "data_loader.py",
    description: "Parse raw Mode-S/ADS-B transponder messages.",
    details: "Parses binary transponder signals into timestamped state vectors (ICAO24 hex, timestamp, latitude, longitude, barometric altitude, velocity, ground track).",
    type: "function",
    connectionsCount: 4,
    code: `def parse_adsb_raw(hex_payload: str) -> dict:
    """Extract raw coordinates and speed vectors from ADSB messages."""
    # Simplified decoding demo
    return {
        "icao24": "3c64ac",
        "timestamp": 1782934000,
        "lat": 48.8566,
        "lon": 2.3522,
        "alt": 10600, # meters
        "speed": 820, # km/h
        "bearing": 285.5
    }`
  },
  {
    id: "clean_trajectories",
    label: "clean_trajectories()",
    community: 3,
    communityName: "data_loader.py",
    description: "Cleans noisy telemetry, flags outliers, and splits multi-vol logs.",
    details: "Filters GPS leaps, fills altitude missing readings, and groups contiguous flight readings into segments based on time gap thresholds.",
    type: "function",
    connectionsCount: 3,
    code: `from physics import haversine_km

def clean_trajectories(records: list) -> list[list]:
    """Filter records and split them into distinct flight tracks."""
    cleaned = []
    # Remove records without lat/lon
    records = [r for r in records if r.get('lat') and r.get('lon')]
    if not records:
        return []
    
    # Simple split if delta_time > 15 mins or distance jump > 100km
    tracks = []
    current_track = [records[0]]
    for r in records[1:]:
        prev = current_track[-1]
        dt = r['timestamp'] - prev['timestamp']
        dist = haversine_km(prev['lat'], prev['lon'], r['lat'], r['lon'])
        if dt > 900 or dist > 100:
            tracks.append(current_track)
            current_track = [r]
        else:
            current_track.append(r)
    tracks.append(current_track)
    return tracks`
  },
  {
    id: "raw_data_format",
    label: "ADS-B Vector format",
    community: 3,
    communityName: "data_loader.py",
    description: "Data Schema: Format of raw flight vectors loaded from ADSB.",
    details: "Defines dictionary schema: ICAO24 string, Unix timestamp, float Coordinates, Speed in knots, Altitude in feet.",
    type: "concept",
    connectionsCount: 2
  },

  // --- Community 4 (metrics.py) ---
  {
    id: "mean_absolute_error_km",
    label: "mean_absolute_error_km()",
    community: 4,
    communityName: "metrics.py",
    description: "Erreur moyenne absolue géographique.",
    details: "Calculates the average distance error in kilometers between predicted trajectory points and the actual flight coordinates.",
    type: "function",
    connectionsCount: 2,
    code: `def mean_absolute_error_km(actual: list, predicted: list) -> float:
    """Average Euclidean/Geodesic distance error."""
    errors = []
    for act, pred in zip(actual, predicted):
        err = haversine_km(act['lat'], act['lon'], pred['lat'], pred['lon'])
        errors.append(err)
    return sum(errors) / len(errors) if errors else 0.0`
  },
  {
    id: "root_mean_square_error_km",
    label: "root_mean_square_error_km()",
    community: 4,
    communityName: "metrics.py",
    description: "RMSE géographique en km pour pénaliser les fortes dérives.",
    details: "Root Mean Square Error. Highlights and heavily penalizes large trajectory deviations or abrupt track drops.",
    type: "function",
    connectionsCount: 2,
    code: `import math

def root_mean_square_error_km(actual: list, predicted: list) -> float:
    """Root Mean Square geodesic error in km."""
    sq_errors = []
    for act, pred in zip(actual, predicted):
        err = haversine_km(act['lat'], act['lon'], pred['lat'], pred['lon'])
        sq_errors.append(err ** 2)
    return math.sqrt(sum(sq_errors) / len(sq_errors)) if sq_errors else 0.0`
  },
  {
    id: "evaluate_predictions",
    label: "evaluate_predictions()",
    community: 4,
    communityName: "metrics.py",
    description: "Analyse statistique de performance de prédiction.",
    details: "Aggregates MAE, RMSE, and decomposes spatial errors into Mean Cross-Track drift and Mean Along-Track timing lag.",
    type: "function",
    connectionsCount: 5,
    code: `from metrics import mean_absolute_error_km, root_mean_square_error_km
from physics import cross_along_track

def evaluate_predictions(actual: list, predicted: list) -> dict:
    """Run full evaluation suite across predicted segments."""
    mae = mean_absolute_error_km(actual, predicted)
    rmse = root_mean_square_error_km(actual, predicted)
    
    # Calculate along-track and cross-track error vectors
    xt_errors = []
    at_errors = []
    for i in range(1, len(actual)):
        start = actual[i-1]
        end = actual[i]
        pred = predicted[i]
        
        xt, at = cross_along_track(start['lat'], start['lon'],
                                   end['lat'], end['lon'],
                                   pred['lat'], pred['lon'])
        xt_errors.append(abs(xt))
        at_errors.append(abs(at))
        
    return {
        "mae_km": mae,
        "rmse_km": rmse,
        "mean_cross_track_drift_km": sum(xt_errors)/len(xt_errors) if xt_errors else 0.0,
        "mean_along_track_timing_km": sum(at_errors)/len(at_errors) if at_errors else 0.0
    }`
  },

  // --- Community 5 (visualization_cli.py) ---
  {
    id: "plot_trajectory_comparison",
    label: "plot_trajectory_comparison()",
    community: 5,
    communityName: "visualization_cli.py",
    description: "Génère des tracés cartographiques de comparaison.",
    details: "Plots predicted coordinates vs actual trajectory points over a Geographic map projection.",
    type: "function",
    connectionsCount: 4,
    code: `import matplotlib.pyplot as plt

def plot_trajectory_comparison(actual: list, predicted: list, save_path: str):
    """Draw actual vs predicted on map."""
    plt.figure(figsize=(10, 6))
    act_lats = [x['lat'] for x in actual]
    act_lons = [x['lon'] for x in actual]
    pred_lats = [x['lat'] for x in predicted]
    pred_lons = [x['lon'] for x in predicted]
    
    plt.plot(act_lons, act_lats, 'g-o', label='Actual Path')
    plt.plot(pred_lons, pred_lats, 'r--', label='Predicted Hybrid')
    plt.xlabel('Longitude')
    plt.ylabel('Latitude')
    plt.title('Flight Trajectory Prediction Comparison')
    plt.legend()
    plt.grid(True)
    plt.savefig(save_path)`
  },
  {
    id: "cli_run",
    label: "cli_run()",
    community: 5,
    communityName: "visualization_cli.py",
    description: "Point d'entrée CLI pour exécuter le système.",
    details: "Coordinates raw ADSB file loading, splitting trajectories, running rolling predictors, exporting comparisons and statistics.",
    type: "function",
    connectionsCount: 5,
    code: `import argparse
from data_loader import parse_adsb_raw, clean_trajectories
from predict_hybrid import predict_trajectory_hybrid
from metrics import evaluate_predictions
from visualization_cli import plot_trajectory_comparison

def cli_run():
    parser = argparse.ArgumentParser(description="Run Geodesic Trajectory Predictor")
    parser.add_argument("--input", type=str, required=True, help="Path to ADSB raw log")
    args = parser.parse_args()
    
    print("Parsing records...")
    # System core orchestration pipeline...`
  }
];

export const graphLinks: GraphLink[] = [
  // Community 0 links
  { source: "haversine_km", target: "doc_haversine", type: "explains", isCrossCommunity: false },
  { source: "bearing_deg", target: "doc_bearing", type: "explains", isCrossCommunity: false },
  { source: "cross_along_track", target: "doc_cross_along", type: "explains", isCrossCommunity: false },
  { source: "cross_along_track", target: "haversine_km", type: "calls", isCrossCommunity: false },
  { source: "cross_along_track", target: "bearing_deg", type: "calls", isCrossCommunity: false },

  // predict_hybrid connects to physics
  { source: "predict_next_hybrid", target: "haversine_km", type: "calls", isCrossCommunity: true },
  { source: "predict_next_hybrid", target: "bearing_deg", type: "calls", isCrossCommunity: true },
  { source: "predict_next_hybrid", target: "destination_point", type: "calls", isCrossCommunity: true },
  { source: "predict_next_hybrid", target: "doc_no_kalman", type: "explains", isCrossCommunity: false },

  // predict_trajectory_hybrid connects to seed, next_hybrid, and geometry
  { source: "predict_trajectory_hybrid", target: "predict_next_hybrid", type: "calls", isCrossCommunity: false },
  { source: "predict_trajectory_hybrid", target: "get_seed_state_from_flight", type: "calls", isCrossCommunity: false },
  { source: "predict_trajectory_hybrid", target: "haversine_km", type: "calls", isCrossCommunity: true },
  { source: "predict_trajectory_hybrid", target: "bearing_deg", type: "calls", isCrossCommunity: true },

  // destination_point connections
  { source: "destination_point", target: "doc_direct_problem", type: "explains", isCrossCommunity: false },
  { source: "destination_point", target: "cross_along_track", type: "references", isCrossCommunity: true },

  // data_loader connections
  { source: "clean_trajectories", target: "haversine_km", type: "calls", isCrossCommunity: true },
  { source: "parse_adsb_raw", target: "clean_trajectories", type: "calls", isCrossCommunity: false },
  { source: "clean_trajectories", target: "raw_data_format", type: "references", isCrossCommunity: false },
  { source: "get_seed_state_from_flight", target: "parse_adsb_raw", type: "references", isCrossCommunity: true },

  // metrics connections
  { source: "mean_absolute_error_km", target: "haversine_km", type: "calls", isCrossCommunity: true },
  { source: "root_mean_square_error_km", target: "haversine_km", type: "calls", isCrossCommunity: true },
  { source: "evaluate_predictions", target: "mean_absolute_error_km", type: "calls", isCrossCommunity: false },
  { source: "evaluate_predictions", target: "root_mean_square_error_km", type: "calls", isCrossCommunity: false },
  { source: "evaluate_predictions", target: "cross_along_track", type: "calls", isCrossCommunity: true },

  // visualization connections
  { source: "plot_trajectory_comparison", target: "destination_point", type: "calls", isCrossCommunity: true },
  { source: "plot_trajectory_comparison", target: "bearing_deg", type: "calls", isCrossCommunity: true },
  { source: "plot_trajectory_comparison", target: "evaluate_predictions", type: "references", isCrossCommunity: true },

  // cli entry points
  { source: "cli_run", target: "predict_trajectory_hybrid", type: "calls", isCrossCommunity: true },
  { source: "cli_run", target: "plot_trajectory_comparison", type: "calls", isCrossCommunity: false },
  { source: "cli_run", target: "parse_adsb_raw", type: "calls", isCrossCommunity: true },
  { source: "cli_run", target: "evaluate_predictions", type: "calls", isCrossCommunity: true }
];
