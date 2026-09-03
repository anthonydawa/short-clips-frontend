from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from ..config import settings
from ..db import db
from ..models.schemas import Brand, Clip, Job, JobDetail, JobList, JobSubmit, Ticket
from ..security.auth import get_current_user, require_active_user
from ..services.storage_service import storage_service
from ..services.video.pipeline_worker import run_video_pipeline

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

def _hydrate_clip_assets(clip_dict: dict) -> Clip:
    from ..models.schemas import ClipAssets, MediaAsset
    now_exp = (datetime.now(timezone.utc) + timedelta(seconds=7200)).isoformat()
    
    video_url = storage_service.generate_presigned_read_url(clip_dict.get("r2_video_key") or "media.mp4", "video/mp4")
    thumb_url = storage_service.generate_presigned_read_url(clip_dict.get("r2_thumbnail_key") or "thumb.jpg", "image/jpeg")
    vtt_url = storage_service.generate_presigned_read_url(clip_dict.get("r2_subtitles_key") or "subs.vtt", "text/vtt")
    down_url = storage_service.generate_presigned_read_url(clip_dict.get("r2_download_key") or "media.mp4", "video/mp4", download_filename=f"{clip_dict['generated_title']}.mp4")

    assets = ClipAssets(
        video=MediaAsset(url=video_url, expires_at=now_exp, content_type="video/mp4"),
        thumbnail=MediaAsset(url=thumb_url, expires_at=now_exp, content_type="image/jpeg"),
        subtitles=MediaAsset(url=vtt_url, expires_at=now_exp, content_type="text/vtt"),
        download=MediaAsset(url=down_url, expires_at=now_exp, content_type="video/mp4")
    )
    d = dict(clip_dict)
    d["assets"] = assets
    return Clip(**d)

@router.post("/submit", response_model=Job, status_code=status.HTTP_202_ACCEPTED, operation_id="submit_job")
async def submit_job(payload: JobSubmit, background_tasks: BackgroundTasks, user_id: str = Depends(require_active_user)):
    if not payload.source_upload_id and not payload.url:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"detail": "Either source_upload_id or url is required", "code": "SOURCE_REQUIRED", "request_id": "req_src_missing", "retryable": False})

    brand = db.get_brand(user_id, payload.brand_id)
    if not brand:
        brand = db.upsert_brand(Brand(
            brand_id=payload.brand_id,
            user_id=user_id,
            brand_name="Reverence Media",
            channel_url="",
            niche="General",
            tone_of_voice="Engaging",
            target_audience="General audience",
            is_default=True,
            created_at=datetime.now(timezone.utc).isoformat(),
            updated_at=datetime.now(timezone.utc).isoformat()
        ))

    video_id = f"job_{uuid.uuid4().hex[:12]}"
    job_slug = f"video_{uuid.uuid4().hex[:8]}"

    job_data = {
        "video_id": video_id,
        "user_id": user_id,
        "job_slug": job_slug,
        "brand_id": payload.brand_id,
        "source_upload_id": payload.source_upload_id,
        "source_url": payload.url,
        "status": "queued",
        "stage": "INGESTION",
        "progress": 0,
        "message": "Job queued for processing",
        "requested_clip_count": payload.target_clip_count,
        "generated_clip_count": 0,
        "source_type": "upload" if payload.source_upload_id else "youtube",
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "start_seconds": payload.start_seconds,
        "end_seconds": payload.end_seconds,
        "settings": {
            "subtitle_preset": payload.subtitle_preset,
            "custom_instructions": payload.custom_instructions,
            "start_time": payload.start_time,
            "end_time": payload.end_time,
            "start_seconds": payload.start_seconds,
            "end_seconds": payload.end_seconds,
        }
    }
    
    created_job = db.create_job(job_data)
    background_tasks.add_task(run_video_pipeline, video_id)
    return created_job

@router.get("", response_model=JobList, operation_id="list_jobs")
async def list_jobs(limit: int = Query(50, ge=1, le=100), cursor: Optional[str] = None, user_id: str = Depends(get_current_user)):
    jobs = db.list_jobs(user_id, limit=limit, cursor=cursor)
    next_cur = jobs[-1].created_at if len(jobs) == limit else None
    return JobList(jobs=jobs, next_cursor=next_cur)

@router.get("/{video_id}", response_model=JobDetail, operation_id="get_job")
async def get_job(video_id: str, user_id: str = Depends(get_current_user)):
    job = db.get_job(user_id, video_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"detail": "Job not found", "code": "NOT_FOUND", "request_id": "req_job_nf", "retryable": False})
    
    raw_clips = db.get_job_clips(user_id, video_id)
    hydrated_clips = [_hydrate_clip_assets(c) for c in raw_clips]
    return JobDetail(job=job, clips=hydrated_clips)

@router.delete("/{video_id}", operation_id="delete_job")
async def delete_job(video_id: str, user_id: str = Depends(get_current_user)):
    job = db.get_job(user_id, video_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"detail": "Job not found", "code": "NOT_FOUND", "request_id": "req_job_nf", "retryable": False})
    
    db.update_job(video_id, status="cancelled")
    return {"deleted": True, "video_id": video_id}

@router.get("/{video_id}/clips", response_model=List[Clip], operation_id="list_job_clips")
async def list_job_clips(video_id: str, user_id: str = Depends(get_current_user)):
    raw_clips = db.get_job_clips(user_id, video_id)
    return [_hydrate_clip_assets(c) for c in raw_clips]

@router.post("/{video_id}/retry", response_model=Job, operation_id="retry_job")
async def retry_job(video_id: str, background_tasks: BackgroundTasks, user_id: str = Depends(require_active_user)):
    job = db.get_job(user_id, video_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"detail": "Job not found", "code": "NOT_FOUND", "request_id": "req_job_nf", "retryable": False})

    db.update_job(video_id, status="queued", stage="INGESTION", progress=0, message="Retrying job...")
    background_tasks.add_task(run_video_pipeline, video_id)
    return db.get_job(user_id, video_id) # type: ignore

@router.post("/{video_id}/cancel", response_model=Job, operation_id="cancel_job")
async def cancel_job(video_id: str, user_id: str = Depends(get_current_user)):
    job = db.get_job(user_id, video_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"detail": "Job not found", "code": "NOT_FOUND", "request_id": "req_job_nf", "retryable": False})
    
    db.update_job(video_id, status="cancelled", stage="CANCELLED", message="Job cancelled by user")
    return db.get_job(user_id, video_id) # type: ignore

@router.post("/{video_id}/events-ticket", response_model=Ticket, operation_id="issue_events_ticket")
async def issue_events_ticket(video_id: str, user_id: str = Depends(get_current_user)):
    job = db.get_job(user_id, video_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"detail": "Job not found", "code": "NOT_FOUND", "request_id": "req_job_nf", "retryable": False})
    
    ticket = f"tkt_{uuid.uuid4().hex}"
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat()
    db.store_ticket(ticket, user_id, video_id, expires_at)
    
    ws_url = f"wss://api.staging.shoortclips.com/api/v1/ws/jobs/{video_id}"
    return Ticket(ticket=ticket, expires_at=expires_at, websocket_url=ws_url)
