import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score

print("Chargement des données...")

data = pd.read_csv("trajectory_features_rf.csv")
print("Nombre d'exemples :", len(data))

data = data.dropna()
print("Après nettoyage NaN :", len(data))

INPUT_COLS = [
    "lat", "long", "alt", "mph", "dt_seconds",
    "heading_sin", "heading_cos",
    "vertical_speed_prev", "dt_prev",
]

TARGET_COLS = ["cross_track_km", "along_track_residual_km", "alt_residual"]

X = data[INPUT_COLS]
y = data[TARGET_COLS]

if len(data) < 20:
    print("\n⚠️ ATTENTION : très peu d'exemples — le modèle sera peu fiable, "
          "mais on entraîne quand même pour avoir une base exploitable.")

# =====================================
# Validation croisée K-fold (plus fiable qu'un seul split avec peu de données)
# =====================================

print("\n===== VALIDATION CROISÉE (5-fold) =====")

n_folds = min(5, len(data) // 10) if len(data) >= 20 else 2
n_folds = max(n_folds, 2)
kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)

cv_model = RandomForestRegressor(
    n_estimators=200, max_depth=5, min_samples_leaf=3, random_state=42, n_jobs=-1
)

for col in TARGET_COLS:
    scores_mae = -cross_val_score(cv_model, X, y[col], cv=kf, scoring="neg_mean_absolute_error")
    scores_r2 = cross_val_score(cv_model, X, y[col], cv=kf, scoring="r2")
    print(f"{col:28s} MAE moy = {scores_mae.mean():.4f} (+/- {scores_mae.std():.4f})   "
          f"R2 moy = {scores_r2.mean():.3f} (+/- {scores_r2.std():.3f})")

print(f"\n(validation croisée sur {n_folds} folds, plus représentative qu'un split unique avec peu de données)")

# =====================================
# Split classique (gardé pour cohérence avec le reste du script)
# =====================================

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print("\nEntraînement du Random Forest...")

# arbres peu profonds + nombreux estimateurs : limite le surapprentissage
# avec un petit dataset
model = RandomForestRegressor(
    n_estimators=200,
    max_depth=5,
    min_samples_leaf=3,
    random_state=42,
    n_jobs=-1,
)

model.fit(X_train, y_train)

pred = model.predict(X_test)

print("\n===== RESULTATS (sur split unique 80/20, à titre indicatif) =====")
for i, col in enumerate(TARGET_COLS):
    mae = mean_absolute_error(y_test[col], pred[:, i])
    r2 = r2_score(y_test[col], pred[:, i])
    print(f"{col:28s} MAE = {mae:.4f}   R2 = {r2:.3f}")

# Importance des features (utile pour ton rapport PFE)
print("\n===== IMPORTANCE DES FEATURES =====")
importances = pd.Series(model.feature_importances_, index=INPUT_COLS).sort_values(ascending=False)
print(importances)

# ===== Modèle FINAL entraîné sur 100% des données =====
# (avec si peu d'exemples, on ne garde pas 20% de côté pour le modèle livré en prod)
final_model = RandomForestRegressor(
    n_estimators=200, max_depth=5, min_samples_leaf=3, random_state=42, n_jobs=-1
)
final_model.fit(X, y)

# Bornes de clipping (percentiles 2-98%) : empêchent le modèle d'extrapoler
# vers des corrections aberrantes lors de la prédiction multi-step (cause
# d'oscillations / demi-tours irréalistes observés en pratique)
clip_bounds = {
    col: (float(y[col].quantile(0.02)), float(y[col].quantile(0.98)))
    for col in TARGET_COLS
}
print("\n===== BORNES DE CLIPPING DES RÉSIDUS (2e-98e percentile) =====")
for col, (lo, hi) in clip_bounds.items():
    print(f"{col:28s} [{lo:.4f}, {hi:.4f}]")

joblib.dump(final_model, "rf_residual_model.pkl")
joblib.dump({
    "input_cols": INPUT_COLS,
    "target_cols": TARGET_COLS,
    "clip_bounds": clip_bounds,
}, "rf_meta.pkl")

print("\n✔ Modèle final (entraîné sur 100% des données) sauvegardé : rf_residual_model.pkl")