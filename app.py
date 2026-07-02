import streamlit as st
import numpy as np
import pandas as pd

from predict_hybrid import (
    get_seed_state_from_flight,
    predict_trajectory_hybrid,
)

st.set_page_config(page_title="FMS Hybride IA Aéronautique", page_icon="✈️", layout="centered")


@st.cache_resource
def load_features():
    try:
        return pd.read_csv("trajectory_features_rf.csv")
    except FileNotFoundError:
        return None


features_df = load_features()

st.title("✈️ FMS Hybride — IA Aéronautique")
st.write("Physique (dead reckoning) + Random Forest sur résidus")

st.divider()

mode = st.radio("Point de départ", ["Vol réel du dataset (recommandé)", "État manuel"], horizontal=True)
steps = st.slider("Horizon de prédiction (steps)", 5, 50, 20)

st.divider()

seed_state = None

if mode == "Vol réel du dataset (recommandé)":

    if features_df is None:
        st.error("Dataset introuvable")
    else:
        flight_ids = sorted(features_df["flight"].unique().tolist())

        if len(flight_ids) == 0:
            st.error("Aucun vol disponible")
        else:
            flight_choice = st.selectbox("Choisir un vol", flight_ids)

            if st.button("🔍 Lancer la prédiction", use_container_width=True):
                seed_state = get_seed_state_from_flight(features_df, flight_choice)

else:
    if features_df is None:
        st.warning("Dataset introuvable → mode manuel uniquement")

    col1, col2 = st.columns(2)
    with col1:
        lat = st.number_input("Latitude", value=40.7128, format="%.4f")
        lon = st.number_input("Longitude", value=-74.0060, format="%.4f")
        alt = st.number_input("Altitude (ft)", value=35000.0)
    with col2:
        mph = st.number_input("Vitesse (mph)", value=480.0)
        heading_deg = st.slider("Cap initial (°)", 0, 359, 90)
        dt = st.slider("dt (sec)", 60, 600, 600)

    if st.button("🔍 Lancer la prédiction", use_container_width=True):
        seed_state = {
            "lat": lat, "lon": lon, "alt": alt, "mph": mph,
            "dt": dt, "heading_deg": heading_deg, "vertical_speed": 0.0,
        }

if seed_state is not None:

    with st.spinner("Calcul trajectoire hybride..."):
        traj = predict_trajectory_hybrid(seed_state, steps=steps)
        df = pd.DataFrame(traj)

    st.success("Trajectoire générée (physique + correction RF)")
    st.dataframe(df)

    st.subheader("🗺️ Trajectoire")
    st.map(df[["lat", "lon"]])

    st.subheader("📊 Analyse")
    col_a, col_b, col_c = st.columns(3)
    col_a.metric("Altitude max (ft)", f"{df['alt'].max():.0f}")
    col_b.metric("Variation altitude", f"{np.abs(np.diff(df['alt'])).sum():.0f}")

    if "cross_track_km" in df.columns:
        col_c.metric("Déviation latérale max (km)", f"{df['cross_track_km'].abs().max():.2f}")
    else:
        col_c.metric("Déviation latérale max (km)", "N/A")

st.divider()
st.caption("FMS Hybride : Physique + Random Forest sur résidus (PFE aéronautique)")