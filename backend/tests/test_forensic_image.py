import io
import pytest
import numpy as np
from PIL import Image, ImageDraw

from app.recon.forensic_image import (
    perform_ela,
    detect_clones,
    generate_noise_map,
    analyze_luminance_gradient,
    detect_jpeg_ghost,
    detect_resampling,
    detect_steganography_lsb,
    compute_hashes,
    compute_hamming_distance,
    extract_exif_forensics,
    run_full_forensic_analysis,
)


@pytest.fixture
def sample_image_bytes():
    """Generates a test RGB JPEG image in memory."""
    img = Image.new("RGB", (200, 200), color=(120, 80, 200))
    draw = ImageDraw.Draw(img)
    # Add shapes, text, and gradients
    draw.rectangle([20, 20, 80, 80], fill=(255, 100, 50), outline=(0, 0, 0))
    draw.ellipse([100, 100, 180, 180], fill=(50, 220, 100), outline=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture
def cloned_image_bytes():
    """Generates an image with an intentionally copied and pasted block."""
    img = Image.new("RGB", (250, 250), color=(50, 50, 50))
    draw = ImageDraw.Draw(img)
    # Draw an intricate pattern
    for i in range(10):
        draw.line([(20 + i * 2, 20), (20 + i * 2, 60)], fill=(200, i * 25, 100))
    # Copy block (20, 20) -> (150, 150)
    crop = img.crop((20, 20, 60, 60))
    img.paste(crop, (150, 150))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_perform_ela(sample_image_bytes):
    res = perform_ela(sample_image_bytes, quality=90, error_scale=10.0)
    assert res["status"] == "success"
    assert "ela_image" in res
    assert res["ela_image"].startswith("data:image/png;base64,")
    assert "mean_diff" in res
    assert "anomaly_score" in res
    assert "multi_quality_scores" in res
    assert "q90" in res["multi_quality_scores"]


def test_detect_clones(cloned_image_bytes):
    res = detect_clones(cloned_image_bytes, block_size=16, threshold=0.90, min_distance=30)
    assert res["status"] == "success"
    assert "matches_count" in res
    assert "visualization" in res
    assert res["visualization"].startswith("data:image/png;base64,")


def test_generate_noise_map(sample_image_bytes):
    res = generate_noise_map(sample_image_bytes, sigma=2.0)
    assert res["status"] == "success"
    assert "channel_variance" in res
    assert "red" in res["channel_variance"]
    assert "noise_map" in res
    assert res["noise_map"].startswith("data:image/png;base64,")


def test_analyze_luminance_gradient(sample_image_bytes):
    res = analyze_luminance_gradient(sample_image_bytes)
    assert res["status"] == "success"
    assert "mean_light_angle_deg" in res
    assert "gradient_map" in res
    assert res["gradient_map"].startswith("data:image/png;base64,")


def test_detect_jpeg_ghost(sample_image_bytes):
    res = detect_jpeg_ghost(sample_image_bytes, quality_steps=(95, 85, 75, 65))
    assert res["status"] == "success"
    assert "quality_curve" in res
    assert "85" in res["quality_curve"]
    assert "estimated_original_quality" in res
    assert res["estimated_original_quality"] in [85, 75, 95]


def test_detect_resampling(sample_image_bytes):
    res = detect_resampling(sample_image_bytes)
    assert res["status"] == "success"
    assert "resampling_score" in res
    assert "spectrum_map" in res
    assert res["spectrum_map"].startswith("data:image/png;base64,")


def test_detect_steganography_lsb(sample_image_bytes):
    res = detect_steganography_lsb(sample_image_bytes)
    assert res["status"] == "success"
    assert "chi_square" in res
    assert "red" in res["chi_square"]
    assert "p_value" in res["chi_square"]["red"]
    assert "lsb_plane_map" in res


def test_compute_hashes(sample_image_bytes):
    res = compute_hashes(sample_image_bytes)
    assert res["status"] == "success"
    assert len(res["cryptographic"]["sha256"]) == 64
    assert len(res["cryptographic"]["md5"]) == 32
    assert len(res["cryptographic"]["sha1"]) == 40
    assert len(res["perceptual"]["ahash"]) == 16
    assert len(res["perceptual"]["dhash"]) == 16
    assert len(res["perceptual"]["phash"]) == 16

    # Test hamming distance between identical hash
    h = res["perceptual"]["phash"]
    assert compute_hamming_distance(h, h) == 0


def test_extract_exif_forensics(sample_image_bytes):
    res = extract_exif_forensics(sample_image_bytes)
    assert res["status"] == "success"
    assert "has_exif" in res


def test_run_full_forensic_analysis(sample_image_bytes):
    res = run_full_forensic_analysis(sample_image_bytes)
    assert res["status"] == "success"
    assert "verdict" in res
    assert "risk_score" in res
    assert 0 <= res["risk_score"] <= 100
    assert "modules" in res
    assert "ela" in res["modules"]
    assert "clones" in res["modules"]
    assert "noise" in res["modules"]
