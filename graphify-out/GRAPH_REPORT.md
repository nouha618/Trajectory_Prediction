# Graph Report - C:\Users\LENOVO\Downloads\Trajectory_Prediction  (2026-07-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 20 nodes · 31 edges · 6 communities (5 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_physics.py|physics.py]]
- [[_COMMUNITY_predict_hybrid.py|predict_hybrid.py]]
- [[_COMMUNITY_destination_point|destination_point]]

## God Nodes (most connected - your core abstractions)
1. `haversine_km()` - 6 edges
2. `bearing_deg()` - 6 edges
3. `destination_point()` - 5 edges
4. `cross_along_track()` - 5 edges
5. `predict_next_hybrid()` - 5 edges
6. `predict_trajectory_hybrid()` - 4 edges
7. `get_seed_state_from_flight()` - 2 edges
8. `Distance grand cercle (km) entre deux points GPS.` - 1 edges
9. `Cap initial entre deux points GPS [0-360°].` - 1 edges
10. `Position GPS après déplacement sur grand cercle (problème géodésique direct).` - 1 edges

## Surprising Connections (you probably didn't know these)
- `predict_next_hybrid()` --calls--> `haversine_km()`  [EXTRACTED]
  predict_hybrid.py → physics.py
- `predict_next_hybrid()` --calls--> `bearing_deg()`  [EXTRACTED]
  predict_hybrid.py → physics.py
- `predict_next_hybrid()` --calls--> `destination_point()`  [EXTRACTED]
  predict_hybrid.py → physics.py

## Import Cycles
- None detected.

## Communities (6 total, 1 thin omitted)

### Community 0 - "physics.py"
Cohesion: 0.43
Nodes (6): bearing_deg(), cross_along_track(), haversine_km(), Cap initial entre deux points GPS [0-360°]., Décomposition erreur trajectoire (formules de navigation sphérique) :       - c, Distance grand cercle (km) entre deux points GPS.

### Community 1 - "predict_hybrid.py"
Cohesion: 0.43
Nodes (4): get_seed_state_from_flight(), predict_next_hybrid(), predict_trajectory_hybrid(), Pas de filtre de Kalman : la physique + le clipping + la limite de     cap suff

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `haversine_km()` connect `physics.py` to `predict_hybrid.py`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `bearing_deg()` connect `physics.py` to `predict_hybrid.py`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `destination_point()` connect `destination_point` to `physics.py`, `predict_hybrid.py`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `Distance grand cercle (km) entre deux points GPS.`, `Cap initial entre deux points GPS [0-360°].`, `Position GPS après déplacement sur grand cercle (problème géodésique direct).` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._