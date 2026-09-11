"""LinkdTime Engine — LinkedIn Activity Timestamp Decoder & Timeline Generator.

Adapted from Luca Garofalo (Lucksi/LinkdTime).
Decompiles LinkedIn snowflake 64-bit integer IDs (posts, ugcPosts, shares, comments, media images)
extracting the embedded 41-bit millisecond epoch timestamp with microsecond accuracy.
Includes chronological timeline reconstruction and active-hour pattern analysis.
"""

import re
import datetime
from typing import Dict, Any, List, Optional


def decode_snowflake_id(snowflake_id: int | str, timezone_offset_hours: float = 0.0) -> Dict[str, Any]:
    """Decompiles a 64-bit LinkedIn snowflake ID into an exact UTC timestamp."""
    try:
        numeric_id = int(str(snowflake_id).strip())
    except (ValueError, TypeError):
        return {"error": f"Invalid integer ID: {snowflake_id}"}

    binary_str = bin(numeric_id).replace("0b", "")
    if len(binary_str) < 41:
        return {"error": f"Snowflake ID too short ({len(binary_str)} bits) to contain 41-bit timestamp"}

    timestamp_bits = binary_str[:41]
    epoch_ms = int(timestamp_bits, 2)

    epoch_sec = epoch_ms / 1000.0
    if epoch_sec < 1041379200 or epoch_sec > 2051222400:
        return {
            "error": "Extracted timestamp is outside LinkedIn validity bounds (2003-2035)",
            "raw_epoch_ms": epoch_ms,
        }

    dt_utc = datetime.datetime.fromtimestamp(epoch_sec, tz=datetime.timezone.utc)
    
    tz_delta = datetime.timedelta(hours=timezone_offset_hours)
    target_tz = datetime.timezone(tz_delta)
    dt_local = dt_utc.astimezone(target_tz)

    tz_sign = "+" if timezone_offset_hours >= 0 else "-"
    tz_abs_h = int(abs(timezone_offset_hours))
    tz_min = int((abs(timezone_offset_hours) - tz_abs_h) * 60)
    tz_label = f"GMT{tz_sign}{tz_abs_h:02d}:{tz_min:02d}"

    weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    return {
        "id": str(numeric_id),
        "epoch_ms": epoch_ms,
        "utc_iso": dt_utc.isoformat(),
        "utc_formatted": dt_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "local_formatted": dt_local.strftime("%Y-%m-%d %H:%M:%S"),
        "local_12h": dt_local.strftime("%Y-%m-%d %I:%M:%S %p"),
        "timezone_label": tz_label,
        "day_of_week": weekday_names[dt_local.weekday()],
        "hour_of_day": dt_local.hour,
        "is_weekend": dt_local.weekday() >= 5,
        "binary_snowflake": binary_str,
        "timestamp_bits": timestamp_bits,
    }


def parse_linkedin_url(input_string: str, timezone_offset_hours: float = 0.0) -> Dict[str, Any]:
    """Parses a LinkedIn post, comment, share, or direct snowflake URL/string."""
    cleaned = input_string.strip()

    if re.match(r"^[0-9]{16,22}$", cleaned):
        decoded = decode_snowflake_id(cleaned, timezone_offset_hours)
        if "error" in decoded:
            return decoded
        decoded["activity_type"] = "Snowflake ID"
        decoded["source_url"] = cleaned
        return decoded

    act_match = re.search(r"activity[-:]([0-9]{16,22})", cleaned)
    ugc_match = re.search(r"ugcPost[-:]([0-9]{16,22})", cleaned)
    share_match = re.search(r"share[-:]([0-9]{16,22})", cleaned)
    comment_match = re.search(r"comment%3A%28[^%]+%2C([0-9]{16,22})\)", cleaned) or re.search(r"comment:\([^,]+,([0-9]{16,22})\)", cleaned)
    fsd_comment_match = re.search(r"fsd_comment%3A%28([0-9]{16,22})", cleaned)
    image_match = "/dms/image/" in cleaned

    target_id = None
    act_type = "LinkedIn Activity"

    if act_match:
        target_id = act_match.group(1)
        act_type = "Post (Activity)"
    elif ugc_match:
        target_id = ugc_match.group(1)
        act_type = "UGC Post"
    elif share_match:
        target_id = share_match.group(1)
        act_type = "Shared Post"
    elif comment_match:
        target_id = comment_match.group(1)
        act_type = "Comment / Reply"
    elif fsd_comment_match:
        target_id = fsd_comment_match.group(1)
        act_type = "Comment"
    elif image_match:
        e_match = re.search(r"[?&]e=([0-9]{10})", cleaned)
        if e_match:
            exp_epoch = int(e_match.group(1))
            dt_exp = datetime.datetime.fromtimestamp(exp_epoch, tz=datetime.timezone.utc)
            return {
                "source_url": cleaned,
                "activity_type": "Media Image (CDN Expiration Marker)",
                "epoch_ms": exp_epoch * 1000,
                "utc_iso": dt_exp.isoformat(),
                "utc_formatted": dt_exp.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "local_formatted": dt_exp.strftime("%Y-%m-%d %H:%M:%S"),
                "timezone_label": f"GMT+{timezone_offset_hours:02.0f}:00",
                "notes": "CDN image token expiration timestamp (usually 7-30 days after generation).",
            }

    if not target_id:
        fallback = re.search(r"([0-9]{18,20})", cleaned)
        if fallback:
            target_id = fallback.group(1)
            act_type = "Detected URN Numeric ID"

    if not target_id:
        return {"error": "Could not identify a valid LinkedIn activity or snowflake ID from input."}

    decoded = decode_snowflake_id(target_id, timezone_offset_hours)
    if "error" in decoded:
        return decoded

    author = "Unknown"
    author_match = re.search(r"linkedin\.com/posts/([a-zA-Z0-9_-]+)", cleaned)
    if author_match:
        author = author_match.group(1).split("_")[0]
    elif "in/" in cleaned:
        author_m2 = re.search(r"linkedin\.com/in/([a-zA-Z0-9_-]+)", cleaned)
        if author_m2:
            author = author_m2.group(1)

    decoded["activity_type"] = act_type
    decoded["source_url"] = cleaned
    decoded["author_handle"] = author
    return decoded


