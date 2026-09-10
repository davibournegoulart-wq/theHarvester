"""Biometrics and Facial Intelligence Routes.
Includes:
- Neural Face Detection & Crop Extraction with Reverse Search Pivots
- 1:1 Facial Verification and Match Score (YuNet + SFace)
- FaceSpyder Web Crawler: Hunts and extracts faces from URLs with optional reference matching.
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.recon.face_intel import (
    compare_two_faces,
    detect_and_extract_faces,
    spider_url_for_faces,
    harvest_web_faces_by_name,
)

router = APIRouter(prefix="/biometrics", tags=["biometrics"])


@router.post("/detect")
async def detect_faces_endpoint(
    file: UploadFile = File(...),
    min_confidence: float = Form(0.55),
):
    """Detect all human faces in the image, return coordinates, landmarks, and base64 crops."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty image file received.")
    try:
        return await run_in_threadpool(detect_and_extract_faces, content, min_confidence)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")


@router.post("/compare")
async def compare_faces_endpoint(
    file1: UploadFile = File(..., description="Reference / Target face"),
    file2: UploadFile = File(..., description="Candidate / Suspect face"),
):
    """Perform 1:1 biometric comparison between two face images using neural embeddings."""
    content1 = await file1.read()
    content2 = await file2.read()
    if not content1 or not content2:
        raise HTTPException(status_code=400, detail="Two valid image files are required for comparison.")
    try:
        return await run_in_threadpool(compare_two_faces, content1, content2)
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Biometric comparison error: {str(e)}")


@router.post("/spider")
async def spider_faces_endpoint(
    url: str = Form(...),
    max_images: int = Form(20),
    use_tor: bool = Form(False),
    reference_file: UploadFile | None = File(None),
):
    """FaceSpyder: Crawl a target web page, scrape all images, detect faces, and optionally match against reference."""
    ref_bytes = None
    if reference_file is not None:
        ref_bytes = await reference_file.read()
        if not ref_bytes:
            ref_bytes = None

    try:
        return await spider_url_for_faces(
            url=url,
            max_images=max_images,
            reference_face_bytes=ref_bytes,
            use_tor=use_tor,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FaceSpyder crawler failed: {str(e)}")


@router.post("/harvest")
async def harvest_faces_endpoint(
    target_name: str = Form(...),
    max_images: int = Form(15),
    use_tor: bool = Form(False),
    reference_file: UploadFile | None = File(None),
):
    """Target Name Web Scraper: Searches the open web for public photos of target person,
    detects faces, assesses forensic quality, demographics, and matches against reference suspect."""
    ref_bytes = None
    if reference_file is not None:
        ref_bytes = await reference_file.read()
        if not ref_bytes:
            ref_bytes = None

    try:
        return await harvest_web_faces_by_name(
            target_name=target_name,
            max_results=max_images,
            reference_face_bytes=ref_bytes,
            use_tor=use_tor,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Web face harvest failed: {str(e)}")

