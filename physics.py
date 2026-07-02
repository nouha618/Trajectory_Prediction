import numpy as np

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1, lon1, lat2, lon2):
    """Distance grand cercle (km) entre deux points GPS."""
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    a = np.clip(a, 0.0, 1.0)
    c = 2 * np.arcsin(np.sqrt(a))
    return EARTH_RADIUS_KM * c


def bearing_deg(lat1, lon1, lat2, lon2):
    """Cap initial entre deux points GPS [0-360°]."""
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    x = np.sin(dlon) * np.cos(lat2)
    y = np.cos(lat1) * np.sin(lat2) - np.sin(lat1) * np.cos(lat2) * np.cos(dlon)
    brng = np.degrees(np.arctan2(x, y))
    return (brng + 360.0) % 360.0


def destination_point(lat1, lon1, bearing_degrees, distance_km):
    """Position GPS après déplacement sur grand cercle (problème géodésique direct)."""
    lat1_r = np.radians(lat1)
    lon1_r = np.radians(lon1)
    brng = np.radians(bearing_degrees)
    delta = distance_km / EARTH_RADIUS_KM

    sin_lat1 = np.sin(lat1_r)
    cos_lat1 = np.cos(lat1_r)
    sin_delta = np.sin(delta)
    cos_delta = np.cos(delta)

    lat2_r = np.arcsin(sin_lat1 * cos_delta + cos_lat1 * sin_delta * np.cos(brng))
    lon2_r = lon1_r + np.arctan2(
        np.sin(brng) * sin_delta * cos_lat1,
        cos_delta - sin_lat1 * np.sin(lat2_r)
    )

    return np.degrees(lat2_r), np.degrees(lon2_r)


def cross_along_track(lat1, lon1, path_bearing_deg, lat3, lon3):
    """
    Décomposition erreur trajectoire (formules de navigation sphérique) :
      - cross_track_km : déviation latérale signée (virage)
      - along_track_km : distance parcourue le long de la route théorique
    """
    R = EARTH_RADIUS_KM

    d13 = haversine_km(lat1, lon1, lat3, lon3) / R
    d13 = np.clip(d13, 0.0, np.pi)

    theta13 = np.radians(bearing_deg(lat1, lon1, lat3, lon3))
    theta12 = np.radians(path_bearing_deg)

    cross_track = np.arcsin(np.clip(np.sin(d13) * np.sin(theta13 - theta12), -1.0, 1.0))
    cross_track_km = cross_track * R

    cos_d13 = np.cos(d13)
    cos_cross = np.cos(cross_track)
    denom = np.clip(cos_cross, 1e-6, None)  # évite division par zéro

    along_track = np.arccos(np.clip(cos_d13 / denom, -1.0, 1.0))
    along_track_km = along_track * R

    direction_sign = np.sign(np.cos(theta13 - theta12))
    along_track_km *= direction_sign

    return cross_track_km, along_track_km