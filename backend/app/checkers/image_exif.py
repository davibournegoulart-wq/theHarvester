"""Extração de metadado EXIF de imagem — GPS, data, modelo de câmera.

Puramente leitura de metadado do próprio arquivo enviado (biblioteca
Pillow, padrão), sem terceiro nenhum envolvido — não é reconhecimento
facial nem busca de "quem é essa pessoa", só o que a câmera/celular já
gravou no arquivo na hora da foto.

⚠️ A maioria das redes sociais REMOVE o EXIF ao processar upload (é
mecanismo de privacidade delas, não falha nossa) — só funciona com o
arquivo original (enviado direto por WhatsApp/e-mail sem compressão
agressiva, anexo, ou baixado de site que não reprocessa a imagem). Foto
baixada do feed do Instagram/Facebook praticamente nunca tem GPS.
"""

from dataclasses import dataclass
from io import BytesIO

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS

_GPS_IFD_TAG = 0x8825


@dataclass
class ImageExifResult:
    has_gps: bool
    latitude: float | None = None
    longitude: float | None = None
    maps_url: str | None = None
    taken_at: str | None = None
    camera_make: str | None = None
    camera_model: str | None = None
    discovered_by: str = "checkers.image_exif"


def _dms_to_decimal(dms, ref: str) -> float:
    degrees, minutes, seconds = (float(v) for v in dms)
    decimal = degrees + minutes / 60 + seconds / 3600
    return -decimal if ref in ("S", "W") else decimal


def extract_exif(image_bytes: bytes) -> ImageExifResult:
    image = Image.open(BytesIO(image_bytes))
    exif = image.getexif()
    if not exif:
        return ImageExifResult(has_gps=False)

    tags = {TAGS.get(tag_id, tag_id): value for tag_id, value in exif.items()}

    latitude = longitude = None
    gps_info = exif.get_ifd(_GPS_IFD_TAG)
    if gps_info:
        gps_tags = {GPSTAGS.get(tag_id, tag_id): value for tag_id, value in gps_info.items()}
        if "GPSLatitude" in gps_tags and "GPSLongitude" in gps_tags:
            latitude = _dms_to_decimal(gps_tags["GPSLatitude"], gps_tags.get("GPSLatitudeRef", "N"))
            longitude = _dms_to_decimal(gps_tags["GPSLongitude"], gps_tags.get("GPSLongitudeRef", "E"))

    return ImageExifResult(
        has_gps=latitude is not None,
        latitude=latitude,
        longitude=longitude,
        maps_url=f"https://www.google.com/maps?q={latitude},{longitude}" if latitude is not None else None,
        taken_at=tags.get("DateTime"),
        camera_make=tags.get("Make"),
        camera_model=tags.get("Model"),
    )
