import pandas as pd
import numpy as np

# =====================================
# Chargement
# =====================================

print("Chargement du dataset...\n")

data = pd.read_csv("aircraft_data.csv")

print("Dataset chargé.")

# =====================================
# Dimensions
# =====================================

print("\n===== DIMENSIONS =====")
print("Lignes :", data.shape[0])
print("Colonnes :", data.shape[1])

# =====================================
# Types
# =====================================

print("\n===== TYPES =====")
print(data.dtypes)

# =====================================
# Aperçu
# =====================================

print("\n===== HEAD =====")
print(data.head(10))

# =====================================
# Valeurs manquantes
# =====================================

print("\n===== MISSING VALUES =====")
print(data.isnull().sum())

# =====================================
# Vols
# =====================================

if "flight" in data.columns:

    print("\n===== FLIGHTS =====")
    print("Nombre vols uniques :", data["flight"].nunique())
    print("\nTop vols :")
    print(data["flight"].value_counts().head(10))

# =====================================
# Timestamp conversion (IMPORTANT LSTM)
# =====================================

if "spotted" in data.columns:

    print("\n===== TIME =====")

    data["spotted"] = pd.to_datetime(data["spotted"], errors="coerce")

    print("Type après conversion :", data["spotted"].dtype)

    print("NaT values :", data["spotted"].isna().sum())

# =====================================
# Cohérence physique
# =====================================

print("\n===== PHYSICS CHECK =====")

invalid_lat = (~data["lat"].between(-90, 90)).sum()
invalid_lon = (~data["long"].between(-180, 180)).sum()
invalid_alt = (data["alt"] < 0).sum()
invalid_speed = ((data["mph"] < 0) | (data["mph"] > 700)).sum()

print("Lat invalides :", invalid_lat)
print("Lon invalides :", invalid_lon)
print("Alt négatives :", invalid_alt)
print("Speed invalides :", invalid_speed)

# =====================================
# Analyse par vol (IMPORTANT LSTM)
# =====================================

if "flight" in data.columns and "spotted" in data.columns:

    print("\n===== ANALYSE TRAJECTOIRE =====")

    data = data.dropna(subset=["flight", "spotted"])
    data = data.sort_values(["flight", "spotted"])

    data["dt_seconds"] = (
        data.groupby("flight")["spotted"]
        .diff()
        .dt.total_seconds()
    )

    print("\nDT stats :")
    print(data["dt_seconds"].describe())

    print("\nGaps > 600s :", (data["dt_seconds"] > 600).sum())

# =====================================
# Statistiques générales
# =====================================

print("\n===== STATISTICS =====")

numeric_cols = data.select_dtypes(include=np.number).columns

print(data[numeric_cols].describe())

# =====================================
# Analyse aviation (améliorée)
# =====================================

print("\n===== AVIATION INSIGHTS =====")

print("Altitude max :", data["alt"].max())
print("Altitude min :", data["alt"].min())

print("Speed max :", data["mph"].max())
print("Speed min :", data["mph"].min())

# =====================================
# Vérification qualité dataset IA
# =====================================

print("\n===== AI READINESS =====")

score = 100

score -= invalid_lat * 0.5
score -= invalid_lon * 0.5
score -= invalid_alt * 0.2
score -= invalid_speed * 0.2

score = max(score, 0)

print(f"Dataset AI Score : {score:.2f}/100")

if score > 90:
    print("✔ Excellent pour LSTM aviation")
elif score > 70:
    print("⚠ Acceptable mais améliorable")
else:
    print("❌ Nettoyage nécessaire")

# =====================================
# Résumé
# =====================================

print("\n===== SUMMARY =====")

print("✔ Dataset prêt pour :")
print("- LSTM Trajectory Prediction")
print("- FMS simulation")
print("- AI decision system (future)")