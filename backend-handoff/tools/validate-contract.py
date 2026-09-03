"""Validate the handoff, not a live service. Requires jsonschema and openapi-spec-validator."""
import json
import sys
import warnings
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)
    from jsonschema import RefResolver
from openapi_spec_validator import validate

root = Path(__file__).resolve().parents[1]
spec = json.loads((root / "openapi.json").read_text(encoding="utf-8"))
validate(spec)
resolver = RefResolver.from_schema(spec)

def validator(name):
    return Draft202012Validator(spec["components"]["schemas"][name], resolver=resolver, format_checker=FormatChecker())

for name, schema in spec["components"]["schemas"].items():
    Draft202012Validator.check_schema(schema)
    for example in schema.get("examples", []):
        validator(name).validate(example)

manifest = json.loads((root / "examples" / "manifest.json").read_text(encoding="utf-8"))
for file, name in manifest.items():
    example = json.loads((root / "examples" / file).read_text(encoding="utf-8"))
    validator(name).validate(example)

valid_job = {"source_upload_id": "upl_a", "brand_id": "brand_a", "target_clip_count": 5}
negative_cases = [
    ("JobSubmit", {"brand_id": "brand_a"}),
    ("JobSubmit", {**valid_job, "url": "https://youtube.com/watch?v=abcdefghijk"}),
    ("JobSubmit", {**valid_job, "target_clip_count": 16}),
    ("JobSubmit", {**valid_job, "user_id": "forged-owner"}),
    ("UploadInit", {"filename": "file.mp4", "content_type": "video/mp4", "size_bytes": 0}),
    ("ClipApproval", {"decision": "approved"}),
    ("UploadPartUrl", {"url": "https://evil.example/upload", "headers": {}, "expires_at": "2026-08-31T08:00:00Z"}),
    ("ScheduleEntryWrite", {"clip_uid": "clip_a", "expected_clip_version": 1, "scheduled_at": "tomorrow", "timezone": "UTC", "privacy_status": "public"}),
]
for name, value in negative_cases:
    if validator(name).is_valid(value):
        sys.exit(f"FAILED: {name} accepted invalid input {value}")

operation_ids = []
for path, methods in spec["paths"].items():
    for method, operation in methods.items():
        operation_ids.append(operation["operationId"])
        if path.startswith("/internal/"):
            assert operation["security"] == [{"GoogleOIDC": []}]
            assert operation["servers"][0]["url"] != spec["servers"][0]["url"]
assert len(set(operation_ids)) == len(operation_ids)
print(f"PASS: OpenAPI 3.1; {len(operation_ids)} HTTP operations; {len(spec['components']['schemas'])} schemas; {len(manifest)} examples; {len(negative_cases)} negative payloads; internal auth separation.")
