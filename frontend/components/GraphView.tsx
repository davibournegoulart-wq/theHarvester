"use client";

import { useEffect, useState, useMemo } from "react";
import Graph from "graphology";
import { SigmaContainer, ControlsContainer, ZoomControl, useLoadGraph, useRegisterEvents, useSigma } from "@react-sigma/core";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { NodeImageProgram } from "@sigma/node-image";
import { bidirectional } from "graphology-shortest-path/unweighted";
import "@react-sigma/core/lib/style.css";
import { useActiveCase } from "@/lib/activeCase";
import { apiGet, apiPostJson } from "@/lib/api";
import { CheckIcon, CrossIcon, BoltIcon, AlertIcon } from "@/components/FlatIcons";

type NodeData = {
  id: string;
  label: string;
  type: string;
  details?: Record<string, any>;
  degree?: number;
  betweenness?: number;
  closeness?: number;
  community?: number;
  color?: string;
  image?: string;
  size?: number;
};

type EdgeData = {
  source: string;
  target: string;
  relation_type?: string;
  weight?: number;
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

const NODE_SETTINGS: Record<string, { color: string; size: number; image?: string; label: string }> = {
  // Case Root Hub
  case: { color: "#05D9E8", size: 24, image: "https://unpkg.com/lucide-static@0.400.0/icons/folder-git-2.svg", label: "Case Hub" },

  // Identity & People
  person: { color: "#FF4D4D", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/user.svg", label: "Person" },
  username: { color: "#00E676", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/user-check.svg", label: "Username" },

  // Contact & Comms
  email: { color: "#00B0FF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/mail.svg", label: "Email" },
  phone: { color: "#FF9100", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/phone.svg", label: "Phone" },
  whatsapp: { color: "#25D366", size: 16, image: "https://cdn.simpleicons.org/whatsapp/white", label: "WhatsApp" },
  telegram: { color: "#2AABEE", size: 16, image: "https://cdn.simpleicons.org/telegram/white", label: "Telegram" },

  // Corporate, Organization & Work
  corporate: { color: "#9C27B0", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/building-2.svg", label: "Corporate / CNPJ" },
  company: { color: "#9C27B0", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/building-2.svg", label: "Company" },
  enterprise: { color: "#9C27B0", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/building-2.svg", label: "Enterprise" },
  partner: { color: "#E040FB", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/users.svg", label: "Partner / QSA" },
  qsa: { color: "#E040FB", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/users.svg", label: "QSA Partner" },
  work: { color: "#7C4DFF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/briefcase.svg", label: "Work" },
  employment: { color: "#7C4DFF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/briefcase.svg", label: "Employment" },

  // Network & Infra
  domain: { color: "#00BCD4", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/globe.svg", label: "Domain" },
  dns: { color: "#00BCD4", size: 15, image: "https://unpkg.com/lucide-static@0.400.0/icons/network.svg", label: "DNS" },
  ip: { color: "#607D8B", size: 15, image: "https://unpkg.com/lucide-static@0.400.0/icons/server.svg", label: "IP Address" },

  // Crypto & Financial
  crypto: { color: "#FFD600", size: 16, image: "https://cdn.simpleicons.org/bitcoin/white", label: "Crypto Wallet" },
  bitcoin: { color: "#F7931A", size: 16, image: "https://cdn.simpleicons.org/bitcoin/white", label: "Bitcoin" },
  ethereum: { color: "#627EEA", size: 16, image: "https://cdn.simpleicons.org/ethereum/white", label: "Ethereum" },

  // Geolocation & Map Pins
  geolocation: { color: "#FF0055", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/map-pin.svg", label: "Geolocation Pin" },
  location: { color: "#FF0055", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/map-pin.svg", label: "Location" },

  // Exposed Secrets & Credentials (Gitleaks / TruffleHog)
  secret: { color: "#FF5500", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/key.svg", label: "Exposed Secret / Key" },

  // Biometrics & Facial Intel
  biometric: { color: "#E040FB", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/scan-face.svg", label: "Biometric Face" },
  face_crop: { color: "#E040FB", size: 18, image: "https://unpkg.com/lucide-static@0.400.0/icons/scan-face.svg", label: "Face Crop" },

  // Databank, Files & Documents
  document: { color: "#05D9E8", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/file-text.svg", label: "Document / PDF" },
  file: { color: "#05D9E8", size: 15, image: "https://unpkg.com/lucide-static@0.400.0/icons/file.svg", label: "Databank File" },
  dork_dump: { color: "#FF2A6D", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/database.svg", label: "Dork Web Dump" },
  evidence: { color: "#00FF9F", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/shield-check.svg", label: "Preserved Evidence" },
  image: { color: "#FFAB00", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/image.svg", label: "Image Asset" },
  audio_video: { color: "#A259FF", size: 16, image: "https://unpkg.com/lucide-static@0.400.0/icons/video.svg", label: "Audio / Video" },

  // Social Platforms
  facebook: { color: "#1877F2", size: 16, image: "https://cdn.simpleicons.org/facebook/white", label: "Facebook" },
  instagram: { color: "#E4405F", size: 16, image: "https://cdn.simpleicons.org/instagram/white", label: "Instagram" },
  twitter: { color: "#1DA1F2", size: 16, image: "https://cdn.simpleicons.org/x/white", label: "Twitter / X" },
  x: { color: "#FFFFFF", size: 16, image: "https://cdn.simpleicons.org/x/white", label: "X" },
  tiktok: { color: "#FE2C55", size: 16, image: "https://cdn.simpleicons.org/tiktok/white", label: "TikTok" },
  github: { color: "#F0F6FC", size: 16, image: "https://cdn.simpleicons.org/github/white", label: "GitHub" },
  linkedin: { color: "#0A66C2", size: 16, image: "https://cdn.simpleicons.org/linkedin/white", label: "LinkedIn" },
  reddit: { color: "#FF4500", size: 16, image: "https://cdn.simpleicons.org/reddit/white", label: "Reddit" },
  youtube: { color: "#FF0000", size: 16, image: "https://cdn.simpleicons.org/youtube/white", label: "YouTube" },

  // System default
  default: { color: "#888888", size: 12, image: "https://unpkg.com/lucide-static@0.400.0/icons/disc.svg", label: "Entity" },
};

const EDGE_COLORS: Record<string, string> = {
  investigates: "#05D9E8",
  has_account: "#00E676",
  located_at: "#FF0055",
  located_document: "#FF0055",
  attached_file: "#05D9E8",
  evidence_saved: "#00FF9F",
  evidence_url: "#00FF9F",
  exposed_secret: "#FF5500",
  biometric_match: "#E040FB",
  cross_case_match: "#FF2A6D",
  default: "#445566",
};

function LoadGraph({ 
  nodes, 
  edges, 
  onGraphReady 
}: { 
  nodes: NodeData[]; 
  edges: EdgeData[]; 
  onGraphReady: (g: Graph) => void;
}) {
  const { assign } = useLayoutForceAtlas2();
  const loadGraph = useLoadGraph();

  useEffect(() => {
    const graph = new Graph({ multi: true });

    nodes.forEach((n) => {
      let cleanId = n.id;
      if (cleanId.startsWith("[")) {
        const idx = cleanId.indexOf("] ");
        if (idx !== -1) cleanId = cleanId.substring(idx + 2);
      }

      let detectedType = (n.type || "default").toLowerCase();
      let displayLabel = n.label || cleanId;

      if (cleanId.includes(":") && !NODE_SETTINGS[detectedType]) {
        const colonIdx = cleanId.indexOf(":");
        const prefixType = cleanId.substring(0, colonIdx).toLowerCase().trim();
        const valuePart = cleanId.substring(colonIdx + 1).trim();
        if (NODE_SETTINGS[prefixType]) {
          detectedType = prefixType;
        }
        if (!n.label) displayLabel = valuePart;
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
        entityType: detectedType,
      });
    });

    edges.forEach((e) => {
      if (graph.hasNode(e.source) && graph.hasNode(e.target)) {
        try {
          const relType = e.relation_type || "default";
          const edgeColor = EDGE_COLORS[relType] || EDGE_COLORS.default;
          const isCross = relType === "cross_case_match";
          graph.addEdge(e.source, e.target, {
            label: e.label || relType.replace(/_/g, " "),
            size: isCross ? 3 : (e.size || 1.5),
            color: isCross ? "#FF2A6D" : edgeColor,
            originalColor: isCross ? "#FF2A6D" : edgeColor,
            relationType: relType,
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

function GraphEvents({ 
  selectedNodes, 
  setSelectedNodes, 
  pathNodes,
  onInspectNode
}: { 
  selectedNodes: string[]; 
  setSelectedNodes: (fn: (prev: string[]) => string[]) => void; 
  pathNodes: string[] | null;
  onInspectNode: (nodeId: string | null) => void;
}) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

  useEffect(() => {
    registerEvents({
      clickNode: (e) => {
        const node = e.node;
        onInspectNode(node);
        setSelectedNodes((prev: string[]) => {
          if (prev.includes(node)) {
            return prev.filter((n) => n !== node);
          }
          if (prev.length >= 2) return [node];
          return [...prev, node];
        });
      },
      clickStage: () => {
        setSelectedNodes(() => []);
        onInspectNode(null);
      }
    });
  }, [registerEvents, setSelectedNodes, onInspectNode]);

  useEffect(() => {
    const graph = sigma.getGraph();
    
    // Reset colors
    graph.forEachNode((n) => {
      graph.setNodeAttribute(n, "color", graph.getNodeAttribute(n, "originalColor"));
    });
    graph.forEachEdge((e) => {
      graph.setEdgeAttribute(e, "color", graph.getEdgeAttribute(e, "originalColor"));
      graph.setEdgeAttribute(e, "size", graph.getEdgeAttribute(e, "relationType") === "cross_case_match" ? 3 : 1.5);
    });

    if (selectedNodes.length > 0 || pathNodes) {
      const activeNodes = new Set(pathNodes || selectedNodes);
      
      graph.forEachNode((n) => {
        if (activeNodes.has(n)) {
          graph.setNodeAttribute(n, "color", "#05D9E8");
        } else {
          graph.setNodeAttribute(n, "color", "#1a2233");
        }
      });

      if (pathNodes && pathNodes.length > 1) {
        for (let i = 0; i < pathNodes.length - 1; i++) {
          const s = pathNodes[i];
          const t = pathNodes[i + 1];
          const edge = graph.edge(s, t) || graph.edge(t, s);
          if (edge) {
            graph.setEdgeAttribute(edge, "color", "#05D9E8");
            graph.setEdgeAttribute(edge, "size", 3.5);
          }
        }
        
        graph.forEachEdge((e) => {
          if (graph.getEdgeAttribute(e, "color") !== "#05D9E8") {
            graph.setEdgeAttribute(e, "color", "#0d1320");
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
  
  // Link Analysis & Inspector State
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [shortestPath, setShortestPath] = useState<string[] | null>(null);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);

  // Quick Add Target Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTargetType, setNewTargetType] = useState<string>("username");
  const [newTargetValue, setNewTargetValue] = useState("");
  const [addingTarget, setAddingTarget] = useState(false);

  // Typology Filter
  const [typologyFilter, setTypologyFilter] = useState<string>("all");

  useEffect(() => {
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
        setShortestPath([]);
      }
    } else {
      setShortestPath(null);
    }
  }, [selectedNodes, graphInstance]);

  async function loadGraphData() {
    setLoading(true);
    setSelectedNodes([]);
    setInspectedNodeId(null);
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

  // Filtered nodes based on typology filter
  const displayedNodes = useMemo(() => {
    if (typologyFilter === "all") return nodes;
    if (typologyFilter === "identifiers") {
      return nodes.filter((n) => ["case", "person", "username", "email", "phone", "corporate", "domain", "crypto"].includes((n.type || "").toLowerCase()));
    }
    if (typologyFilter === "accounts") {
      return nodes.filter((n) => !["case", "person", "username", "email", "phone", "corporate", "domain", "crypto", "geolocation", "secret", "biometric", "document", "file", "dork_dump", "evidence"].includes((n.type || "").toLowerCase()) || n.type === "case");
    }
    if (typologyFilter === "geolocations") {
      return nodes.filter((n) => n.type === "geolocation" || n.type === "case");
    }
    if (typologyFilter === "files") {
      return nodes.filter((n) => ["case", "document", "file", "dork_dump", "image", "audio_video"].includes((n.type || "").toLowerCase()));
    }
    if (typologyFilter === "evidence_secrets") {
      return nodes.filter((n) => ["case", "evidence", "secret", "biometric"].includes((n.type || "").toLowerCase()));
    }
    return nodes;
  }, [nodes, typologyFilter]);

  const displayedNodeIds = useMemo(() => new Set(displayedNodes.map((n) => n.id)), [displayedNodes]);

  const displayedEdges = useMemo(() => {
    return edges.filter((e) => displayedNodeIds.has(e.source) && displayedNodeIds.has(e.target));
  }, [edges, displayedNodeIds]);

  // Currently inspected node details
  const inspectedNode = useMemo(() => {
    if (!inspectedNodeId) return null;
    return nodes.find((n) => n.id === inspectedNodeId) || null;
  }, [inspectedNodeId, nodes]);

  // Connected edges for the inspected node
  const inspectedNodeConnections = useMemo(() => {
    if (!inspectedNodeId) return [];
    return edges.filter((e) => e.source === inspectedNodeId || e.target === inspectedNodeId);
  }, [inspectedNodeId, edges]);

  // Quick Add Target
  async function handleAddTarget() {
    if (!activeCase || !newTargetValue.trim()) return;
    setAddingTarget(true);
    try {
      if (newTargetType === "geolocation") {
        // Parse coords or address
        const parts = newTargetValue.split(",").map((p) => parseFloat(p.trim()));
        const lat = !isNaN(parts[0]) ? parts[0] : 0.0;
        const lon = !isNaN(parts[1]) ? parts[1] : 0.0;
        await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
          latitude: lat,
          longitude: lon,
          label: newTargetValue.trim(),
          source: "Graph Quick Add",
        });
      } else {
        await apiPostJson(`/cases/${activeCase.id}/findings`, {
          identifier_type: newTargetType,
          identifier_value: newTargetValue.trim(),
          platform: "target",
          exists: true,
          discovered_by: "investigator_graph",
        });
      }
      setNewTargetValue("");
      setShowAddModal(false);
      await loadGraphData();
    } catch (e: any) {
      alert("Failed to add target: " + (e?.message || e));
    } finally {
      setAddingTarget(false);
    }
  }

  if (!activeCase && viewMode === "active") {
    return (
      <div style={{ color: "var(--warning)", marginTop: 32, padding: 24, background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 8 }}>
        <h3 style={{ color: "var(--cyan)", marginTop: 0 }}>No Active Case Selected</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Select or create an active case in the top navigation bar to access the Relational Intelligence Graph.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Top Header & View Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ color: "var(--cyan)", margin: 0, textShadow: "0 0 10px rgba(5,217,232,0.4)" }}>
              MALTEGO RELATIONAL GRAPH
            </h2>
            <span style={{ fontSize: 11, background: "rgba(5, 217, 232, 0.15)", color: "var(--cyan)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(5,217,232,0.3)" }}>
              {displayedNodes.length} Entities • {displayedEdges.length} Links
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0 0" }}>
            Visual intelligence correlation graph uniting targets, social footprints, documents, geolocations, credentials, and biometrics.
          </p>
        </div>
        
        {/* Scope Selector */}
        <div style={{ display: "flex", gap: 12, background: "var(--panel)", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--panel-border)", height: "fit-content", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input 
              type="radio" 
              checked={viewMode === "active"} 
              onChange={() => setViewMode("active")} 
            />
            <span style={{ fontSize: 12, fontWeight: viewMode === "active" ? "bold" : "normal", color: viewMode === "active" ? "var(--cyan)" : "inherit" }}>
              Active Case Only
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input 
              type="radio" 
              checked={viewMode === "custom"} 
              onChange={() => setViewMode("custom")} 
            />
            <span style={{ fontSize: 12, fontWeight: viewMode === "custom" ? "bold" : "normal", color: viewMode === "custom" ? "var(--cyan)" : "inherit" }}>
              Select Cases (2 or more)
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input 
              type="radio" 
              checked={viewMode === "all"} 
              onChange={() => setViewMode("all")} 
            />
            <span style={{ fontSize: 12, fontWeight: viewMode === "all" ? "bold" : "normal", color: viewMode === "all" ? "var(--danger)" : "inherit" }}>
              Full Merge (All Cases)
            </span>
          </label>
        </div>
      </div>

      {/* Multi-case picker when Select Cases (2 or more) is chosen */}
      {viewMode === "custom" && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(5, 217, 232, 0.05)", border: "1px solid var(--cyan)", borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
            CHOOSE 2 OR MORE CASES TO CORRELATE INTO THIS GRAPH:
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
                  {isChecked ? (
                    <CheckIcon size={12} color="var(--cyan)" />
                  ) : (
                    <span style={{ width: 12, height: 12, border: "1px solid var(--text-muted)", display: "inline-block", borderRadius: 2 }} />
                  )}
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

      {/* Maltego Transforms & Action Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        {/* Typology Filter Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Typologies" },
            { id: "identifiers", label: "Targets & IDs" },
            { id: "accounts", label: "Social Accounts" },
            { id: "geolocations", label: "Geolocations" },
            { id: "files", label: "Databank Files" },
            { id: "evidence_secrets", label: "Evidence & Leaks" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTypologyFilter(f.id)}
              style={{
                background: typologyFilter === f.id ? "var(--cyan)" : "var(--panel)",
                color: typologyFilter === f.id ? "#000" : "var(--text-muted)",
                border: typologyFilter === f.id ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: typologyFilter === f.id ? "bold" : "normal",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Quick Add Target Action */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activeCase && (
            <button
              onClick={() => setShowAddModal(!showAddModal)}
              style={{
                background: "rgba(5, 217, 232, 0.15)",
                color: "var(--cyan)",
                border: "1px solid var(--cyan)",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>+</span> Add Target to Graph
            </button>
          )}

          <button
            onClick={() => loadGraphData()}
            style={{
              background: "var(--panel)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Reload graph findings"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Inline Quick Add Target Modal */}
      {showAddModal && (
        <div style={{ marginBottom: 14, padding: 14, background: "rgba(17, 21, 31, 0.95)", border: "1px solid var(--cyan)", borderRadius: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)" }}>NEW TARGET ENTITY:</span>
          <select
            value={newTargetType}
            onChange={(e) => setNewTargetType(e.target.value)}
            style={{
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              padding: "5px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <option value="username">Username / Social Handle</option>
            <option value="email">Email Address</option>
            <option value="phone">Phone Number</option>
            <option value="person">Person Name / CPF</option>
            <option value="corporate">Company / CNPJ</option>
            <option value="domain">Domain / Hostname</option>
            <option value="crypto">Cryptocurrency Address</option>
            <option value="geolocation">Geolocation (Lat, Lon)</option>
          </select>

          <input
            type="text"
            placeholder={newTargetType === "geolocation" ? "-23.5505, -46.6333 (or Place Name)" : "Target value / identifier..."}
            value={newTargetValue}
            onChange={(e) => setNewTargetValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTarget()}
            style={{
              flex: 1,
              minWidth: 240,
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              padding: "5px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          />

          <button
            onClick={handleAddTarget}
            disabled={addingTarget || !newTargetValue.trim()}
            style={{
              background: "var(--cyan)",
              color: "#000",
              fontWeight: "bold",
              border: "none",
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 12,
              cursor: addingTarget ? "wait" : "pointer",
            }}
          >
            {addingTarget ? "Linking..." : "Link to Case Hub"}
          </button>
          <button
            onClick={() => setShowAddModal(false)}
            style={{
              background: "transparent",
              color: "var(--text-muted)",
              border: "none",
              padding: "6px 8px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Link Analysis Path Tool Banner */}
      <div style={{ marginBottom: 12, fontSize: 12, background: "rgba(5, 217, 232, 0.08)", padding: "6px 12px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(5,217,232,0.2)" }}>
        <div>
          <strong style={{ color: "var(--cyan)" }}>MALTEGO LINK ANALYSIS:</strong> Click any 2 nodes to calculate shortest path and correlation hops.
          {selectedNodes.length === 1 && <span style={{ color: "var(--warning)", marginLeft: 8 }}>(Node 1 selected, click Node 2...)</span>}
          {selectedNodes.length === 2 && shortestPath && shortestPath.length > 0 && <span style={{ color: "var(--success)", marginLeft: 8 }}>(Correlated path found: {shortestPath.length - 1} hops)</span>}
          {selectedNodes.length === 2 && shortestPath && shortestPath.length === 0 && <span style={{ color: "var(--danger)", marginLeft: 8 }}>(No direct path exists between entities)</span>}
        </div>
        {selectedNodes.length > 0 && (
          <button 
            onClick={() => setSelectedNodes(() => [])}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Main Canvas Container with Inspector Drawer */}
      <div style={{ height: "620px", width: "100%", background: "#060812", border: "1px solid var(--cyan)", borderRadius: 8, position: "relative", overflow: "hidden" }}>
        {loading && (
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, color: "var(--cyan)", fontSize: 12, background: "rgba(6,8,18,0.85)", padding: "6px 12px", borderRadius: 4, border: "1px solid rgba(5,217,232,0.3)", display: "flex", alignItems: "center", gap: 6 }}>
            <BoltIcon size={14} color="var(--cyan)" />
            Computing ForceAtlas2 Graph Topology...
          </div>
        )}
        
        {viewMode === "all" && (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, color: "var(--danger)", fontSize: 11, background: "rgba(0,0,0,0.8)", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertIcon size={14} color="var(--danger)" />
            MACRO MULTI-CASE VIEW: Shared identifiers are linked by highlighted correlation lines.
          </div>
        )}

        <SigmaContainer 
          style={{ height: "100%", width: "100%", background: "#060812" }} 
          settings={{ 
            defaultNodeType: "circle", 
            defaultNodeColor: "#05D9E8",
            labelColor: { color: "#d6f3ff" },
            labelSize: 11,
            labelWeight: "600",
            nodeProgramClasses: {
              image: NodeImageProgram,
            }
          }}
        >
          <LoadGraph nodes={displayedNodes} edges={displayedEdges} onGraphReady={setGraphInstance} />
          <GraphEvents 
            selectedNodes={selectedNodes} 
            setSelectedNodes={setSelectedNodes} 
            pathNodes={shortestPath}
            onInspectNode={setInspectedNodeId}
          />
          
          <ControlsContainer position={"bottom-right"}>
            <ZoomControl />
          </ControlsContainer>
        </SigmaContainer>

        {/* MALTEGO ENTITY INSPECTOR DRAWER */}
        {inspectedNode && (
          <div 
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 320,
              height: "100%",
              background: "rgba(10, 14, 24, 0.95)",
              borderLeft: "1px solid var(--cyan)",
              backdropFilter: "blur(10px)",
              padding: 16,
              overflowY: "auto",
              zIndex: 50,
              boxShadow: "-8px 0 24px rgba(0,0,0,0.6)",
              color: "var(--text)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--panel-border)", paddingBottom: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span 
                  style={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: "50%", 
                    background: (NODE_SETTINGS[inspectedNode.type] || NODE_SETTINGS.default).color,
                    boxShadow: `0 0 8px ${(NODE_SETTINGS[inspectedNode.type] || NODE_SETTINGS.default).color}`
                  }} 
                />
                <div>
                  <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: "bold", textTransform: "uppercase" }}>
                    {(NODE_SETTINGS[inspectedNode.type] || NODE_SETTINGS.default).label}
                  </div>
                  <h4 style={{ margin: 0, fontSize: 14, wordBreak: "break-word", color: "#fff" }}>
                    {inspectedNode.label}
                  </h4>
                </div>
              </div>
              <button 
                onClick={() => setInspectedNodeId(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center" }}
              >
                <CrossIcon size={14} color="var(--text-muted)" />
              </button>
            </div>

            {/* Centrality Metrics */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold", marginBottom: 6 }}>
                GRAPH CENTRALITY & TOPOLOGY:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ background: "var(--panel)", padding: 6, borderRadius: 4, border: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Degree (Links)</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                    {inspectedNodeConnections.length}
                  </div>
                </div>
                <div style={{ background: "var(--panel)", padding: 6, borderRadius: 4, border: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Community Cluster</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--magenta)" }}>
                    #{inspectedNode.community ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Entity Attributes & Details */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold", marginBottom: 6 }}>
                ENTITY ATTRIBUTES:
              </div>
              <div style={{ background: "var(--panel)", padding: 10, borderRadius: 4, border: "1px solid var(--panel-border)", fontSize: 11, lineHeight: 1.6 }}>
                <div style={{ color: "var(--text-muted)" }}>ID:</div>
                <div style={{ wordBreak: "break-all", color: "#fff", marginBottom: 6 }}>{inspectedNode.id}</div>
                
                {inspectedNode.details && Object.keys(inspectedNode.details).length > 0 ? (
                  Object.entries(inspectedNode.details).map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    return (
                      <div key={k} style={{ marginTop: 4 }}>
                        <span style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}: </span>
                        <span style={{ color: "var(--text)", wordBreak: "break-all" }}>
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No extra metadata attached</div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {inspectedNode.details?.url && (
              <div style={{ marginBottom: 14 }}>
                <a
                  href={inspectedNode.details.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "var(--cyan)",
                    color: "#000",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    borderRadius: 4,
                    textDecoration: "none",
                    fontSize: 12,
                  }}
                >
                  Visit Discovered Link ↗
                </a>
              </div>
            )}

            {/* Connected Links */}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold", marginBottom: 6 }}>
                CONNECTED CORRELATIONS ({inspectedNodeConnections.length}):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {inspectedNodeConnections.map((e, idx) => {
                  const otherId = e.source === inspectedNode.id ? e.target : e.source;
                  const otherNode = nodes.find((n) => n.id === otherId);
                  return (
                    <div 
                      key={idx}
                      onClick={() => setInspectedNodeId(otherId)}
                      style={{
                        padding: "6px 8px",
                        background: "var(--panel)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                        {otherNode?.label || otherId}
                      </div>
                      <span style={{ fontSize: 9, color: EDGE_COLORS[e.relation_type || "default"] || "var(--cyan)", textTransform: "uppercase" }}>
                        {(e.relation_type || "link").replace(/_/g, " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Maltego Typology Legend */}
      <div style={{ marginTop: 14, padding: "12px 16px", background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
        <div style={{ fontSize: 11, fontWeight: "bold", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.5px" }}>
          MALTEGO ENTITY CLUSTERS & RELATIONSHIPS:
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            { label: "Case Hub", color: "#05D9E8" },
            { label: "Person", color: "#FF4D4D" },
            { label: "Username", color: "#00E676" },
            { label: "Email", color: "#00B0FF" },
            { label: "Phone", color: "#FF9100" },
            { label: "Company / CNPJ", color: "#9C27B0" },
            { label: "Domain / Network", color: "#00BCD4" },
            { label: "Crypto Wallet", color: "#FFD600" },
            { label: "Geolocation", color: "#FF0055" },
            { label: "Exposed Secret", color: "#FF5500" },
            { label: "Face Biometric", color: "#E040FB" },
            { label: "Databank Document", color: "#05D9E8" },
            { label: "Evidence URL", color: "#00FF9F" },
            { label: "Social Footprint", color: "#1877F2" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: item.color, display: "inline-block", boxShadow: `0 0 6px ${item.color}` }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

