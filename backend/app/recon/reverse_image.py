"""Busca reversa de imagem pública — sem reconhecimento facial próprio.

Ver vault: Architecture Roadmap#Fase 0. Usado tipicamente sobre uma foto de
perfil achada via checkers/username.py ou checkers/facebook_pivot.py.

TODO: integrar motor de busca reversa público (ex: endpoint de busca por
imagem de um motor de busca que ofereça isso). Não construir/rodar modelo
de reconhecimento facial próprio — está fora do escopo aprovado.
"""

from dataclasses import dataclass


@dataclass
class ReverseImageMatch:
    source_url: str
    page_url: str
    discovered_by: str = "recon.reverse_image"


async def search_reverse_image(image_url: str) -> list[ReverseImageMatch]:
    raise NotImplementedError("Integrar motor de busca reversa público. Sem modelo de reconhecimento facial próprio.")
