"use client";

import { useEffect, useState } from "react";
import Graph from "graphology";
import { SigmaContainer, ControlsContainer, ZoomControl, useLoadGraph, useRegisterEvents, useSigma } from "@react-sigma/core";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { NodeImageProgram } from "@sigma/node-image";
import { bidirectional } from "graphology-shortest-path/unweighted";
import "@react-sigma/core/lib/style.css";
import { useActiveCase } from "@/lib/activeCase";
import { apiGet, apiPostJson } from "@/lib/api";

type NodeData = {
  id: string;
  label: string;
  type: string;
  color?: string;
  image?: string;
  size?: number;
};
type EdgeData = {
  id: string;
  source: string;
  target: string;
  label?: string;
  color?: string;
  size?: number;
};

type ViewMode = "active" | "custom" | "all";

type CaseOption = {
  id: string;
  name: string;
  status: string;
};

const NODE_SETTINGS: Record<string, { color: string; size: number; image?: string }> = {
  // Identity & People
  person: { color: "#FF4D4D", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/user.svg" },
  username: { color: "#00E676", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/user-check.svg" },
  
  // Contact & Comms
  email: { color: "#00B0FF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/mail.svg" },
  phone: { color: "#FF9100", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/phone.svg" },
  whatsapp: { color: "#25D366", size: 16, image: "https://cdn.simpleicons.org/whatsapp/white" },
  telegram: { color: "#2AABEE", size: 16, image: "https://cdn.simpleicons.org/telegram/white" },

  // Corporate, Organization & Work
  corporate: { color: "#9C27B0", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/building-2.svg" },
  company: { color: "#9C27B0", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/building-2.svg" },
  enterprise: { color: "#9C27B0", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/building-2.svg" },
  partner: { color: "#E040FB", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/users.svg" },
  qsa: { color: "#E040FB", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/users.svg" },
  work: { color: "#7C4DFF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/briefcase.svg" },
  employment: { color: "#7C4DFF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/briefcase.svg" },

  // Network & Infra
  domain: { color: "#00BCD4", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/globe.svg" },
  dns: { color: "#00BCD4", size: 15, image: "https://unpkg.com/lucide-static@0.400.0/icons/network.svg" },
  ip: { color: "#607D8B", size: 15, image: "https://unpkg.com/lucide-static@0.400.0/icons/server.svg" },

  // Crypto & Financial
  crypto: { color: "#FFD600", size: 16, image: "https://cdn.simpleicons.org/bitcoin/white" },
  bitcoin: { color: "#F7931A", size: 16, image: "https://cdn.simpleicons.org/bitcoin/white" },
  ethereum: { color: "#627EEA", size: 16, image: "https://cdn.simpleicons.org/ethereum/white" },

  // Databank, Files & Documents
  document: { color: "#05D9E8", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/file-text.svg" },
  dork_dump: { color: "#FF2A6D", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/database.svg" },
  evidence: { color: "#00FF9F", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/shield-check.svg" },
  image: { color: "#FFAB00", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/image.svg" },
  audio_video: { color: "#A259FF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/video.svg" },
  file: { color: "#05D9E8", size: 15, image: "https://unpkg.com/lucide-static@0.400.0/icons/file.svg" },

  // Social Platforms
  facebook: { color: "#1877F2", size: 16, image: "https://cdn.simpleicons.org/facebook/white" },
  instagram: { color: "#E4405F", size: 16, image: "https://cdn.simpleicons.org/instagram/white" },
  twitter: { color: "#1DA1F2", size: 16, image: "https://cdn.simpleicons.org/x/white" },
  x: { color: "#FFFFFF", size: 16, image: "https://cdn.simpleicons.org/x/white" },
  tiktok: { color: "#FE2C55", size: 16, image: "https://cdn.simpleicons.org/tiktok/white" },
  github: { color: "#F0F6FC", size: 16, image: "https://cdn.simpleicons.org/github/white" },
  linkedin: { color: "#0A66C2", size: 16, image: "https://cdn.simpleicons.org/linkedin/white" },
  reddit: { color: "#FF4500", size: 16, image: "https://cdn.simpleicons.org/reddit/white" },
  youtube: { color: "#FF0000", size: 16, image: "https://cdn.simpleicons.org/youtube/white" },

  // System default
  case: { color: "#05D9E8", size: 20, image: "https://unpkg.com/lucide-static@0.400.0/icons/folder-git-2.svg" },
  default: { color: "#888888", size: 12, image: "https://unpkg.com/lucide-static@0.400.0/icons/disc.svg" },
};

function LoadGraph({ nodes, edges, onGraphReady }: { nodes: NodeData[]; edges: EdgeData[], onGraphReady: (g: Graph) => void }) {
  const { assign } = useLayoutForceAtlas2();
  const loadGraph = useLoadGraph();

  useEffect(() => {
    const graph = new Graph({ multi: true }); // Multi graph to avoid duplicate edge issues just in case
    
    nodes.forEach((n) => {
      // Node IDs come from backend as e.g. "[case_id] username:target_user" or "email:test@target.com"
      let cleanId = n.id;
      let casePrefix = "";
      if (cleanId.startsWith("[")) {
        const idx = cleanId.indexOf("] ");
        if (idx !== -1) {
          casePrefix = cleanId.substring(0, idx + 2);
          cleanId = cleanId.substring(idx + 2);
        }
      }

      // Infer type and clean label
      let detectedType = n.type || "default";
      let displayLabel = n.label || cleanId;

      if (cleanId.includes(":")) {
        const colonIdx = cleanId.indexOf(":");
        const prefixType = cleanId.substring(0, colonIdx).toLowerCase().trim();
        const valuePart = cleanId.substring(colonIdx + 1).trim();

        if (NODE_SETTINGS[prefixType]) {
          detectedType = prefixType;
        }
        displayLabel = valuePart;
      }

      const st = NODE_SETTINGS[detectedType] || NODE_SETTINGS.default;

      graph.addNode(n.id, {
        x: Math.random() * 100,
        y: Math.random() * 100,
        label: displayLabel,
        size: n.size || st.size,
        color: n.color || st.color,
        type: st.image ? "image" : "circle",
        image: st.image,
        originalColor: n.color || st.color,
      });
    });

    edges.forEach((e) => {
      if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
        try {
          graph.addEdge(e.source, e.target, {
            label: e.label || "",
            size: e.size || 1,
            color: e.color || "#555555",
            originalColor: e.color || "#555555",
          });
        } catch {}
      }
    });

    loadGraph(graph);
    assign();
    onGraphReady(graph);
  }, [nodes, edges, assign, loadGraph, onGraphReady]);

  return null;
}

function GraphEvents({ selectedNodes, setSelectedNodes, pathNodes }: { selectedNodes: string[], setSelectedNodes: any, pathNodes: string[] | null }) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

  useEffect(() => {
    registerEvents({
      clickNode: (e) => {
        const node = e.node;
        setSelectedNodes((prev: string[]) => {
          if (prev.includes(node)) {
            return prev.filter((n) => n !== node);
          }
          if (prev.length >= 2) return [node]; // Reset if 2 already selected
          return [...prev, node];
        });
      },
      clickStage: () => {
        setSelectedNodes([]);
      }
    });
  }, [registerEvents, setSelectedNodes]);

  useEffect(() => {
    const graph = sigma.getGraph();
    
    // Reset all
    graph.forEachNode((n) => {
      graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
      graph.setNodeAttribute(n, "highlighted", false);
    });
    graph.forEachEdge((e) => {
      graph.setEdgeAttribute(e, "color", graph.getEdgeAttribute(e, "originalColor"));
      graph.setEdgeAttribute(e, "size", 1);
    });

    if (selectedNodes.length > 0 || pathNodes) {
      const activeNodes = new Set(pathNodes || selectedNodes);
      
      graph.forEachNode((n) => {
        if (activeNodes.has(n)) {
          // Highlight
          graph.setNodeAttribute(n, "color", "#05D9E8");
        } else {
          // Dim
          graph.setNodeAttribute(n, "color", "#222222");
        }
      });

      if (pathNodes && pathNodes.length > 1) {
        // Highlight path edges
        for (let i = 0; i < pathNodes.length - 1; i++) {
          const s = pathNodes[i];
          const t = pathNodes[i+1];
          const edge = graph.edge(s, t) || graph.edge(t, s);
          if (edge) {
            graph.setEdgeAttribute(edge, "color", "#05D9E8");
            graph.setEdgeAttribute(edge, "size", 3);
          }
        }
        
        // Dim other edges
        graph.forEachEdge((e) => {
          if (graph.getEdgeAttribute(e, "color") !== "#05D9E8") {
            graph.setEdgeAttribute(e, "color", "#111111");
          }
        });
      }
    }
  }, [selectedNodes, pathNodes, sigma]);

  return null;
}

export default function GraphView() {
  const { activeCase } = useActiveCase();
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [availableCases, setAvailableCases] = useState<CaseOption[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [graphInstance, setGraphInstance] = useState<Graph | null>(null);
  
  // Link Analysis State
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [shortestPath, setShortestPath] = useState<string[] | null>(null);

  useEffect(() => {
    // Load list of available cases
    apiGet<CaseOption[]>("/cases/")
      .then((data) => {
        setAvailableCases(data || []);
        if (activeCase) {
          setSelectedCaseIds([activeCase.id]);
        }
      })
      .catch((err) => console.error("Error loading cases:", err));
  }, [activeCase]);

  useEffect(() => {
    if (selectedNodes.length === 2 && graphInstance) {
      try {
        const path = bidirectional(graphInstance, selectedNodes[0], selectedNodes[1]);
        setShortestPath(path || []);
      } catch (e) {
        setShortestPath([]); // No path found
      }
    } else {
      setShortestPath(null);
    }
  }, [selectedNodes, graphInstance]);

  async function loadGraphData() {
    setLoading(true);
    setSelectedNodes([]);
    try {
      let data: { nodes: NodeData[]; edges: EdgeData[] };

      if (viewMode === "active" && activeCase) {
        data = await apiGet<{ nodes: NodeData[]; edges: EdgeData[] }>(`/cases/${activeCase.id}/graph`);
      } else if (viewMode === "custom") {
        if (selectedCaseIds.length === 0) {
          setNodes([]);
          setEdges([]);
          setLoading(false);
          return;
        }
        data = await apiPostJson<{ nodes: NodeData[]; edges: EdgeData[] }>("/cases/custom-graph", {
          case_ids: selectedCaseIds,
        });
      } else if (viewMode === "all") {
        data = await apiGet<{ nodes: NodeData[]; edges: EdgeData[] }>("/cases/all/graph");
      } else {
        setNodes([]);
        setEdges([]);
        return;
      }
      
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (e) {
      console.error("Error loading graph:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGraphData();
  }, [activeCase, viewMode, selectedCaseIds]);

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  if (!activeCase && viewMode === "active") {
    return <div style={{ color: "var(--warning)", marginTop: 32 }}>Select an active case to view the correlation graph.</div>;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ color: "var(--cyan)", margin: 0 }}>Relational Graph</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0 0" }}>
            Visualizes all saved findings and their correlations.
          </p>
          <div style={{ marginTop: 8, fontSize: 12, background: "rgba(5, 217, 232, 0.1)", padding: "4px 8px", borderRadius: 4, display: "inline-block", border: "1px solid rgba(5,217,232,0.3)" }}>
            <strong>Link Analysis Tool:</strong> Click 2 nodes to find the shortest path between them. 
            {selectedNodes.length === 1 && <span style={{ color: "var(--warning)", marginLeft: 6 }}>(1 node selected...)</span>}
            {selectedNodes.length === 2 && shortestPath && shortestPath.length > 0 && <span style={{ color: "var(--success)", marginLeft: 6 }}>(Path found: {shortestPath.length - 1} hops)</span>}
            {selectedNodes.length === 2 && shortestPath && shortestPath.length === 0 && <span style={{ color: "var(--danger)", marginLeft: 6 }}>(No path exists)</span>}
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 16, background: "var(--panel)", padding: "4px 8px", borderRadius: 4, border: "1px solid var(--panel-border)", height: "fit-content", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input 
              type="radio" 
              checked={viewMode === "active"} 
              onChange={() => setViewMode("active")} 
            />
            <span style={{ fontSize: 13, fontWeight: viewMode === "active" ? "bold" : "normal" }}>
              Active Case Only
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input 
              type="radio" 
              checked={viewMode === "custom"} 
              onChange={() => setViewMode("custom")} 
            />
            <span style={{ fontSize: 13, fontWeight: viewMode === "custom" ? "bold" : "normal", color: viewMode === "custom" ? "var(--cyan)" : "inherit" }}>
              Select Cases (2 or more)
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input 
              type="radio" 
              checked={viewMode === "all"} 
              onChange={() => setViewMode("all")} 
            />
            <span style={{ fontSize: 13, fontWeight: viewMode === "all" ? "bold" : "normal", color: viewMode === "all" ? "var(--danger)" : "inherit" }}>
              Full Merge (All Cases)
            </span>
          </label>
        </div>
      </div>

      {/* Multi-case picker when Select Cases (2 or more) is chosen */}
      {viewMode === "custom" && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(5, 217, 232, 0.05)", border: "1px solid var(--cyan)", borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
            CHOOSE 2 OR MORE CASES TO MERGE INTO THIS GRAPH:
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableCases.map((c) => {
              const isChecked = selectedCaseIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCaseSelection(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                    background: isChecked ? "rgba(5, 217, 232, 0.25)" : "var(--panel)",
                    border: isChecked ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
                    color: isChecked ? "var(--cyan)" : "var(--text-muted)",
                    fontWeight: isChecked ? "bold" : "normal",
                  }}
                >
                  <span>{isChecked ? "☑" : "☐"}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            {selectedCaseIds.length} case(s) selected {selectedCaseIds.length < 2 && "(select at least 2 to analyze cross-case correlations)"}
          </div>
        </div>
      )}

      <div style={{ height: "600px", width: "100%", background: "#0a0c12", border: "1px solid var(--cyan)", borderRadius: 8, position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, color: "var(--cyan)", fontSize: 14 }}>
            Loading graph...
          </div>
        )}
        
        {viewMode === "all" && (
          <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 10, color: "var(--danger)", fontSize: 11, background: "rgba(0,0,0,0.7)", padding: "4px 8px", borderRadius: 4 }}>
            🚨 MACRO VIEW: Cross-case connections are highlighted in red edges.
          </div>
        )}

        <SigmaContainer 
          style={{ height: "100%", width: "100%" }} 
          settings={{ 
            defaultNodeType: "circle", 
            defaultNodeColor: "#999",
            nodeProgramClasses: {
              image: NodeImageProgram,
            }
          }}
        >
          <LoadGraph nodes={nodes} edges={edges} onGraphReady={setGraphInstance} />
          <GraphEvents selectedNodes={selectedNodes} setSelectedNodes={setSelectedNodes} pathNodes={shortestPath} />
          
          <ControlsContainer position={"bottom-right"}>
            <ZoomControl />
          </ControlsContainer>
        </SigmaContainer>
      </div>

      {/* Maltego Typology Legend */}
      <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
        <div style={{ fontSize: 11, fontWeight: "bold", color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.5px" }}>
          MALTEGO ENTITY TYPOLOGIES & HARVESTED DATA:
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Person", color: "#FF4D4D", icon: "user.svg" },
            { label: "Username", color: "#00E676", icon: "user-check.svg" },
            { label: "Email", color: "#00B0FF", icon: "mail.svg" },
            { label: "Phone", color: "#FF9100", icon: "phone.svg" },
            { label: "Enterprise / Company", color: "#9C27B0", icon: "building-2.svg" },
            { label: "Partner / QSA", color: "#E040FB", icon: "users.svg" },
            { label: "Work / Employment", color: "#7C4DFF", icon: "briefcase.svg" },
            { label: "Domain / Network", color: "#00BCD4", icon: "globe.svg" },
            { label: "Crypto / Bitcoin", color: "#FFD600", icon: "bitcoin.svg" },
            { label: "Document / PDF", color: "#05D9E8", icon: "file-text.svg" },
            { label: "Dork Web Dump", color: "#FF2A6D", icon: "database.svg" },
            { label: "Forensic Evidence", color: "#00FF9F", icon: "shield-check.svg" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block", boxShadow: `0 0 6px ${item.color}` }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
