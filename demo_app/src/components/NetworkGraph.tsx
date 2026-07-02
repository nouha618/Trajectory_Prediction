import { useState, useEffect, useRef } from "react";
import { GraphNode, GraphLink } from "../types";
import { graphNodes, graphLinks, communities } from "../data/graphData";
import { Code, BookOpen, Layers, GitFork, ArrowUpRight, HelpCircle } from "lucide-react";

interface NodePosition extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface NetworkGraphProps {
  onSelectNode: (node: GraphNode) => void;
  selectedNode: GraphNode | null;
  onAskAI: (prompt: string) => void;
}

export default function NetworkGraph({ onSelectNode, selectedNode, onAskAI }: NetworkGraphProps) {
  const [nodes, setNodes] = useState<NodePosition[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragNodeIdRef = useRef<string | null>(null);

  // Initialize nodes randomly in a circular distribution
  useEffect(() => {
    const width = 600;
    const height = 500;
    const initialNodes: NodePosition[] = graphNodes.map((node, index) => {
      const angle = (index / graphNodes.length) * 2 * Math.PI;
      const radius = 100 + Math.random() * 80;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    setNodes(initialNodes);
  }, []);

  // Run a continuous light force-directed physics engine
  useEffect(() => {
    if (nodes.length === 0) return;

    let animId: number;
    const width = 600;
    const height = 500;
    const centerX = width / 2;
    const centerY = height / 2;

    const tick = () => {
      setNodes((prevNodes) => {
        // Create a deep copy for step calculation
        const nextNodes = prevNodes.map((n) => ({ ...n }));

        // 1. Repulsive forces (Coulomb)
        const kRep = 1500; // repulsion constant
        for (let i = 0; i < nextNodes.length; i++) {
          for (let j = i + 1; j < nextNodes.length; j++) {
            const dx = nextNodes[j].x - nextNodes[i].x;
            const dy = nextNodes[j].y - nextNodes[i].y;
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);

            if (dist < 280) {
              const force = kRep / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              // Apply opposite forces
              if (nextNodes[i].id !== dragNodeIdRef.current) {
                nextNodes[i].x -= fx;
                nextNodes[i].y -= fy;
              }
              if (nextNodes[j].id !== dragNodeIdRef.current) {
                nextNodes[j].x += fx;
                nextNodes[j].y += fy;
              }
            }
          }
        }

        // 2. Attractive forces (Hooke's Law for links)
        const kAttr = 0.04; // link stiffness
        const dRest = 90;   // rest length
        graphLinks.forEach((link) => {
          const sourceNode = nextNodes.find((n) => n.id === link.source);
          const targetNode = nextNodes.find((n) => n.id === link.target);

          if (sourceNode && targetNode) {
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
            const force = (dist - dRest) * kAttr;

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (sourceNode.id !== dragNodeIdRef.current) {
              sourceNode.x += fx;
              sourceNode.y += fy;
            }
            if (targetNode.id !== dragNodeIdRef.current) {
              targetNode.x -= fx;
              targetNode.y -= fy;
            }
          }
        });

        // 3. Gravity/Center pulling and updates
        const kGravity = 0.015;
        const damping = 0.85;

        nextNodes.forEach((node) => {
          if (node.id === dragNodeIdRef.current) return;

          // Pull to center
          node.vx += (centerX - node.x) * kGravity;
          node.vy += (centerY - node.y) * kGravity;

          // Apply velocity and damp
          node.x += node.vx;
          node.y += node.vy;
          node.vx *= damping;
          node.vy *= damping;

          // Keep inside bounds
          node.x = Math.max(40, Math.min(width - 40, node.x));
          node.y = Math.max(40, Math.min(height - 40, node.y));
        });

        return nextNodes;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [nodes.length]);

  // Handle Dragging
  const handleMouseDown = (nodeId: string) => {
    dragNodeIdRef.current = nodeId;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragNodeIdRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.id === dragNodeIdRef.current) {
            return { ...n, x, y, vx: 0, vy: 0 };
          }
          return n;
        })
      );
    };

    const handleMouseUp = () => {
      dragNodeIdRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const selectedNodeWithPositions = nodes.find((n) => n.id === selectedNode?.id) || selectedNode;

  // Determine connected links and nodes for highlighting
  const isHighlighted = (nodeId: string) => {
    if (!hoveredNode && !selectedNode) return true;
    const focusId = hoveredNode || selectedNode?.id;
    if (nodeId === focusId) return true;

    // Is neighbor?
    return graphLinks.some(
      (l) =>
        (l.source === focusId && l.target === nodeId) ||
        (l.target === focusId && l.source === nodeId)
    );
  };

  const isLinkHighlighted = (link: GraphLink) => {
    if (!hoveredNode && !selectedNode) return true;
    const focusId = hoveredNode || selectedNode?.id;
    return link.source === focusId || link.target === focusId;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
      {/* Network Graph Frame */}
      <div className="lg:col-span-7 bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4 flex flex-col relative overflow-hidden min-h-[480px]">
        <div className="flex justify-between items-center mb-2 z-10">
          <div>
            <h3 className="font-sans font-medium text-slate-100 flex items-center gap-2">
              <GitFork className="w-4 h-4 text-teal-400" />
              Code Dependency Graph
            </h3>
            <p className="text-xs text-slate-400">Interactive live network of codebase abstractions</p>
          </div>
          <div className="flex gap-2 text-[10px]">
            {communities.map((c) => (
              <span key={c.id} className="flex items-center gap-1 text-slate-300">
                <span className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
                {c.name}
              </span>
            ))}
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div
          ref={containerRef}
          className="flex-1 w-full bg-[#030712]/40 rounded-xl border border-slate-900 overflow-hidden relative cursor-grab active:cursor-grabbing"
        >
          <svg className="w-full h-full min-h-[400px]" viewBox="0 0 600 500">
            {/* Draw Defs for glow filters and markers */}
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
              </marker>
            </defs>

            {/* Links Layer */}
            {nodes.length > 0 &&
              graphLinks.map((link, idx) => {
                const s = nodes.find((n) => n.id === link.source);
                const t = nodes.find((n) => n.id === link.target);
                if (!s || !t) return null;

                const highlighted = isLinkHighlighted(link);

                return (
                  <line
                    key={`${link.source}-${link.target}-${idx}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={
                      highlighted
                        ? link.isCrossCommunity
                          ? "#38bdf8" // Cross-community bridges
                          : "#14b8a6" // standard physics/prediction dependencies
                        : "#1e293b"
                    }
                    strokeWidth={highlighted ? (link.isCrossCommunity ? 2.5 : 1.8) : 0.8}
                    strokeDasharray={link.type === "explains" ? "4 4" : "none"}
                    opacity={highlighted ? 0.85 : 0.15}
                    markerEnd="url(#arrow)"
                    className="transition-all duration-300"
                  />
                );
              })}

            {/* Nodes Layer */}
            {nodes.map((node) => {
              const highlighted = isHighlighted(node.id);
              const isSelected = selectedNode?.id === node.id;
              const comm = communities.find((c) => c.id === node.community);
              const colorClass = comm?.color || "bg-slate-400";

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onMouseDown={() => handleMouseDown(node.id)}
                  onClick={() => onSelectNode(node)}
                >
                  {/* Outer selection ring */}
                  <circle
                    r={isSelected ? 18 : 12}
                    className={`fill-none transition-all duration-300 ${
                      isSelected
                        ? "stroke-teal-400 stroke-[3px]"
                        : "stroke-slate-700/40 stroke-1 group-hover:stroke-slate-400"
                    }`}
                  />

                  {/* Core Node Ball */}
                  <circle
                    r={node.type === "function" ? 9 : 6.5}
                    className={`transition-all duration-300 ${
                      highlighted ? colorClass : "fill-slate-800"
                    }`}
                    opacity={highlighted ? 1 : 0.2}
                    style={{ filter: isSelected ? "url(#glow)" : "none" }}
                  />

                  {/* Icon details or types inside node */}
                  {node.type === "documentation" && (
                    <circle r={3} className="fill-white" opacity={highlighted ? 0.8 : 0.2} />
                  )}

                  {/* Text Label */}
                  <text
                    y={node.type === "function" ? 22 : 18}
                    textAnchor="middle"
                    className={`font-mono text-[9px] select-none pointer-events-none transition-colors duration-300 ${
                      isSelected
                        ? "fill-teal-300 font-bold"
                        : highlighted
                        ? "fill-slate-100"
                        : "fill-slate-600"
                    }`}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Quick Help Overlays */}
          <div className="absolute bottom-3 left-3 bg-[#0a0e17]/90 px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 pointer-events-none flex items-center gap-1.5 backdrop-blur-md">
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Drag nodes to re-organize. Hover to view links.</span>
          </div>
        </div>
      </div>

      {/* Node Inspection & Code Terminal */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {selectedNode ? (
          <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 flex-1 flex flex-col overflow-hidden">
            {/* Header metadata */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {selectedNode.type}
                </span>
                <h4 className="text-lg font-sans font-medium text-slate-100 mt-1.5 flex items-center gap-1.5">
                  {selectedNode.label}
                </h4>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1 justify-end">
                  <Layers className="w-3 h-3 text-teal-400" />
                  {selectedNode.communityName}
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  {selectedNode.connectionsCount} incident edges
                </span>
              </div>
            </div>

            {/* Description card */}
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50 mb-4 text-xs">
              <div className="flex gap-2 items-start mb-1 text-slate-300">
                <BookOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span className="font-medium text-slate-200">{selectedNode.description}</span>
              </div>
              <p className="text-slate-400 pl-6 leading-relaxed">{selectedNode.details}</p>
            </div>

            {/* Code Panel / terminal */}
            {selectedNode.code ? (
              <div className="flex-1 flex flex-col overflow-hidden border border-slate-800 rounded-xl bg-slate-950">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-teal-500" />
                    Python Implementation
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">UTC-7</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 scrollbar-thin">
                  <pre className="whitespace-pre">{selectedNode.code}</pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500 bg-slate-950/20">
                <BookOpen className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs">This node represents a conceptual description block or data schema.</p>
                <p className="text-[10px] text-slate-600 mt-1">No execution code is bound to this abstraction.</p>
              </div>
            )}

            {/* Explainer Action buttons */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  onAskAI(`Can you explain what ${selectedNode.label} does and how it's used in the physics model?`)
                }
                className="flex-1 py-2.5 px-4 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 font-sans font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-teal-500/10"
              >
                Query Physics Explainer
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 flex-1 flex flex-col justify-center items-center text-center text-slate-400">
            <GitFork className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
            <h4 className="text-sm font-medium text-slate-200">No abstraction selected</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
              Click on any node in the dependency network graph to inspect its Python implementation, structural details, and dependencies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
