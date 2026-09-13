"""
Forensic Image Analysis Engine
==============================
Integrates algorithms from Forensically (Jonas Wagner) and Forensic-Image-Analysis-Toolkit (CodeRafay).
Provides:
  - Error Level Analysis (ELA) with multi-quality difference maps and anomaly scoring
  - Copy-Move Forgery Detection (CMFD / Clone Detection) with 2D-DCT block matching
  - High-frequency Noise Map & Inconsistency Analysis
  - Luminance Gradient & Lighting Direction Analysis
  - JPEG Ghost Analysis (multi-quality recompression curve)
  - Resampling & Interpolation Periodic Artifacts via 2D FFT Magnitude Spectrum
  - LSB Steganography Detection & Chi-Square Randomness Anomaly Testing
  - Cryptographic & Perceptual Hashing (SHA-256, MD5, SHA-1, aHash, dHash, pHash)
  - EXIF & Camera Software Tampering Forensics
"""

import io
import math
import hashlib
import base64
from typing import Dict, List, Any, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ExifTags


def _to_pil(image_bytes: bytes) -> Image.Image:
    """Safely convert raw bytes to RGB PIL Image."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def _to_cv2(image_bytes: bytes) -> np.ndarray:
    """Safely convert raw bytes to BGR OpenCV image."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image using OpenCV")
    return img


def _pil_to_base64_data_url(pil_img: Image.Image, format: str = "PNG") -> str:
    """Converts a PIL image to a base64 data URL."""
    buffered = io.BytesIO()
    pil_img.save(buffered, format=format)
    encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{encoded}"


def _cv2_to_base64_data_url(cv_img: np.ndarray, ext: str = ".png") -> str:
    """Converts an OpenCV image to a base64 data URL."""
    success, encoded_img = cv2.imencode(ext, cv_img)
    if not success:
        return ""
    b64 = base64.b64encode(encoded_img).decode("utf-8")
    mime = "image/png" if ext == ".png" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


# ============================================================================
# 1. ERROR LEVEL ANALYSIS (ELA)
# ============================================================================

