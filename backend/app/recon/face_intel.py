"""Biometric & Facial Intelligence Engine (YuNet + SFace + FaceSpyder).

Synthesizes capabilities from DeepFace, face_recognition, FaceSpyder, and web scraping repos:
1. High-precision neural face detection & 5-point landmark extraction (OpenCV YuNet ONNX).
2. Biometric alignment, feature embedding, and 1:1 / 1:N cosine & L2 distance comparison (OpenCV SFace ONNX).
3. Face crop extraction as base64 data URIs with instant reverse image pivots.
4. FaceSpyder web spider: crawls web pages, extracts all discovered images, scans for human faces,
   and optionally cross-matches against a reference suspect face.
"""

from __future__ import annotations

import base64
import io
import os
import re
from dataclasses import dataclass, asdict
from typing import Any
from urllib.parse import urljoin, urlparse

import cv2
import httpx
import numpy as np
from PIL import Image
from bs4 import BeautifulSoup

from app.recon.reverse_image import generate_reverse_image_links

# Paths to neural network models
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "face")
YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

# Global cached model instances
_detector: cv2.FaceDetectorYN | None = None
_recognizer: cv2.FaceRecognizerSF | None = None


def get_detector() -> cv2.FaceDetectorYN:
    global _detector
    if _detector is None:
        if not os.path.exists(YUNET_MODEL_PATH):
            raise FileNotFoundError(f"YuNet model not found at {YUNET_MODEL_PATH}")
        # Default input size (320, 320), conf_threshold 0.6, nms_threshold 0.3
        _detector = cv2.FaceDetectorYN_create(
            model=YUNET_MODEL_PATH,
            config="",
            input_size=(320, 320),
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=5000,
        )
    return _detector


def get_recognizer() -> cv2.FaceRecognizerSF:
    global _recognizer
    if _recognizer is None:
        if not os.path.exists(SFACE_MODEL_PATH):
            raise FileNotFoundError(f"SFace model not found at {SFACE_MODEL_PATH}")
        _recognizer = cv2.FaceRecognizerSF_create(
            model=SFACE_MODEL_PATH,
            config="",
        )
    return _recognizer


@dataclass
class DetectedFace:
    face_id: int
    bbox: list[int]  # [x, y, w, h]
    confidence: float
    landmarks: list[list[int]]  # [[x,y], ...] 5 points: right_eye, left_eye, nose_tip, right_mouth, left_mouth
    crop_base64: str  # data:image/jpeg;base64,...
    reverse_search_links: list[dict[str, str]]


@dataclass
class FaceDetectionResult:
    image_width: int
    image_height: int
    total_faces: int
    faces: list[DetectedFace]
    original_reverse_links: list[dict[str, str]]


@dataclass
class BiometricComparisonResult:
    cosine_similarity: float  # -1.0 to 1.0 (typically 0.0 to 1.0)
    l2_distance: float
    match_percentage: float  # 0% - 100% normalized score
    is_match: bool  # True if cosine >= 0.40 or L2 <= 1.0
    confidence_level: str  # "HIGH MATCH", "PROBABLE MATCH", "INCONCLUSIVE", "NO MATCH"
    face1_crop: str
    face2_crop: str


@dataclass
class SpiderDiscoveredFace:
    source_image_url: str
    face_index: int
    confidence: float
    bbox: list[int]
    crop_base64: str
    match_with_target: float | None  # If reference suspect provided


@dataclass
class FaceSpiderResult:
    target_url: str
    images_scanned: int
    faces_detected: int
    discovered_faces: list[SpiderDiscoveredFace]


def _image_bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes into an OpenCV BGR numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        # Fallback with PIL for unusual formats / RGBA
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    return img


