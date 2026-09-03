from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import traceback
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from ...config import settings
from ...db import db
from ...models.schemas import ClipAssets, MediaAsset
from ..ai.transcriber import CloudTranscriber
from ..ai.director import GeminiClipDirector
from ..ai.alignment import align_verbatim_text, extract_transcript_words, parse_timestamp_str
from ..ai.captions import generate_social_caption
from ..storage_service import storage_service
from .renderer import generate_thumbnail, render_short_clip


active_ws_connections: Dict[str, List[Any]] = {}


async def broadcast_progress(video_id: str, stage: str, progress: int, message: str, status: str = "processing", generated_clip_count: int = 0, requested_clip_count: int = 5) -> None:
    job = db.get_job_record(video_id)
    if job:
        db.update_job(video_id, stage=stage, progress=progress, message=message, status=status, generated_clip_count=generated_clip_count)
        db.append_job_event(video_id, {
            "user_id": job["user_id"],
            "stage": stage,
            "progress": progress,
            "message": message,
            "status": status,
            "requested_clip_count": requested_clip_count,
            "generated_clip_count": generated_clip_count
        })

    event = {
        "event_id": 1,
        "video_id": video_id,
        "stage": stage,
        "progress": progress,
        "message": message,
        "status": status,
        "generated_clip_count": generated_clip_count,
        "requested_clip_count": requested_clip_count
    }
    
    ws_list = active_ws_connections.get(video_id, [])
    for ws in list(ws_list):
        try:
            await ws.send_text(json.dumps(event))
        except Exception:
            try:
                ws_list.remove(ws)
            except Exception:
                pass


