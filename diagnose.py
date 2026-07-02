import pandas as pd
import numpy as np

# =====================================
# Chargement
# =====================================

print("\nChargement des données...")

data = pd.read_csv("aircraft_data.csv")

print("Nombre initial :", len(data))

# =====================================
# Colonnes essentielles
# =====================================

required = [
    "flight",
    "lat",
    "long",
    "alt",
    "mph",
    "spotted"
]

missing_cols = [c for c in required if c not in data.columns]

if missing_cols:
    print("\n❌ Colonnes manquantes :", missing_cols)
    exit()

# =====================================
# Nettoyage NaN
# =====================================

print("\nValeurs manquantes :")
print(data[required].isnull().sum())

data["spotted"] = pd.to_datetime(data["spotted"], errors="coerce")
data = data.dropna(subset=["spotted", "flight"])

data = data[data["flight"] != "0"]

# =====================================
# Filtrage physique aviation
# =====================================

print("\n===== CONTROLES PHYSIQUES =====")

bad_lat = (~data["lat"].between(-90, 90)).sum()
bad_lon = (~data["long"].between(-180, 180)).sum()
bad_alt = (data["alt"] < 0).sum()
bad_speed = ((data["mph"] < 0) | (data["mph"] > 700)).sum()

print("Latitude invalide :", bad_lat)
print("Longitude invalide :", bad_lon)
print("Altitude négative :", bad_alt)
print("Vitesses anormales :", bad_speed)

data = data[
    data["lat"].between(-90, 90) &
    data["long"].between(-180, 180) &
    (data["alt"] >= 0) &
    (data["mph"].between(0, 700))
]

# =====================================
# Tri temporel (IMPORTANT LSTM)
# =====================================

data = data.sort_values(["flight", "spotted"])

# =====================================
# dt_seconds
# =====================================

data["dt_seconds"] = (
    data.groupby("flight")["spotted"]
    .diff()
    .dt.total_seconds()
)

print("\n===== TEMPS =====")
print(data["dt_seconds"].describe())

# filtrage plus propre LSTM
data = data[
    (data["dt_seconds"] > 0) &
    (data["dt_seconds"] <= 600)
]

# =====================================
# Analyse trajectoire (optionnel)
# =====================================

data["delta_lat"] = data.groupby("flight")["lat"].diff()
data["delta_long"] = data.groupby("flight")["long"].diff()
data["delta_alt"] = data.groupby("flight")["alt"].diff()

# =====================================
# Anomalies
# =====================================

anomalies = data[
    (abs(data["delta_lat"]) > 1) |
    (abs(data["delta_long"]) > 1) |
    (abs(data["delta_alt"]) > 1000)
]

print("\n===== ANOMALIES =====")
print("Nombre :", len(anomalies))

# =====================================
# SCORE QUALITE (version IA améliorée)
# =====================================

score = 100

# pénalités physiques
score -= bad_lat * 0.5
score -= bad_lon * 0.5
score -= bad_alt * 0.2
score -= bad_speed * 0.2

# pénalité anomalies trajectoire
score -= len(anomalies) * 0.02

# pénalité fragmentation temporelle
score -= data["dt_seconds"].isna().sum() * 0.5

score = max(score, 0)

print("\n===== SCORE QUALITE DATASET =====")
print(f"{score:.2f}/100")

if score > 90:
    print("✔ Dataset excellent pour IA aéronautique (LSTM)")
elif score > 70:
    print("⚠ Dataset acceptable mais améliorable")
else:
    print("❌ Dataset nécessite nettoyage important")