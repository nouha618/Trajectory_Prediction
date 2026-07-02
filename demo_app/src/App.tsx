import { useState } from "react";
import { GraphNode } from "./types";
import NetworkGraph from "./components/NetworkGraph";
import FlightSimulator from "./components/FlightSimulator";
import AIExplainer from "./components/AIExplainer";
import {
  GitFork,
  Plane,
  MessageSquareCode,
  Layers,
  FileCode,
  Network,
  Info,
  ExternalLink,
} from "lucide-react";

type ActiveTab = "graph" | "simulator" | "chat";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("graph");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  
  // Cross-tab triggers
  const [chatTriggerPrompt, setChatTriggerPrompt] = useState<string>("");

  const handleSelectNode = (node: GraphNode) => {
    setSelectedNode(node);
  };

  const handleAskAI = (prompt: string) => {
    setChatTriggerPrompt(prompt);
    setActiveTab("chat"); // Switch to AI Explainer tab
  };

  return (
    <div className="min-h-screen bg-[#03060f] text-slate-100 flex flex-col selection:bg-teal-500/20 selection:text-teal-300">
      
      {/* Sleek Aerospace Header */}
      <header className="bg-[#080c14]/90 border-b border-slate-900 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <h1 className="font-sans font-semibold tracking-tight text-lg text-slate-100">
              Trajectory Prediction Graph Explorer
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Geodesic Navigation Physics Playground & ADSB Code Dependency Report
          </p>
        </div>

        {/* Global Summary Stats */}
        <div className="flex gap-4 items-center bg-slate-950 px-4 py-2 rounded-xl border border-slate-900/80">
          <div className="text-center">
            <span className="text-[9px] font-mono text-slate-500 block">NODES</span>
            <span className="text-xs font-mono font-bold text-slate-200">20</span>
          </div>
          <div className="h-6 w-px bg-slate-900" />
          <div className="text-center">
            <span className="text-[9px] font-mono text-slate-500 block">EDGES</span>
            <span className="text-xs font-mono font-bold text-slate-200">31</span>
          </div>
          <div className="h-6 w-px bg-slate-900" />
          <div className="text-center">
            <span className="text-[9px] font-mono text-slate-500 block">COMMUNITIES</span>
            <span className="text-xs font-mono font-bold text-teal-400">6</span>
          </div>
          <div className="h-6 w-px bg-slate-900" />
          <div className="text-center">
            <span className="text-[9px] font-mono text-slate-500 block">EXTRACTION</span>
            <span className="text-xs font-mono font-bold text-teal-400">100%</span>
          </div>
        </div>
      </header>

      {/* Primary Tab Navigation */}
      <div className="px-6 py-3 bg-[#060a12] border-b border-slate-900 flex justify-between items-center shrink-0">
        <div className="flex gap-2">
          {/* Graph Tab */}
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-4 py-2 rounded-xl text-xs font-sans font-medium transition-all flex items-center gap-2 cursor-pointer border ${
              activeTab === "graph"
                ? "bg-teal-500/10 border-teal-500/30 text-teal-300 shadow-md shadow-teal-500/5"
                : "bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400"
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            Architecture Graph
          </button>

          {/* Simulator Tab */}
          <button
            onClick={() => setActiveTab("simulator")}
            className={`px-4 py-2 rounded-xl text-xs font-sans font-medium transition-all flex items-center gap-2 cursor-pointer border ${
              activeTab === "simulator"
                ? "bg-teal-500/10 border-teal-500/30 text-teal-300 shadow-md shadow-teal-500/5"
                : "bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400"
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            Aero Flight Simulator
          </button>

          {/* Chat Tab */}
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-2 rounded-xl text-xs font-sans font-medium transition-all flex items-center gap-2 cursor-pointer border ${
              activeTab === "chat"
                ? "bg-teal-500/10 border-teal-500/30 text-teal-300 shadow-md shadow-teal-500/5"
                : "bg-transparent border-transparent hover:bg-slate-900/50 text-slate-400"
            }`}
          >
            <MessageSquareCode className="w-3.5 h-3.5" />
            AI Physics Explainer
          </button>
        </div>

        {/* Floating System Status Badge */}
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-500">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
          <span>PILOT INTERACTION MODE ENABLED</span>
        </div>
      </div>

      {/* Main Tabbed Layout Panel */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full">
          {activeTab === "graph" && (
            <NetworkGraph
              selectedNode={selectedNode}
              onSelectNode={handleSelectNode}
              onAskAI={handleAskAI}
            />
          )}

          {activeTab === "simulator" && <FlightSimulator />}

          {activeTab === "chat" && (
            <AIExplainer
              chatTriggerPrompt={chatTriggerPrompt}
              onClearTrigger={() => setChatTriggerPrompt("")}
            />
          )}
        </div>
      </main>

      {/* Footnote details info */}
      <footer className="bg-[#04070d] border-t border-slate-900 px-6 py-3 text-center text-[10px] text-slate-500 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-2">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3 text-teal-400" />
          <span>Graph extracted from C:\Users\LENOVO\Downloads\Trajectory_Prediction (2026-07-02)</span>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Spherical Great Circle Models
          </span>
          <span className="flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5" /> No-Kalman Kinematic Clipping
          </span>
        </div>
      </footer>
    </div>
  );
}