def build_linkedin_timeline(
    raw_inputs: List[str],
    timezone_offset_hours: float = 0.0,
) -> Dict[str, Any]:
    """Generates a structured chronological timeline from a batch of LinkedIn links/IDs."""
    items = []
    errors = []

    for entry in raw_inputs:
        line = entry.strip()
        if not line or line.startswith("#"):
            continue
        parsed = parse_linkedin_url(line, timezone_offset_hours)
        if "error" in parsed:
            errors.append({"input": line, "error": parsed["error"]})
        else:
            items.append(parsed)

    items.sort(key=lambda x: x.get("epoch_ms", 0))

    for i in range(len(items)):
        if i == 0:
            items[i]["delta_from_previous"] = "Initial Reference Event"
            items[i]["delta_seconds"] = 0
        else:
            prev_ms = items[i - 1].get("epoch_ms", 0)
            curr_ms = items[i].get("epoch_ms", 0)
            diff_sec = max(0, int((curr_ms - prev_ms) / 1000))
            items[i]["delta_seconds"] = diff_sec
            
            if diff_sec < 60:
                items[i]["delta_from_previous"] = f"+{diff_sec}s"
            elif diff_sec < 3600:
                mins = diff_sec // 60
                items[i]["delta_from_previous"] = f"+{mins}m"
            elif diff_sec < 86400:
                hours = diff_sec // 3600
                rem_mins = (diff_sec % 3600) // 60
                items[i]["delta_from_previous"] = f"+{hours}h {rem_mins}m"
            else:
                days = diff_sec // 86400
                rem_hours = (diff_sec % 86400) // 3600
                items[i]["delta_from_previous"] = f"+{days}d {rem_hours}h"

    hour_distribution = {h: 0 for h in range(24)}
    day_distribution = {"Monday": 0, "Tuesday": 0, "Wednesday": 0, "Thursday": 0, "Friday": 0, "Saturday": 0, "Sunday": 0}
    weekend_count = 0
    weekday_count = 0

    for it in items:
        h = it.get("hour_of_day")
        if h is not None and h in hour_distribution:
            hour_distribution[h] += 1
        d = it.get("day_of_week")
        if d in day_distribution:
            day_distribution[d] += 1
        if it.get("is_weekend"):
            weekend_count += 1
        else:
            weekday_count += 1

    peak_hour = max(hour_distribution, key=hour_distribution.get) if items else None
    peak_count = hour_distribution[peak_hour] if peak_hour is not None else 0

    return {
        "total_parsed": len(items),
        "total_errors": len(errors),
        "timezone_offset": timezone_offset_hours,
        "items": items,
        "errors": errors,
        "pattern_analysis": {
            "peak_hour_local": peak_hour,
            "peak_hour_count": peak_count,
            "hour_distribution": hour_distribution,
            "day_distribution": day_distribution,
            "weekday_count": weekday_count,
            "weekend_count": weekend_count,
            "weekend_ratio_percent": round((weekend_count / len(items) * 100), 1) if items else 0,
        },
    }
