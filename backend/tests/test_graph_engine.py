from app.graph.engine import GraphEdge, build_graph, compute_metrics, to_frontend_json


def _two_triangle_edges() -> list[GraphEdge]:
    """Duas comunidades bem separadas (A-B-C e D-E-F), sem ponte entre elas —
    fácil de verificar que a detecção de comunidade não mistura os dois grupos."""
    return [
        GraphEdge("A", "B", "same_platform", 1.0),
        GraphEdge("B", "C", "same_platform", 1.0),
        GraphEdge("A", "C", "same_platform", 1.0),
        GraphEdge("D", "E", "same_platform", 1.0),
        GraphEdge("E", "F", "same_platform", 1.0),
        GraphEdge("D", "F", "same_platform", 1.0),
    ]


def test_build_graph_creates_expected_nodes_and_edges():
    graph = build_graph(_two_triangle_edges())
    assert set(graph.nodes) == {"A", "B", "C", "D", "E", "F"}
    assert graph.number_of_edges() == 6


def test_compute_metrics_separates_disconnected_communities():
    graph = build_graph(_two_triangle_edges())
    metrics = compute_metrics(graph)

    assert metrics.communities["A"] == metrics.communities["B"] == metrics.communities["C"]
    assert metrics.communities["D"] == metrics.communities["E"] == metrics.communities["F"]
    assert metrics.communities["A"] != metrics.communities["D"]


def test_compute_metrics_centrality_is_equal_within_a_symmetric_triangle():
    graph = build_graph(_two_triangle_edges())
    metrics = compute_metrics(graph)

    degrees = {metrics.degree_centrality[n] for n in ("A", "B", "C")}
    assert len(degrees) == 1  # triângulo simétrico -> todo nó tem o mesmo grau


def test_to_frontend_json_shape():
    graph = build_graph(_two_triangle_edges())
    metrics = compute_metrics(graph)
    payload = to_frontend_json(graph, metrics)

    assert {n["id"] for n in payload["nodes"]} == {"A", "B", "C", "D", "E", "F"}
    assert len(payload["edges"]) == 6
    for edge in payload["edges"]:
        assert edge["relation_type"] == "same_platform"
        assert edge["weight"] == 1.0