def _cv2_to_base64_data_uri(img: np.ndarray, quality: int = 90) -> str:
    """Encode OpenCV BGR image to base64 data URI."""
    success, buffer = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not success:
        return ""
    b64 = base64.b64encode(buffer).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def detect_and_extract_faces(image_bytes: bytes, min_confidence: float = 0.55) -> dict[str, Any]:
    """Detect faces using YuNet, extract crops, landmarks, and generate search links."""
    img = _image_bytes_to_cv2(image_bytes)
    h, w, _ = img.shape

    detector = get_detector()
    detector.setInputSize((w, h))
    detector.setScoreThreshold(min_confidence)

    _, faces = detector.detect(img)

    detected_faces: list[dict[str, Any]] = []

    if faces is not None and len(faces) > 0:
        for idx, face_data in enumerate(faces):
            # YuNet output: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
            x, y, fw, fh = map(int, face_data[0:4])
            score = float(face_data[-1])

            # Clamp bounding box
            x = max(0, x)
            y = max(0, y)
            fw = min(fw, w - x)
            fh = min(fh, h - y)

            if fw <= 5 or fh <= 5:
                continue

            # Landmarks: 5 points (right eye, left eye, nose, right mouth, left mouth)
            raw_landmarks = face_data[4:14].reshape((5, 2))
            landmarks = [[int(pt[0]), int(pt[1])] for pt in raw_landmarks]

            # Add a slight margin around face crop for better human inspection
            margin_x = int(fw * 0.15)
            margin_y = int(fh * 0.15)
            crop_x1 = max(0, x - margin_x)
            crop_y1 = max(0, y - margin_y)
            crop_x2 = min(w, x + fw + margin_x)
            crop_y2 = min(h, y + fh + margin_y)

            face_crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
            crop_b64 = _cv2_to_base64_data_uri(face_crop)

            rev_links = [
                {"engine": "Google Lens / Images", "search_url": "https://images.google.com/"},
                {"engine": "Yandex Visual", "search_url": "https://yandex.com/images/"},
                {"engine": "TinEye", "search_url": "https://tineye.com/"},
                {"engine": "Bing Visual", "search_url": "https://www.bing.com/images/search?view=detailv2&iss=sbi"},
            ]

            detected_faces.append(
                {
                    "face_id": idx + 1,
                    "bbox": [x, y, fw, fh],
                    "confidence": round(score, 3),
                    "landmarks": landmarks,
                    "crop_base64": crop_b64,
                    "reverse_search_links": rev_links,
                }
            )

    return {
        "image_width": w,
        "image_height": h,
        "total_faces": len(detected_faces),
        "faces": detected_faces,
        "original_reverse_links": [
            {"engine": "Google Lens / Images", "search_url": "https://images.google.com/"},
            {"engine": "Yandex Visual", "search_url": "https://yandex.com/images/"},
            {"engine": "TinEye", "search_url": "https://tineye.com/"},
            {"engine": "Bing Visual", "search_url": "https://www.bing.com/images/search?view=detailv2&iss=sbi"},
        ],
    }


def compare_two_faces(image_bytes_1: bytes, image_bytes_2: bytes) -> dict[str, Any]:
    """Extract facial features via YuNet + SFace and compute Cosine similarity & L2 distance."""
    img1 = _image_bytes_to_cv2(image_bytes_1)
    img2 = _image_bytes_to_cv2(image_bytes_2)

    detector = get_detector()
    recognizer = get_recognizer()

    # Process image 1
    h1, w1, _ = img1.shape
    detector.setInputSize((w1, h1))
    detector.setScoreThreshold(0.5)
    _, faces1 = detector.detect(img1)
    if faces1 is None or len(faces1) == 0:
        raise ValueError("No face detected in Image 1 (Target / Reference). Please upload a clearer face photo.")

    face1 = faces1[0]
    aligned1 = recognizer.alignCrop(img1, face1)
    feat1 = recognizer.feature(aligned1)
    crop1_b64 = _cv2_to_base64_data_uri(aligned1)

    # Process image 2
    h2, w2, _ = img2.shape
    detector.setInputSize((w2, h2))
    detector.setScoreThreshold(0.5)
    _, faces2 = detector.detect(img2)
    if faces2 is None or len(faces2) == 0:
        raise ValueError("No face detected in Image 2 (Candidate / Suspect). Please upload a clearer face photo.")

    face2 = faces2[0]
    aligned2 = recognizer.alignCrop(img2, face2)
    feat2 = recognizer.feature(aligned2)
    crop2_b64 = _cv2_to_base64_data_uri(aligned2)

    # Match computation
    cosine_sim = float(recognizer.match(feat1, feat2, cv2.FaceRecognizerSF_FR_COSINE))
    l2_dist = float(recognizer.match(feat1, feat2, cv2.FaceRecognizerSF_FR_NORM_L2))

    # SFace thresholds:
    # Cosine threshold: ~0.363 (>= 0.363 same person)
    # L2 threshold: ~1.128 (<= 1.128 same person)
    norm_score = max(0.0, min(100.0, ((cosine_sim + 0.1) / 1.0) * 100))
    match_pct = round(norm_score, 1)

    is_match = cosine_sim >= 0.363 or l2_dist <= 1.128

    if cosine_sim >= 0.65:
        level = "HIGH MATCH (Identical Biometrics)"
    elif cosine_sim >= 0.363:
        level = "PROBABLE MATCH (Likely Same Person)"
    elif cosine_sim >= 0.20:
        level = "INCONCLUSIVE (Partial Facial Resemblance)"
    else:
        level = "NO MATCH (Different Individuals)"

    return {
        "cosine_similarity": round(cosine_sim, 4),
        "l2_distance": round(l2_dist, 4),
        "match_percentage": match_pct,
        "is_match": is_match,
        "confidence_level": level,
        "face1_crop": crop1_b64,
        "face2_crop": crop2_b64,
    }


