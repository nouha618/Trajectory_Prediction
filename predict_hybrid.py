import numpy as np
import pandas as pd
import joblib

from physics import haversine_km, bearing_deg, destination_point

model = joblib.load("rf_residual_model.pkl")
meta = joblib.load("rf_meta.pkl")

INPUT_COLS = meta["input_cols"]
TARGET_COLS = meta["target_cols"]
CLIP_BOUNDS = meta.get("clip_bounds", {})

MAX_HEADING_CHANGE_DEG = 30.0  # limite physique : pas plus de 30°/step
MIN_REALISTIC_MPH = 60.0   # vitesse de décrochage approximative (sécurité minimale, tout type d'avion)
MAX_REALISTIC_MPH = 700.0
SPEED_SMOOTHING = 0.5      # mélange new_mph calculé / mph précédent (évite l'effondrement en cascade)


def get_seed_state_from_flight(features_df, flight_id):
    g = features_df[features_df["flight"] == flight_id]
    if g.empty:
        raise ValueError(f"Vol {flight_id} introuvable")

    last_run = g["run_id"].iloc[-1]
    g = g[g["run_id"] == last_run].reset_index(drop=True)
    last = g.iloc[-1]

    heading_deg = (np.degrees(np.arctan2(last["heading_sin"], last["heading_cos"]))) % 360

    return {
        "lat": float(last["lat"]),
        "lon": float(last["long"]),
        "alt": float(last["alt"]),
        "mph": float(last["mph"]),
        "dt": float(last["dt_seconds"]),
        "heading_deg": float(heading_deg),
        "vertical_speed": float(last["vertical_speed_prev"]),
    }


def predict_next_hybrid(state):
    lat, lon, alt = state["lat"], state["lon"], state["alt"]
    mph, dt = state["mph"], state["dt"]
    heading_deg = state["heading_deg"]
    vertical_speed = state["vertical_speed"]

    # ----- 1) Baseline physique -----
    dist_km_pred = mph * 1.60934 * (dt / 3600.0)
    baseline_lat, baseline_lon = destination_point(lat, lon, heading_deg, dist_km_pred)
    baseline_alt = alt + vertical_speed * dt

    # ----- 2) Correction RF -----
    heading_rad = np.radians(heading_deg)
    features = pd.DataFrame([{
        "lat": lat, "long": lon, "alt": alt, "mph": mph, "dt_seconds": dt,
        "heading_sin": np.sin(heading_rad), "heading_cos": np.cos(heading_rad),
        "vertical_speed_prev": vertical_speed, "dt_prev": dt,
    }])[INPUT_COLS]

    residual = model.predict(features)[0]
    cross_track_km, along_track_residual_km, alt_residual = residual

    if CLIP_BOUNDS:
        cross_track_km = float(np.clip(cross_track_km, *CLIP_BOUNDS["cross_track_km"]))
        along_track_residual_km = float(np.clip(along_track_residual_km, *CLIP_BOUNDS["along_track_residual_km"]))
        alt_residual = float(np.clip(alt_residual, *CLIP_BOUNDS["alt_residual"]))

    # plancher de distance basé sur une vitesse MINIMALE ABSOLUE (pas relative
    # à dist_km_pred courant) : évite la spirale d'effondrement où une vitesse
    # déjà faible rend le plancher suivant encore plus faible
    min_dist_km = MIN_REALISTIC_MPH * 1.60934 * (dt / 3600.0)
    max_dist_km = MAX_REALISTIC_MPH * 1.60934 * (dt / 3600.0)
    along_track_km = float(np.clip(dist_km_pred + along_track_residual_km, min_dist_km, max_dist_km))

    # ----- 3) Reconstruction -----
    along_lat, along_lon = destination_point(lat, lon, heading_deg, along_track_km)
    new_lat, new_lon = destination_point(along_lat, along_lon, (heading_deg + 90) % 360, cross_track_km)
    new_alt = max(0.0, baseline_alt + alt_residual)

    # ----- 4) Limite physique de changement de cap -----
    new_heading_raw = bearing_deg(lat, lon, new_lat, new_lon)
    delta = ((new_heading_raw - heading_deg + 180) % 360) - 180

    if abs(delta) > MAX_HEADING_CHANGE_DEG:
        delta = np.sign(delta) * MAX_HEADING_CHANGE_DEG
        new_heading = (heading_deg + delta) % 360
        dist_total_km = haversine_km(lat, lon, new_lat, new_lon)
        new_lat, new_lon = destination_point(lat, lon, new_heading, dist_total_km)
    else:
        new_heading = new_heading_raw

    raw_new_mph = (haversine_km(lat, lon, new_lat, new_lon) / dt) * 3600.0 / 1.60934

    # lissage : on ne remplace jamais brutalement mph par la valeur calculée
    # (cause de la spirale d'effondrement observée) + bornes physiques dures
    new_mph = SPEED_SMOOTHING * raw_new_mph + (1 - SPEED_SMOOTHING) * mph
    new_mph = float(np.clip(new_mph, MIN_REALISTIC_MPH, MAX_REALISTIC_MPH))

    raw_new_vertical_speed = (new_alt - alt) / dt
    new_vertical_speed = SPEED_SMOOTHING * raw_new_vertical_speed + (1 - SPEED_SMOOTHING) * vertical_speed

    new_state = {
        "lat": new_lat, "lon": new_lon, "alt": new_alt,
        "mph": new_mph, "dt": dt,
        "heading_deg": new_heading, "vertical_speed": new_vertical_speed,
    }

    return new_state, {
        "baseline_lat": baseline_lat, "baseline_lon": baseline_lon, "baseline_alt": baseline_alt,
        "cross_track_km": cross_track_km, "along_track_residual_km": along_track_residual_km,
    }


def predict_trajectory_hybrid(initial_state, steps=10):
    """Pas de filtre de Kalman : la physique + le clipping + la limite de
    cap suffisent déjà à garantir une trajectoire stable et réaliste."""
    state = dict(initial_state)
    trajectory = []

    for i in range(steps):
        state, debug = predict_next_hybrid(state)
        trajectory.append({
            "step": i + 1,
            "lat": state["lat"],
            "lon": state["lon"],
            "alt": state["alt"],
            "mph": state["mph"],
            "heading": state["heading_deg"],
            "cross_track_km": debug["cross_track_km"],
        })

    return trajectory


if __name__ == "__main__":
    try:
        features_df = pd.read_csv("trajectory_features_rf.csv")
        flight_id = features_df["flight"].iloc[0]
        seed_state = get_seed_state_from_flight(features_df, flight_id)
        print(f"Amorce avec le vol réel : {flight_id}")
    except Exception as e:
        print("Pas de vol réel disponible, état manuel :", e)
        seed_state = {
            "lat": 40.7128, "lon": -74.0060, "alt": 35000.0,
            "mph": 480.0, "dt": 60.0, "heading_deg": 90.0, "vertical_speed": 0.0,
        }

    print("État initial :", seed_state)
    traj = predict_trajectory_hybrid(seed_state, steps=10)
    for t in traj:
        print(t)