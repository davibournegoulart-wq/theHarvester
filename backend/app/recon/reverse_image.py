"""Busca reversa de imagem — gera URL de busca, não faz scraping do resultado.

Ver vault: Architecture Roadmap#Fase 0. Mesmo princípio do
`recon/dork_generator.py`: motor de busca de imagem (Google, Yandex,
TinEye, Bing) não tem API pública/keyless de busca reversa — TinEye só
oferece API paga, Google/Bing exigem chave de nuvem paga. Fazer scraping
automatizado do resultado desses motores é o mesmo problema de ToS que
evitamos ao não automatizar busca textual no Google (ver dork_generator).

Em vez disso, geramos a URL pronta pra cada motor — o investigador abre e
revisa visualmente. Sem reconhecimento facial próprio, sem servidor
raspando resultado de busca de terceiro.
"""

from dataclasses import dataclass
from urllib.parse import quote


@dataclass
class ReverseImageSearchLink:
    engine: str
    search_url: str


def generate_reverse_image_links(image_url: str) -> list[ReverseImageSearchLink]:
    encoded = quote(image_url, safe="")
    return [
        ReverseImageSearchLink(engine="Google Images", search_url=f"https://www.google.com/searchbyimage?image_url={encoded}"),
        ReverseImageSearchLink(engine="Yandex", search_url=f"https://yandex.com/images/search?rpt=imageview&url={encoded}"),
        ReverseImageSearchLink(engine="TinEye", search_url=f"https://tineye.com/search?url={encoded}"),
        ReverseImageSearchLink(
            engine="Bing",
            search_url=f"https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIRP&sbisrc=UrlPaste&q=imgurl:{encoded}",
        ),
    ]

def extract_faces(image_bytes: bytes) -> list[bytes]:
    """Extrai recortes de rostos detectados na imagem em formato de bytes JPEG."""
    import cv2
    import numpy as np
    from app.recon.face_intel import get_detector, _image_bytes_to_cv2
    
    try:
        img = _image_bytes_to_cv2(image_bytes)
        h, w, _ = img.shape
        detector = get_detector()
        detector.setInputSize((w, h))
        detector.setScoreThreshold(0.55)
        _, faces = detector.detect(img)
        
        face_crops: list[bytes] = []
        if faces is not None:
            for face in faces:
                x, y, fw, fh = map(int, face[0:4])
                x = max(0, x)
                y = max(0, y)
                fw = min(fw, w - x)
                fh = min(fh, h - y)
                if fw > 10 and fh > 10:
                    crop = img[y : y + fh, x : x + fw]
                    success, buffer = cv2.imencode(".jpg", crop)
                    if success:
                        face_crops.append(buffer.tobytes())
        return face_crops
    except Exception:
        return []
