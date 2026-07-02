# ✈️ Trajectory Prediction

Prédiction de trajectoires d'avions à partir d'un **dataset ADS-B réel issu de Kaggle**, combinant un modèle physique de vol et du machine learning (Random Forest) pour corriger les résidus. Une interface interactive **Streamlit** permet de visualiser et tester les prédictions.

> Projet de Fin d'Études (PFE) — Ingénierie Aéronautique, ESAT Tunis.

---

## 🎯 Objectif

Prédire l'évolution de la position et de la trajectoire d'un avion à partir de son historique de vol (dataset ADS-B, Kaggle), en s'appuyant sur :
1. Un **modèle physique** basé sur les équations de la mécanique du vol pour une première estimation.
2. Un **modèle Random Forest** entraîné pour corriger les résidus/erreurs du modèle physique.

Cette approche hybride permet d'allier l'interprétabilité physique et la capacité de généralisation du machine learning.

---

## 📊 Source des données

Le dataset ADS-B utilisé provient de Kaggle : **[Aircraft local flight data (ADS-B and FAA)](https://www.kaggle.com/datasets/brianwarner/aircraft-data-from-nov-2022-through-dec-31-2022)**, couvrant la période de novembre à décembre 2022 (fabricant, modèle, propriétaire, vitesse, altitude, etc.).

## 🧠 Approche

Le projet est passé d'un pipeline initial basé sur un **LSTM** (devenu instable / peu fiable) à une approche **hybride physique + Random Forest**, plus robuste et plus facile à interpréter et déboguer.

Pipeline actuel :
1. **Exploration & nettoyage des données** ADS-B (dataset Kaggle) (`explore_data.py`, `diagnose.py`)
2. **Modélisation physique** du vol (`physics.py`, `physics_limits.pkl`)
3. **Préparation des features** pour le modèle ML (`prepare_features_rf.py`)
4. **Entraînement du Random Forest** sur les résidus (`train_rf.py`, `rf_residual_model.pkl`)
5. **Prédiction hybride** (physique + correction RF) (`predict_hybrid.py`)
6. **Validation** via une suite de tests (`test_pipeline`)
7. **Interface de démonstration** (`app.py` + dossier `demo_app/`)

---

## 📁 Structure du repository

```
Trajectory_Prediction/
├── app.py                      # Interface Streamlit principale
├── physics.py                  # Modèle physique de vol
├── predict_hybrid.py           # Prédiction hybride (physique + RF)
├── prepare_features_rf.py      # Préparation des features pour le RF
├── train_rf.py                 # Entraînement du Random Forest
├── explore_data.py             # Exploration des données ADS-B
├── diagnose.py                 # Scripts de diagnostic
├── test_pipeline                # Suite de tests (pytest)
│
├── aircraft_data.csv           # Données brutes ADS-B (dataset Kaggle)
├── trajectory_features.csv     # Features extraites
├── trajectory_features_rf.csv  # Features pour le modèle RF
├── trajectory_filtered.npy     # Trajectoires filtrées
│
├── rf_residual_model.pkl       # Modèle Random Forest entraîné (résidus)
├── trajectory_model.pkl        # Modèle de trajectoire final
├── physics_limits.pkl          # Contraintes physiques du modèle
├── input_scaler.pkl            # Normalisation des entrées
├── target_scaler.pkl           # Normalisation des sorties
├── rf_meta.pkl / model_meta.pkl / target_scaler.pkl  # Métadonnées des modèles
│
├── demo_app/                   # 🆕 Application de démonstration (AI Studio)
│                                #    Illustre le champ d'application concret du projet
│
└── graphify-out/                # Sorties de visualisation
```

> ⚠️ Note : `fms_lstm_model.h5` est un reliquat de l'ancien pipeline LSTM, conservé à titre d'historique mais non utilisé dans l'approche actuelle.

---

## 🚀 Application de démonstration (`demo_app/`)

Le dossier `demo_app/` contient une application indépendante développée pour **illustrer concrètement le champ d'application** du projet (visualisation interactive de trajectoires prédites). Elle a été générée via Google AI Studio et permet une démonstration rapide sans nécessiter l'exécution complète du pipeline d'entraînement.

---

## 🛠️ Installation & utilisation

```bash
# Cloner le repo
git clone https://github.com/nouha618/Trajectory_Prediction.git
cd Trajectory_Prediction

# Créer un environnement virtuel
python -m venv venv
venv\Scripts\activate        # Windows

# Installer les dépendances
pip install -r requirements.txt

# Lancer l'interface Streamlit
streamlit run app.py
```

### Lancer les tests

```bash
pytest test_pipeline
```

---

## 🧰 Stack technique

- **Python** — traitement des données, modélisation
- **Random Forest (scikit-learn)** — correction des résidus du modèle physique
- **Streamlit** — interface interactive
- **Pandas / NumPy** — manipulation des données ADS-B
- **Pytest** — validation du pipeline (32 tests)

---

## 👤 Auteur

**Nouha** — Élève-ingénieure en Aéronautique, ESAT Tunis (promotion 2027)

---

## 📄 Licence

Projet académique — libre utilisation à des fins pédagogiques.
