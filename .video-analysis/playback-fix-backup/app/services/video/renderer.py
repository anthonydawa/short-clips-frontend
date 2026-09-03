from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..ai.transcriber import format_timecode
from .tracker import get_smooth_crop_filter


DEFAULT_CAPTION_STYLE: Dict[str, Any] = {
    "font": "Arial",
    "font_size": 18,
    "primary_color": "&H00FFFFFF",
    "outline_color": "&H00000000",
    "outline": 3,
    "shadow": 0,
    "alignment": 2,
    "margin_v": 35,
    "words_per_chunk": 3,
}

PRESET_STYLES: Dict[str, Dict[str, Any]] = {
    "clean": DEFAULT_CAPTION_STYLE,
    "default": DEFAULT_CAPTION_STYLE,
}


def slugify(text: str, max_len: int = 40) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", text.strip().lower()).strip("_")
    return cleaned[:max_len] or "clip"


def write_vtt_subtitles(words: List[Dict[str, Any]], start_sec: float, end_sec: float, path: Path, words_per_chunk: int = 3) -> Path:
    selected = [
        w for w in words
        if float(w["end"]) > start_sec and float(w["start"]) < end_sec and str(w.get("word", "")).strip()
    ]

    lines = ["WEBVTT", ""]
    seq = 1
    for offset in range(0, len(selected), words_per_chunk):
        group = selected[offset : offset + words_per_chunk]
        local_start = max(0.0, float(group[0]["start"]) - start_sec)
        local_end = min(end_sec - start_sec, float(group[-1]["end"]) - start_sec)
        if local_end <= local_start:
            local_end = local_start + 0.4

        lines.append(str(seq))
        lines.append(f"{format_timecode(local_start, vtt=True)} --> {format_timecode(local_end, vtt=True)}")
        lines.append(" ".join(str(w["word"]).strip() for w in group))
        lines.append("")
        seq += 1

    if len(lines) <= 2:
        lines.extend(["1", "00:00:00.000 --> 00:00:00.500", " ", ""])

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_srt_subtitles(words: List[Dict[str, Any]], start_sec: float, end_sec: float, path: Path, words_per_chunk: int = 3) -> Path:
    selected = [
        w for w in words
        if float(w["end"]) > start_sec and float(w["start"]) < end_sec and str(w.get("word", "")).strip()
    ]

    lines = []
    seq = 1
    for offset in range(0, len(selected), words_per_chunk):
        group = selected[offset : offset + words_per_chunk]
        local_start = max(0.0, float(group[0]["start"]) - start_sec)
        local_end = min(end_sec - start_sec, float(group[-1]["end"]) - start_sec)
        if local_end <= local_start:
            local_end = local_start + 0.4

        text_chunk = " ".join(str(w["word"]).strip() for w in group)
        clean_text = "".join(c for c in text_chunk if ord(c) < 128).strip()

        lines.extend([
            str(seq),
            f"{format_timecode(local_start, srt=True)} --> {format_timecode(local_end, srt=True)}",
            clean_text,
            "",
        ])
        seq += 1

    if not lines:
        lines = ["1", "00:00:00,000 --> 00:00:00,500", " ", ""]

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def build_subtitle_filter(srt_path: Path, preset: str = "clean") -> str:
    config = PRESET_STYLES.get(preset, PRESET_STYLES["clean"])
    escaped = str(srt_path.resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    style = (
        f"FontName={config['font']},"
        f"FontSize={config['font_size']},"
        f"PrimaryColour={config['primary_color']},"
        f"OutlineColour={config['outline_color']},"
        f"BorderStyle=1,"
        f"Outline={config['outline']},"
        f"Shadow={config['shadow']},"
        f"Alignment={config['alignment']},"
        f"MarginV={config['margin_v']},"
        f"Bold=1"
    )
    return f"subtitles='{escaped}':force_style='{style}'"


def render_short_clip(
    media_path: Path,
    words: List[Dict[str, Any]],
    output_dir: Path,
    job_slug: str,
    clip_id: str,
    title: str,
    start_sec: float,
    end_sec: float,
    preset: str = "clean",
    crop_mode: str = "auto_track",
    pad_tail: float = 0.4,
) -> Tuple[Path, Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    title_slug = slugify(title, 40)
    output_mp4 = output_dir / f"{job_slug}__clip_{clip_id}__{title_slug}.mp4"
    output_vtt = output_mp4.with_suffix(".vtt")
    output_srt = output_mp4.with_suffix(".srt")

    config = PRESET_STYLES.get(preset, PRESET_STYLES["clean"])
    padded_end = end_sec + pad_tail
    words_per_chunk = config.get("words_per_chunk", 3)

    write_vtt_subtitles(words, start_sec, padded_end, output_vtt, words_per_chunk=words_per_chunk)
    write_srt_subtitles(words, start_sec, padded_end, output_srt, words_per_chunk=words_per_chunk)

    if output_mp4.exists():
        return output_mp4, output_vtt, output_srt

    target_w, target_h = 1080, 1920
    crop_scale_filter = get_smooth_crop_filter(
        media_path,
        start_sec,
        padded_end,
        target_w,
        target_h,
        crop_mode=crop_mode,
    )

    sub_filter = build_subtitle_filter(output_srt, preset)
    full_vf = f"{crop_scale_filter},{sub_filter}"
    duration = max(0.1, padded_end - start_sec)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-i", str(media_path),
        "-t", str(duration),
        "-vf", full_vf,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(output_mp4),
    ]

    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except Exception as err:
        std_crop = f"crop=ih*9/16:ih:(iw-ow)/2:0,scale={target_w}:{target_h}"
        cmd_fallback = [
            "ffmpeg", "-y",
            "-ss", str(start_sec),
            "-i", str(media_path),
            "-t", str(duration),
            "-vf", f"{std_crop},{sub_filter}",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(output_mp4),
        ]
        subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    return output_mp4, output_vtt, output_srt


def generate_thumbnail(video_path: Path, output_jpg: Path, timestamp_sec: float = 1.0) -> Path:
    output_jpg.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(timestamp_sec),
        "-i", str(video_path),
        "-vframes", "1",
        "-q:v", "2",
        str(output_jpg)
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except Exception:
        # Fallback first frame
        cmd_first = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-vframes", "1",
            "-q:v", "2",
            str(output_jpg)
        ]
        subprocess.run(cmd_first, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    return output_jpg
