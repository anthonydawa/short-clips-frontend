from __future__ import annotations

import time
import uuid
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import (
    analytics,
    auth,
    billing,
    brands,
    clips,
    internal,
    jobs,
    operations,
    pilot,
    publications,
    schedule,
    storage,
    uploads,
    websocket,
    youtube,
)
from .config import settings

app = FastAPI(
    title="Shoort Clips API",
    version="1.0.0",
    description="Scalable Cloud AI Video Clipping and Directing Platform powered by Google AI Studio Gemini.",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_metadata_and_security(request: Request, call_next):
    req_id = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:12]}"
    start_time = time.time()
    
    response: Response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Request-Id"] = req_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    req_id = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:12]}"
    if isinstance(exc.detail, dict):
        body = exc.detail
        if "request_id" not in body:
            body["request_id"] = req_id
        return JSONResponse(status_code=exc.status_code, content=body)
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": str(exc.detail),
            "code": "HTTP_ERROR",
            "request_id": req_id,
            "retryable": exc.status_code >= 500,
        }
    )


# Mount All API Routers
app.include_router(auth.router)
app.include_router(brands.router)
app.include_router(uploads.router)
app.include_router(jobs.router)
app.include_router(clips.router)
app.include_router(analytics.router)
app.include_router(youtube.router)
app.include_router(schedule.router)
app.include_router(publications.router)
app.include_router(billing.router)
app.include_router(storage.router)
app.include_router(operations.router)
app.include_router(pilot.router)
app.include_router(websocket.router)
app.include_router(internal.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=False)
