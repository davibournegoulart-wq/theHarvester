from io import BytesIO

import pytest
from PIL import Image
from PIL.ExifTags import Base

from app.checkers.image_exif import extract_exif


def _jpeg_with_gps() -> bytes:
    img = Image.new("RGB", (10, 10), color="red")
    exif = img.getexif()
    exif[Base.Make.value] = "TestCam"
    exif[Base.Model.value] = "TestModel X"
    exif[Base.DateTime.value] = "2026:01:01 12:00:00"
    exif[Base.GPSInfo.value] = {1: "N", 2: (23.0, 33.0, 12.0), 3: "W", 4: (46.0, 38.0, 5.0)}
    buf = BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def _png_without_exif() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (10, 10), color="blue").save(buf, format="PNG")
    return buf.getvalue()


def test_extracts_gps_and_camera_info():
    result = extract_exif(_jpeg_with_gps())

    assert result.has_gps is True
    assert result.latitude == pytest.approx(23.5533, abs=0.001)
    assert result.longitude == pytest.approx(-46.6347, abs=0.001)
    assert result.maps_url == f"https://www.google.com/maps?q={result.latitude},{result.longitude}"
    assert result.camera_make == "TestCam"
    assert result.camera_model == "TestModel X"


def test_returns_no_gps_when_exif_is_absent():
    result = extract_exif(_png_without_exif())

    assert result.has_gps is False
    assert result.latitude is None
    assert result.maps_url is None
