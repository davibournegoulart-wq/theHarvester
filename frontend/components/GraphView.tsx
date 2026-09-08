"use client";

import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { useEffect, useRef, useState } from "react";
import Sigma from "sigma";
import { API_URL } from "@/lib/api";

type EdgeInput = { source_id: string; target_id: string; relation_type: string };
type GraphNodeResult = { id: string; degree: number; betweenness: number; closeness: number; community: number };
type GraphEdgeResult = { source: string; target: string; relation_type: string; weight: number };
type GraphResponse = { nodes: GraphNodeResult[]; edges: GraphEdgeResult[] };

const COMMUNITY_COLORS = ["#4C72B0", "#DD8452", "#55A868", "#C44E52", "#8172B2", "#937860", "#DA8BC3", "#8C8C8C"];

const EXAMPLE_EDGES: EdgeInput[] = [
  { source_id: "email:a@x.com", target_id: "user:alice", relation_type: "same_person" },
  { source_id: "user:alice", target_id: "phone:+551199999", relation_type: "same_person" },
  { source_id: "user:alice", target_id: "user:alice_gh", relation_type: "same_person" },
  { source_id: "user:bob", target_id: "user:carol", relation_type: "same_person" },
  { source_id: "user:carol", target_id: "email:c@y.com", relation_type: "same_person" },
];

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [edges, setEdges] = useState<EdgeInput[]>(EXAMPLE_EDGES);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [relation, setRelation] = useState("same_person");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNodeResult | null>(null);

  function addEdge() {
    if (!source || !target) return;
    setEdges((prev) => [...prev, { source_id: source, target_id: target, relation_type: relation }]);
    setSource("");
    setTarget("");
  }

  function removeEdge(index: number) {
    setEdges((prev) => prev.filter((_, i) => i !== index));
  }

  async function computeAndRender() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/graph/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edges }),
      });
      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data: GraphResponse = await response.json();
      renderGraph(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao calcular grafo");
    } finally {
      setLoading(false);
    }
  }

  function renderGraph(data: GraphResponse) {
    if (!containerRef.current) return;
    sigmaRef.current?.kill();
    sigmaRef.current = null;

    const graph = new Graph();
    const maxDegree = Math.max(...data.nodes.map((n) => n.degree), 0.01);

    for (const node of data.nodes) {
      graph.addNode(node.id, {
        label: node.id,
        size: 5 + (node.degree / maxDegree) * 15,
        color: COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length],
        x: Math.random(),
        y: Math.random(),
        degree: node.degree,
        betweenness: node.betweenness,
        closeness: node.closeness,
        community: node.community,
      });
    }
    for (const edge of data.edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target) && !graph.hasEdge(edge.source, edge.target)) {
        graph.addEdge(edge.source, edge.target, { label: edge.relation_type, size: 1, color: "#ccc" });
      }
    }

    forceAtlas2.assign(graph, { iterations: 100 });

    const sigma = new Sigma(graph, containerRef.current);
    sigma.on("clickNode", ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      setSelected({
        id: node,
        degree: attrs.degree,
        betweenness: attrs.betweenness,
        closeness: attrs.closeness,
        community: attrs.community,
      });
    });
    sigmaRef.current = sigma;
  }

  useEffect(() => {
    return () => {
      sigmaRef.current?.kill();
    };
  }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="origem (ex: email:a@x.com)"
          style={{ flex: 1, padding: 8 }}
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="destino (ex: user:alice)"
          style={{ flex: 1, padding: 8 }}
        />
        <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="relação" style={{ width: 140, padding: 8 }} />
        <button onClick={addEdge}>+ aresta</button>
      </div>

      <ul style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
        {edges.map((e, i) => (
          <li key={i}>
            {e.source_id} → {e.target_id} ({e.relation_type}){" "}
            <button onClick={() => removeEdge(i)} style={{ fontSize: 11 }}>
              remover
            </button>
          </li>
        ))}
      </ul>

      <button onClick={computeAndRender} disabled={loading || edges.length === 0}>
        {loading ? "Calculando..." : "Calcular e renderizar grafo"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div ref={containerRef} style={{ width: "100%", height: 420, marginTop: 16, border: "1px solid #ddd" }} />

      {selected && (
        <ul style={{ marginTop: 8 }}>
          <li>
            <strong>{selected.id}</strong>
          </li>
          <li>Degree centrality: {selected.degree.toFixed(3)}</li>
          <li>Betweenness centrality: {selected.betweenness.toFixed(3)}</li>
          <li>Closeness centrality: {selected.closeness.toFixed(3)}</li>
          <li>Comunidade: {selected.community}</li>
        </ul>
      )}
    </div>
  );
}
