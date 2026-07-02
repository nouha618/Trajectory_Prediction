import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "../types";
import { MessageSquare, Send, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AIExplainerProps {
  chatTriggerPrompt: string;
  onClearTrigger: () => void;
}

const SUGGESTED_QUESTIONS = [
  "Why does haversine_km() connect physics.py to predict_hybrid.py?",
  "Why does bearing_deg() connect physics.py to predict_hybrid.py?",
  "Why does destination_point() connect destination_point to physics.py, predict_hybrid.py?",
  "What connects Distance grand cercle (km) and Cap initial entre deux points GPS to the rest of the system?"
];

export default function AIExplainer({ chatTriggerPrompt, onClearTrigger }: AIExplainerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `### Welcome to the Trajectory Prediction Geodesic AI Explainer! 
I am here to guide you through the physics, codebase dependencies, and mathematical foundations of this flight tracking project.

**You can ask me:**
* How the **Haversine** distance or **Bearing** heading calculation works.
* How **Cross-Track (XT)** and **Along-Track (AT)** errors are decomposed.
* Why certain modules or code files are linked (e.g., how \`predict_next_hybrid\` utilizes geodesic coordinate steps).

Select one of the suggested structural questions below or type your own query!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, []);

  // Handle external triggers (e.g. from the code inspector click)
  useEffect(() => {
    if (chatTriggerPrompt) {
      handleSend(chatTriggerPrompt);
      onClearTrigger();
    }
  }, [chatTriggerPrompt]);

  // Scroll to bottom on message updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch response from backend.");
      }

      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        role: "assistant",
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong. Please verify that GEMINI_API_KEY is configured in Secrets.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-220px)] items-stretch">
      {/* Suggested Questions Side panel */}
      <div className="xl:col-span-4 bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-sans font-medium text-slate-100 flex items-center gap-2 mb-3">
            <Sparkles className="w-4.5 h-4.5 text-amber-400" />
            Suggested Graph Insights
          </h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            These questions explore high betweenness centrality nodes and bridging connections revealed in the dependency report.
          </p>

          <div className="flex flex-col gap-2.5">
            {SUGGESTED_QUESTIONS.map((question, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(question)}
                disabled={isLoading}
                className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700/60 transition-colors text-xs text-slate-300 leading-relaxed cursor-pointer disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-900/40 rounded-xl border border-slate-800 text-[10px] text-slate-500 leading-relaxed">
          <p>
            <strong>Note:</strong> Responses are generated in real-time by Gemini based on mathematical great-circle geometries and standard kinematic laws.
          </p>
        </div>
      </div>

      {/* Main Dialogue Console */}
      <div className="xl:col-span-8 bg-[#0b0f19]/80 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 flex flex-col overflow-hidden h-full">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            <h4 className="font-sans font-medium text-slate-100 text-sm">Physics Assistant Terminal</h4>
          </div>
          <button
            onClick={() => setMessages(messages.slice(0, 1))}
            className="text-[10px] font-mono text-slate-500 hover:text-slate-400 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Clear Thread
          </button>
        </div>

        {/* Chat Thread Messages */}
        <div className="flex-1 overflow-y-auto px-1 space-y-4 mb-4 scrollbar-thin scrollbar-track-transparent pr-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col max-w-[85%] ${
                m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              <span className="text-[9px] font-mono text-slate-500 mb-1 px-1">
                {m.role === "user" ? "PILOT STATE" : "AI EXPLAINER"} • {m.timestamp}
              </span>
              <div
                className={`rounded-2xl px-4 py-3 text-xs leading-relaxed border ${
                  m.role === "user"
                    ? "bg-teal-500/10 border-teal-500/30 text-teal-200"
                    : "bg-slate-900/50 border-slate-800/80 text-slate-300"
                }`}
              >
                <div className="markdown-body select-text">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="mr-auto items-start flex flex-col max-w-[80%]">
              <span className="text-[9px] font-mono text-slate-500 mb-1">
                AI EXPLAINER • Computing telemetry...
              </span>
              <div className="rounded-2xl px-4 py-3 bg-slate-900/50 border border-slate-800/80 text-xs flex items-center gap-2 text-slate-400">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>Calculating geodesic equations...</span>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl flex gap-2.5 items-start text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">API Connection Blocked</p>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2 shrink-0 bg-slate-950 p-1 rounded-xl border border-slate-800"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about haversine, bearing_deg, cross-track, or predict_next_hybrid..."
            disabled={isLoading}
            className="flex-1 bg-transparent px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-30 disabled:hover:bg-teal-500 text-slate-950 rounded-lg cursor-pointer transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