async def spider_url_for_faces(
    url: str,
    max_images: int = 25,
    reference_face_bytes: bytes | None = None,
    use_tor: bool = False,
) -> dict[str, Any]:
    """Crawl a website, extract discovered image URLs, scan for faces, and optionally match reference face."""
    detector = get_detector()
    recognizer = get_recognizer() if reference_face_bytes else None

    ref_feat = None
    if reference_face_bytes and recognizer:
        try:
            ref_img = _image_bytes_to_cv2(reference_face_bytes)
            rh, rw, _ = ref_img.shape
            detector.setInputSize((rw, rh))
            _, r_faces = detector.detect(ref_img)
            if r_faces is not None and len(r_faces) > 0:
                aligned_ref = recognizer.alignCrop(ref_img, r_faces[0])
                ref_feat = recognizer.feature(aligned_ref)
        except Exception:
            ref_feat = None

    proxies = "socks5://127.0.0.1:9050" if use_tor else None
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
    }

    discovered_image_urls: list[str] = []

    async with httpx.AsyncClient(proxy=proxies, headers=headers, timeout=20.0, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for img_tag in soup.find_all("img"):
                    src = img_tag.get("src") or img_tag.get("data-src") or img_tag.get("srcset")
                    if not src:
                        continue
                    if " " in src:
                        src = src.split(" ")[0]
                    abs_url = urljoin(url, src)
                    if abs_url.startswith("http") and abs_url not in discovered_image_urls:
                        if not any(ext in abs_url.lower() for ext in [".svg", ".gif", "favicon", "pixel", "tracker"]):
                            discovered_image_urls.append(abs_url)
                            if len(discovered_image_urls) >= max_images:
                                break
        except Exception:
            pass

    discovered_faces: list[dict[str, Any]] = []
    images_scanned = 0

    async with httpx.AsyncClient(proxy=proxies, headers=headers, timeout=15.0, follow_redirects=True) as client:
        for img_url in discovered_image_urls:
            images_scanned += 1
            try:
                res = await client.get(img_url)
                if res.status_code != 200 or len(res.content) < 2000:
                    continue
                img = _image_bytes_to_cv2(res.content)
                if img is None:
                    continue
                ih, iw, _ = img.shape
                if ih < 60 or iw < 60:
                    continue

                detector.setInputSize((iw, ih))
                detector.setScoreThreshold(0.55)
                _, detected = detector.detect(img)

                if detected is not None and len(detected) > 0:
                    for f_idx, f_data in enumerate(detected):
                        fx, fy, fw, fh = map(int, f_data[0:4])
                        fx = max(0, fx)
                        fy = max(0, fy)
                        fw = min(fw, iw - fx)
                        fh = min(fh, ih - fy)

                        if fw <= 15 or fh <= 15:
                            continue

                        crop = img[fy : fy + fh, fx : fx + fw]
                        crop_b64 = _cv2_to_base64_data_uri(crop)

                        match_score = None
                        if ref_feat is not None and recognizer is not None:
                            try:
                                aligned = recognizer.alignCrop(img, f_data)
                                curr_feat = recognizer.feature(aligned)
                                sim = float(recognizer.match(ref_feat, curr_feat, cv2.FaceRecognizerSF_FR_COSINE))
                                match_score = round(max(0.0, min(100.0, ((sim + 0.1) / 1.0) * 100)), 1)
                            except Exception:
                                pass

                        discovered_faces.append(
                            {
                                "source_image_url": img_url,
                                "face_index": f_idx + 1,
                                "confidence": round(float(f_data[-1]), 3),
                                "bbox": [fx, fy, fw, fh],
                                "crop_base64": crop_b64,
                                "match_with_target": match_score,
                            }
                        )
            except Exception:
                continue

    return {
        "target_url": url,
        "images_scanned": images_scanned,
        "faces_detected": len(discovered_faces),
        "discovered_faces": discovered_faces,
    }
