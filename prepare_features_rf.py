import pandas as pd
import numpy as np

from physics import haversine_km, bearing_deg, destination_point, cross_along_track

print("Chargement dataset...")

data = pd.read_csv("aircraft_data.csv")

HEADING_CANDIDATES = ["track", "heading", "heading_deg", "course", "dir", "trak"]
native_heading_col = next((c for c in HEADING_CANDIDATES if c in data.columns), None)

if native_heading_col:
    print(f"-> Colonne de cap native détectée : '{native_heading_col}'")
else:
    print("-> Aucune colonne de cap native, calcul via bearing sphérique")

essential_cols = ["flight", "lat", "long", "alt", "mph", "spotted"]
data = data.dropna(subset=essential_cols)

data["spotted"] = pd.to_datetime(data["spotted"], errors="coerce")
data = data.dropna(subset=["spotted"])

data = data[data["flight"] != "0"]

# ===== RÉGIME DE VOL HOMOGÈNE =====
# Le dataset mélange des régimes très différents (avions de ligne en
# croisière 250-600mph/>10000ft, avions légers/patrouille en orbite à basse
# vitesse et basse altitude, taxi au sol). Mélanger ces régimes dans un seul
# modèle produit des dynamiques contradictoires (cf. analyse du vol ARRIS47
# qui "voulait" une vitesse quasi nulle). On se concentre ici sur le régime
# de croisière/montée-descente d'avions de ligne, cohérent avec l'objectif
# FMS du PFE.
MIN_CRUISE_MPH = 250
MIN_CRUISE_ALT_FT = 10000

data = data[
    data["lat"].between(-90, 90) &
    data["long"].between(-180, 180) &
    (data["alt"] >= MIN_CRUISE_ALT_FT) &
    (data["mph"].between(MIN_CRUISE_MPH, 700))
]

data = data.sort_values(["flight", "spotted"]).reset_index(drop=True)

rows = []

for flight_id, group in data.groupby("flight"):

    group = group.reset_index(drop=True)

    # dt par rapport au point précédent, et identification des chaînes
    # temporellement continues (pas de saut > 600s, ni dt<=0)
    dt_prev_all = group["spotted"].diff().dt.total_seconds()
    valid_prev = (dt_prev_all > 0) & (dt_prev_all <= 600)
    valid_prev = valid_prev.fillna(False)
    run_id = (~valid_prev).cumsum()

    group["run_id"] = run_id

    for rid, run_group in group.groupby("run_id"):

        run_group = run_group.reset_index(drop=True)

        if len(run_group) < 3:
            continue  # il faut prev, cur, next

        for i in range(1, len(run_group) - 1):

            prev = run_group.iloc[i - 1]
            cur = run_group.iloc[i]
            nxt = run_group.iloc[i + 1]

            dt_prev = (cur["spotted"] - prev["spotted"]).total_seconds()
            dt_next = (nxt["spotted"] - cur["spotted"]).total_seconds()

            if dt_prev <= 0 or dt_prev > 600 or dt_next <= 0 or dt_next > 600:
                continue

            # cap "connu" au moment de la prédiction : calculé entre le point
            # précédent et le point courant (PAS entre cur et next, sinon fuite)
            if native_heading_col and not pd.isna(cur[native_heading_col]):
                heading_prev_deg = float(cur[native_heading_col])
            else:
                heading_prev_deg = bearing_deg(prev["lat"], prev["long"], cur["lat"], cur["long"])

            vertical_speed_prev = (cur["alt"] - prev["alt"]) / dt_prev
            mph_cur = cur["mph"]

            # ===== BASELINE PHYSIQUE (dead reckoning) =====
            dist_km_pred = mph_cur * 1.60934 * (dt_next / 3600.0)
            baseline_lat, baseline_lon = destination_point(
                cur["lat"], cur["long"], heading_prev_deg, dist_km_pred
            )
            baseline_alt = cur["alt"] + vertical_speed_prev * dt_next

            # ===== RESIDUS RÉELS (ce que le RF doit apprendre) =====
            cross_track_km, along_track_km = cross_along_track(
                cur["lat"], cur["long"], heading_prev_deg, nxt["lat"], nxt["long"]
            )
            along_track_residual_km = along_track_km - dist_km_pred
            alt_residual = nxt["alt"] - baseline_alt

            heading_rad = np.radians(heading_prev_deg)

            rows.append({
                "flight": flight_id,
                "run_id": rid,

                # ----- INPUT (connu au moment de la prédiction) -----
                "lat": cur["lat"],
                "long": cur["long"],
                "alt": cur["alt"],
                "mph": mph_cur,
                "dt_seconds": dt_next,
                "heading_sin": np.sin(heading_rad),
                "heading_cos": np.cos(heading_rad),
                "vertical_speed_prev": vertical_speed_prev,
                "dt_prev": dt_prev,

                # ----- baseline (pour debug/analyse) -----
                "baseline_lat": baseline_lat,
                "baseline_lon": baseline_lon,
                "baseline_alt": baseline_alt,
                "dist_km_pred": dist_km_pred,

                # ----- TARGETS (résidus à apprendre) -----
                "cross_track_km": cross_track_km,
                "along_track_residual_km": along_track_residual_km,
                "alt_residual": alt_residual,
            })

features_df = pd.DataFrame(rows)

print("\nNombre d'exemples (triplets valides) :", len(features_df))
if len(features_df) > 0:
    print(features_df.head())
    print("\nStats résidus :")
    print(features_df[["cross_track_km", "along_track_residual_km", "alt_residual"]].describe())

features_df.to_csv("trajectory_features_rf.csv", index=False)
print("\n✔ trajectory_features_rf.csv prêt pour Random Forest hybride")