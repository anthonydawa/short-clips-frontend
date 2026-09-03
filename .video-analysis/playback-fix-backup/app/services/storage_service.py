from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from ..config import settings


class StorageService:
    def __init__(self):
        self.bucket = settings.R2_BUCKET_NAME
        self.endpoint_url = settings.R2_ENDPOINT_URL
        self.access_key = settings.R2_ACCESS_KEY_ID
        self.secret_key = settings.R2_SECRET_ACCESS_KEY
        self.part_size = settings.R2_PART_SIZE_BYTES
        self._s3_client = None

    @property
    def client(self):
        if self._s3_client is None and self.endpoint_url and self.access_key and self.secret_key:
            self._s3_client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name="auto",
                config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
            )
        return self._s3_client

    def is_configured(self) -> bool:
        if not (self.endpoint_url and self.access_key and self.secret_key and self.bucket):
            return False
        if "your_" in str(self.endpoint_url) or "your_" in str(self.access_key):
            return False
        return True

    def initialize_multipart_upload(self, r2_key: str, content_type: str) -> str:
        if not self.is_configured():
            return f"mock_mp_{hashlib.md5(r2_key.encode()).hexdigest()}"
        try:
            res = self.client.create_multipart_upload(
                Bucket=self.bucket,
                Key=r2_key,
                ContentType=content_type
            )
            return res["UploadId"]
        except Exception as e:
            print(f"[StorageService] Failed to init multipart upload: {e}")
            return f"mock_mp_{hashlib.md5(r2_key.encode()).hexdigest()}"

    def generate_presigned_part_url(
        self,
        r2_key: str,
        upload_id: str,
        part_number: int,
        ttl_seconds: int = 3600
    ) -> str:
        if not self.is_configured():
            return f"https://mock-r2.invalid/{self.bucket}/{r2_key}?uploadId={upload_id}&partNumber={part_number}"
        try:
            return self.client.generate_presigned_url(
                ClientMethod="upload_part",
                Params={
                    "Bucket": self.bucket,
                    "Key": r2_key,
                    "UploadId": upload_id,
                    "PartNumber": part_number,
                },
                ExpiresIn=ttl_seconds,
                HttpMethod="PUT"
            )
        except Exception as e:
            print(f"[StorageService] Presigned part URL error: {e}")
            return f"https://mock-r2.invalid/{self.bucket}/{r2_key}?uploadId={upload_id}&partNumber={part_number}"

    def complete_multipart_upload(
        self,
        r2_key: str,
        upload_id: str,
        parts: List[Dict[str, Any]]
    ) -> bool:
        if not self.is_configured():
            return True
        try:
            s3_parts = [{"PartNumber": p["part_number"], "ETag": p["etag"]} for p in sorted(parts, key=lambda x: x["part_number"])]
            self.client.complete_multipart_upload(
                Bucket=self.bucket,
                Key=r2_key,
                UploadId=upload_id,
                MultipartUpload={"Parts": s3_parts}
            )
            return True
        except Exception as e:
            print(f"[StorageService] Complete multipart error: {e}")
            return False

    def abort_multipart_upload(self, r2_key: str, upload_id: str) -> bool:
        if not self.is_configured():
            return True
        try:
            self.client.abort_multipart_upload(
                Bucket=self.bucket,
                Key=r2_key,
                UploadId=upload_id
            )
            return True
        except Exception as e:
            print(f"[StorageService] Abort multipart error: {e}")
            return False

    def generate_presigned_read_url(
        self,
        r2_key: str,
        content_type: str = "video/mp4",
        download_filename: Optional[str] = None,
        ttl_seconds: int = 7200
    ) -> str:
        if not self.is_configured():
            return f"https://media.staging.shoortclips.com/{r2_key}"
        try:
            params = {
                "Bucket": self.bucket,
                "Key": r2_key,
                "ResponseContentType": content_type,
            }
            if download_filename:
                safe_name = download_filename.replace('"', '').replace("'", "")
                params["ResponseContentDisposition"] = f'attachment; filename="{safe_name}"'
            return self.client.generate_presigned_url(
                ClientMethod="get_object",
                Params=params,
                ExpiresIn=ttl_seconds
            )
        except Exception as e:
            print(f"[StorageService] Presigned read URL error: {e}")
            return f"https://media.staging.shoortclips.com/{r2_key}"

    def upload_local_file(self, local_path: Path, r2_key: str, content_type: str = "video/mp4") -> str:
        if not self.is_configured():
            return f"https://media.staging.shoortclips.com/{r2_key}"
        try:
            with open(local_path, "rb") as f:
                self.client.put_object(
                    Bucket=self.bucket,
                    Key=r2_key,
                    Body=f,
                    ContentType=content_type
                )
            return self.generate_presigned_read_url(r2_key, content_type)
        except Exception as e:
            print(f"[StorageService] Upload error for {r2_key}: {e}")
            return f"https://media.staging.shoortclips.com/{r2_key}"


storage_service = StorageService()
