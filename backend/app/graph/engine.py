"""Motor de grafo próprio — substitui embutir Gephi/Gephi Lite.

Ver vault: Tools - Correlation and Case Management#Gephi Gephi Lite e
Architecture Roadmap#Fase 1. Usa `networkx` (biblioteca Python pura, sem
servidor/produto externo) pra calcular as mesmas métricas que o Gephi
oferece. A visualização interativa fica no frontend (sigma.js/cytoscape.js),
consumindo o JSON que `to_frontend_json` produz aqui.
"""

from dataclasses import dataclass

import networkx as nx


@dataclass
class GraphEdge:
    source_id: str
    target_id: str
    relation_type: str
    confidence: float = 1.0


@dataclass
class GraphMetrics:
    degree_centrality: dict[str, float]
    betweenness_centrality: dict[str, float]
    closeness_centrality: dict[str, float]
    communities: dict[str, int]  # node_id -> community index (modularidade)


def build_graph(edges: list[GraphEdge]) -> nx.Graph:
    graph = nx.Graph()
    for edge in edges:
        graph.add_edge(edge.source_id, edge.target_id, relation_type=edge.relation_type, weight=edge.confidence)
    return graph


def compute_metrics(graph: nx.Graph) -> GraphMetrics:
    if len(graph) == 0:
        return GraphMetrics(
            degree_centrality={},
            betweenness_centrality={},
            closeness_centrality={},
            communities={},
        )

    communities_generator = nx.community.greedy_modularity_communities(graph) if len(graph) > 1 else [list(graph.nodes)]
    community_map: dict[str, int] = {}
    for index, community in enumerate(communities_generator):
        for node in community:
            community_map[node] = index

    return GraphMetrics(
        degree_centrality=nx.degree_centrality(graph),
        betweenness_centrality=nx.betweenness_centrality(graph),
        closeness_centrality=nx.closeness_centrality(graph),
        communities=community_map,
    )


def to_frontend_json(graph: nx.Graph, metrics: GraphMetrics) -> dict:
    """Formato consumido pelo componente sigma.js/cytoscape.js no frontend."""
    nodes = [
        {
            "id": node,
            "degree": metrics.degree_centrality.get(node, 0),
            "betweenness": metrics.betweenness_centrality.get(node, 0),
            "closeness": metrics.closeness_centrality.get(node, 0),
            "community": metrics.communities.get(node, -1),
        }
        for node in graph.nodes
    ]
    edges = [
        {"source": u, "target": v, "relation_type": data.get("relation_type"), "weight": data.get("weight", 1.0)}
        for u, v, data in graph.edges(data=True)
    ]
    return {"nodes": nodes, "edges": edges}
