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
    category: str
    search_url: str
    description: str = ""


def generate_reverse_image_links(image_url: str) -> list[ReverseImageSearchLink]:
    encoded = quote(image_url, safe="")
    return [
        # General Visual Matchers
        ReverseImageSearchLink(
            engine="Google Lens",
            category="General",
            search_url=f"https://lens.google.com/uploadbyurl?url={encoded}",
            description="Deep multimodal visual recognition & OCR",
        ),
        ReverseImageSearchLink(
            engine="Google Images",
            category="General",
            search_url=f"https://images.google.com/searchbyimage?image_url={encoded}",
            description="Global web crawl exact & visually similar pages",
        ),
        ReverseImageSearchLink(
            engine="Bing Visual Search",
            category="General",
            search_url=f"https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIRP&sbisrc=UrlPaste&q=imgurl:{encoded}",
            description="Microsoft Bing visual object & entity lookup",
        ),
        ReverseImageSearchLink(
            engine="Yandex Visual",
            category="General",
            search_url=f"https://yandex.com/images/search?rpt=imageview&url={encoded}",
            description="Leading Russian & Eastern European facial & object recognizer",
        ),
        ReverseImageSearchLink(
            engine="TinEye",
            category="General",
            search_url=f"https://tineye.com/search?url={encoded}",
            description="First reverse image engine with duplicate & modification tracker",
        ),
        # Asian Regional OSINT
        ReverseImageSearchLink(
            engine="Baidu Graph",
            category="Regional / Asian",
            search_url=f"https://graph.baidu.com/details?isfromvs=1&url={encoded}",
            description="China's primary reverse image search engine",
        ),
        ReverseImageSearchLink(
            engine="Sogou Visual",
            category="Regional / Asian",
            search_url=f"https://pic.sogou.com/ris?query={encoded}",
            description="Tencent WeChat & QQ integrated Chinese image recognition",
        ),
        # Facial, Biometric & Specialized Lookups
        ReverseImageSearchLink(
            engine="Lenso.ai",
            category="Biometrics & People",
            search_url=f"https://lenso.ai/en/search?url={encoded}",
            description="AI-powered face, person, place and duplicate finder",
        ),
        ReverseImageSearchLink(
            engine="PimEyes",
            category="Biometrics & People",
            search_url="https://pimeyes.com/en",
            description="High-precision facial recognition & identity audit",
        ),
        ReverseImageSearchLink(
            engine="SauceNAO",
            category="Forensics & Anime/Artwork",
            search_url=f"https://saucenao.com/search.php?url={encoded}",
            description="Specialized database for illustrations, manga, and artworks",
        ),
        ReverseImageSearchLink(
            engine="RepostSleuth",
            category="Forensics & Social Media",
            search_url=f"https://repostsleuth.com/search?url={encoded}",
            description="Reddit and social media repost & duplicate detector",
        ),
        ReverseImageSearchLink(
            engine="Kagi Images",
            category="Privacy Search",
            search_url=f"https://kagi.com/images?q={encoded}",
            description="Ad-free privacy-respecting visual index",
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
