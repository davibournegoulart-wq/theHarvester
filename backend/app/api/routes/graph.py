from fastapi import APIRouter
from pydantic import BaseModel

from app.graph.engine import GraphEdge, build_graph, compute_metrics, to_frontend_json

router = APIRouter(prefix="/graph", tags=["graph"])


class GraphEdgeIn(BaseModel):
    source_id: str
    target_id: str
    relation_type: str
    confidence: float = 1.0


class GraphComputeRequest(BaseModel):
    edges: list[GraphEdgeIn]


@router.post("/compute")
async def compute_graph(request: GraphComputeRequest):
    edges = [GraphEdge(**edge.model_dump()) for edge in request.edges]
    graph = build_graph(edges)
    metrics = compute_metrics(graph)
    return to_frontend_json(graph, metrics)
