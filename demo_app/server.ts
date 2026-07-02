import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini AI client to prevent crash if key is missing on startup
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// System instruction containing detailed knowledge about the codebase graph and physics equations
const SYSTEM_INSTRUCTION = `You are an expert Flight Navigation & Geodesic Physics AI assistant.
Your focus is to explain the repository structure, code nodes, edges, and spherical geometry calculations used in the "Trajectory Prediction" system.

Codebase graph context:
- 20 nodes, 31 edges, 6 communities.
- Community 0 ("physics.py"): bearing_deg(), cross_along_track(), haversine_km(), description nodes like "Distance grand cercle", "Cap initial".
- Community 1 ("predict_hybrid.py"): get_seed_state_from_flight(), predict_next_hybrid(), predict_trajectory_hybrid(), and "Pas de filtre de Kalman: la physique + clipping".
- Community 2 ("destination_point"): destination_point(), "Position GPS apres deplacement".
- Core functions (God Nodes):
  1. haversine_km() [6 edges] - computes spherical distance.
  2. bearing_deg() [6 edges] - computes initial heading/bearing.
  3. destination_point() [5 edges] - computes position after moving a distance on a bearing.
  4. cross_along_track() [5 edges] - computes along-track and cross-track error distances.
  5. predict_next_hybrid() [5 edges] - core physics prediction stepping.
  6. predict_trajectory_hybrid() [4 edges] - full trajectory sequence generator.

Geodesic Physics formulas:
1. Haversine distance (km) between two GPS points:
   a = sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlon/2)
   c = 2 * atan2(√a, √(1-a))
   d = R * c (where R = 6371 km)

2. Bearing (deg) [0-360°]:
   θ = atan2(sin(Δlon)*cos(lat2), cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(Δlon))
   converted to degrees and normalized to [0, 360).

3. Destination point:
   lat2 = asin(sin(lat1)*cos(d/R) + cos(lat1)*sin(d/R)*cos(θ))
   lon2 = lon1 + atan2(sin(θ)*sin(d/R)*cos(lat1), cos(d/R) - sin(lat1)*sin(lat2))

4. Along-track & Cross-track Error:
   Given start point A, destination B, and current point D:
   δ_AD = haversine(A, D) / R
   θ_AD = bearing(A, D)
   θ_AB = bearing(A, B)
   Cross-track (XT) angular error: δ_XT = asin(sin(δ_AD) * sin(θ_AD - θ_AB))
   Along-track (AT) angular error: δ_AT = acos(cos(δ_AD) / cos(δ_XT))
   Convert back to km by multiplying by R.

Answers must be highly educational, professional, and clear. Explain physical derivations, why certain nodes link (e.g. predict_next_hybrid calls physics functions for state updating), and how to interpret along-track vs cross-track error. Use markdown formatting.`;

// API routes FIRST
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const client = getGeminiClient();
    
    // Convert history format if passed
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const turn of history) {
        contents.push({
          role: turn.role === "user" ? "user" : "model",
          parts: [{ text: turn.content }]
        });
      }
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      error: error.message || "An error occurred while calling the Gemini API.",
    });
  }
});

// Vite middleware for development or static file serving for production
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupViteOrStatic().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