async def run_video_pipeline(video_id: str, attempt_token: Optional[str] = None) -> None:
    job = db.get_job_record(video_id)
    if not job:
        return

    user_id = job["user_id"]
    brand_id = job["brand_id"]
    job_slug = job["job_slug"]
    target_clip_count = int(job.get("requested_clip_count") or 5)
    settings_dict = job.get("settings") or {}
    subtitle_preset = str(settings_dict.get("subtitle_preset", "clean"))
    custom_instructions = settings_dict.get("custom_instructions")
    pacing_mode = str(settings_dict.get("pacing_mode", "snappy"))

    brand = db.get_brand(user_id, brand_id)
    brand_profile = brand.model_dump() if brand else None

    job_dir = settings.JOBS_DIR / job_slug
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Stage 1: INGESTION
        await broadcast_progress(video_id, "INGESTION", 10, "Locating and verifying video source media...")
        db.update_job(video_id, status="processing", stage="INGESTION")

        source_media = job_dir / "source.mp4"
        if not source_media.exists():
            # If upload session exists, check R2 or local storage
            if job.get("source_upload_id"):
                upload_sess = db.get_upload_session(user_id, job["source_upload_id"])
                if upload_sess:
                    local_staged = Path("workspace/uploads") / upload_sess["upload_id"] / "source.mp4"
                    if local_staged.exists():
                        shutil.copy2(local_staged, source_media)
                    elif storage_service.is_configured() and upload_sess.get("r2_key"):
                        storage_service.client.download_file(
                            Bucket=storage_service.bucket,
                            Key=upload_sess["r2_key"],
                            Filename=str(source_media)
                        )

        if not source_media.exists():
            # Check inputs or workspace test files
            sample_candidates = list(Path("inputs").glob("*.mp4")) + list(Path("data").glob("*.mp4"))
            if sample_candidates:
                shutil.copy2(sample_candidates[0], source_media)

        if not source_media.exists():
            # Generate 30s synthetic test video if missing
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=duration=35:size=1920x1080:rate=30",
                "-f", "lavfi", "-i", "sine=frequency=1000:duration=35",
                "-c:v", "libx264", "-c:a", "aac", str(source_media)
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

        await broadcast_progress(video_id, "EXTRACTING_AUDIO", 25, "Extracting audio track for transcription...")
        db.update_job(video_id, stage="EXTRACTING_AUDIO", progress=25)

        # Stage 2: TRANSCRIBING
        await broadcast_progress(video_id, "TRANSCRIBING", 35, "Transcribing speech with Google AI Studio Gemini...")
        db.update_job(video_id, stage="TRANSCRIBING", progress=35)

        transcriber = CloudTranscriber()
        transcript_dir = job_dir / "transcript"
        transcript_json_path = transcript_dir / f"{job_slug}_full_data.json"
        if not transcript_json_path.exists():
            transcript_json_path = await asyncio.to_thread(
                transcriber.transcribe,
                source_media,
                transcript_dir,
                job_slug
            )

        # Stage 3: DIRECTING_CLIPS
        await broadcast_progress(video_id, "DIRECTING_CLIPS", 60, "AI Clip Director selecting viral moments and payoffs...")
        db.update_job(video_id, stage="DIRECTING_CLIPS", progress=60)

        ts_file = transcript_dir / f"{job_slug}_transcript_with_timestamps.txt"
        transcript_text = ts_file.read_text(encoding="utf-8") if ts_file.exists() else ""
        transcript_words_list = extract_transcript_words(transcript_json_path)

        # Parse optional time range constraints
        start_sec_val = parse_timestamp_str(str(job.get("start_time") or job.get("settings", {}).get("start_time") or ""))
        if start_sec_val is None and (job.get("start_seconds") is not None or job.get("settings", {}).get("start_seconds") is not None):
            raw_s = job.get("start_seconds") if job.get("start_seconds") is not None else job.get("settings", {}).get("start_seconds")
            try:
                start_sec_val = float(raw_s)
            except Exception:
                pass

        end_sec_val = parse_timestamp_str(str(job.get("end_time") or job.get("settings", {}).get("end_time") or ""))
        if end_sec_val is None and (job.get("end_seconds") is not None or job.get("settings", {}).get("end_seconds") is not None):
            raw_e = job.get("end_seconds") if job.get("end_seconds") is not None else job.get("settings", {}).get("end_seconds")
            try:
                end_sec_val = float(raw_e)
            except Exception:
                pass

        # If time range is given, filter transcript text and words list
        if (start_sec_val is not None or end_sec_val is not None) and transcript_text:
            filtered_lines = []
            for line in transcript_text.splitlines():
                m = re.search(r"\[([\d:.]+)\s*-->\s*([\d:.]+)\]", line)
                if m:
                    line_s = parse_timestamp_str(m.group(1))
                    line_e = parse_timestamp_str(m.group(2))
                    if line_s is not None and line_e is not None:
                        if start_sec_val is not None and line_e < start_sec_val:
                            continue
                        if end_sec_val is not None and line_s > end_sec_val:
                            continue
                filtered_lines.append(line)
            if filtered_lines:
                transcript_text = "\n".join(filtered_lines)

        director = GeminiClipDirector()
        raw_clips = await asyncio.to_thread(
            director.direct_clips,
            transcript_text=transcript_text,
            video_title=job.get("source_title") or "Shoort Clips Video",
            target_clip_count=target_clip_count,
            brand_profile=brand_profile,
            custom_instructions=custom_instructions,
            pacing_mode=pacing_mode,
            time_range_start=start_sec_val,
            time_range_end=end_sec_val,
        )

        aligned_clips = []
        for raw_c in raw_clips:
            start_sec, end_sec, caption_words = align_verbatim_text(
                transcript_words_list,
                raw_c["clip_text"],
                start_hint=raw_c.get("start_time"),
                end_hint=raw_c.get("end_time")
            )
            aligned_clips.append({
                "clip_id": raw_c["clip_id"],
                "title": raw_c["title"],
                "virality_score": raw_c["virality_score"],
                "hook_rating": raw_c["hook_rating"],
                "caption": raw_c["caption"],
                "start_seconds": start_sec,
                "end_seconds": end_sec,
                "duration_seconds": round(end_sec - start_sec, 2),
                "caption_words": caption_words,
            })

        # Stage 4: RENDERING_CLIPS
        clips_dir = job_dir / "clips"
        total_clips = len(aligned_clips)
        rendered_count = 0

        for idx, clip in enumerate(aligned_clips, start=1):
            clip_id = clip["clip_id"]
            progress_pct = 60 + int((idx / total_clips) * 30)

            await broadcast_progress(
                video_id,
                "RENDERING_CLIPS",
                progress_pct,
                f"Rendering 9:16 vertical video & captions for clip {idx}/{total_clips}...",
                generated_clip_count=rendered_count,
                requested_clip_count=target_clip_count
            )

            out_mp4, out_vtt, out_srt = await asyncio.to_thread(
                render_short_clip,
                media_path=source_media,
                words=transcript_words_list,
                output_dir=clips_dir,
                job_slug=job_slug,
                clip_id=clip_id,
                title=clip["title"],
                start_sec=clip["start_seconds"],
                end_sec=clip["end_seconds"],
                preset=subtitle_preset,
                crop_mode="auto_track"
            )

            thumb_jpg = out_mp4.with_suffix(".jpg")
            await asyncio.to_thread(generate_thumbnail, out_mp4, thumb_jpg, 1.0)

            # R2 keys
            mp4_key = f"users/{user_id}/jobs/{video_id}/clips/{clip_id}/r1/video.mp4"
            thumb_key = f"users/{user_id}/jobs/{video_id}/clips/{clip_id}/r1/thumbnail.jpg"
            vtt_key = f"users/{user_id}/jobs/{video_id}/clips/{clip_id}/r1/captions.vtt"

            storage_service.upload_local_file(out_mp4, mp4_key, "video/mp4")
            storage_service.upload_local_file(thumb_jpg, thumb_key, "image/jpeg")
            storage_service.upload_local_file(out_vtt, vtt_key, "text/vtt")

            clip_uid = f"{video_id}:{clip_id}"
            db.upsert_clip({
                "clip_uid": clip_uid,
                "clip_id": clip_id,
                "video_id": video_id,
                "user_id": user_id,
                "brand_id": brand_id,
                "job_slug": job_slug,
                "generated_title": clip["title"],
                "title": clip["title"],
                "virality_score": int(clip.get("virality_score", 90)),
                "start_seconds": clip["start_seconds"],
                "end_seconds": clip["end_seconds"],
                "duration_seconds": clip["duration_seconds"],
                "caption": clip.get("caption") or f"{clip['title']} #Shorts",
                "hashtags": "#Shorts #Viral",
                "r2_video_key": mp4_key,
                "r2_thumbnail_key": thumb_key,
                "r2_subtitles_key": vtt_key,
                "r2_download_key": mp4_key,
                "status": "ready"
            })
            rendered_count += 1

        final_status = "completed" if rendered_count == target_clip_count else ("partial" if rendered_count > 0 else "failed")
        db.update_job(video_id, status=final_status, stage="COMPLETED", progress=100, generated_clip_count=rendered_count, completed_at=db.now_iso())
        
        await broadcast_progress(
            video_id,
            "COMPLETED",
            100,
            f"Successfully generated {rendered_count} of {target_clip_count} clips.",
            status=final_status,
            generated_clip_count=rendered_count,
            requested_clip_count=target_clip_count
        )

    except Exception as exc:
        err_msg = f"{type(exc).__name__}: {exc}"
        print(f"[Worker Error] {err_msg}\n{traceback.format_exc()}")
        db.update_job(video_id, status="failed", stage="FAILED", error=str(exc))
        await broadcast_progress(video_id, "FAILED", 0, f"Processing failed: {exc}", status="failed")