def perform_ela(
    image_bytes: bytes,
    quality: int = 95,
    error_scale: float = 10.0,
    overlay_opacity: float = 0.5,
) -> Dict[str, Any]:
    """
    Performs Error Level Analysis (ELA) by recompressing at a specific JPEG quality
    and measuring compression difference. Manipulated/spliced areas typically display
    mismatched error levels compared to original regions.
    """
    try:
        original = _to_pil(image_bytes)
        w, h = original.size

        # Cap processing dimensions if extremely large to prevent OOM
        max_dim = 1600
        if max(w, h) > max_dim:
            ratio = max_dim / max(w, h)
            original = original.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)

        # Recompress in memory at specified quality
        buf = io.BytesIO()
        original.save(buf, "JPEG", quality=int(quality))
        buf.seek(0)
        recompressed = Image.open(buf).convert("RGB")

        # Compute difference
        diff = ImageChops.difference(original, recompressed)
        recompressed.close()

        # Compute statistics
        diff_np = np.asarray(diff, dtype=np.float32)
        max_diff = float(np.max(diff_np))
        mean_diff = float(np.mean(diff_np))
        std_diff = float(np.std(diff_np))

        # Dynamic scale
        scale = 255.0 / max(max_diff, 1.0) * (error_scale / 10.0)
        ela_img = ImageEnhance.Brightness(diff).enhance(scale)

        # Overlay on original
        ela_overlay = Image.blend(original, ela_img.convert("RGB"), alpha=overlay_opacity)

        # Anomaly scoring
        anomaly_score = round(mean_diff + 2.0 * std_diff, 2)
        suspicious = anomaly_score > 25.0

        # Multi-quality snapshot scores
        multi_scores = {}
        for q in [75, 85, 90, 95]:
            b_q = io.BytesIO()
            original.save(b_q, "JPEG", quality=q)
            b_q.seek(0)
            res_q = Image.open(b_q).convert("RGB")
            d_q = ImageChops.difference(original, res_q)
            d_np = np.asarray(d_q, dtype=np.float32)
            multi_scores[f"q{q}"] = round(float(np.mean(d_np)), 2)
            res_q.close()
            d_q.close()

        ela_b64 = _pil_to_base64_data_url(ela_img)
        overlay_b64 = _pil_to_base64_data_url(ela_overlay)

        return {
            "status": "success",
            "quality": quality,
            "error_scale": error_scale,
            "mean_diff": round(mean_diff, 3),
            "max_diff": round(max_diff, 3),
            "std_diff": round(std_diff, 3),
            "anomaly_score": anomaly_score,
            "is_suspicious": suspicious,
            "multi_quality_scores": multi_scores,
            "ela_image": ela_b64,
            "overlay_image": overlay_b64,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================================
# 2. COPY-MOVE FORGERY DETECTION (CMFD / CLONE DETECTION)
# ============================================================================

def detect_clones(
    image_bytes: bytes,
    block_size: int = 16,
    threshold: float = 0.96,
    min_distance: int = 40,
) -> Dict[str, Any]:
    """
    Detects duplicated / cloned regions (copy-move forgery) using 2D-DCT block matching
    with lexicographic sorting. Connects cloned sources and targets with vector lines.
    """
    try:
        img = _to_cv2(image_bytes)
        h, w = img.shape[:2]

        # Downscale if too large for real-time block matching
        max_size = 800
        scale_factor = 1.0
        if max(h, w) > max_size:
            scale_factor = max_size / max(h, w)
            img_processed = cv2.resize(img, (int(w * scale_factor), int(h * scale_factor)))
        else:
            img_processed = img.copy()

        gray = cv2.cvtColor(img_processed, cv2.COLOR_BGR2GRAY)
        gh, gw = gray.shape

        step = max(4, block_size // 2)
        blocks = []
        positions = []

        for y in range(0, gh - block_size, step):
            for x in range(0, gw - block_size, step):
                block = gray[y : y + block_size, x : x + block_size]
                dct = cv2.dct(np.float32(block))
                # Top-left low-frequency 6x6 coefficients
                feat = dct[:6, :6].flatten()
                blocks.append(feat)
                positions.append((y, x))

        if not blocks:
            return {"status": "success", "matches_count": 0, "clones_detected": False}

        blocks = np.array(blocks, dtype=np.float32)
        norms = np.linalg.norm(blocks, axis=1, keepdims=True) + 1e-10
        blocks_norm = blocks / norms
        n = len(blocks_norm)

        # Lexicographic sorting turns O(n^2) into O(n * k)
        sort_idx = np.lexsort(blocks_norm[:, ::-1].T)
        sorted_blocks = blocks_norm[sort_idx]

        window = min(20, n)
        matches = []
        max_matches = 250

        scaled_min_dist = int(min_distance * scale_factor)

        for i in range(n):
            for j in range(i + 1, min(i + window, n)):
                sim = float(np.dot(sorted_blocks[i], sorted_blocks[j]))
                if sim >= threshold:
                    pos1 = positions[int(sort_idx[i])]
                    pos2 = positions[int(sort_idx[j])]
                    dist = math.hypot(pos1[0] - pos2[0], pos1[1] - pos2[1])
                    if dist >= scaled_min_dist:
                        matches.append({
                            "b1": pos1,
                            "b2": pos2,
                            "sim": round(sim, 4),
                            "dist": round(dist, 1)
                        })
                        if len(matches) >= max_matches:
                            break
            if len(matches) >= max_matches:
                break

        # Render visual clone map
        vis = img_processed.copy()
        # Draw matched blocks and connecting vectors
        colors = [(0, 255, 128), (0, 165, 255), (255, 0, 128), (0, 255, 255), (255, 128, 0)]
        for idx, m in enumerate(matches[:50]):
            color = colors[idx % len(colors)]
            y1, x1 = m["b1"]
            y2, x2 = m["b2"]
            cv2.rectangle(vis, (x1, y1), (x1 + block_size, y1 + block_size), color, 2)
            cv2.rectangle(vis, (x2, y2), (x2 + block_size, y2 + block_size), color, 2)
            cv2.line(vis, (x1 + block_size // 2, y1 + block_size // 2),
                          (x2 + block_size // 2, y2 + block_size // 2), color, 1)

        vis_b64 = _cv2_to_base64_data_url(vis)

        clones_found = len(matches) >= 3
        return {
            "status": "success",
            "matches_count": len(matches),
            "clones_detected": clones_found,
            "threshold": threshold,
            "block_size": block_size,
            "sample_matches": matches[:10],
            "visualization": vis_b64,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================================
# 3. NOISE MAP & INCONSISTENCY ANALYSIS
# ============================================================================

def generate_noise_map(image_bytes: bytes, sigma: float = 2.0) -> Dict[str, Any]:
    """
    Generates high-frequency noise map by subtracting Gaussian blurred versions
    per RGB channel. Inconsistencies in noise variance across grid blocks reveal
    retouched, pasted, or AI-generated segments.
    """
    try:
        pil_img = _to_pil(image_bytes)
        channels = pil_img.split()
        noise_channels = []
        variances = []

        for ch in channels:
            blurred = ch.filter(ImageFilter.GaussianBlur(radius=sigma))
            diff = ImageChops.difference(ch, blurred)
            enhanced = ImageChops.multiply(diff, diff)
            noise_channels.append(enhanced)
            diff_np = np.asarray(diff, dtype=np.float32)
            variances.append(float(np.var(diff_np)))

        noise_map = Image.merge("RGB", noise_channels)

        # Block-level noise variance analysis (64x64 grid)
        noise_np = np.asarray(noise_map, dtype=np.float32)
        h, w = noise_np.shape[:2]
        bs = 64
        block_vars = []
        for y in range(0, h - bs, bs):
            for x in range(0, w - bs, bs):
                block = noise_np[y : y + bs, x : x + bs]
                block_vars.append(float(np.var(block)))

        mean_var = float(np.mean(block_vars)) if block_vars else 0.0
        std_var = float(np.std(block_vars)) if block_vars else 0.0
        inconsistency_ratio = round(std_var / max(mean_var, 0.001), 3)

        warnings = []
        if inconsistency_ratio > 0.65:
            warnings.append("High local noise inconsistency: potential splicing or selective smoothing detected.")
        if np.mean(variances) < 5.0:
            warnings.append("Abnormally low noise floor: possible heavy AI denoising, synthetic generation, or flat graphic.")

        noise_b64 = _pil_to_base64_data_url(noise_map)

        return {
            "status": "success",
            "channel_variance": {
                "red": round(variances[0], 2),
                "green": round(variances[1], 2),
                "blue": round(variances[2], 2),
            },
            "mean_block_variance": round(mean_var, 2),
            "std_block_variance": round(std_var, 2),
            "inconsistency_ratio": inconsistency_ratio,
            "suspicious": inconsistency_ratio > 0.65,
            "warnings": warnings,
            "noise_map": noise_b64,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================================
# 4. LUMINANCE GRADIENT ANALYSIS
# ============================================================================

def analyze_luminance_gradient(image_bytes: bytes) -> Dict[str, Any]:
    """
    Computes horizontal and vertical directional Sobel gradients on luminance channel.
    Reveals whether lighting direction, shadow gradients, and illumination angles
    are consistent across foreground objects and background.
    """
    try:
        cv_img = _to_cv2(image_bytes)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

        # Sobel gradients
        sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)

        # Gradient magnitude and angle
        magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
        angle = np.arctan2(sobel_y, sobel_x) * (180.0 / np.pi) % 180.0

        # Normalize magnitude for visualization
        norm_mag = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        grad_colored = cv2.applyColorMap(norm_mag, cv2.COLORMAP_JET)

        # Directional statistics
        mean_angle = round(float(np.mean(angle)), 1)
        std_angle = round(float(np.std(angle)), 1)

        grad_b64 = _cv2_to_base64_data_url(grad_colored)

        return {
            "status": "success",
            "mean_light_angle_deg": mean_angle,
            "gradient_std_deg": std_angle,
            "gradient_map": grad_b64,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================================
# 5. JPEG GHOST ANALYSIS (MULTI-QUALITY RESAVE CURVE)
# ============================================================================

def detect_jpeg_ghost(
    image_bytes: bytes,
    quality_steps: Tuple[int, ...] = (95, 85, 75, 65, 55),
) -> Dict[str, Any]:
    """
    Identifies previous JPEG compression quality levels by evaluating difference
    extrema across multiple recompression passes. An image previously saved at Q=75
    will show a pronounced local minimum when recompressed at Q=75.
    """
    try:
        original = _to_pil(image_bytes)
        scores = {}
        diff_maps = {}

        for q in quality_steps:
            buf = io.BytesIO()
            original.save(buf, "JPEG", quality=q)
            buf.seek(0)
            resaved = Image.open(buf).convert("RGB")

            diff = ImageChops.difference(original, resaved)
            resaved.close()

            diff_np = np.asarray(diff, dtype=np.float32)
            score = float(np.mean(diff_np))
            scores[str(q)] = round(score, 3)

            # Enhanced contrast difference map
            enhanced = ImageEnhance.Contrast(diff).enhance(3.5)
            diff_maps[str(q)] = _pil_to_base64_data_url(enhanced)
            diff.close()

        # Find estimated original quality (lowest difference dip)
        min_q = min(scores, key=scores.get)

        return {
            "status": "success",
            "quality_curve": scores,
            "estimated_original_quality": int(min_q),
            "ghost_maps": diff_maps,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================================
# 6. RESAMPLING & INTERPOLATION PERIODIC ARTIFACTS
# ============================================================================

def detect_resampling(image_bytes: bytes) -> Dict[str, Any]:
    """
    Detects periodic interpolation / resampling artifacts (upscaling or resizing)
    via 2D Fast Fourier Transform (FFT) magnitude spectrum of high-pass residuals.
    """
    try:
        cv_img = _to_cv2(image_bytes)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY).astype(np.float32)

        # High-pass filter via Gaussian subtraction
        blurred = cv2.GaussianBlur(gray, (5, 5), 1.0)
        high_pass = gray - blurred

        # 2D FFT
        fft = np.fft.fft2(high_pass)
        fft_shift = np.fft.fftshift(fft)
        magnitude = np.abs(fft_shift)

        # Log transform for visualization
        mag_log = np.log1p(magnitude)
        norm_fft = cv2.normalize(mag_log, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        fft_colored = cv2.applyColorMap(norm_fft, cv2.COLORMAP_VIRIDIS)

        # Ring periodicity peak sampling
        h, w = magnitude.shape
        cy, cx = h // 2, w // 2
        threshold = np.percentile(magnitude, 95)
        peak_count = 0
        total_rings = 0

        for r in range(10, min(cy, cx) - 10, 15):
            total_rings += 1
            y_indices, x_indices = np.ogrid[:h, :w]
            dist = np.sqrt((x_indices - cx) ** 2 + (y_indices - cy) ** 2)
            mask = (dist >= r) & (dist < r + 4)
            if np.any(magnitude[mask] > threshold):
                peak_count += 1

        resampling_score = round(peak_count / max(total_rings, 1), 3)
        fft_b64 = _cv2_to_base64_data_url(fft_colored)

        return {
            "status": "success",
            "resampling_score": resampling_score,
            "artifacts_detected": peak_count,
            "is_resampled": resampling_score > 0.45,
            "spectrum_map": fft_b64,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================================
# 7. STEGANOGRAPHY LSB ANALYSIS & CHI-SQUARE TESTING
# ============================================================================

def detect_steganography_lsb(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extracts Least Significant Bit (LSB) planes across R, G, B channels and performs
    Chi-Square randomness testing. In natural images, bit distribution is balanced;
    injected payloads cause observable statistical deviation or string patterns.
    """
    try:
        cv_img = _to_cv2(image_bytes)
        rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)

        r_lsb = (rgb[:, :, 0] & 1).astype(np.uint8)
        g_lsb = (rgb[:, :, 1] & 1).astype(np.uint8)
        b_lsb = (rgb[:, :, 2] & 1).astype(np.uint8)

        # Combine LSBs into an amplified visualization image
        lsb_vis = (np.stack([r_lsb, g_lsb, b_lsb], axis=2) * 255).astype(np.uint8)
        lsb_b64 = _cv2_to_base64_data_url(cv2.cvtColor(lsb_vis, cv2.COLOR_RGB2BGR))

        # Chi-square test on bit distribution
        def _channel_chi2(plane: np.ndarray) -> Tuple[float, float]:
            ones = int(np.sum(plane))
            zeros = int(plane.size - ones)
            expected = plane.size / 2.0
            chi2 = ((ones - expected) ** 2 + (zeros - expected) ** 2) / expected
            # For df=1, p-value = 1 - erf(sqrt(chi2 / 2))
            p_val = 1.0 - math.erf(math.sqrt(chi2 / 2.0))
            return round(chi2, 2), round(p_val, 4)

        r_chi2, r_p = _channel_chi2(r_lsb)
        g_chi2, g_p = _channel_chi2(g_lsb)
        b_chi2, b_p = _channel_chi2(b_lsb)

        # Extract first 512 bytes of raw LSBs from green channel to inspect for ASCII strings/headers
        flat_bits = g_lsb.flatten()[: 512 * 8]
        packed_bytes = np.packbits(flat_bits).tobytes()
        
        extracted_strings = []
        ascii_chars = []
        for b in packed_bytes:
            if 32 <= b <= 126:
                ascii_chars.append(chr(b))
            else:
                if len(ascii_chars) >= 4:
                    extracted_strings.append("".join(ascii_chars))
                ascii_chars = []
        if len(ascii_chars) >= 4:
            extracted_strings.append("".join(ascii_chars))

        is_suspicious = min(r_p, g_p, b_p) < 0.01 or len(extracted_strings) > 0

        return {
            "status": "success",
            "chi_square": {
                "red": {"chi2": r_chi2, "p_value": r_p},
                "green": {"chi2": g_chi2, "p_value": g_p},
                "blue": {"chi2": b_chi2, "p_value": b_p},
            },
            "suspicious_payload": is_suspicious,
            "detected_strings": extracted_strings[:5],
            "lsb_plane_map": lsb_b64,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ============================================================================
# 8. CRYPTOGRAPHIC & PERCEPTUAL HASHING
# ============================================================================

def compute_hashes(image_bytes: bytes) -> Dict[str, Any]:
    """
    Computes exact cryptographic hashes (SHA-256, MD5, SHA-1) and robust perceptual
    hashes (aHash, dHash, pHash) using OpenCV and NumPy.
    """
    try:
        # Cryptographic
        sha256 = hashlib.sha256(image_bytes).hexdigest()
        md5 = hashlib.md5(image_bytes).hexdigest()
        sha1 = hashlib.sha1(image_bytes).hexdigest()

        # Perceptual Hashing using OpenCV
        cv_img = _to_cv2(image_bytes)
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

        # 1. aHash (Average Hash - 8x8)
        resized_8 = cv2.resize(gray, (8, 8), interpolation=cv2.INTER_AREA)
        avg = resized_8.mean()
        ahash_bits = (resized_8 > avg).flatten()
        ahash_hex = "".join(f"{b:02x}" for b in np.packbits(ahash_bits))

        # 2. dHash (Difference Hash - 9x8)
        resized_9x8 = cv2.resize(gray, (9, 8), interpolation=cv2.INTER_AREA)
        dhash_bits = (resized_9x8[:, 1:] > resized_9x8[:, :-1]).flatten()
        dhash_hex = "".join(f"{b:02x}" for b in np.packbits(dhash_bits))

        # 3. pHash (Perceptual DCT Hash - 32x32 -> 8x8 DCT)
        resized_32 = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
        dct_32 = cv2.dct(resized_32)
        dct_low = dct_32[:8, :8]
        # Exclude DC term (0,0) from median calculation
        med = np.median(dct_low.flatten()[1:])
        phash_bits = (dct_low > med).flatten()
        phash_hex = "".join(f"{b:02x}" for b in np.packbits(phash_bits))

        return {
            "status": "success",
            "cryptographic": {
                "sha256": sha256,
                "md5": md5,
                "sha1": sha1,
            },
            "perceptual": {
                "ahash": ahash_hex,
                "dhash": dhash_hex,
                "phash": phash_hex,
            },
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def compute_hamming_distance(hash1_hex: str, hash2_hex: str) -> int:
    """Calculates Hamming bit distance between two perceptual hashes."""
    try:
        b1 = bytes.fromhex(hash1_hex)
        b2 = bytes.fromhex(hash2_hex)
        dist = sum(bin(x ^ y).count("1") for x, y in zip(b1, b2))
        return dist
    except Exception:
        return 999


# ============================================================================
# 9. EXIF & CAMERA FORENSICS
# ============================================================================

def extract_exif_forensics(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extracts camera metadata, exposure parameters, timestamps, GPS coordinates,
    and editing software signatures (Photoshop, GIMP, Canva, etc.).
    """
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        info = pil_img._getexif() or {}

        exif = {}
        for tag, value in info.items():
            decoded = ExifTags.TAGS.get(tag, str(tag))
            if isinstance(value, bytes):
                try:
                    value = value.decode("utf-8", errors="ignore")
                except Exception:
                    value = str(value)
            exif[decoded] = str(value)

        # Check for software editing signatures
        software = exif.get("Software", "")
        editor_detected = False
        editing_tools = ["photoshop", "gimp", "canva", "lightroom", "paint.net", "snapseed", "vsco", "affinity"]
        for tool in editing_tools:
            if tool in software.lower():
                editor_detected = True
                break

        # Check timestamp discrepancy
        dt_original = exif.get("DateTimeOriginal")
        dt_digitized = exif.get("DateTimeDigitized")
        dt_file = exif.get("DateTime")

        timestamp_anomaly = False
        if dt_original and dt_file and dt_original != dt_file:
            timestamp_anomaly = True

        # GPS extraction
        gps_info = {}
        gps_raw = info.get(34853)  # GPSInfo tag ID
        if gps_raw and isinstance(gps_raw, dict):
            for k, v in gps_raw.items():
                decoded_k = ExifTags.GPSTAGS.get(k, str(k))
                gps_info[decoded_k] = str(v)

        return {
            "status": "success",
            "has_exif": len(exif) > 0,
            "camera_make": exif.get("Make"),
            "camera_model": exif.get("Model"),
            "lens_model": exif.get("LensModel"),
            "software": software or None,
            "software_manipulation_suspected": editor_detected,
            "date_time_original": dt_original,
            "date_time_modified": dt_file,
            "timestamp_anomaly": timestamp_anomaly,
            "iso": exif.get("ISOSpeedRatings"),
            "exposure_time": exif.get("ExposureTime"),
            "f_number": exif.get("FNumber"),
            "gps": gps_info if gps_info else None,
            "raw_tags": {k: v for k, v in list(exif.items())[:30]},
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "has_exif": False}


# ============================================================================
# 10. FULL FORENSIC INVESTIGATION ORCHESTRATOR
# ============================================================================

def run_full_forensic_analysis(image_bytes: bytes) -> Dict[str, Any]:
    """
    Orchestrates the entire digital image forensics suite:
    ELA, CMFD Clones, Noise Map, Luminance Gradient, JPEG Ghost, Resampling,
    LSB Steganography, Perceptual Hashes, and EXIF metadata.
    Synthesizes an overall authenticity and tampering verdict.
    """
    ela = perform_ela(image_bytes)
    clones = detect_clones(image_bytes)
    noise = generate_noise_map(image_bytes)
    luminance = analyze_luminance_gradient(image_bytes)
    ghost = detect_jpeg_ghost(image_bytes)
    resampling = detect_resampling(image_bytes)
    stego = detect_steganography_lsb(image_bytes)
    hashes = compute_hashes(image_bytes)
    exif = extract_exif_forensics(image_bytes)

    # Synthesis & Tampering Scoring
    flags = []
    risk_points = 0

    if ela.get("is_suspicious"):
        risk_points += 25
        flags.append("High compression inconsistency detected via Error Level Analysis (ELA).")

    if clones.get("clones_detected"):
        risk_points += 35
        flags.append(f"Copy-Move clone patches detected ({clones.get('matches_count')} matched blocks).")

    if noise.get("suspicious"):
        risk_points += 20
        flags.append("High localized noise inconsistency indicating regional splicing or smoothing.")

    if resampling.get("is_resampled"):
        risk_points += 15
        flags.append(f"Periodic interpolation artifacts detected in 2D FFT spectrum (score: {resampling.get('resampling_score')}).")

    if stego.get("suspicious_payload"):
        risk_points += 20
        flags.append("Statistical bit distribution anomaly or hidden LSB payload detected.")

    if exif.get("software_manipulation_suspected"):
        risk_points += 20
        flags.append(f"Image editor signature recorded in metadata: '{exif.get('software')}'.")

    if exif.get("timestamp_anomaly"):
        risk_points += 10
        flags.append("Timestamp discrepancy between capture date and modification date.")

    # Calculate Verdict
    risk_points = min(risk_points, 100)
    if risk_points >= 60:
        verdict = "HIGH_MANIPULATION_RISK"
        verdict_color = "var(--danger)"
    elif risk_points >= 30:
        verdict = "SUSPICIOUS_ARTIFACTS"
        verdict_color = "#ffaa33"
    else:
        verdict = "AUTHENTIC_APPEARANCE"
        verdict_color = "var(--success)"

    return {
        "status": "success",
        "verdict": verdict,
        "verdict_color": verdict_color,
        "risk_score": risk_points,
        "findings": flags,
        "modules": {
            "ela": ela,
            "clones": clones,
            "noise": noise,
            "luminance": luminance,
            "ghost": ghost,
            "resampling": resampling,
            "steganography": stego,
            "hashes": hashes,
            "exif": exif,
        },
    }
